# PROD-RC-1 — Backend Deployment Readiness

## Commands run (2026-08-11)

| Step | Result |
|---|---|
| `npx prisma generate` | PASS |
| `npx prisma migrate status` (local) | up to date (7 migrations) |
| `npm run build` (`nest build`) | **FAIL** — 2 TypeScript errors in Fashion `*.schema-tests.ts` |
| `npm run test:phase9m-face-trust` | PASS |

## Error class

| Issue | Class |
|---|---|
| `phase-at2-production-llm-provider.schema-tests.ts` TS2345 | **RELEASE BLOCKER** for Render `buildCommand` that runs `npm run build` |
| `phase-fk12-production-wiring.schema-tests.ts` TS2345 | same |
| Unrelated Fashion nest inclusion of tests | PRE-EXISTING DEBT / TEST-ONLY files wrongly compiled |

**No silent fix applied** in PROD-RC-1.

## Deploy order (when unblocked)

1. Fix or exclude schema-tests from `nest build` via approved CR/fix commit.
2. Deploy backend with **all new feature flags OFF**.
3. Health-check existing behavior.
4. Only then consider QA flag enablement on **mira-api-qa**.
