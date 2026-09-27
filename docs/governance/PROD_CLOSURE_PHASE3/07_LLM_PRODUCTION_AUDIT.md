# Phase 3 — OpenAI-Compatible LLM Production Audit

Four callers share `LLM_*` configuration:

1. Vision semantic extraction (strict JSON schema);
2. MCE consultation;
3. Fashion Knowledge Mode B (optional overrides + Claim Lock);
4. legacy outfit reasoning.

| Rung | Vision semantics | MCE | FK Mode B | Legacy OI |
|---|---|---|---|---|
| CODE | PASS | PASS | PASS | PASS |
| WIRED | PASS | PASS | PASS | auth-exposed legacy |
| CONFIGURED live | UNKNOWN | UNKNOWN | OFF by flags/master | UNKNOWN |
| REACHABLE | vendor endpoint returned unauthenticated 401 | same | same | same |
| REAL RESPONSE | NOT_PROVEN | NOT_PROVEN | NOT_PROVEN | NOT_PROVEN |
| E2E | NOT_PROVEN | NOT_PROVEN | NOT_PROVEN | NOT_PROVEN |

Vision and FK Mode B fail closed on missing key, malformed payload, timeout,
auth, 429 and 5xx; FK retries only bounded retryable classes and applies Claim
Lock. Safe schema tests passed for 401/429/500/timeout/malformed and no mock
fallback.

MCE converts non-JSON provider content into a medium-confidence
`parse_fallback` prose payload. The legacy outfit hybrid path can fall back to
deterministic scores; it is not the canonical Flutter path but remains callable.

Account, billing, model access, token quota, rate limits and actual live key
presence are UNKNOWN. COST is UNKNOWN.

## Verdict

`PARTIAL / OWNER_ACTION_REQUIRED`
