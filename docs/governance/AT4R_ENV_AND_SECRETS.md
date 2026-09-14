# AT-4R — Env Requirements / Secret Handling / Flags

## Minimum local QA variables (from repo evidence)

### Required for live Mode B
- `LLM_API_KEY` — **MISSING today**
- `LLM_BASE_URL` (default `https://api.openai.com/v1`)
- `LLM_MODEL` (default `gpt-4o-mini`)
- `FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=true`
- `FASHION_KNOWLEDGE_LLM_ENABLED=true`

### Required keep-false
- `FASHION_KNOWLEDGE_TELEMETRY_ENABLED=false`
- `FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED=false`

### Local Nest operational
- `DATABASE_URL` (local `.env` already PRESENT)
- `PORT` (PRESENT)
- `AUTH_SKIP=true` (approved local bypass in `FirebaseAuthGuard`; **never** on production)
- `NODE_ENV=development` (avoid production integrity fatals for unrelated providers)
- `WEBSITE_CORS_ORIGINS=*` for local Flutter reachability

### Domain flags
Keep OFF unless scenario-specific testing: Registry, Accessories, Form, Cultural.

## Secret handling
- Template: `mira-api/.env.qa.example` (committed, empty key)
- Secrets file: `mira-api/.env.qa` (**gitignored**)
- Also ignored: `.env.local`, `.env.*.local`
- Load: `source scripts/at4r-export-qa-env.sh` (prints PRESENT/MISSING only)
- Live: `npm run at4r:live` → `AT4_LIVE_PROVIDER=1 npm run test:at4`

**Never commit secrets. Never print secret values.**
