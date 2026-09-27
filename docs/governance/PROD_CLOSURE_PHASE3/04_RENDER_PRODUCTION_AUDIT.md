# Phase 3 — Render Production Audit

## Source mapping

`render.yaml` declares Node `mira-api`, Render PostgreSQL `mira-db`, and three
static sites. API build is install → Prisma generate → Nest build; start is
Prisma migrate deploy → `node dist/main`; health is `/api/v1/health`.
`main.ts` binds `0.0.0.0:$PORT`.

## Verified live evidence

| Probe | Result |
|---|---|
| `/api/v1/health` | HTTP 200, service `mira-api` |
| `/api/v1/website/stats` | HTTP 200 and DB-backed counts |
| `/api/v1/entitlements/runtime` | HTTP 404 |
| candidate `584be7f` deployed? | NO: candidate contains route, live does not |
| deployed SHA | UNKNOWN; hardcoded `dca812d` is not reliable runtime metadata |

Render MCP authentication succeeded nominally but workspace listing remained
`unauthorized`; no service, deploy, env, logs, metrics, database, region,
auto-deploy, or plan state was inferred from the Dashboard.

## Verdict

`PARTIAL / OWNER_ACTION_REQUIRED`

API and database are reachable. Candidate identity, Dashboard env presence,
current deploy ID, auto-deploy, region, plan/expiry and metrics require
read-only owner-authorized Render access. No deploy or Render mutation occurred.
