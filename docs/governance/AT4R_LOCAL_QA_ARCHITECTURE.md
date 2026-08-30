# AT-4R — Local QA Architecture

```
Developer machine
├── mira-api/.env.qa          (gitignored; secrets + QA flags)
├── Nest start:dev @ 0.0.0.0:3000
│     AUTH_SKIP=true (local only)
│     FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=true
│     FASHION_KNOWLEDGE_LLM_ENABLED=true
│     FASHION_KNOWLEDGE_TELEMETRY_ENABLED=false
│     LEGACY_MCE_FASHION_ALLOWED=false
├── OpenAI via LLM_* (shared config)
└── Flutter QA build
      MIRA_FASHION_ADVISOR_V1=true
      MIRA_API_BASE_URL=<local address>
```

Production Render `mira-api` is **out of band**.

## Startup (evidence)
- Node `>=20` (`package.json` engines); observed `v25.1.0`
- `npm install` → `npm run prisma:generate` → `npx prisma migrate deploy` → `npm run start:dev` (`scripts/dev.sh`)
- Listen: `0.0.0.0:$PORT` default 3000 (`main.ts`)
- Prefix: `api/v1`
