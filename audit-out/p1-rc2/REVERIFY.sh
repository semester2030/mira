#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$(cd "$(dirname "$0")" && pwd)/logs"
mkdir -p "$LOG_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL required (local host + mira_db or mira_test*)" >&2
  exit 2
fi

# Explicit host/name allowlist — do not rely on substring "localhost" alone
python3 - <<'PY'
import os, sys, urllib.parse
u = urllib.parse.urlparse(os.environ["DATABASE_URL"])
host = (u.hostname or "").lower()
db = (u.path or "/").lstrip("/").split("?")[0]
ok_hosts = {"127.0.0.1", "localhost", "::1"}
ok_dbs = {"mira_db"} | {d for d in [db] if d.startswith("mira_test")}
if host not in ok_hosts or db not in ok_dbs and not db.startswith("mira_test"):
    print(f"REFUSED: host={host!r} db={db!r} — use local mira_db / mira_test*", file=sys.stderr)
    sys.exit(3)
print(f"OK database host={host} name={db}")
PY

cd "$ROOT/mira-api"
npx prisma migrate deploy
npm run check:field-registry 2>&1 | tee "$LOG_DIR/rc2-registry-sync.txt"
npm run test:registry-validation 2>&1 | tee "$LOG_DIR/rc2-registry-validation.txt"
npm run test:editor-v2 2>&1 | tee "$LOG_DIR/rc2-editor-v1-regression.txt"
# HTTP RC2 only (validation already above)
npx tsx src/partners-portal/editor-drafts/editor-v2-rc2.http.integration-tests.ts 2>&1 | tee "$LOG_DIR/rc2-http-integration.txt"

cd "$ROOT/partners-portal/web/js"
node --test editor-v2-isolation.tests.mjs 2>&1 | tee "$LOG_DIR/rc2-account-isolation.txt"

cd "$ROOT"
flutter test test/features/marketplace/service_profile_json_parse_test.dart \
  test/features/marketplace/catalog_service_template_test.dart \
  2>&1 | tee "$LOG_DIR/rc2-flutter-tests.txt"

echo "REVERIFY complete exit=0"
