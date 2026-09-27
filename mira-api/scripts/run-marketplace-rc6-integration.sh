#!/usr/bin/env bash
# Isolated local Postgres for the remaining phase-2 connection fix and phase-3 content tests.
# Prisma uses DATABASE_URL. Admin commands use the operating-system role, or MIRA_RC6_ADMIN_USER,
# on the same host and port taken from that URL. Inherited PGHOST, PGPORT, and PGSERVICE are unset
# so they cannot send createdb, psql, or dropdb to a different server.
set -uo pipefail

unset PGHOST PGPORT PGHOSTADDR PGSERVICE PGDATABASE PGUSER PGPASSWORD PGAPPNAME PGOPTIONS

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${MIRA_RC6_DB_NAME:-mira_ph2_rc6_test}"
MODE="${1:-run}"
ADMIN_USER="${MIRA_RC6_ADMIN_USER:-$(id -un)}"
created=0
export MIRA_RC6_MODE="$MODE"

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  rm -f "/tmp/.mira-rc6-url-${DB_NAME}" "/tmp/.mira-rc6-meta-${DB_NAME}"
  if [[ "$created" == 1 ]]; then
    if [[ "${MIRA_RC6_SIMULATE_CLEANUP_FAIL:-}" == "1" ]]; then
      echo "cleanup failed ${DB_NAME}" >&2
      echo "cleanup=failed test_status=${status}"
      if [[ "$status" -eq 0 ]]; then
        status=1
      fi
    elif dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" --if-exists "$DB_NAME" >/dev/null 2>&1; then
      echo "cleaned ${DB_NAME}"
      echo "cleanup=ok test_status=${status}"
    else
      echo "cleanup failed ${DB_NAME}" >&2
      echo "cleanup=failed test_status=${status}"
      if [[ "$status" -eq 0 ]]; then
        status=1
      fi
    fi
  fi
  exit "$status"
}

admin_psql() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" "$@"
}

python3 - "$ROOT" "$DB_NAME" << 'PY'
import os, re, sys
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse

root, name = sys.argv[1], sys.argv[2]
raw = os.environ.get("DATABASE_URL", "").strip().strip('"').strip("'")
if not raw:
    env_path = Path(root) / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                raw = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
if not raw:
    print("REFUSE missing local database settings", file=sys.stderr)
    sys.exit(2)
parsed = urlparse(raw)
host = os.environ.get("MIRA_RC6_HOST", parsed.hostname or "")
if host not in {"localhost", "127.0.0.1"}:
    print("REFUSE host is not the local test server", file=sys.stderr)
    sys.exit(2)
if not re.fullmatch(r"mira_ph2_rc6_test(_[a-z0-9]+)?", name):
    print("REFUSE database name is not a dedicated RC6 test database", file=sys.stderr)
    sys.exit(2)
user = parsed.username or ""
if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", user):
    print("REFUSE database role", file=sys.stderr)
    sys.exit(2)
port = parsed.port or 5432
if os.environ.get("MIRA_RC6_MODE") == "--prove-port":
    port = int(os.environ.get("MIRA_RC6_PORT_OVERRIDE", "1"))
password = parsed.password or ""
userinfo = quote(user, safe="")
if password:
    userinfo += ":" + quote(password, safe="")
url = urlunparse(("postgresql", f"{userinfo}@{host}:{port}", f"/{name}", "", "schema=public", ""))
Path(f"/tmp/.mira-rc6-url-{name}").write_text(url)
Path(f"/tmp/.mira-rc6-meta-{name}").write_text(f"{host}\n{port}\n{user}\n")
PY
status=$?
if [[ $status -ne 0 ]]; then
  exit "$status"
fi

DB_HOST="$(sed -n '1p' "/tmp/.mira-rc6-meta-${DB_NAME}")"
DB_PORT="$(sed -n '2p' "/tmp/.mira-rc6-meta-${DB_NAME}")"
DB_ROLE="$(sed -n '3p' "/tmp/.mira-rc6-meta-${DB_NAME}")"
rm -f "/tmp/.mira-rc6-meta-${DB_NAME}"

if [[ "$MODE" == "--print-admin" ]]; then
  rm -f "/tmp/.mira-rc6-url-${DB_NAME}"
  echo "admin=${ADMIN_USER} host=${DB_HOST} port=${DB_PORT} psql=-h ${DB_HOST} -p ${DB_PORT} -U ${ADMIN_USER}"
  exit 0
fi
if [[ "$MODE" == "--check" ]]; then
  rm -f "/tmp/.mira-rc6-url-${DB_NAME}"
  echo "ACCEPT ${DB_NAME} on ${DB_HOST}:${DB_PORT} admin=${ADMIN_USER} prisma_role=${DB_ROLE}"
  exit 0
fi

trap cleanup EXIT INT TERM

exists_err="$(mktemp)"
set +e
exists_out="$(admin_psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>"$exists_err")"
exists_status=$?
set -e
if [[ "$MODE" == "--prove-port" ]]; then
  rm -f "/tmp/.mira-rc6-url-${DB_NAME}" "$exists_err"
  if [[ "$exists_status" -eq 0 ]]; then
    echo "REFUSE prove-port connected instead of stopping" >&2
    exit 1
  fi
  echo "STOP existence check failed for ${DB_HOST}:${DB_PORT}; connection failure is not an absent database"
  exit 3
