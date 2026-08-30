# FK-11 — MCE Bypass Audit

## CRITICAL question
Is there a production path: User → unrestricted LLM → prescriptive fashion without FK→Claim Lock→Envelope?

## Finding (MAJOR under default config)
**YES when `FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED` is false (default).**

`evaluateMceFashionQuarantine` returns `{ quarantine: false }` if integration flag off  
(`advisor-integration/mce-bypass.ts`).

When flag **true**, quarantine fires for fashion-prescriptive intents on MCE send/stream  
(`consultation-orchestrator.service.ts`).

## Other bypasses
| Path | Class | Notes |
|------|-------|-------|
| `/ai/outfit-intelligence` | BYPASS_RISK | Hybrid LLM, no Claim Lock |
| RecommendationsService | LEGACY | Outside envelope |
| `advisorBridge` method | BYPASS_RISK | Unwired on controllers |

## When flags ON (intended activation)
MCE closed for fashion prescriptions; Advisor returns **unavailable** (not Mode B). Bypass closed on MCE, but claimed advice path still missing.
