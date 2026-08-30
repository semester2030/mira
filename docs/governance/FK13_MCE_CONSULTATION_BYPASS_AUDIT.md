# FK13 MCE CONSULTATION BYPASS AUDIT

## Option A verified
`evaluateMceFashionQuarantine` in `consultation-orchestrator.service.ts` for both `resolveAssistantPayload` and SSE stream path.

Legacy escape: `FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED` default false.

Integration ON/OFF: quarantine does **not** depend on Advisor integration flag (Option A).

Residual: `RecommendationsService` is a separate legacy surface (not consultation MCE).
