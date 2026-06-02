#!/usr/bin/env bash
# Free port 3000 (or PORT from .env) so Nest can start cleanly.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=3000
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  source <(grep -E '^PORT=' "$ROOT/.env" | head -1) 2>/dev/null || true
fi

PIDS=$(lsof -t -i ":${PORT}" -sTCP:LISTEN 2>/dev/null || true)
if [[ -z "$PIDS" ]]; then
  echo "Port ${PORT} is already free."
  exit 0
fi

echo "Stopping process(es) on port ${PORT}: $PIDS"
kill $PIDS 2>/dev/null || true
sleep 1
if lsof -i ":${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Force kill..."
  kill -9 $(lsof -t -i ":${PORT}" -sTCP:LISTEN) 2>/dev/null || true
fi
echo "Port ${PORT} is free."
