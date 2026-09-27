#!/usr/bin/env bash
set -euo pipefail
unset PGHOST PGPORT PGHOSTADDR PGSERVICE PGDATABASE PGUSER PGPASSWORD PGAPPNAME PGOPTIONS
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="mira_ph2_rc6_test_ph4rc3ui"
ADMIN_USER="${MIRA_RC6_ADMIN_USER:-$(id -un)}"
REPO="$(cd "$ROOT/.." && pwd)"

python3 - "$ROOT" "$DB_NAME" << 'PY'
import os, re, sys
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse
root, name = sys.argv[1], sys.argv[2]
raw = os.environ.get("DATABASE_URL", "").strip().strip('"').strip("'")
if not raw:
    for line in Path(root, ".env").read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            raw = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
if not raw:
    sys.exit(2)
parsed = urlparse(raw)
host = parsed.hostname or ""
if host not in {"localhost", "127.0.0.1"}:
    sys.exit(2)
if not re.fullmatch(r"mira_ph2_rc6_test(_[a-z0-9]+)?", name):
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
dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" --if-exists "$DB_NAME" >/dev/null
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" "$DB_NAME"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_ROLE};" \
  -c "GRANT ALL ON SCHEMA public TO ${DB_ROLE};" \
  -c "ALTER SCHEMA public OWNER TO ${DB_ROLE};" >/dev/null
export DATABASE_URL
DATABASE_URL="$(cat "/tmp/.mira-rc6-url-${DB_NAME}")"
rm -f "/tmp/.mira-rc6-url-${DB_NAME}"
cd "$ROOT"
npx prisma migrate deploy --schema "$ROOT/prisma/schema.prisma" >/tmp/ph4-rc3-ui-migrate.log
export MIRA_MEDIA_STORE=local
rm -f /tmp/ph4-rc3-journey.json
npx --no-install tsx src/marketplace/catalog-ad.ph4.rc3.portal-journey.ts > /tmp/ph4-rc3-ui-server.log 2>&1 &
server_pid=$!
cleanup() {
  kill "$server_pid" >/dev/null 2>&1 || true
  dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" --if-exists "$DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT
for _ in $(seq 1 50); do
  if [[ -f /tmp/ph4-rc3-journey.json ]]; then
    break
  fi
  sleep 0.2
done
if [[ ! -f /tmp/ph4-rc3-journey.json ]]; then
  echo "journey server did not start" >&2
  exit 1
fi
mkdir -p "$REPO/docs/mira-commerce-reference/evidence/ph4-rc4"
node "$REPO/docs/mira-commerce-reference/evidence/ph4-rc3/portal-journey.mjs" --root "$REPO" --out "$REPO/docs/mira-commerce-reference/evidence/ph4-rc4" --journey /tmp/ph4-rc3-journey.json
echo "portal journey shell passed"
