# AT-4R — Live Test Proof

## Command
```bash
npm run at4r:live
# equivalent: load .env.qa then AT4_LIVE_PROVIDER=1 npm run test:at4
```

## Required artifact
`mira-api/dist/fashion-knowledge/at4-live-proof.json`

```json
{
  "liveProviderExecuted": true,
  "structuredOk": true,
  "claimLockInvoked": true
}
```

## This run
| Field | Value |
|-------|-------|
| `.env.qa` | **ABSENT** |
| `LLM_API_KEY` | **MISSING** |
| `liveProviderExecuted` | **false / not proven** |
| AT-4 classification | remains **B** |

Do not claim AT-4 A while live branch skips.
