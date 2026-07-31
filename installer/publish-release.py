"""Publish a built installer as a GitHub release asset.

Usage:
    python publish-release.py <tag> <path-to-exe>

Auth comes from the credential Git already has stored for github.com (the same one
`git push` uses), read over a pipe from `git credential fill`. The token is never
printed, logged, or written to disk -- keep it that way. gh CLI is not required.
"""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

REPO = "JehuAlv/FreshDeskProMax"
API = "https://api.github.com"

if len(sys.argv) != 3:
    sys.exit(__doc__)
TAG, ASSET = sys.argv[1], sys.argv[2]
if not os.path.isfile(ASSET):
    sys.exit(f"asset not found: {ASSET}")


def get_token():
    p = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True,
        text=True,
    )
    if p.returncode != 0:
        sys.exit("could not read the stored git credential for github.com")
    for line in p.stdout.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1]
    sys.exit("stored credential has no password field")


TOKEN = get_token()


def req(method, url, body=None, ctype="application/json", raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body else None)
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", "Bearer " + TOKEN)
    r.add_header("Accept", "application/vnd.github+json")
    r.add_header("X-GitHub-Api-Version", "2022-11-28")
    r.add_header("User-Agent", "fd-release")
    if data:
        r.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw_body = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(raw_body)
        except Exception:
            return e.code, {"raw": raw_body[:400]}


name = os.path.basename(ASSET)

status, rel = req("GET", f"{API}/repos/{REPO}/releases/tags/{TAG}")
if status == 200:
    print(f"release {TAG} already exists (id {rel['id']})")
elif status == 404:
    notes = (
        f"FreshDesk Pro Max installer {TAG}.\n\n"
        f"## Install\n\nDownload `{name}` and double-click it. The installer asks for "
        "administrator rights and sets up the whole server on its own: Python, Ollama, "
        "Python dependencies, the AI model, firewall rules for ports 8080 and 11434, "
        "auto-start on Windows login, and it opens the dashboard when it finishes.\n\n"
        "Installs to `C:\\FreshdeskDashboard`. Reinstalling over an existing install "
        "merges files and keeps your local configuration.\n\n"
        "## After installing\n\nCopy "
        "`C:\\FreshdeskDashboard\\Sharepoint\\.env.example` to `.env` and fill it in to "
        "enable SharePoint ticket-folder creation, then run\n"
        "`python C:\\FreshdeskDashboard\\Sharepoint\\create_ticket_folder.py <ticket_id>`\n"
        "once in a terminal to complete the Microsoft device-code sign-in.\n"
    )
    status, rel = req(
        "POST",
        f"{API}/repos/{REPO}/releases",
        {
            "tag_name": TAG,
            "name": f"FreshDesk Pro Max {TAG}",
            "body": notes,
            "draft": False,
            "prerelease": False,
        },
    )
    if status != 201:
        sys.exit(f"create release failed: HTTP {status} {rel.get('message', rel)}")
    print(f"release {TAG} created (id {rel['id']})")
else:
    sys.exit(f"lookup failed: HTTP {status} {rel.get('message', rel)}")

# Replace an asset of the same name so re-running is idempotent.
for a in rel.get("assets", []):
    if a["name"] == name:
        st, _ = req("DELETE", f"{API}/repos/{REPO}/releases/assets/{a['id']}")
        print(f"deleted stale asset {name}: HTTP {st}")

blob = open(ASSET, "rb").read()
status, res = req(
    "POST",
    rel["upload_url"].split("{")[0] + "?name=" + name,
    raw=blob,
    ctype="application/vnd.microsoft.portable-executable",
)
if status != 201:
    sys.exit(f"upload failed: HTTP {status} {res.get('message', res)}")
print(f"uploaded {name} ({len(blob)} bytes)")
print("download URL:", res["browser_download_url"])
