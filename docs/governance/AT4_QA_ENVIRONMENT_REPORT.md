# AT-4 — QA Environment Report

## Classification

| Target | Class | Evidence |
|--------|-------|----------|
| Render `mira-api` | **NOT_AVAILABLE** for AT-4 enablement | Sole API service; `NODE_ENV=production`; Flutter default base URL points here |
| Render staging/QA API | **NOT_AVAILABLE** | No `mira-api-qa` / `mira-api-staging` in `render.yaml` |
| Local developer Nest | **PARTIAL** | Safe isolation possible, but local `.env` has `LLM_API_KEY: MISSING` |

## Blocker (exact)
No Render staging/QA service AND local LLM_API_KEY missing — cannot execute real-provider E2E without enabling production.

## Safe path forward
1. Local `.env` with `LLM_API_KEY` (never commit) → local class becomes SAFE
2. Or add a dedicated Render QA service with its own env (sync:false secrets)
3. Never flip FKL flags on production `mira-api` for AT-4
