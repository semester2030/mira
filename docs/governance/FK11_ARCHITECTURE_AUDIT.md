# FK-11 — Architecture Audit

## Claimed
Fashion Knowledge → Claim Lock → Envelope → Advisor.

## Verified library architecture
Additive under `mira-api/src/fashion-knowledge/**` with domain packages:
contracts, claim-lock, llm, registry, curated, approval, accessories, form-silhouette, cultural-context, telemetry, advisor-integration.

## Verified production architecture
Advisor façade does **not** host the claimed pipeline. It hosts a **guardrail stub** (`projectNoKnowledge`) when the master flag is enabled.

## Frozen upstream
Beauty Advisor release pin still `1.0.0-beauty-advisor`. No redesign of envelope schema semantics observed. Additive projector only (`fashion-knowledge-projector.ts`, provenance `fashion_knowledge_claim_locked`, subsystem `unknown`).

## Nest registration
No `FashionKnowledgeModule`. No Nest providers for bridge/registry. Library imports only.
