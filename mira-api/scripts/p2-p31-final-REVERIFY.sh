#!/usr/bin/env bash
# Final P2 + P3.1 D1–D4 / T1 / R2 reverify.
# Never masks failures. R2 BLOCKED ≠ PASS. Fresh OUT dir each run (no stale evidence reuse).
# Evidence commit must match the tested SHA; refuse unknown/empty/mismatch.
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
RUN_ID="reverify-${UTC}-$$"
OUT="${MIRA_P21_OUT_DIR:-$REPO_ROOT/audit-out/p2-p31-verified/logs/$RUN_ID}"
# Refuse reusing an existing evidence directory (stale verdict risk).
if [[ -e "$OUT" ]]; then
  echo "REFUSE: evidence dir already exists: $OUT"
  exit 1
fi
mkdir -p "$OUT"/{http,rc4,p22,crash,memory-v02,portal,bind,p31,p31-defects,p31-d1d4,r2,swatch,hydrate,editor-state,r2-unit,typecheck,evidence-gate}
export MIRA_P21_COMMIT="$(git -C "$REPO_ROOT" rev-parse HEAD)"
export MIRA_TEST_COMMIT="$MIRA_P21_COMMIT"
export MIRA_P31_OUT_DIR="$OUT/p31"
echo "$MIRA_P21_COMMIT" > "$OUT/TESTED_COMMIT.txt"
echo "$UTC" > "$OUT/STARTED_UTC.txt"
echo "$RUN_ID" > "$OUT/RUN_ID.txt"
git -C "$REPO_ROOT" status --porcelain > "$OUT/WORKING_TREE.txt" || true
date -u +%Y-%m-%dT%H:%M:%SZ > "$OUT/STARTED_ISO.txt"

if [[ -n "${REQUIRED_COMMIT:-}" ]]; then
  if [[ "$MIRA_P21_COMMIT" != "$REQUIRED_COMMIT" ]]; then
    echo "SHA_MISMATCH evidence_commit=$MIRA_P21_COMMIT required=$REQUIRED_COMMIT" | tee "$OUT/SHA_MISMATCH.txt"
    echo "FAIL" > "$OUT/verdict.txt"
    echo "FAIL: tested SHA does not match REQUIRED_COMMIT — refusing pass"
    exit 1
  fi
fi

fail_run() {
  echo "FAIL" > "$OUT/verdict.txt"
  echo "$1" | tee "$OUT/FAILURE.txt"
  date -u +%Y%m%dT%H%M%SZ > "$OUT/FINISHED_UTC.txt"
  exit 1
}

echo "== evidence integrity unit =="
npx tsx src/partners-portal/upload-sessions/reverify-evidence-gate.unit.ts | tee "$OUT/evidence-gate/unit.txt"

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

echo "== typecheck (changed P3.1 / R2 / catalog-content modules) =="
set +e
npx tsc -p tsconfig.json --noEmit > "$OUT/typecheck/tsc-full.txt" 2>&1
TSC_RC=$?
set -e
TOUCHED_ERR=0
if [[ -f "$OUT/typecheck/tsc-full.txt" ]]; then
  if grep -E 'commerce\.service\.ts|variant-inventory\.service\.ts|catalog-content\.service\.ts|catalog-media\.controller\.ts|p31-d1-d4|p31-inventory-defects|r2-browser-multipart\.evidence\.ts|r2-acceptance-gate\.ts|r2-mira-gate|r2-abort-same-stream|reverify-evidence-gate' \
    "$OUT/typecheck/tsc-full.txt" > "$OUT/typecheck/tsc-touched.txt"; then
    TOUCHED_ERR=1
  else
    echo "(no errors in touched modules)" > "$OUT/typecheck/tsc-touched.txt"
  fi
fi
if [[ $TOUCHED_ERR -ne 0 ]]; then
  echo "TYPECHECK=FAIL touched-modules" | tee "$OUT/typecheck/verdict.txt"
  cat "$OUT/typecheck/tsc-touched.txt"
  fail_run "typecheck touched modules failed"
fi
echo "TYPECHECK=PASS touched-modules (full-project exit=$TSC_RC recorded)" | tee "$OUT/typecheck/verdict.txt"
echo "tsc_full_exit=$TSC_RC" >> "$OUT/typecheck/verdict.txt"

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
  fail_run "R2 evidence file missing"
fi
# Authoritative verifier (same module unit-tested) — not a parallel python copy.
STARTED_ISO="$(cat "$OUT/STARTED_ISO.txt")"
set +e
npx tsx src/partners-portal/upload-sessions/verify-r2-evidence.ts \
  "$R2_JSON" "$MIRA_P21_COMMIT" "$STARTED_ISO" "$R2_RC" "$RUN_ID"
VERIFY_RC=$?
set -e
if [[ ! -f "$OUT/r2/verdict.txt" ]]; then
  echo "FAIL" > "$OUT/r2/verdict.txt"
  fail_run "R2 verify did not write verdict"
fi
VERDICT="$(tr -d '\n' < "$OUT/r2/verdict.txt")"
echo "R2_ACCEPTANCE=$VERDICT verify_exit=$VERIFY_RC"
if [[ "$VERDICT" == "FAIL" || "$VERIFY_RC" -ne 0 && "$VERDICT" != "BLOCKED" ]]; then
  fail_run "R2 evidence verification failed"
fi

date -u +%Y%m%dT%H%M%SZ > "$OUT/FINISHED_UTC.txt"
# Overwrite any stale overall verdict only after successful completion of gated steps.
if [[ -f "$OUT/r2/verdict.txt" ]] && grep -qx "FAIL" "$OUT/r2/verdict.txt"; then
  echo "FAIL" > "$OUT/verdict.txt"
  echo "REVERIFY failed under $OUT commit=$MIRA_P21_COMMIT"
  exit 1
fi
echo "PASS_LOCAL_OR_R2_BLOCKED" > "$OUT/verdict.txt"
echo "REVERIFY done under $OUT commit=$MIRA_P21_COMMIT"
echo "LOCAL_RESULTS=$OUT"
