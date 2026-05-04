import http.server
import urllib.request
import urllib.error
import json
import os
import ssl
import base64
import threading
import sys
import signal

PORT = 8080
SHUTDOWN_TIMEOUT = 20
last_activity = None
server = None

def reset_timer():
    global last_activity
    last_activity = __import__('time').time()

def watchdog():
    import time
    while True:
        time.sleep(10)
        if last_activity and (time.time() - last_activity) > SHUTDOWN_TIMEOUT:
            pass
        if last_activity and (time.time() - last_activity) > 30:
            os._exit(0)

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def end_headers(self):
        if self.path == '/' or self.path.endswith('.html'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        reset_timer()
        if self.path == '/heartbeat':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'ok')
        elif self.path == '/shutdown':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'bye')
            threading.Thread(target=lambda: ((__import__('time').sleep(0.5)), os._exit(0))).start()
        elif self.path.startswith('/fd/'):
            self._proxy('GET')
        else:
            super().do_GET()

    def do_POST(self):
        reset_timer()
        if self.path.startswith('/fd/'):
            self._proxy('POST')
        else:
            self.send_error(404)

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
reset_timer()

t = threading.Thread(target=watchdog, daemon=True)
t.start()

server = http.server.HTTPServer(('0.0.0.0', PORT), ProxyHandler)
server.serve_forever()
