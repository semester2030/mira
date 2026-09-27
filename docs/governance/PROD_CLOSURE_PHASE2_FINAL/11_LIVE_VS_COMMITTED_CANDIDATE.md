# Phase 2 Final — Live vs Committed Candidate

READ ONLY. No deploy.

## Candidate

`CANDIDATE HEAD = 584be7fcd9486b17ba97569debe8b9aacf90408a`

Includes `GET /api/v1/entitlements/runtime`.

## Live probe (2026-08-31)

| Check | Result |
|---|---|
| `GET https://mira-api-n4p3.onrender.com/api/v1/health` | HTTP 200, `service=mira-api` |
| Health body Git SHA | absent |
| `GET …/entitlements/runtime` | HTTP 404 |

## Classification

`LIVE PRODUCTION = DIFFERENT`

Expected. Deployment is the next phase and is not required for Phase 2 Final
Closure.
