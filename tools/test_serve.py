"""HTTP regression tests for the local launcher's public-file boundary."""
import http.client
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import serve


class PublicServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for name in ("assets", "lessons", "docs", ".git", "split_pdfs"):
            (self.root / name).mkdir()
        for name in ("index.html", "components.html", "assets/app.js",
                     "lessons/lesson.html", "docs/example.csv", ".git/config",
                     "split_pdfs/private.pdf", "notes.txt"):
            (self.root / name).write_text(name, encoding="utf-8")
        self.patch = patch.object(serve, "ROOT", str(self.root))
        self.patch.start()
        self.server = serve.Server(("127.0.0.1", 0), serve.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.patch.stop()
        self.temp.cleanup()

    def request(self, path, method="GET"):
        connection = http.client.HTTPConnection(*self.server.server_address, timeout=3)
        try:
            connection.request(method, path)
            response = connection.getresponse()
            return response.status, response.read()
        finally:
            connection.close()

    def test_published_content_still_loads(self):
        for path in ("/", "/index.html", "/components.html", "/assets/app.js?v=abc",
                     "/lessons/lesson.html", "/docs/example.csv"):
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 200)

    def test_private_paths_and_traversal_are_not_served(self):
        for method in ("GET", "HEAD"):
            for path in ("/.git/config", "/%2egit/config", "/split_pdfs/private.pdf",
                         "/notes.txt", "/assets/../notes.txt", "/assets/%2e%2e/notes.txt",
                         "/assets/%5c../notes.txt", "/assets/%00", "/assets/"):
                with self.subTest(path=path, method=method):
                    self.assertEqual(self.request(path, method)[0], 404)

    def test_symlink_cannot_expose_private_content(self):
        link = self.root / "assets" / "private"
        try:
            link.symlink_to(self.root / "split_pdfs", target_is_directory=True)
        except OSError:
            self.skipTest("Creating symlinks requires permission on this platform")
        self.assertEqual(self.request("/assets/private/private.pdf")[0], 404)


if __name__ == "__main__":
    unittest.main()
