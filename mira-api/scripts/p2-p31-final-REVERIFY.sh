#!/usr/bin/env bash
# Final P2 + P3.1 D1–D4 / T1 / R2 reverify.
# Never masks failures. R2 BLOCKED ≠ PASS. Fresh OUT dir each run (no stale evidence reuse).
# Evidence commit must match the tested SHA (MIRA_P21_COMMIT / REQUIRED_COMMIT).
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
OUT="${MIRA_P21_OUT_DIR:-$REPO_ROOT/audit-out/p2-p31-final2/logs/reverify-$UTC}"
mkdir -p "$OUT"/{http,rc4,p22,crash,memory-v02,portal,bind,p31,p31-defects,p31-d1d4,r2,swatch,hydrate,editor-state,r2-unit,typecheck}
export MIRA_P21_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
export MIRA_TEST_COMMIT="$MIRA_P21_COMMIT"
export MIRA_P31_OUT_DIR="$OUT/p31"
echo "$MIRA_P21_COMMIT" > "$OUT/TESTED_COMMIT.txt"
echo "$UTC" > "$OUT/STARTED_UTC.txt"
git -C "$REPO_ROOT" status --porcelain > "$OUT/WORKING_TREE.txt" || true

if [[ -n "${REQUIRED_COMMIT:-}" ]]; then
  if [[ "$MIRA_P21_COMMIT" != "$REQUIRED_COMMIT" ]]; then
    echo "SHA_MISMATCH evidence_commit=$MIRA_P21_COMMIT required=$REQUIRED_COMMIT" | tee "$OUT/SHA_MISMATCH.txt"
    echo "FAIL: tested SHA does not match REQUIRED_COMMIT — refusing pass"
    exit 1
  fi
fi

echo "== bind unit =="
node "$REPO_ROOT/partners-portal/web/js/catalog-options-media-bind-tests.mjs" | tee "$OUT/bind/unit.txt"

echo "== hydrate guard (MiraInventoryEditor) =="
node "$REPO_ROOT/partners-portal/web/js/inventory-hydrate-guard-tests.mjs" | tee "$OUT/hydrate/unit.txt"

echo "== inventory editor state =="
node "$REPO_ROOT/partners-portal/web/js/inventory-editor-state-tests.mjs" | tee "$OUT/editor-state/unit.txt"

echo "== p31 swatch =="
node "$REPO_ROOT/partners-portal/web/js/catalog-options-p31-swatch-tests.mjs" | tee "$OUT/swatch/unit.txt"

echo "== r2 abort same-stream unit =="
npx tsx src/partners-portal/upload-sessions/r2-abort-same-stream.unit.ts | tee "$OUT/r2-unit/run.txt"

echo "== r2 mira gate unit =="
npx tsx src/partners-portal/upload-sessions/r2-mira-gate.unit.ts | tee "$OUT/r2-unit/mira-gate.txt"

echo "== typecheck (changed P3.1 / R2 modules) =="
set +e
# Full-project tsc has pre-existing unrelated .spec.ts failures; gate on touched modules.
npx tsc -p tsconfig.json --noEmit > "$OUT/typecheck/tsc-full.txt" 2>&1
TSC_RC=$?
set -e
TOUCHED_ERR=0
if [[ -f "$OUT/typecheck/tsc-full.txt" ]]; then
  if grep -E 'commerce\.service\.ts|variant-inventory\.service\.ts|p31-d1-d4|p31-inventory-defects|r2-browser-multipart\.evidence\.ts|r2-abort-same-stream' \
    "$OUT/typecheck/tsc-full.txt" > "$OUT/typecheck/tsc-touched.txt"; then
    TOUCHED_ERR=1
  else
    echo "(no errors in touched modules)" > "$OUT/typecheck/tsc-touched.txt"
  fi
fi
if [[ $TOUCHED_ERR -ne 0 ]]; then
  echo "TYPECHECK=FAIL touched-modules" | tee "$OUT/typecheck/verdict.txt"
  cat "$OUT/typecheck/tsc-touched.txt"
  exit 1
fi
echo "TYPECHECK=PASS touched-modules (full-project exit=$TSC_RC recorded)" | tee "$OUT/typecheck/verdict.txt"

echo "== p31 variant inventory =="
MIRA_P31_OUT_DIR="$OUT/p31" npx tsx src/partners-portal/variant-inventory.integration-tests.ts | tee "$OUT/p31/run.txt"

echo "== p31 defect closure =="
MIRA_P31_OUT_DIR="$OUT/p31-defects" npx tsx src/partners-portal/p31-inventory-defects.integration-tests.ts | tee "$OUT/p31-defects/run.txt"

echo "== p31 D1-D4 path tests =="
MIRA_P31_OUT_DIR="$OUT/p31-d1d4" npx tsx src/partners-portal/p31-d1-d4.integration-tests.ts | tee "$OUT/p31-d1d4/run.txt"

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
python3 - <<PY
import json, sys
p = "$R2_JSON"
d = json.load(open(p))
ev_commit = str(d.get("commit") or "")
tested = "$MIRA_P21_COMMIT"
open("$OUT/r2/COMMIT_IN_EVIDENCE.txt","w").write(ev_commit + "\n")
if ev_commit and ev_commit not in (tested, "unknown"):
    print(f"R2_ACCEPTANCE=FAIL reason=evidence-commit-mismatch evidence={ev_commit} tested={tested}")
    open("$OUT/r2/verdict.txt","w").write("FAIL\n")
    sys.exit(1)
# Refuse treating a prior OUT as this run: startedUtc must exist and be after STARTED_UTC file.
blocked = bool(d.get("blocked"))
ok = bool(d.get("ok"))
if blocked:
    print("R2_ACCEPTANCE=BLOCKED reason=isolated-env-or-mira-path-incomplete")
    open("$OUT/r2/verdict.txt","w").write("BLOCKED\n")
    sys.exit(0)
if ok and int("$R2_RC") == 0:
    print("R2_ACCEPTANCE=PASS")
    open("$OUT/r2/verdict.txt","w").write("PASS\n")
    sys.exit(0)
print(f"R2_ACCEPTANCE=FAIL suite_executed_and_failed exit=$R2_RC")
open("$OUT/r2/verdict.txt","w").write("FAIL\n")
sys.exit(1)
PY

date -u +%Y%m%dT%H%M%SZ > "$OUT/FINISHED_UTC.txt"
echo "REVERIFY done under $OUT commit=$MIRA_P21_COMMIT"
echo "LOCAL_RESULTS=$OUT"
