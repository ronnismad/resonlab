#!/usr/bin/env python3
"""Local static server for Acoustic Resonator Studio.

Serves with Cache-Control: no-store so ES module graphs never go stale
after a file edit (default http.server can leave browsers with old nested
modules even when the entry script is cache-busted).
"""
from __future__ import annotations

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST = "127.0.0.1"
PORT = 8877


class NoCacheHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".wasm": "application/wasm",
    }

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        # Keep terminal noise low; still show errors.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


def main() -> None:
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)
    httpd = ThreadingHTTPServer((HOST, PORT), NoCacheHandler)
    print(f"Acoustic Resonator Studio -> http://{HOST}:{PORT}/  (no-store cache)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
