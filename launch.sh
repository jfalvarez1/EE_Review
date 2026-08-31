#!/usr/bin/env bash
# Launcher for the Analog Design Refresher Course (macOS / Linux / WSL).
#
# The course has no dependencies - plain HTML, CSS and JavaScript. It only
# needs a static web server, because lessons are fetched with XMLHttpRequest
# and browsers block that on file://. Python's built-in server is enough.

set -euo pipefail
cd "$(dirname "$0")"

for candidate in python3 python py; do
    if command -v "$candidate" >/dev/null 2>&1; then
        # Reject Python 2, which cannot run tools/serve.py.
        if "$candidate" -c 'import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)' 2>/dev/null; then
            exec "$candidate" tools/serve.py "$@"
        fi
    fi
done

cat <<'MSG'

  Python 3 was not found.

  The course needs a static web server to run. Python has one built in:

      macOS:   brew install python
      Debian:  sudo apt install python3

  Or, if you already have Node.js:
      npx --yes http-server -p 8080 -c-1
  then open http://localhost:8080/index.html

MSG
exit 1
