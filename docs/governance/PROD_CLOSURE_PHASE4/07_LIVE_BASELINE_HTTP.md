# Live Baseline HTTP

## Pre-deployment RUNTIME evidence

Production base: `https://mira-api-n4p3.onrender.com`

| Path | HTTP | Sanitized classification | Sample latency |
|---|---:|---|---:|
| `/health` | 404 | JSON error; API prefix required | 595 ms |
| `/api/v1/health` | 200 | JSON health object | 490 ms |
| `/api/v1/entitlements/runtime` | 404 | JSON route-not-found | 559 ms |
| `/api/v1/website/features` | 200 | JSON feature catalog | 479 ms |
| `/api/v1/website/stats` | 200 | JSON public stats | 844 ms |

Latency values are single observations, not an SLA. The canonical production
API uses the configured `/api/v1` prefix. This fresh baseline confirms the
historical entitlement 404 before deployment.
