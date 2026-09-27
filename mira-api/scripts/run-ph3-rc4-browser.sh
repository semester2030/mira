#!/usr/bin/env bash
# Local-only browser evidence for PH3 RC4. Creates and drops mira_ph2_rc6_test_rc4ui.
set -uo pipefail

unset PGHOST PGPORT PGHOSTADDR PGSERVICE PGDATABASE PGUSER PGPASSWORD PGAPPNAME PGOPTIONS

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="mira_ph2_rc6_test_rc4ui"
ADMIN_USER="${MIRA_RC6_ADMIN_USER:-$(id -un)}"
created=0
export MIRA_RC6_MODE=run

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  rm -f "/tmp/.mira-rc6-url-${DB_NAME}" "/tmp/.mira-rc6-meta-${DB_NAME}"
  if [[ "$created" == 1 ]]; then
    if dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" --if-exists "$DB_NAME" >/dev/null 2>&1; then
      echo "cleaned ${DB_NAME}"
    else
      echo "cleanup failed ${DB_NAME}" >&2
      if [[ "$status" -eq 0 ]]; then status=1; fi
    fi
  fi
  exit "$status"
}

python3 - "$ROOT" "$DB_NAME" << 'PY'
import os, re, sys
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse

root, name = sys.argv[1], sys.argv[2]
raw = ""
for line in (Path(root) / ".env").read_text().splitlines():
    if line.startswith("DATABASE_URL="):
        raw = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
if not raw:
    print("REFUSE missing local database settings", file=sys.stderr)
    sys.exit(2)
parsed = urlparse(raw)
host = parsed.hostname or ""
if host not in {"localhost", "127.0.0.1"}:
    print("REFUSE host is not the local test server", file=sys.stderr)
    sys.exit(2)
if not re.fullmatch(r"mira_ph2_rc6_test(_[a-z0-9]+)?", name):
    print("REFUSE database name", file=sys.stderr)
    sys.exit(2)
user = parsed.username or ""
port = parsed.port or 5432
password = parsed.password or ""
userinfo = quote(user, safe="")
if password:
    userinfo += ":" + quote(password, safe="")
url = urlunparse(("postgresql", f"{userinfo}@{host}:{port}", f"/{name}", "", "schema=public", ""))
Path(f"/tmp/.mira-rc6-url-{name}").write_text(url)
Path(f"/tmp/.mira-rc6-meta-{name}").write_text(f"{host}\n{port}\n{user}\n")
PY

DB_HOST="$(sed -n '1p' "/tmp/.mira-rc6-meta-${DB_NAME}")"
DB_PORT="$(sed -n '2p' "/tmp/.mira-rc6-meta-${DB_NAME}")"
DB_ROLE="$(sed -n '3p' "/tmp/.mira-rc6-meta-${DB_NAME}")"
rm -f "/tmp/.mira-rc6-meta-${DB_NAME}"
trap cleanup EXIT INT TERM

exists_out="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")"
if printf '%s' "$exists_out" | grep -q 1; then
  echo "REFUSE ${DB_NAME} already exists" >&2
  exit 2
fi
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" "$DB_NAME"
created=1
psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_ROLE};" \
  -c "GRANT ALL ON SCHEMA public TO ${DB_ROLE};" \
  -c "ALTER SCHEMA public OWNER TO ${DB_ROLE};" >/dev/null
export DATABASE_URL
DATABASE_URL="$(cat "/tmp/.mira-rc6-url-${DB_NAME}")"
rm -f "/tmp/.mira-rc6-url-${DB_NAME}"
cd "$ROOT"
npx --no-install prisma migrate deploy >/dev/null
node scripts/ph3-rc4-browser-evidence.mjs
