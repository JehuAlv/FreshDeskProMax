import http.server
import urllib.request
import urllib.error
import json
import os
import sys
import ssl
import base64
import subprocess
import time
import threading
from concurrent.futures import ThreadPoolExecutor

PORT = 8080
MODEL = 'qwen3.5:9b'

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Sharepoint'))
import create_ticket_folder as sp

_sp_config = None
_sp_token = None
_sp_base_folder_id = None
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

def _get_sp_base_folder(token):
    global _sp_base_folder_id
    if _sp_base_folder_id is None:
        config = _get_sp_config()
        _sp_base_folder_id = sp.resolve_share_url(token, config["onedrive_folder_url"])
    return _sp_base_folder_id

def _is_cuda_error(body):
    try:
        msg = json.loads(body).get('error', '').lower()
    except Exception:
        msg = body.decode('utf-8', errors='ignore').lower()
    return 'cuda' in msg or 'out of memory' in msg or 'gpu' in msg

def _ollama_is_alive():
    try:
        with urllib.request.urlopen('http://127.0.0.1:11434/api/tags', timeout=5):
            return True
    except Exception:
        return False

def _ensure_ollama():
    if _ollama_is_alive():
        return True
    print('[ollama] Not running, starting...')
    subprocess.Popen(['ollama', 'serve'], creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW)
    for _ in range(10):
        time.sleep(2)
        if _ollama_is_alive():
            print('[ollama] Started successfully')
            return True
    print('[ollama] Start timeout')
    return False

def _restart_ollama():
    subprocess.run(['taskkill', '/F', '/IM', 'ollama.exe'], capture_output=True)
    subprocess.run(['taskkill', '/F', '/IM', 'ollama app.exe'], capture_output=True)
    time.sleep(3)
    return _ensure_ollama()

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

    def do_PUT(self):
        if self.path.startswith('/fd/'):
            self._proxy('PUT')
        else:
            self.send_error(404)

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

        try:
            payload = json.loads(raw)
        except Exception:
            self.send_error(400, 'Invalid JSON')
            return

        is_stream = payload.get('stream', False)
        t0 = time.time()

        for attempt in range(2):
            req = urllib.request.Request('http://127.0.0.1:11434/api/chat', data=raw, method='POST')
            req.add_header('Content-Type', 'application/json')
            try:
                resp = urllib.request.urlopen(req, timeout=120)
                if is_stream:
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/event-stream')
                    self.send_header('Cache-Control', 'no-cache')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    try:
                        while True:
                            chunk = resp.read1(8192)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                            self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        pass
                    finally:
                        resp.close()
                    elapsed = time.time() - t0
                    print('[ollama] Streamed in %.1fs' % elapsed)
                else:
                    body = resp.read()
                    resp.close()
                    elapsed = time.time() - t0
                    print('[ollama] Response in %.1fs' % elapsed)
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(body)
                return
            except urllib.error.HTTPError as e:
                body = e.read()
                if attempt == 0 and _is_cuda_error(body):
                    print('[ollama] CUDA error detected, restarting Ollama...')
                    _restart_ollama()
                    continue
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(body)
                return
            except Exception as e:
                if attempt == 0 and not _ollama_is_alive():
                    print('[ollama] Connection error, starting Ollama...')
                    _ensure_ollama()
                    continue
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
                return

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
            frontend_emails = data.get('emails', [])

            with ThreadPoolExecutor(max_workers=2) as pool:
                token_future = pool.submit(_get_sp_token)
                fd_future = pool.submit(self._sp_fetch_emails, config, ticket_id)
                token = token_future.result()
                fd_emails = fd_future.result()

            merged = set(e.lower().strip() for e in frontend_emails)
            merged.update(e.lower().strip() for e in fd_emails)
            exclude = config.get('exclude_emails', set())
            exclude_domains = config.get('exclude_domains', set())
            emails = sorted(
                e for e in merged
                if e
                and e not in exclude
                and e.split('@')[1] not in exclude_domains
                and not e.endswith('.freshdesk.com')
            )

            base_folder_id = _get_sp_base_folder(token)
            folder_id, created = sp.ensure_folder(token, base_folder_id, str(ticket_id))

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
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
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
        content_type = self.headers.get('Content-Type', 'application/json')
        req.add_header('Content-Type', content_type)

        if method in ('POST', 'PUT'):
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

def _preload_model():
    _ensure_ollama()
    try:
        req = urllib.request.Request(
            'http://127.0.0.1:11434/api/chat',
            data=json.dumps({'model': MODEL, 'messages': [], 'keep_alive': -1}).encode(),
            method='POST'
        )
        req.add_header('Content-Type', 'application/json')
        with urllib.request.urlopen(req, timeout=120):
            pass
        print('[ollama] Model preloaded into VRAM')
    except Exception as e:
        print('[ollama] Preload failed: ' + str(e))

def _kill_previous():
    try:
        out = subprocess.check_output(['netstat', '-ano'], text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        pids = set()
        for line in out.splitlines():
            if (':%d ' % PORT in line or ':%d\t' % PORT in line) and 'LISTENING' in line:
                pid = line.strip().split()[-1]
                if pid.isdigit() and int(pid) != os.getpid():
                    pids.add(pid)
        for pid in pids:
            subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
        if pids:
            print('[proxy] Killed %d previous instance(s)' % len(pids))
            time.sleep(1)
    except Exception:
        pass

import socketserver
class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

os.chdir(os.path.dirname(os.path.abspath(__file__)))
_kill_previous()
threading.Thread(target=_preload_model, daemon=True).start()
server = ThreadedServer(('127.0.0.1', PORT), ProxyHandler)
print('[proxy] Listening on port %d' % PORT)
server.serve_forever()
