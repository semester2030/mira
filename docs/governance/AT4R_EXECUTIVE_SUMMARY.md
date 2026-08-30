# AT-4R — Executive Summary

## Decision
**B) AT-4R PARTIALLY COMPLETED — LIVE QA STILL BLOCKED**

## What was solved
Local QA **architecture and runbooks** are ready without touching production:

| Item | Status |
|------|--------|
| Local Nest feasibility | **READY_WITH_CONFIG** |
| `.env.qa.example` template | Created |
| Gitignore for `.env.qa` / `.env.local` | Hardened |
| Export / live scripts | `scripts/at4r-export-qa-env.sh`, `scripts/at4r-run-live.sh` |
| npm `at4r:check` / `at4r:live` | Added |
| Live proof artifact path | `dist/.../at4-live-proof.json` (`liveProviderExecuted`) |
| AUTH_SKIP local path | Documented (already supported by `FirebaseAuthGuard`) |
| Flutter dart-defines | Documented |
| Device networking map | Documented |
| Production Render FKL flags | Untouched (verified clean) |
| Staging Render service | Not created (local-first) |

## What remains blocked
| Item | Status |
|------|--------|
| `LLM_API_KEY` | **MISSING** (process + `.env` + no filled `.env.qa`) |
| Live provider through FKL port | **NOT EXECUTED** |
| AT-4 re-run with `liveProviderExecuted=true` | **NOT PASSED** |
| Flutter → local API → provider | **NOT EXECUTED** |

## Exact next human action (required)
```bash
cd mira-api
cp .env.qa.example .env.qa
# edit .env.qa: set LLM_API_KEY=<your key>  (never commit)
# ensure DATABASE_URL matches your local DB (from existing .env)
npm run at4r:live
```

Then Flutter (simulator):
```bash
flutter run \
  --dart-define=MIRA_FASHION_ADVISOR_V1=true \
  --dart-define=MIRA_API_BASE_URL=http://127.0.0.1:3000/api/v1
```
with Nest started under the exported QA env (`AUTH_SKIP=true`, FKL flags true, telemetry false).

## Staging decision
**LOCAL_SUFFICIENT_FOR_AT4** (once key is present).  
**DEDICATED_STAGING_REQUIRED_BEFORE_AT5 / production activation** for HTTPS + Render parity — design only, not deployed.

## Non-claims
- No production rollout
- No telemetry enablement
- No curated rules
- No AT-5 start
- AT-4 is **not** reclassified to A yet
