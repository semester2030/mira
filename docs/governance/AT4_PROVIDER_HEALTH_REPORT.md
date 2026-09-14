# AT-4 — Provider Health / Live E2E Status

## LIVE_PROVIDER_SMOKE
**SKIPPED**

Reason: `AT4_LIVE_PROVIDER` not set and/or `LLM_API_KEY` missing locally.

## Controlled (non-live) verification PASS
- Production adapter config resolution (`gpt-4o-mini`, timeout 15000)
- Malformed transport → fail-closed (no candidate)
- Flags OFF → bridge not invoked (rollback)
- MCE Option A quarantine for fashion-prescriptive text

## How to run live local QA later
```bash
# in mira-api, with LLM_API_KEY in environment (not committed)
AT4_LIVE_PROVIDER=1 npm run test:at4
```
Then Flutter against local API:
```bash
flutter run \
  --dart-define=MIRA_FASHION_ADVISOR_V1=true \
  --dart-define=MIRA_API_BASE_URL=http://localhost:3000/api/v1
```
With Nest local env:
`FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=true`
`FASHION_KNOWLEDGE_LLM_ENABLED=true`
`FASHION_KNOWLEDGE_TELEMETRY_ENABLED=false`
