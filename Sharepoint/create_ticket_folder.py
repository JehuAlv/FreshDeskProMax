import os
import sys
import json
import re
import argparse
import base64
import functools
import requests
import msal
from dotenv import load_dotenv

# Unbuffered print so output is visible immediately in background/piped runs
print = functools.partial(print, flush=True)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
SCOPES = ["Files.ReadWrite", "User.Read"]
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TOKEN_CACHE_FILE = os.path.join(SCRIPT_DIR, "token_cache.json")


def load_config(dry_run=False):
    load_dotenv(os.path.join(SCRIPT_DIR, ".env"))
    config = {
        "freshdesk_domain": os.getenv("FRESHDESK_DOMAIN"),
        "freshdesk_api_key": os.getenv("FRESHDESK_API_KEY"),
        "azure_client_id": os.getenv("AZURE_CLIENT_ID"),
        "azure_tenant_id": os.getenv("AZURE_TENANT_ID"),
        "onedrive_folder_url": os.getenv("ONEDRIVE_FOLDER_URL", ""),
        "share_role": os.getenv("SHARE_ROLE", "write").lower(),
        "send_invitation": os.getenv("SEND_INVITATION", "false").lower() == "true",
        "exclude_emails": {
            e.strip().lower()
            for e in os.getenv("EXCLUDE_EMAILS", "").split(",")
            if e.strip()
        },
        "exclude_domains": {
            d.strip().lower()
            for d in os.getenv("EXCLUDE_DOMAINS", "").split(",")
            if d.strip()
        },
    }
    required = ["freshdesk_domain", "freshdesk_api_key"]
    if not dry_run:
        required += ["azure_client_id", "azure_tenant_id", "onedrive_folder_url"]
    missing = [k.upper() for k in required if not config[k]]
    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}")
        print("Copy .env.example to .env and fill in the values.")
        sys.exit(1)
    return config


# ── FreshDesk ────────────────────────────────────────────────────────────────


def freshdesk_headers(api_key):
    auth = base64.b64encode(f"{api_key}:X".encode()).decode()
    return {"Authorization": f"Basic {auth}", "Content-Type": "application/json"}


def get_ticket(domain, api_key, ticket_id):
    url = f"https://{domain}.freshdesk.com/api/v2/tickets/{ticket_id}?include=requester"
    resp = requests.get(url, headers=freshdesk_headers(api_key))
    resp.raise_for_status()
    return resp.json()


def get_conversations(domain, api_key, ticket_id):
    url = f"https://{domain}.freshdesk.com/api/v2/tickets/{ticket_id}/conversations"
    headers = freshdesk_headers(api_key)
    all_convos = []
    page = 1
    while True:
        resp = requests.get(url, headers=headers, params={"page": page, "per_page": 100})
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        all_convos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return all_convos


def get_contact_email(domain, api_key, contact_id):
    url = f"https://{domain}.freshdesk.com/api/v2/contacts/{contact_id}"
    resp = requests.get(url, headers=freshdesk_headers(api_key))
    resp.raise_for_status()
    return resp.json().get("email")


def parse_email(raw):
    """Extract email address from strings like '"Name" <email>' or plain emails."""
    if not raw:
        return None
    match = re.search(r"[\w.+\-]+@[\w.\-]+\.\w+", raw)
    return match.group(0).lower() if match else None


def extract_emails(ticket, conversations, config):
    """Collect every unique email from the ticket thread, minus exclusions."""
    raw_emails = set()

    for field in ("cc_emails", "fwd_emails", "reply_cc_emails", "to_emails"):
        for addr in ticket.get(field, []) or []:
            raw_emails.add(addr)

    if ticket.get("requester_id"):
        try:
            requester_email = get_contact_email(
                config["freshdesk_domain"], config["freshdesk_api_key"], ticket["requester_id"]
            )
            if requester_email:
                raw_emails.add(requester_email)
        except Exception:
            pass

    for conv in conversations:
        if conv.get("from_email"):
            raw_emails.add(conv["from_email"])
        for field in ("to_emails", "cc_emails", "bcc_emails"):
            for addr in conv.get(field, []) or []:
                raw_emails.add(addr)

    parsed = set()
    for raw in raw_emails:
        email = parse_email(raw)
        if email:
            parsed.add(email)

    filtered = set()
    for email in parsed:
        if email in config["exclude_emails"]:
            continue
        domain = email.split("@")[1]
        if domain in config["exclude_domains"]:
            continue
        # Skip freshdesk system emails
        if domain.endswith(".freshdesk.com"):
            continue
        filtered.add(email)

    return sorted(filtered)


