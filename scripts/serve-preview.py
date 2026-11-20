"""Serve the prototype and resolve event detail paths locally."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
from urllib.parse import urlsplit


class PreviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.path
        if re.fullmatch(r'/silovematch/events/[a-z0-9]+(?:[-_][a-z0-9]+)*/?', urlsplit(path).path):
            target = super().translate_path(path)
            if not Path(target).exists():
                if urlsplit(path).path.endswith('/'):
                    self.send_response(308)
                    self.send_header('Location', urlsplit(path).path.rstrip('/'))
                    self.end_headers()
                    return None
                self.path = '/silovematch/events/index.html'
        try:
            return super().send_head()
        finally:
            self.path = path

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('port', type=int, nargs='?', default=8792)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    handler = partial(PreviewHandler, directory=str(root))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        server.serve_forever()
