# Phase 3 — FASHN Production Audit

## Canonical path

Flutter `/ai/vision/outfit/analyze` → Fashion orchestrator → Vision adapter →
FASHN `/v1/run` → `/v1/status/{id}` → mask geometry/QEL → OpenAI semantics →
normalization/conflict/confidence gates → Garment Intelligence → canonical DTO.

Recolor uses FASHN Edit plus bounded QEL retries.

| Rung | Status |
|---|---|
| CODE | PASS |
| WIRED | PASS |
| CONFIGURED live | UNKNOWN (`FASHN_API_KEY`, `FASHN_BASE_URL`) |
| PROVIDER REACHABLE | network endpoint returned unauthenticated 401 |
| REAL REQUEST/RESPONSE | NOT_PROVEN |
| CANONICAL MAPPING | TEST_PROVEN only |
| USER E2E | NOT_PROVEN |

Missing configuration, 401, non-2xx, failed/unknown status, empty output,
timeout, malformed mask and quality rejection fail closed. Canonical Vision has
no mock fallback.

Residual paths:

- `OUTFIT_PROVIDER=mock` is legacy and blocked by production service guards;
- configuring legacy `OUTFIT_PROVIDER=fashn` reaches a provider class that can
  return mock fallback;
- authenticated `/ai/outfit-intelligence` can return deterministic synthetic
  scores after provider failure. It is not used by primary Flutter, but remains
  reachable API surface.

No real provider call was made because it could consume credits. Account,
billing, credits, model access, quota, rate limits and live credential presence
require owner/vendor verification. COST is UNKNOWN.

## Verdict

`PARTIAL / REAL_E2E_REQUIRES_OWNER_APPROVAL`
