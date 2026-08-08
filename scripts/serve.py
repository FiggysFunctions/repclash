# -*- coding: utf-8 -*-
"""
Tiny static server for local testing. Works on the Python 2.7 that ships
with this machine, and on Python 3 if you ever install it.

    python scripts/serve.py            # http://localhost:8099
    python scripts/serve.py 5000       # pick a port

Windows' registry sometimes reports .js as text/plain, which makes browsers
refuse to load ES modules. So MIME types are set explicitly below rather than
left to the system.
"""

import os
import sys

try:                                     # Python 3
    from http.server import SimpleHTTPRequestHandler, HTTPServer
except ImportError:                      # Python 2.7
    from SimpleHTTPServer import SimpleHTTPRequestHandler
    from BaseHTTPServer import HTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')

TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.mjs':  'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
    '.txt':  'text/plain; charset=utf-8',
}


class Handler(SimpleHTTPRequestHandler):

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in TYPES:
            return TYPES[ext]
        return SimpleHTTPRequestHandler.guess_type(self, path)

    def end_headers(self):
        # Never cache during development, otherwise the service worker and the
        # browser will happily serve you yesterday's code.
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    os.chdir(ROOT)
    server = HTTPServer(('127.0.0.1', port), Handler)
    print("RepClash dev server")
    print("  serving %s" % os.getcwd())
    print("  http://localhost:%d" % port)
    print("  Ctrl+C to stop")
    server.serve_forever()


if __name__ == '__main__':
    main()
