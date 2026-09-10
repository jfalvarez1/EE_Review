"""Local-only review server; saves browser geometry to one fixed report path."""
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/__audit_report':
            self.send_error(404)
            return
        size = int(self.headers.get('Content-Length', 0))
        if not 0 < size < 5_000_000:
            self.send_error(413)
            return
        report = json.loads(self.rfile.read(size))
        Path('_audit/circuit-layout-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        self.send_response(204)
        self.end_headers()

if __name__ == '__main__':
    print('Circuit audit: http://127.0.0.1:8091/_audit/circuit-gallery.html', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8091), Handler).serve_forever()
