# AT-4 — Executive Summary

## Decision
**B) AT-4 QA COMPLETED — REMEDIATION REQUIRED BEFORE AT-5**

## Why not A
AT-4 forbids enabling Fashion Knowledge on production Render. Discovery found:

| Environment | Classification |
|-------------|----------------|
| Render `mira-api` (sole web API) | **NOT_AVAILABLE** for AT-4 flag enablement (production) |
| Render staging/QA service | **NOT_AVAILABLE** (not in `render.yaml`) |
| Local developer | **PARTIAL** — architecturally safe, but `LLM_API_KEY` **MISSING** in local `.env` |

Therefore **real-provider E2E could not be executed** without either (a) enabling production, or (b) a local key that is not present.

## What AT-4 DID verify (without production activation)
- Pre-activation regressions green (`test:at2`, AT-3 Flutter, `fk10`, `fk12`, `phase7b`)
- `render.yaml` has **no** `FASHION_KNOWLEDGE_*` flags (production remains unactivated)
- Default flags OFF; telemetry not enabled
- MCE Option A quarantine still active for fashion-prescriptive turns
- Rollback fail-closed when integration/LLM flags false
- Controlled malformed-provider fail-closed via production adapter + mocked transport
- Opt-in live smoke harness exists: `AT4_LIVE_PROVIDER=1` + `LLM_API_KEY` (skipped this run)

## Activation track
`1.0.0-fashion-knowledge+at4-qa`  
Platform freeze unchanged: `1.0.0-fashion-knowledge` / `MIRA-FK-FREEZE-1.0.0`

## Remediation before AT-5 / re-run AT-4 live
1. Add `LLM_API_KEY` (and shared `LLM_*`) to **local** `.env` — never commit
2. Optionally provision a separate Render **QA** service (not `mira-api` production)
3. Re-run: `AT4_LIVE_PROVIDER=1 npm run test:at4` then Flutter QA with `MIRA_FASHION_ADVISOR_V1=true` against local/QA API
4. Keep production Render flags OFF until AT-6 certificate

## Explicit non-claims
- Production users were **not** activated
- Telemetry remains OFF
- No curated rule promotion
- Live red/yellow OpenAI E2E was **not** completed this run
