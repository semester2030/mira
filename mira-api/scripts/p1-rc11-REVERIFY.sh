#!/usr/bin/env bash
set -euo pipefail
REPO="${MIRA_REPO:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$REPO"
RUN_ID="reverify-$(date -u +%Y%m%dT%H%M%SZ)"
LOG="${MIRA_RC11_LOG:-$REPO/audit-out/p1-rc11/logs/$RUN_ID}"
mkdir -p "$LOG"
export MIRA_RC11_OUT_DIR="$LOG"
if [[ -f "$REPO/mira-api/.env.rc11" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO/mira-api/.env.rc11"
  set +a
fi
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL required" >&2; exit 2; }
python3 - <<'PY'
import os, sys, urllib.parse
u = urllib.parse.urlparse(os.environ["DATABASE_URL"])
h = (u.hostname or "").lower()
db = (u.path or "/").lstrip("/").split("?")[0]
if h not in {"127.0.0.1", "localhost", "::1"} or db != "mira_p1_rc11_test":
    print("REFUSED non-isolated DATABASE_URL", h, db, file=sys.stderr)
    sys.exit(3)
print("OK", h, db)
PY
export MIRA_PARTNER_EDITOR_V2=true
export RC11_TESTED_COMMIT="$(git -C "$REPO" rev-parse HEAD)"
WT_STATUS="$(git -C "$REPO" status --porcelain)"
STARTED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cd "$REPO/mira-api"
npx prisma db push --skip-generate | tee "$LOG/prisma-push.txt"
npm run check:field-registry | tee "$LOG/rc11-registry-sync.txt"
npm run test:editor-v2 | tee "$LOG/rc11-editor-v2-regression.txt"
node scripts/p1-rc11-f2-busy-defects.mjs | tee "$LOG/rc11-f2-busy-defects-post.txt"
node scripts/p1-rc11-browser-e2e.mjs | tee "$LOG/rc11-browser-e2e.reverify.txt"
cd "$REPO/partners-portal/web/js"
node options-registry-contract.tests.mjs | tee "$LOG/rc11-options-contract.txt"
node editor-v2-isolation.tests.mjs | tee "$LOG/rc11-account-isolation.txt"
cd "$REPO"
flutter test test/features/marketplace/service_profile_json_parse_test.dart test/features/marketplace/catalog_service_template_test.dart | tee "$LOG/rc11-flutter-tests.txt"
FINISHED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - <<PY
import json, re, sys
from pathlib import Path
log = Path("$LOG")
repo = Path("$REPO")
# defects from THIS run only
raw = (log / "rc11-f2-busy-defects-post.txt").read_text()
i = raw.rfind('"ok"')
start = raw.rfind("{", 0, i)
depth = 0
jsn = None
for j in range(start, len(raw)):
    if raw[j] == "{":
        depth += 1
    elif raw[j] == "}":
        depth -= 1
        if depth == 0:
            jsn = json.loads(raw[start : j + 1])
            break
if not jsn or not jsn.get("ok"):
    print("f2-busy defects failed", file=sys.stderr)
    sys.exit(4)
e2e = log / "rc11-browser-e2e.txt"
if not e2e.exists():
    # harness may write under outDir/logs
    cand = list(log.glob("**/rc11-browser-e2e.txt"))
    e2e = cand[0] if cand else e2e
if not e2e.exists():
    print("missing e2e results in run dir", log, file=sys.stderr)
    sys.exit(4)
ej = json.loads(e2e.read_text())
if not ej.get("ok"):
    print("e2e not ok", ej.get("failed"), ej.get("extraFails"), file=sys.stderr)
    sys.exit(4)
checks = {
    "registry": "FIELD_REGISTRY_SYNC_OK" in (log / "rc11-registry-sync.txt").read_text(),
    "options": bool(re.search(r'"ok"\s*:\s*true', (log / "rc11-options-contract.txt").read_text())),
    "isolation": bool(re.search(r'"ok"\s*:\s*true', (log / "rc11-account-isolation.txt").read_text())),
    "flutter": "All tests passed" in (log / "rc11-flutter-tests.txt").read_text(),
    "editor_v2": bool(re.search(r'"ok"\s*:\s*true', (log / "rc11-editor-v2-regression.txt").read_text(), re.I))
        or "PASS_LOCAL" in (log / "rc11-editor-v2-regression.txt").read_text(),
}
if not all(checks.values()):
    print("companion failed", checks, file=sys.stderr)
    sys.exit(4)
run = {
    "runId": "$RUN_ID",
    "codeCommit": "$RC11_TESTED_COMMIT",
    "workingTreePorcelain": """$WT_STATUS""",
    "workingTreeClean": len("""$WT_STATUS""".strip()) == 0,
    "db": "mira_p1_rc11_test",
    "startedUtc": "$STARTED",
    "finishedUtc": "$FINISHED",
    "outDir": str(log),
    "commands": [
        "prisma db push",
        "check:field-registry",
        "test:editor-v2",
        "p1-rc11-f2-busy-defects.mjs",
        "p1-rc11-browser-e2e.mjs",
        "options-registry-contract.tests.mjs",
        "editor-v2-isolation.tests.mjs",
        "flutter contract tests",
    ],
    "exitCodes": {"aggregate": 0},
    "checks": checks,
    "defectsOk": True,
    "e2eOk": True,
    "judgment": "REVERIFY_OK",
}
(log / "REVERIFY_RUN.json").write_text(json.dumps(run, ensure_ascii=False, indent=2), encoding="utf-8")
(repo / "audit-out/p1-rc11/REVERIFY_RUN.json").write_text(json.dumps(run, ensure_ascii=False, indent=2), encoding="utf-8")
print("REVERIFY_OK", "$RUN_ID")
PY
