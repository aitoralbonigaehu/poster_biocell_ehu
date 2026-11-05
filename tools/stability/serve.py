# No-cache static server for the stability tools: python tools/stability/serve.py [port] [root]
import sys, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
root = sys.argv[2] if len(sys.argv) > 2 else 'Living_poster_v3'
ThreadingHTTPServer.request_queue_size = 64
ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()
