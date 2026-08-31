#!/usr/bin/env python3
"""
Launcher for the Analog Design Refresher Course.

The course has no build step and no runtime dependencies - it is plain HTML,
CSS and ES5-compatible JavaScript. What it does need is to be served over HTTP
rather than opened as file://, because the lessons are fetched with
XMLHttpRequest and every browser blocks that on the file:// protocol. Opening
index.html directly gives a sidebar full of lessons that will not load, which
is a confusing first experience for something that is otherwise dependency-free.

So this does the four things a person actually wants:

  * finds a free port instead of failing when 8080 is taken
  * binds to all interfaces and prints the LAN URL, so a phone on the same
    WiFi can read it
  * disables caching, so an edited lesson shows up on reload rather than
    three reloads later
  * opens the browser

Run it directly, or use start.bat / start.sh which locate Python first.
"""

import argparse
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

DEFAULT_PORT = 8080
PORT_ATTEMPTS = 40

# The repo root is the parent of tools/, whatever the working directory is.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static handler that always serves the repo root, and never caches."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Without this the browser holds onto lessons and assets, and an edit
        # appears not to have worked. Correctness beats speed for a local
        # study guide being actively written.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # The default logs every asset request, which buries the URLs printed
        # at startup. Errors still matter, so keep those.
        status = str(args[1]) if len(args) > 1 else ""
        if status.startswith(("4", "5")) and "favicon" not in (args[0] if args else ""):
            sys.stderr.write("  %s %s\n" % (status, args[0] if args else ""))


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True

    # SO_REUSEADDR does not mean the same thing on both platforms. On POSIX it
    # allows rebinding a port still in TIME_WAIT, which is what you want when
    # restarting a server you just stopped. On Windows it allows binding a port
    # another process is actively listening on - two servers, one port, requests
    # going to whichever wins. So it is only safe to enable off Windows.
    allow_reuse_address = (os.name != "nt")


def find_port(start, attempts):
    """
    First free port at or above `start`.

    Deliberately does NOT set SO_REUSEADDR on the probe. With it set, this test
    always succeeds on Windows even when the port is in use, so the launcher
    would cheerfully report a port that another server already owns.
    """
    for port in range(start, start + attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                probe.bind(("0.0.0.0", port))
            return port
        except OSError:
            continue
    return None


def lan_ip():
    """
    This machine's address on the local network.

    Opening a UDP socket toward a public address does not send anything - it
    just makes the OS choose a route, which is the only portable way to learn
    which of several interfaces would actually be used.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.settimeout(0.4)
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return None


def main():
    ap = argparse.ArgumentParser(description="Serve the Analog Design Refresher Course.")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT,
                    help="preferred port (default %d; the next free one is used if taken)"
                         % DEFAULT_PORT)
    ap.add_argument("--no-browser", action="store_true", help="do not open a browser")
    ap.add_argument("--local-only", action="store_true",
                    help="bind to 127.0.0.1 only, so nothing on the network can reach it")
    args = ap.parse_args()

    if not os.path.isfile(os.path.join(ROOT, "index.html")):
        sys.stderr.write("Could not find index.html next to tools/.\n"
                         "Run this from inside the EE_Review folder.\n")
        return 1

    port = find_port(args.port, PORT_ATTEMPTS)
    if port is None:
        sys.stderr.write("No free port between %d and %d.\n"
                         % (args.port, args.port + PORT_ATTEMPTS - 1))
        return 1

    host = "127.0.0.1" if args.local_only else "0.0.0.0"
    local_url = "http://localhost:%d/index.html" % port

    print()
    print("  Analog Design Refresher Course")
    print("  " + "-" * 44)
    print("  On this computer:  %s" % local_url)

    if not args.local_only:
        ip = lan_ip()
        if ip:
            print("  On your phone:     http://%s:%d/index.html" % (ip, port))
            print("                     (same WiFi network)")
        else:
            print("  On your phone:     could not determine this machine's LAN address")

    if port != args.port:
        print("  Note: port %d was busy, using %d instead." % (args.port, port))

    print()
    print("  Start here:        %s#path" % local_url)
    print("  Symbol reference:  http://localhost:%d/components.html" % port)
    print()
    print("  Press Ctrl+C to stop.")
    print()

    try:
        server = Server((host, port), Handler)
    except OSError as exc:
        sys.stderr.write("Could not start the server: %s\n" % exc)
        return 1

    if not args.no_browser:
        # Slightly delayed so the browser does not race the first accept().
        threading.Timer(0.4, lambda: webbrowser.open(local_url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.\n")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
