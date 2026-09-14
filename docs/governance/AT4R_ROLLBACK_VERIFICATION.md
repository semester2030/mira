# AT-4R — Rollback Verification

## Planned local rollbacks (execute after live unlock)

1. `FASHION_KNOWLEDGE_LLM_ENABLED=false` → no provider call; safe unavailable; no MCE prescription
2. `FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=false` → Option-A safe behavior
3. Flutter `MIRA_FASHION_ADVISOR_V1=false` → no unsafe legacy fashion path

## Status
Scripts/templates enforce safe defaults for telemetry + legacy MCE.
Full live rollback matrix **PENDING** first successful live enablement.
Production flags were never flipped — production rollback N/A.
