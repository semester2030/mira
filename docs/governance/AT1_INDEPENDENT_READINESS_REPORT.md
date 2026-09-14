# AT-1 — Full Readiness Report (Evidence)

**Date:** 2026-08-10  
**Release under inspection:** `1.0.0-fashion-knowledge` / `MIRA-FK-FREEZE-1.0.0`

## What is missing for a user to receive safe Year-1 Mode-B advice

1. Nest production provider for `FASHION_KNOWLEDGE_LLM_PORT` (**MISSING**)  
2. DI registration in AdvisorModule (**MISSING**)  
3. Feature flags ON in a controlled environment (**DISABLED** by design)  
4. Flutter calling `/advisor/chat` with fashion context (**MISSING path** — primary UX is MCE)  
5. Optional: domain flags if testing FK-6/7/8 specifically  
6. Not required for Year-1: curated ACTIVE rules, telemetry consent (if telemetry OFF)

## Fail-closed preserved
Without provider: `MODE_B_PROVIDER_MISSING`. Integration OFF: quarantine. Body/religion OOS. Claim Lock mandatory on bridge.

## Provider model
Configured `gpt-4o-mini` via OpenAI chat completions + JSON modes used elsewhere → classify **SUITABLE_WITH_CONFIGURATION** for FKL structured draft (must map to FashionAdviceCandidateDraft schema; verify in AT-2/4). Not production-verified for FKL yet → activation tests required.

## Security
Keys in Render sync:false. FKL must not log prompts/raw drafts publicly. Existing MCE logs HTTP status only on failure — FKL adapter must match no-secret logging.

## Auth / rate limit
`/advisor/chat` uses FirebaseAuthGuard + `RATE_LIMIT_PER_HOUR` (30). Sufficient baseline; LLM cost exposure rises once Mode B enabled — monitor in AT-4.

## Migrations
No Prisma/DB migration required for Mode B provider activation (library + DI + flags).

## Observability gap
Need request-correlated logs: provider status, Claim Lock decision, projectionId (audit metadata partially exists on AdvisorService). Define before AT-4; do not implement in AT-1.

## Rollback
Flags can disable integration/LLM/domains/telemetry without GI/OI/SI/Advisor redesign.

## Red/yellow/wedding readiness
| Segment | Status |
|---------|--------|
| Flutter garment/occasion facts | PARTIAL (exist in OutfitAnalysis) |
| DTO fashion | MISSING send |
| Context assembler | READY |
| Nest provider | MISSING |
| Claim Lock / projection / envelope | READY |
| Client path to `/advisor/chat` | MISSING |

## Shoes/bags / silhouette / cultural
Same client gap; domain data often PARTIAL/NOT_AVAILABLE until AT-3 mapping from analysis/wardrobe.

## AD-FK-05
Recommendations + local FashionKnowledgeGraph remain LEGACY. Classify ACCEPTED_LEGACY_BOUNDARY for first Mode-B advice activation on Advisor path; do not claim exclusive FKL SSOT until governed.

## Final AT-1 decision
**READY TO PLAN AT-2** (provider) and **AT-3** (client path — blocking for real users).  
**NOT READY TO ACTIVATE** production flags.
