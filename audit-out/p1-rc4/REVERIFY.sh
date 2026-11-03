#!/usr/bin/env bash
set -euo pipefail
REPO="${MIRA_REPO:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$REPO"
LOG="$REPO/audit-out/p1-rc4/logs"
mkdir -p "$LOG"
if [[ -f "$REPO/mira-api/.env.rc4" ]]; then set -a; source "$REPO/mira-api/.env.rc4"; set +a; fi
[[ -n "${DATABASE_URL:-}" ]] || { echo DATABASE_URL required; exit 2; }
python3 - <<'PY'
import os,sys,urllib.parse
u=urllib.parse.urlparse(os.environ["DATABASE_URL"])
h=(u.hostname or "").lower(); db=(u.path or "/").lstrip("/").split("?")[0]
if h not in {"127.0.0.1","localhost","::1"} or db!="mira_p1_rc4_test":
  print("REFUSED",h,db); sys.exit(3)
print("OK",h,db)
PY
export MIRA_PARTNER_EDITOR_V2=true
cd "$REPO/mira-api"
npx prisma migrate deploy
npm run check:field-registry | tee "$LOG/rc4-registry-sync.txt"
npm run test:registry-validation | tee "$LOG/rc4-registry-validation.txt"
npm run test:editor-v2 | tee "$LOG/rc4-editor-v1-regression.txt"
npm run test:editor-v2-rc4 | tee "$LOG/rc4-http-integration.txt"
node scripts/p1-rc4-browser-e2e.mjs 2>/dev/null | tee "$LOG/rc4-browser-e2e.txt"
cd "$REPO/partners-portal/web/js"
node options-registry-contract.tests.mjs | tee "$LOG/rc4-options-contract.txt"
node editor-v2-isolation.tests.mjs | tee "$LOG/rc4-account-isolation.txt"
cd "$REPO"
flutter test test/features/marketplace/service_profile_json_parse_test.dart test/features/marketplace/catalog_service_template_test.dart | tee "$LOG/rc4-flutter-tests.txt"
echo REVERIFY_OK
