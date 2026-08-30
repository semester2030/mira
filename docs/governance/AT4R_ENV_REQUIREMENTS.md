# AT-4R — Env Requirements

Evidence-based minimum for Local QA Mode B.

| Variable | Need | Status this machine |
|----------|------|---------------------|
| `LLM_API_KEY` | Required for live provider | **MISSING** |
| `LLM_BASE_URL` | Default OpenAI | Template default OK |
| `LLM_MODEL` | Default `gpt-4o-mini` | Template default OK |
| `FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED` | `true` local QA | In `.env.qa.example` |
| `FASHION_KNOWLEDGE_LLM_ENABLED` | `true` local QA | In `.env.qa.example` |
| `FASHION_KNOWLEDGE_TELEMETRY_ENABLED` | must `false` | In example |
| `FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED` | must `false` | In example |
| `AUTH_SKIP` | local only | PRESENT in day-to-day `.env` |
| `DATABASE_URL` | Nest/Prisma | PRESENT in `.env` |
| `PORT` | default 3000 | PRESENT |
| `WEBSITE_CORS_ORIGINS` | local Flutter | `*` in QA example |

Do not invent additional secrets. Reuse `DATABASE_URL` from local `.env` when creating `.env.qa`.
