# PHASE FK14 PUBLIC CONTRACT INVENTORY

## PUBLIC PRODUCT CONTRACTS
Primarily **none** as Fashion Knowledge HTTP API. User-facing remains Advisor chat response + optional request `fashion` DTO fields.

## INTERNAL PLATFORM CONTRACTS
- FashionKnowledgeRule / conditions / domains
- FashionAdviceCandidate (+ LLM draft policy)
- FashionClaimLockResult (15 gates)
- Registry lookup / snapshot / release model
- FashionKnowledgeLlmPort
- FashionKnowledgeAdvisorProjection
- Telemetry/feedback event contracts
- Feature flags (default false)
- Production wiring resolver (`resolveFashionEvidenceForAdvisorChat`)
