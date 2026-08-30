# AT-4R — Provider Connectivity

## Status
**BLOCKED** — `LLM_API_KEY` MISSING.

## Required proof path (not direct curl as final)
`FashionKnowledgeLlmPort` → `OpenAiFashionKnowledgeLlmProvider` → structured draft parse → Claim Lock.

## How to unlock
```bash
cd mira-api
cp .env.qa.example .env.qa
# set LLM_API_KEY locally
npm run at4r:live
```

Expect `at4-live-proof.json` with `liveProviderExecuted=true`.

## Diagnostic vs proof
- Adapter smoke alone: allowed first diagnostic only
- Final AT-4R proof: full FKL provider path via `test:at4` live branch
