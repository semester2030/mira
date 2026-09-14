# AT-4R — Blocker Resolution

## AT-4 blockers

| Blocker | Resolution in AT-4R |
|---------|---------------------|
| No Render staging | Accepted; local-first path prepared |
| Must not use production `mira-api` | Honored; `render.yaml` unchanged |
| Local Nest architecturally safe | Confirmed READY_WITH_CONFIG |
| Local `LLM_API_KEY` missing | **Still open** — developer must inject into gitignored `.env.qa` |

## Remaining single blocker
`LLM_API_KEY` presence = **MISSING**

Until the developer supplies a real key into `.env.qa` (or shell export) and runs `npm run at4r:live`, AT-4 cannot prove `liveProviderExecuted=true`.
