#!/usr/bin/env bash
set -euo pipefail
REPO="${MIRA_REPO:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$REPO"
LOG="$REPO/audit-out/p1-rc3/logs"
mkdir -p "$LOG"

if [[ -f "$REPO/mira-api/.env.rc3" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO/mira-api/.env.rc3"
  set +a
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL required" >&2
  exit 2
fi

python3 - <<'PY'
import os, sys, urllib.parse
u = urllib.parse.urlparse(os.environ["DATABASE_URL"])
host = (u.hostname or "").lower()
db = (u.path or "/").lstrip("/").split("?")[0]
if host not in {"127.0.0.1", "localhost", "::1"} or db != "mira_p1_rc3_test":
    print(f"REFUSED host={host!r} db={db!r}", file=sys.stderr)
    sys.exit(3)
print(f"OK host={host} db={db}")
PY

export MIRA_PARTNER_EDITOR_V2=true
cd "$REPO/mira-api"
npx prisma migrate deploy
npm run check:field-registry 2>&1 | tee "$LOG/rc3-registry-sync.txt"
npm run test:registry-validation 2>&1 | tee "$LOG/rc3-registry-validation.txt"
npm run test:editor-v2 2>&1 | tee "$LOG/rc3-editor-v1-regression.txt"
npm run test:editor-v2-rc3 2>&1 | tee "$LOG/rc3-http-integration.txt"
node scripts/p1-rc3-browser-e2e.mjs 2>/dev/null | tee "$LOG/rc3-browser-e2e.txt"
cd "$REPO/partners-portal/web/js"
node editor-v2-isolation.tests.mjs 2>&1 | tee "$LOG/rc3-account-isolation.txt"
cd "$REPO"
flutter test test/features/marketplace/service_profile_json_parse_test.dart \
  test/features/marketplace/catalog_service_template_test.dart \
  2>&1 | tee "$LOG/rc3-flutter-tests.txt"
echo REVERIFY_OK
