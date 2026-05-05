import http.server
import urllib.request
import urllib.error
import json
import os
import sys
import ssl
import base64
import threading
from concurrent.futures import ThreadPoolExecutor

PORT = 8080

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Sharepoint'))
import create_ticket_folder as sp

_sp_config = None
_sp_token = None
_sp_lock = threading.Lock()

def _get_sp_config():
    global _sp_config
    if _sp_config is None:
        _sp_config = sp.load_config()
    return _sp_config

def _get_sp_token():
    global _sp_token
    with _sp_lock:
        config = _get_sp_config()
        _sp_token = sp.get_graph_token(config)
    return _sp_token

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def end_headers(self):
        if not self.path.startswith('/fd/'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/heartbeat':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'ok')
        elif self.path.startswith('/fd/'):
            self._proxy('GET')
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/fd/'):
            self._proxy('POST')
        elif self.path == '/ollama':
            self._ollama()
        elif self.path == '/sharepoint':
            self._sharepoint()
        else:
            self.send_error(404)

    def _ollama(self):
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            self.send_error(400, 'Empty body')
            return
        raw = self.rfile.read(length)

        req = urllib.request.Request('http://127.0.0.1:11434/api/chat', data=raw, method='POST')
        req.add_header('Content-Type', 'application/json')

        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _sharepoint(self):
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            self.send_error(400, 'Empty body')
            return
        raw = self.rfile.read(length)
        data = json.loads(raw)
        ticket_id = data.get('ticketId')
        if not ticket_id:
            self.send_error(400, 'Missing ticketId')
            return

        try:
            config = _get_sp_config()
            emails = data.get('emails', [])

            with ThreadPoolExecutor(max_workers=2) as pool:
                token_future = pool.submit(_get_sp_token)
                if not emails:
                    fd_future = pool.submit(self._sp_fetch_emails, config, ticket_id)
                token = token_future.result()
                if not emails:
                    emails = fd_future.result()

            sp.ensure_folder(token, '', 'Tickets')
            folder_id, created = sp.ensure_folder(token, 'Tickets', str(ticket_id))

            with ThreadPoolExecutor(max_workers=2) as pool:
                share_future = pool.submit(sp.share_folder, token, folder_id, emails, config)
                link_future = pool.submit(sp.get_share_link, token, folder_id)
                succeeded, failed = share_future.result()
                link = link_future.result()

            result = {
                'link': link or '',
                'created': created,
                'shared': succeeded,
                'failed': [{'email': e, 'error': err} for e, err in failed],
                'ticketId': ticket_id
            }
            body = json.dumps(result).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    @staticmethod
    def _sp_fetch_emails(config, ticket_id):
        ticket = sp.get_ticket(config['freshdesk_domain'], config['freshdesk_api_key'], ticket_id)
        conversations = sp.get_conversations(config['freshdesk_domain'], config['freshdesk_api_key'], ticket_id)
        return sp.extract_emails(ticket, conversations, config)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-FD-Key, X-FD-Domain, Content-Type')
        self.end_headers()

    def _proxy(self, method):
        api_path = self.path[4:]
        api_key = self.headers.get('X-FD-Key', '')
        domain = self.headers.get('X-FD-Domain', '')

        if not api_key or not domain:
            self.send_error(400, 'Missing X-FD-Key or X-FD-Domain header')
            return

        url = 'https://{}/api/v2/{}'.format(domain, api_path)
        auth = base64.b64encode('{}:X'.format(api_key).encode()).decode()

        req = urllib.request.Request(url, method=method)
        req.add_header('Authorization', 'Basic ' + auth)
        req.add_header('Content-Type', 'application/json')

        if method == 'POST':
            length = int(self.headers.get('Content-Length', 0))
            if length > 0:
                req.data = self.rfile.read(length)

        ctx = ssl.create_default_context()

        try:
            with urllib.request.urlopen(req, context=ctx) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

os.chdir(os.path.dirname(os.path.abspath(__file__)))
server = http.server.HTTPServer(('0.0.0.0', PORT), ProxyHandler)
server.serve_forever()
