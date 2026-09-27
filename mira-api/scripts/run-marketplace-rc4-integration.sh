#!/usr/bin/env bash
# Isolated local Postgres for Discover phase 2 RC4. Does not touch production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MIRA_RC4_DB_NAME:-mira_ph2_rc4_test}"
cd "$ROOT"
eval "$(python3 - << 'PY'
from pathlib import Path
from urllib.parse import urlparse, urlunparse
line = next(l for l in Path(".env").read_text().splitlines() if l.startswith("DATABASE_URL="))
raw = line.split("=", 1)[1].strip().strip('"').strip("'")
parsed = urlparse(raw)
if parsed.hostname not in {"localhost", "127.0.0.1"}:
    raise SystemExit("REFUSE non-local DATABASE_URL")
admin = urlunparse(parsed._replace(path="/postgres", query=""))
test = urlunparse(parsed._replace(path="/mira_ph2_rc4_test"))
print(f"DB_ROLE={parsed.username!r}")
print(f"export DATABASE_URL={test!r}")
PY
)"
dropdb --if-exists "$DB_NAME" || true
createdb "$DB_NAME"
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_ROLE};" \
  -c "GRANT ALL ON SCHEMA public TO ${DB_ROLE};" \
  -c "ALTER SCHEMA public OWNER TO ${DB_ROLE};"
cd "$ROOT"
npx prisma generate
npx prisma migrate deploy
npx prisma migrate deploy
npx tsx src/marketplace/marketplace.http.integration-tests.ts
dropdb --if-exists "$DB_NAME"
echo "rc4 integration cleaned ${DB_NAME}"