# ── Microsoft Graph ──────────────────────────────────────────────────────────


def get_msal_app(config):
    authority = f"https://login.microsoftonline.com/{config['azure_tenant_id']}"
    cache = msal.SerializableTokenCache()
    if os.path.exists(TOKEN_CACHE_FILE):
        with open(TOKEN_CACHE_FILE, "r") as f:
            cache.deserialize(f.read())
    app = msal.PublicClientApplication(
        config["azure_client_id"], authority=authority, token_cache=cache
    )
    return app, cache


def save_cache(cache):
    if cache.has_state_changed:
        with open(TOKEN_CACHE_FILE, "w") as f:
            f.write(cache.serialize())


def get_graph_token(config):
    app, cache = get_msal_app(config)

    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])
        if result and "access_token" in result:
            save_cache(cache)
            return result["access_token"]

    print("\nAuthentication required.")
    flow = app.initiate_device_flow(scopes=SCOPES)
    if "user_code" not in flow:
        print(f"ERROR: Could not create device flow: {flow.get('error_description', 'unknown error')}")
        sys.exit(1)
    print(flow["message"])
    result = app.acquire_token_by_device_flow(flow)

    if "access_token" not in result:
        print(f"ERROR: Authentication failed: {result.get('error_description', result.get('error', 'unknown'))}")
        sys.exit(1)

    save_cache(cache)
    return result["access_token"]


def graph_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def resolve_share_url(token, share_url):
    """Resolve a OneDrive/SharePoint sharing URL to a drive item ID."""
    encoded = base64.urlsafe_b64encode(share_url.encode()).decode().rstrip("=")
    share_token = f"u!{encoded}"
    url = f"{GRAPH_BASE}/shares/{share_token}/driveItem"
    resp = requests.get(url, headers=graph_headers(token))
    resp.raise_for_status()
    data = resp.json()
    return data["id"]


def ensure_folder(token, parent_id, folder_name):
    """Get or create a subfolder under a parent item ID. Returns (item_id, created)."""
    headers = graph_headers(token)
    base_url = f"{GRAPH_BASE}/me/drive/items/{parent_id}"

    list_url = f"{base_url}/children?$filter=name eq '{folder_name}'"
    resp = requests.get(list_url, headers=headers)
    if resp.status_code == 200:
        for item in resp.json().get("value", []):
            if item.get("name") == folder_name and "folder" in item:
                return item["id"], False

    body = {
        "name": folder_name,
        "folder": {},
        "@microsoft.graph.conflictBehavior": "fail",
    }
    resp = requests.post(f"{base_url}/children", headers=headers, json=body)
    if resp.status_code == 409:
        resp2 = requests.get(list_url, headers=headers)
        resp2.raise_for_status()
        for item in resp2.json().get("value", []):
            if item.get("name") == folder_name and "folder" in item:
                return item["id"], False
    resp.raise_for_status()
    return resp.json()["id"], True


def share_folder(token, item_id, emails, config):
    """Share a folder with a list of email addresses. Returns (succeeded, failed)."""
    if not emails:
        return [], []

    headers = graph_headers(token)
    url = f"{GRAPH_BASE}/me/drive/items/{item_id}/invite"

    succeeded = []
    failed = []

    # Share one at a time to isolate failures (external users may be blocked)
    for email in emails:
        body = {
            "requireSignIn": True,
            "sendInvitation": config["send_invitation"],
            "roles": [config["share_role"]],
            "recipients": [{"email": email}],
        }
        if config["send_invitation"]:
            body["message"] = f"Shared folder for support ticket"

        resp = requests.post(url, headers=headers, json=body)
        if resp.status_code in (200, 201):
            succeeded.append(email)
        else:
            error_msg = ""
            try:
                err = resp.json().get("error", {})
                code = err.get("code", "")
                msg = err.get("message", resp.text)
                error_msg = f"[{resp.status_code}/{code}] {msg}"
            except Exception:
                error_msg = f"[{resp.status_code}] {resp.text}"
            failed.append((email, error_msg))

    return succeeded, failed


