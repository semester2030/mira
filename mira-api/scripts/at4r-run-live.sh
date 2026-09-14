#!/usr/bin/env bash
# AT-4R — Live provider readiness check + AT-4 live branch.
# Never prints secrets. Never touches Render/production.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== AT-4R Live Provider Readiness ==="

if [[ ! -f .env.qa ]]; then
  echo "BLOCKED: .env.qa missing. Run: cp .env.qa.example .env.qa && edit LLM_API_KEY"
  exit 10
fi

# shellcheck disable=SC1091
set -a
source "$ROOT/scripts/at4r-export-qa-env.sh"
set +a

if [[ -z "${LLM_API_KEY:-}" ]]; then
  echo "BLOCKED: LLM_API_KEY MISSING after loading .env.qa"
  exit 11
fi

export AT4_LIVE_PROVIDER=1
export FASHION_KNOWLEDGE_TELEMETRY_ENABLED=false
export FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED=false

echo "Running: AT4_LIVE_PROVIDER=1 npm run test:at4"
npm run test:at4

PROOF="$ROOT/dist/fashion-knowledge/at4-live-proof.json"
if [[ -f "$PROOF" ]]; then
  # Print proof flags only (no secrets / no provider payloads)
  node -e 'const p=require("./dist/fashion-knowledge/at4-live-proof.json"); console.log("liveProviderExecuted="+p.liveProviderExecuted); console.log("structuredOk="+p.structuredOk); console.log("claimLockInvoked="+p.claimLockInvoked); console.log("model="+p.model); console.log("latencyMs="+p.latencyMs); if(!p.liveProviderExecuted) process.exit(12);'
else
  echo "BLOCKED: at4-live-proof.json not written — live branch likely skipped"
  exit 12
fi

echo "AT-4R live provider proof OK"
