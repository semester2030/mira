# 32 — LLM Attempt 2 Schema Forensic

Attempt 2 is historical input from the micro-closure run.

## Proven boundary

| Stage | Result |
|---|---|
| real provider response | YES |
| parser | FAIL |
| parser reason | `schema_mismatch` |
| validator | NOT REACHED |
| Claim Lock | NOT REACHED |
| trusted output | NO |

The response was parseable enough for the provider to classify it as a
structural schema mismatch, not an HTTP/auth/connectivity failure.

## Exactness boundary

The response body and sanitized parser branch were not retained. Consequently
the exact missing field/path cannot be truthfully distinguished among:

- root not an object;
- `alternatives` absent/not array/over limit;
- invalid nested alternative/change shape;
- invalid `occasionContext`.

Malformed JSON, provider leakage and missing required field have separate
parser codes, so those classifications are excluded.

Exact field/path:

`UNKNOWN_WITH_EVIDENCE — PARSER SCHEMA_MISMATCH BRANCH NOT RETAINED`

## Root cause contribution

The provider was constrained only by `json_object`, not a strict JSON schema.
The parser correctly rejected a non-conforming shape and returned no trusted
candidate.

`LLM_REJECTED_OUTPUT_TRUSTED_SUCCESS = 0`
