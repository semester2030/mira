# AT-4R — Live Test Proof / Checklist / Staging / AT-5 Gate

## Live proof requirement
`npm run at4r:live` must produce:
`dist/fashion-knowledge/at4-live-proof.json` with:
```json
{ "liveProviderExecuted": true, "structuredOk": true, "claimLockInvoked": true }
```
This run: **not produced as true** (key missing). Default `test:at4` writes skipped proof when live not opted in.

## Live checklist (pending key)
1. provider health via FKL port  
2. structured output  
3. Arabic draft fields  
4. red/yellow/wedding  
5–15. remaining AT-4 scenarios after key present  

## Staging decision
- **LOCAL_SUFFICIENT_FOR_AT4** once `LLM_API_KEY` injected
- Design-only if later needed: separate Render service `mira-api-qa`, own secrets, FKL flags true, telemetry false, no production DB writes for fashion advice if avoidable

## Data isolation
Local Nest + local `DATABASE_URL` / `AUTH_SKIP` uses `dev-user` — do not point QA flags at production DB.

## Telemetry / cost / logs
Telemetry false enforced by export script refuse. Live call budget = AT-4 suite live branch (small). Logs must not print key/raw provider (AT-2 provider logging policy).

## Rollback
`.env.qa` flags → false; Flutter without `MIRA_FASHION_ADVISOR_V1`; production untouched.

## AT-4 reclassification
**Remains B** until `liveProviderExecuted=true`.

## AT-5 gate
**CLOSED** until AT-4 becomes A after live proof.