fi
if [[ "$exists_status" -ne 0 ]]; then
  echo "STOP existence check failed for ${DB_HOST}:${DB_PORT}; connection failure is not an absent database" >&2
  cat "$exists_err" >&2
  rm -f "$exists_err" "/tmp/.mira-rc6-url-${DB_NAME}"
  exit 3
fi
rm -f "$exists_err"
if printf '%s' "$exists_out" | grep -q 1; then
  echo "REFUSE ${DB_NAME} already exists and was not created by this run" >&2
  exit 2
fi
if [[ "$MODE" != "run" ]]; then
  echo "REFUSE unknown mode" >&2
  exit 2
fi

set -e
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" "$DB_NAME"
created=1
admin_psql -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_ROLE};" \
  -c "GRANT ALL ON SCHEMA public TO ${DB_ROLE};" \
  -c "ALTER SCHEMA public OWNER TO ${DB_ROLE};"
server_port="$(admin_psql -d "$DB_NAME" -tAc 'SELECT inet_server_port()')"
server_port="$(printf '%s' "$server_port" | tr -d '[:space:]')"
echo "server_port=${server_port} expected=${DB_PORT}"
[[ "$server_port" == "$DB_PORT" ]]
if [[ "${MIRA_RC6_SIMULATE_CLEANUP_FAIL:-}" == "1" ]]; then
  echo "cleanup drill ready"
  exit 0
fi

export DATABASE_URL
DATABASE_URL="$(cat "/tmp/.mira-rc6-url-${DB_NAME}")"
rm -f "/tmp/.mira-rc6-url-${DB_NAME}"

PRE="$(mktemp -d)"
cp "$ROOT/prisma/schema.prisma" "$PRE/schema.prisma"
mkdir -p "$PRE/migrations"
for dir in "$ROOT"/prisma/migrations/*; do
  base="$(basename "$dir")"
  if [[ "$base" == "20260926040000_discover_catalog_rc2" || "$base" == "20260926120000_discover_content_ph3" || "$base" == "20260926230000_discover_content_ph3_rc2" || "$base" == "20260927013000_discover_content_ph3_rc3" || "$base" == "20260927040000_discover_content_ph3_rc4" ]]; then
    continue
  fi
  cp -R "$dir" "$PRE/migrations/$base"
done
cd "$ROOT"
npx prisma migrate deploy --schema "$PRE/schema.prisma"
admin_psql -d "$DB_NAME" -v ON_ERROR_STOP=1 << 'SQL'
INSERT INTO partners (id, type, status, name_ar, name_en, city, updated_at)
VALUES ('legacy-rc5-partner', 'brand', 'active', 'متجر سابق', 'Legacy', 'جدة', CURRENT_TIMESTAMP);
INSERT INTO products (id, partner_id, name_ar, name_en, price_halalas, external_url, concern_tags, skin_types)
VALUES ('legacy-rc5-product', 'legacy-rc5-partner', 'فستان سابق', 'Legacy dress', 3210, 'https://example.com', '{}', '{}');
INSERT INTO services (id, partner_id, name_ar, name_en, duration_min, price_halalas, concern_tags)
VALUES ('legacy-rc5-service', 'legacy-rc5-partner', 'خدمة سابقة', 'Legacy service', 30, 4500, '{}');
SQL
npx prisma migrate deploy --schema "$ROOT/prisma/schema.prisma"
product_row="$(admin_psql -d "$DB_NAME" -tAc "SELECT id || '|' || price_halalas::text || '|' || COALESCE(category, 'NULL') || '|' || content_status FROM products WHERE id = 'legacy-rc5-product'")"
service_row="$(admin_psql -d "$DB_NAME" -tAc "SELECT id || '|' || price_halalas::text || '|' || COALESCE(category, 'NULL') || '|' || content_status FROM services WHERE id = 'legacy-rc5-service'")"
echo "legacy-product ${product_row}"
echo "legacy-service ${service_row}"
[[ "$product_row" == "legacy-rc5-product|3210|NULL|published" ]]
[[ "$service_row" == "legacy-rc5-service|4500|NULL|published" ]]
admin_psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "DELETE FROM partners WHERE id = 'legacy-rc5-partner';"
rm -rf "$PRE"

npx prisma generate
npx prisma migrate deploy --schema "$ROOT/prisma/schema.prisma"
npx --no-install tsx src/marketplace/marketplace.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-content.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-storage.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-content.rc3.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-content.rc4.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-media.rc5.storage-tests.ts
npx --no-install tsx src/marketplace/catalog-media.rc5.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-media.rc6.storage-tests.ts
npx --no-install tsx src/marketplace/catalog-media.rc6.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-ad.ph4.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-ad.ph4.rc2.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-ad.ph4.rc3.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-ad.ph4.rc4.http.integration-tests.ts
npx --no-install tsx src/marketplace/catalog-ad.ph4.rc6.http.integration-tests.ts
echo "rc6 integration passed"
