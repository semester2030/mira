# Phase 3 — Safe Runtime Probe Evidence

Date: 2026-08-31. Probes were read-only and used no real user data, paid job,
secret value or production mutation.

## Live MIRA API

| Target | Result | Interpretation |
|---|---|---|
| `/api/v1/health` | 200 | API reachable; selected provider/key booleans reported |
| `/api/v1/website/features` | 200 | public website controller reachable |
| `/api/v1/website/stats` | 200 | API and database read path reachable |
| `/api/v1/entitlements/runtime` | 404 | Phase 2 candidate not deployed |
| `/api/v1/ai/skin-analysis` without token | 401 missing Bearer | route and auth guard reachable |
| same with invalid token | 401 invalid/expired Firebase token | Firebase verification path reachable |
| `/api/v1/ai/vision/outfit/analyze` without token | 401 | canonical fashion route/auth reachable |
| `/api/v1/advisor/session` without token | 401 | advisor route/auth reachable |
| `/api/v1/subscriptions/webhook` | 501 | commerce intentionally unimplemented |

## Provider/network targets

| Target | Result | Claim allowed |
|---|---|---|
| `api.openai.com/v1/models` without key | 401 | network/vendor edge reachable; no account/key/model proof |
| `api.fashn.ai/v1/run` without key | 401 | network/vendor edge reachable; no account/key/task proof |
| YouCam S2S root without key | 404 | host/TLS reachable; no API/SKU proof |
| TFHub BlazeFace `model.json` | timeout / HTTP 000 | current probe did not reach model; not proof of global outage |

HTTP codes and redacted response categories are evidence; returned provider
payloads and all credentials are intentionally excluded.

Render Dashboard inspection was attempted through authenticated MCP but
workspace listing remained `unauthorized`; it is classified
`OWNER_ACTION_REQUIRED`, not guessed.
