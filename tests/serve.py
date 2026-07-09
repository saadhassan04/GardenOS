#!/usr/bin/env python3
"""GardenOS development server.

Serves the project root with HTTP caching disabled. Plain
`python3 -m http.server` sends Last-Modified without Cache-Control, so
browsers heuristically cache ES modules — after an edit, a page can load a
mix of fresh and stale modules and fail with confusing import errors
(observed live: a stale plantService.js breaking a fresh notes.test.js).

Usage:  python3 tests/serve.py [port]     (default 8080)
Then open http://127.0.0.1:<port>/ (app) or /tests/ (test suite).

Dev-time convenience only — GardenOS itself needs any static file server
and has no build or tooling requirement (ADR-0001).
"""

import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=project_root)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), handler)
    print(f'GardenOS dev server: http://127.0.0.1:{port}/  (root: {project_root})')
    server.serve_forever()


if __name__ == '__main__':
    main()
