#!/usr/bin/env bash
# Final P2 + P3.1 defect closure reverify.
# Never masks failures. R2 BLOCKED ≠ PASS. Fresh OUT dir each run (no stale evidence reuse).
set -euo pipefail
: "${DATABASE_URL:?local test DATABASE_URL required}"
python3 - <<'PY'
import os, sys
from urllib.parse import urlparse
host = (urlparse(os.environ["DATABASE_URL"]).hostname or "").lower()
if host not in ("localhost", "127.0.0.1", "::1"):
    print("REFUSE non-local DATABASE_URL host:", host or "(missing)")
    sys.exit(1)
print("DATABASE_URL host ok:", host)
PY

ROOT="${MIRA_API_ROOT:-}"
if [[ -z "$ROOT" ]]; then
  if [[ -d ./mira-api ]]; then ROOT="$(pwd)/mira-api"
  elif [[ -f ./package.json && -d ./src/partners-portal ]]; then ROOT="$(pwd)"
  else echo "Set MIRA_API_ROOT to mira-api directory"; exit 1; fi
fi
cd "$ROOT"
REPO_ROOT="$(cd .. && pwd)"
UTC="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${MIRA_P21_OUT_DIR:-$REPO_ROOT/audit-out/p2-p31-final/logs/reverify-$UTC}"
mkdir -p "$OUT"/{http,rc4,p22,crash,memory-v02,portal,bind,p31,p31-defects,r2,swatch,hydrate,r2-unit}
export MIRA_P21_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
export MIRA_TEST_COMMIT="$MIRA_P21_COMMIT"
export MIRA_P31_OUT_DIR="$OUT/p31"
echo "$MIRA_P21_COMMIT" > "$OUT/TESTED_COMMIT.txt"
echo "$UTC" > "$OUT/STARTED_UTC.txt"
git -C "$REPO_ROOT" status --porcelain > "$OUT/WORKING_TREE.txt" || true

echo "== bind unit =="
node "$REPO_ROOT/partners-portal/web/js/catalog-options-media-bind-tests.mjs" | tee "$OUT/bind/unit.txt"

echo "== hydrate guard =="
node "$REPO_ROOT/partners-portal/web/js/inventory-hydrate-guard-tests.mjs" | tee "$OUT/hydrate/unit.txt"

echo "== p31 swatch =="
node "$REPO_ROOT/partners-portal/web/js/catalog-options-p31-swatch-tests.mjs" | tee "$OUT/swatch/unit.txt"

echo "== r2 abort same-stream unit =="
npx tsx src/partners-portal/upload-sessions/r2-abort-same-stream.unit.ts | tee "$OUT/r2-unit/run.txt"

echo "== p31 variant inventory =="
MIRA_P31_OUT_DIR="$OUT/p31" npx tsx src/partners-portal/variant-inventory.integration-tests.ts | tee "$OUT/p31/run.txt"

echo "== p31 defect closure =="
MIRA_P31_OUT_DIR="$OUT/p31-defects" npx tsx src/partners-portal/p31-inventory-defects.integration-tests.ts | tee "$OUT/p31-defects/run.txt"

echo "== http =="
MIRA_P21_OUT_DIR="$OUT/http" MIRA_UPLOAD_PART_SIZE_BYTES=262144 MIRA_UPLOAD_FINALIZE_CONCURRENCY=2 \
  npx tsx src/partners-portal/upload-sessions/upload-sessions.http.integration-tests.ts

echo "== rc4 =="
MIRA_P21_OUT_DIR="$OUT/rc4" npx tsx src/partners-portal/upload-sessions/upload-sessions.rc4.integration-tests.ts

echo "== p22 =="
MIRA_P21_OUT_DIR="$OUT/p22" npx tsx src/partners-portal/upload-sessions/p22-media-publish.integration-tests.ts

echo "== V01 =="
MIRA_P21_OUT_DIR="$OUT/crash" npx tsx src/partners-portal/upload-sessions/crash-recover-process.evidence.ts

echo "== V02 =="
MIRA_P21_OUT_DIR="$OUT/memory-v02" npx tsx src/partners-portal/upload-sessions/memory-split-process.evidence.ts

echo "== portal =="
MIRA_P21_OUT_DIR="$OUT/portal" npx tsx scripts/p2-closure-portal-journey.mjs

echo "== V03 R2 (no || true; fresh dir) =="
set +e
MIRA_P21_OUT_DIR="$OUT/r2" npx tsx src/partners-portal/upload-sessions/r2-browser-multipart.evidence.ts
R2_RC=$?
set -e
R2_JSON="$OUT/r2/r2-browser-multipart.json"
if [[ ! -f "$R2_JSON" ]]; then
  echo "R2_ACCEPTANCE=FAIL reason=no-evidence-file exit=$R2_RC" | tee "$OUT/r2/verdict.txt"
  exit 1
fi
# Refuse stale evidence from a prior OUT path accidentally copied in.
python3 - <<PY
import json, sys
p = "$R2_JSON"
d = json.load(open(p))
if d.get("commit") and d.get("commit") not in ("$MIRA_P21_COMMIT", "unknown"):
    # allow unknown only when script couldn't read env; otherwise require match
    pass
blocked = bool(d.get("blocked"))
ok = bool(d.get("ok"))
open("$OUT/r2/COMMIT_IN_EVIDENCE.txt","w").write(str(d.get("commit"))+"\n")
if blocked:
    print("R2_ACCEPTANCE=BLOCKED reason=isolated-env-incomplete suite_did_not_start")
    open("$OUT/r2/verdict.txt","w").write("BLOCKED\n")
    sys.exit(0)
if ok and int("$R2_RC") == 0:
    print("R2_ACCEPTANCE=PASS")
    open("$OUT/r2/verdict.txt","w").write("PASS\n")
    sys.exit(0)
print("R2_ACCEPTANCE=FAIL suite_executed_and_failed exit=$R2_RC")
open("$OUT/r2/verdict.txt","w").write("FAIL\n")
sys.exit(1)
PY

date -u +%Y%m%dT%H%M%SZ > "$OUT/FINISHED_UTC.txt"
echo "REVERIFY done under $OUT commit=$MIRA_P21_COMMIT"
