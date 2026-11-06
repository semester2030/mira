#!/usr/bin/env bash
set -euo pipefail
REPO="${MIRA_REPO:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$REPO"
RUN_ID="reverify-$(date -u +%Y%m%dT%H%M%SZ)"
LOG="${MIRA_RC13_LOG:-$REPO/audit-out/p1-rc13/logs/$RUN_ID}"
mkdir -p "$LOG"
export MIRA_RC13_OUT_DIR="$LOG"
if [[ -f "$REPO/mira-api/.env.rc13" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO/mira-api/.env.rc13"
  set +a
fi
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL required" >&2; exit 2; }
python3 - <<'PY'
import os, sys, urllib.parse
u = urllib.parse.urlparse(os.environ["DATABASE_URL"])
h = (u.hostname or "").lower()
db = (u.path or "/").lstrip("/").split("?")[0]
if h not in {"127.0.0.1", "localhost", "::1"} or db != "mira_p1_rc13_test":
    print("REFUSED non-isolated DATABASE_URL", h, db, file=sys.stderr)
    sys.exit(3)
print("OK", h, db)
PY
export MIRA_PARTNER_EDITOR_V2=true
export RC13_TESTED_COMMIT="$(git -C "$REPO" rev-parse HEAD)"
WT_STATUS="$(git -C "$REPO" status --porcelain)"
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cd "$REPO/mira-api"

run_cmd() {
  local name="$1"; shift
  local ec=0
  echo "=== BEGIN $name ===" | tee -a "$LOG/reverify-full.log"
  set +e
  "$@" 2>&1 | tee "$LOG/$name.txt"
  ec=${PIPESTATUS[0]}
  set -e
  echo "=== END $name exit=$ec ===" | tee -a "$LOG/reverify-full.log"
  echo "$ec" > "$LOG/$name.exit"
  return 0
}

npx prisma db push --skip-generate | tee "$LOG/prisma-push.txt"
run_cmd rc13-registry-sync npm run check:field-registry
run_cmd rc13-editor-v2-regression npm run test:editor-v2
run_cmd rc13-f2-busy-defects node scripts/p1-rc13-f2-busy-defects.mjs
run_cmd rc13-browser-e2e node scripts/p1-rc13-browser-e2e.mjs
run_cmd rc13-field-coverage node scripts/p1-rc13-field-coverage.mjs
# sensitivity after e2e+fields — only THIS run's outputs (no historical fallback)
E2E_FILE="$LOG/rc13-browser-e2e.json"
if [[ ! -f "$E2E_FILE" ]]; then E2E_FILE="$LOG/rc13-browser-e2e.txt"; fi
FIELD_FILE="$LOG/field-coverage.json"
if [[ -f "$E2E_FILE" ]]; then export MIRA_RC13_E2E_RESULTS="$E2E_FILE"; fi
if [[ -f "$FIELD_FILE" ]]; then export MIRA_RC13_FIELD_RESULTS="$FIELD_FILE"; fi
run_cmd rc13-acceptance-sensitivity node scripts/p1-rc13-acceptance-sensitivity.mjs
cd "$REPO/partners-portal/web/js"
run_cmd rc13-options-contract node options-registry-contract.tests.mjs
run_cmd rc13-account-isolation node editor-v2-isolation.tests.mjs
cd "$REPO"
run_cmd rc13-flutter-tests flutter test test/features/marketplace/service_profile_json_parse_test.dart test/features/marketplace/catalog_service_template_test.dart
FINISHED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - <<PY
import json, re, sys
from pathlib import Path
log = Path("$LOG")
repo = Path("$REPO")

def exit_code(name):
    p = log / f"{name}.exit"
    return int(p.read_text().strip()) if p.exists() else 99

def load_json_blob(path):
    raw = path.read_text()
    # prefer trailing JSON object
    i = raw.rfind('"ok"')
    if i < 0:
        return None
    start = raw.rfind("{", 0, i)
    depth = 0
    for j in range(start, len(raw)):
        if raw[j] == "{":
            depth += 1
        elif raw[j] == "}":
            depth -= 1
            if depth == 0:
                return json.loads(raw[start : j + 1])
    return None

cmds = {
    "registry": exit_code("rc13-registry-sync"),
    "editor_v2": exit_code("rc13-editor-v2-regression"),
    "f2_busy": exit_code("rc13-f2-busy-defects"),
    "e2e": exit_code("rc13-browser-e2e"),
    "field_coverage": exit_code("rc13-field-coverage"),
    "sensitivity": exit_code("rc13-acceptance-sensitivity"),
    "options": exit_code("rc13-options-contract"),
    "isolation": exit_code("rc13-account-isolation"),
    "flutter": exit_code("rc13-flutter-tests"),
}

# defects from THIS run
defects = None
for cand in [log / "f2-busy-defects.json", log / "rc13-f2-busy-defects.txt"]:
    if cand.exists():
        try:
            if cand.suffix == ".json":
                defects = json.loads(cand.read_text())
            else:
                defects = load_json_blob(cand)
        except Exception:
            pass
if not defects or not defects.get("ok"):
    print("f2-busy defects failed", defects, file=sys.stderr)
    sys.exit(4)

e2e = None
cands = list(log.glob("**/rc13-browser-e2e.json")) or list(log.glob("**/rc13-browser-e2e.txt"))
if not cands:
    print("missing e2e results in run dir", log, file=sys.stderr)
    sys.exit(4)
raw = cands[0].read_text()
try:
    e2e = json.loads(raw)
except Exception:
    e2e = load_json_blob(cands[0])
if not e2e or not e2e.get("ok"):
    print("e2e not ok", (e2e or {}).get("failed"), (e2e or {}).get("extraFails"), (e2e or {}).get("missingMandatory"), file=sys.stderr)
    sys.exit(4)

# mandatory acceptance ids
required = [
    "RC13-10-product-inform",
    "RC13-10-product-reload",
    "RC13-10-service-inform",
    "RC13-10-service-reload",
    "RC13-14-legacy-product",
    "RC13-14-legacy-service",
    "RC13-14-legacy-product-retry",
    "RC13-14-legacy-service-retry",
    "RC13-12-product-exact-delete",
    "RC13-12-service-exact-clear",
]
ids = {r["id"]: r for r in e2e.get("results") or []}
missing = [i for i in required if i not in ids]
failed_req = [i for i in required if i in ids and ids[i].get("status") != "PASS_LOCAL"]
if missing or failed_req:
    print("mandatory acceptance missing/failed", missing, failed_req, file=sys.stderr)
    sys.exit(4)

# F2 from defects findings
fids = {f.get("id"): f for f in (defects.get("findings") or [])}
for need in ("RC13-F2-URL", "RC13-F2-BUSY"):
    f = fids.get(need)
    if not f or f.get("reproduced") is not False:
        print("F2 regression present or missing", need, f, file=sys.stderr)
        sys.exit(4)

sens = load_json_blob(log / "rc13-acceptance-sensitivity.txt") or {}
if not sens.get("ok"):
    # also try dedicated json
    sj = log / "ACCEPTANCE_SENSITIVITY.json"
    if sj.exists():
        sens = json.loads(sj.read_text())
if not sens.get("ok"):
    print("sensitivity failed", sens, file=sys.stderr)
    sys.exit(4)

fc = None
for cand in [log / "field-coverage.json", log / "rc13-field-coverage.txt"]:
    if cand.exists():
        try:
            fc = json.loads(cand.read_text()) if cand.name.endswith(".json") else load_json_blob(cand)
        except Exception:
            pass
if not fc or not fc.get("ok"):
    print("field coverage failed", fc, file=sys.stderr)
    sys.exit(4)

checks = {
    "registry": "FIELD_REGISTRY_SYNC_OK" in (log / "rc13-registry-sync.txt").read_text(),
    "options": bool(re.search(r'"ok"\s*:\s*true', (log / "rc13-options-contract.txt").read_text())),
    "isolation": bool(re.search(r'"ok"\s*:\s*true', (log / "rc13-account-isolation.txt").read_text())),
    "flutter": "All tests passed" in (log / "rc13-flutter-tests.txt").read_text(),
    "editor_v2": bool(re.search(r'"ok"\s*:\s*true', (log / "rc13-editor-v2-regression.txt").read_text(), re.I))
        or "PASS_LOCAL" in (log / "rc13-editor-v2-regression.txt").read_text(),
    "command_exits": all(v == 0 for v in cmds.values()),
}
if not all(checks.values()):
    print("companion failed", checks, cmds, file=sys.stderr)
    sys.exit(4)

run = {
    "runId": "$RUN_ID",
    "codeCommit": "$RC13_TESTED_COMMIT",
    "workingTreePorcelain": """$WT_STATUS""",
    "workingTreeClean": len("""$WT_STATUS""".strip()) == 0,
    "db": "mira_p1_rc13_test",
    "startedUtc": "$STARTED",
    "finishedUtc": "$FINISHED",
    "outDir": str(log),
    "cwd": str(repo),
    "commands": list(cmds.keys()),
    "exitCodes": cmds,
    "checks": checks,
    "defectsOk": True,
    "e2eOk": True,
    "fieldCoverageOk": True,
    "sensitivityOk": True,
    "mandatoryAcceptance": required,
    "judgment": "REVERIFY_OK",
}
(log / "REVERIFY_RUN.json").write_text(json.dumps(run, ensure_ascii=False, indent=2), encoding="utf-8")
(repo / "audit-out/p1-rc13/REVERIFY_RUN.json").write_text(json.dumps(run, ensure_ascii=False, indent=2), encoding="utf-8")
print("REVERIFY_OK", "$RUN_ID")
PY
