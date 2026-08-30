#!/usr/bin/env bash
# AT-4R — Export local QA env from mira-api/.env.qa without printing secrets.
# Usage (from mira-api):
#   set -a && source scripts/at4r-export-qa-env.sh && set +a
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QA_ENV="$ROOT/.env.qa"

if [[ ! -f "$QA_ENV" ]]; then
  echo "AT4R: missing $QA_ENV"
  echo "AT4R: copy .env.qa.example → .env.qa and set LLM_API_KEY locally (do not commit)."
  return 1 2>/dev/null || exit 1
fi

# shellcheck disable=SC1090
set -a
# Load only KEY=VALUE lines; never echo values
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  [[ "$line" != *=* ]] && continue
  key="${line%%=*}"
  # Basic key sanity
  if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    export "$line"
  fi
done < "$QA_ENV"
set +a

# Presence-only readiness (no values)
presence() {
  local k="$1"
  if [[ -n "${!k:-}" ]]; then
    echo "AT4R_READY $k=PRESENT"
  else
    echo "AT4R_READY $k=MISSING"
  fi
}

presence LLM_API_KEY
presence LLM_BASE_URL
presence LLM_MODEL
presence FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED
presence FASHION_KNOWLEDGE_LLM_ENABLED
presence FASHION_KNOWLEDGE_TELEMETRY_ENABLED
presence FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED
presence AUTH_SKIP

if [[ -z "${LLM_API_KEY:-}" ]]; then
  echo "AT4R: LLM_API_KEY still MISSING — live provider blocked."
  return 2 2>/dev/null || exit 2
fi

if [[ "${FASHION_KNOWLEDGE_TELEMETRY_ENABLED:-false}" == "true" ]]; then
  echo "AT4R: refuse — telemetry must stay false in QA."
  return 3 2>/dev/null || exit 3
fi

if [[ "${FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED:-false}" == "true" ]]; then
  echo "AT4R: refuse — legacy MCE fashion must stay false."
  return 4 2>/dev/null || exit 4
fi

echo "AT4R: QA env exported (values not printed)."
