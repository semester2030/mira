# AT-4 — Rollback / Kill Switch / Production Isolation

## Fastest rollback order
1. Client: rebuild with `MIRA_FASHION_ADVISOR_V1=false` (default)
2. Backend: `FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=false`
3. Backend: `FASHION_KNOWLEDGE_LLM_ENABLED=false`
4. Keep `FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED=false`

## This run
No backend flags were enabled → nothing to roll back on Render.
Verified programmatic rollback: integration/LLM false → bridge not invoked.

## Production isolation
- `render.yaml` unchanged regarding FKL flags
- Flutter default still points at production URL but client fashion flag defaults **false**
- No production activation certificate issued