def get_share_link(token, item_id):
    headers = graph_headers(token)
    url = f"{GRAPH_BASE}/me/drive/items/{item_id}/createLink"
    # "users" scope: only the specific people the folder is shared with can access
    for scope in ("users", "anonymous"):
        body = {"type": "edit", "scope": scope}
        resp = requests.post(url, headers=headers, json=body)
        if resp.status_code in (200, 201):
            link = resp.json().get("link", {}).get("webUrl")
            if link:
                return link
    # Fallback: get the webUrl directly from the item
    resp2 = requests.get(f"{GRAPH_BASE}/me/drive/items/{item_id}", headers=headers)
    if resp2.status_code == 200:
        return resp2.json().get("webUrl")
    return None


# ── Main ─────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="Create a SharePoint/OneDrive folder for a FreshDesk ticket and share it with everyone in the thread."
    )
    parser.add_argument("ticket_id", type=int, help="FreshDesk ticket number")
    parser.add_argument("--dry-run", action="store_true", help="Show emails and exit without creating folder or sharing")
    args = parser.parse_args()

    config = load_config(dry_run=args.dry_run)
    ticket_id = args.ticket_id

    print(f"Fetching ticket #{ticket_id} from FreshDesk...")
    try:
        ticket = get_ticket(config["freshdesk_domain"], config["freshdesk_api_key"], ticket_id)
    except requests.HTTPError as e:
        print(f"ERROR: Could not fetch ticket: {e}")
        sys.exit(1)

    print(f"  Subject: {ticket.get('subject', 'N/A')}")

    conversations = get_conversations(config["freshdesk_domain"], config["freshdesk_api_key"], ticket_id)
    print(f"  Conversations: {len(conversations)}")

    emails = extract_emails(ticket, conversations, config)
    print(f"\nEmails found in thread ({len(emails)}):")
    for email in emails:
        print(f"  - {email}")

    if not emails:
        print("\nNo external emails found. Nothing to share.")
        return

    if args.dry_run:
        print("\n[DRY RUN] Would create folder and share with the emails above.")
        return

    print("\nAuthenticating with Microsoft Graph...")
    token = get_graph_token(config)

    print("\nResolving target folder...")
    try:
        base_folder_id = resolve_share_url(token, config["onedrive_folder_url"])
    except requests.HTTPError as e:
        print(f"ERROR: Could not resolve OneDrive folder URL: {e}")
        sys.exit(1)

    folder_name = str(ticket_id)
    print(f"\nCreating folder '{folder_name}'...")

    try:
        folder_id, created = ensure_folder(token, base_folder_id, folder_name)
        if created:
            print(f"  Folder created.")
        else:
            print(f"  Folder already exists.")
    except requests.HTTPError as e:
        print(f"ERROR: Could not create folder: {e}")
        try:
            print(f"  Response: {e.response.json()}")
        except Exception:
            pass
        sys.exit(1)

    print(f"\nSharing folder with {len(emails)} recipient(s) (role: {config['share_role']})...")
    succeeded, failed = share_folder(token, folder_id, emails, config)

    if succeeded:
        print(f"\n  Shared successfully with:")
        for email in succeeded:
            print(f"    + {email}")

    if failed:
        print(f"\n  Failed to share with:")
        for email, error in failed:
            print(f"    x {email}: {error}")

    link = get_share_link(token, folder_id)
    print(f"\nDone. Folder: {folder_name}")
    if link:
        print(f"Link: {link}")


if __name__ == "__main__":
    main()
