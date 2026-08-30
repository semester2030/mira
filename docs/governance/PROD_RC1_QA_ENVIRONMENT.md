# PROD-RC-1 — QA Environment

**Status:** **NOT PROVISIONED** · design only (extends AT4R)

## Decision (this phase)

Do **not** use public production as first live QA.

Preferred service: **`mira-api-qa`** (separate URL, env, secrets, DB preference).

## Current local QA

| Item | Status |
|---|---|
| `mira-api/.env.qa.example` | PRESENT |
| `mira-api/.env.qa` | **MISSING** |
| `LLM_API_KEY` local | **MISSING** |
| Local Postgres migrate | up to date |
| AUTH_SKIP for local QA | documented in example (non-prod only) |
| Dedicated Render QA | **NOT CREATED** |

## HUMAN APPROVAL REQUIRED

Approve creation of Render service **`mira-api-qa`** with:

- separate web service + preferably non-prod DB
- HTTPS
- auth enabled for device E2E (no AUTH_SKIP on hosted QA if testing real auth)
- secrets supplied in Dashboard (not git)
- Fashion flags ON only on QA; telemetry OFF
- Face provider secrets present for real analysis
- easy delete/rollback

**Paused pending your approval.** Will not silently alter production Render.
