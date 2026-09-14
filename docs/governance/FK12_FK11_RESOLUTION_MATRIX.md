# FK-12 — FK-11 Resolution Matrix

| FK-11 Blocker | Resolution | Evidence |
|---------------|------------|----------|
| 1. /advisor/chat does not execute bridge | AdvisorService.chat → resolveFashionEvidenceForAdvisorChat → runFashionKnowledgeAdvisorBridge | advisor.service.ts, production-wiring.ts, test:fk12 |
| 2. Flag ON injects projectNoKnowledge stub | Real bridge when context+Mode B available | production-wiring.ts |
| 3. Flag OFF leaves MCE unrestricted | Option A global quarantine + consultation orchestrator | mce-bypass.ts, integration-off-policy.ts |
| 4. DTO lacks fashion context | AdvisorFashionContextDto nested optional | advisor-chat.dto.ts |
| 5. FK-10 overstated wiring readiness | FK12_DOCUMENTATION_CORRECTION_REPORT; FK-11 C preserved | docs |
| 6. /ai/outfit-intelligence BYPASS_RISK | applyOutfitIntelligenceFashionBoundary on gateway | ai-gateway.controller.ts |
| 7. Sensitive exports | Public barrels drop fixtures/mock/storage/release | index.ts, llm/index.ts, registry/index.ts |
| 8. Telemetry without consent | consent-gate hard block; CONSENT_UNAVAILABLE default | telemetry/consent-gate.ts, service.ts |
| G8 weak on Mode B | Documented NOT_APPLICABLE_MODE_B | g8-exception-decision.ts |
| Law #34 key-based | Production path validates narration vs projection | production-wiring.ts, response-validation.ts |
