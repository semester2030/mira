# Production Failure-Path Matrix

| Controlled path | Observed result | Trusted/fake success |
|---|---|---:|
| missing entitlement auth | 401 | 0 |
| malformed bearer token | 401 | 0 |
| valid non-allowlisted identities | 200, both entitlements OFF | 0 |
| malformed Fashion request | 400 | 0 |
| malformed/unknown-field Advisor request | 400 | 0 |
| Redis critical control unavailable | 503 `RATE_LIMIT_UNAVAILABLE` | 0 |
| BlazeFace model load failure | 503 `face_detector_unavailable` | 0 |
| LLM invalid output | prior parser/validator/Claim Lock rejection | 0 |
| Perfect failure | prior explicit failure/no fabricated scores | 0 |
| FASHN failure | prior explicit failure/no synthetic score | 0 |
| Firebase account deletion | MIRA 204 but account still login-capable | **1** |

The temporary account remaining after the false 204 was deleted through the
normal Firebase REST flow.

`FAILURE_PATH_FAKE_SUCCESS_COUNT = 1`

The single count is `P4B-BLOCKER-01`; it is not an AI/provider fake result.
