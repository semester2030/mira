# AI Beauty Advisor v1.0.0 — Protected Components

**Status:** PRODUCTION FROZEN  
**Package roots:** `mira-api/src/beauty-advisor/**` · façade `mira-api/src/advisor/**`

Changes require Change Request approval per `PHASE_7B2_AI_BEAUTY_ADVISOR_CHANGE_POLICY.md`.

## Protected modules

| Component | Path |
|-----------|------|
| Conversation Engine | `conversation/conversation-engine.ts` |
| Intent Detection | `conversation/intent-detection.ts` |
| Conversation Planner | `planner/conversation-planner.ts` |
| Capability Router | `routing/capability-router.ts` |
| Advisor Evidence Envelope | `contracts/advisor-evidence-envelope.ts` · `envelope/envelope-builder.ts` |
| Provenance gate | `evidence/provenance.ts` |
| Advisor Memory | `contracts/advisor-memory.ts` · `memory/advisor-memory-store.ts` |
| Grounded Response Engine | `response/grounded-response-engine.ts` |
| Validation (+ Law #34) | `validation/advisor-validators.ts` |
| Advisor Runtime | `contracts/advisor-runtime.ts` |
| Beauty Advisor Service | `beauty-advisor.service.ts` |
| Version / Laws pins | `release.ts` |

## Protected laws

| Law | Text |
|-----|------|
| Law #33 | Advisor never replaces frozen intelligence |
| Law #34 | Advisor speaks only through Advisor Evidence Envelope |

## Explicitly not owned

- Skin / Face / Wardrobe / Garment / Outfit / Styling engines  
- Beauty Experience try-on implementation  
- Recommendation Engine / Marketplace  
- MCE LLM consultation product (sibling surface; not this freeze’s ownership to redesign)

## Protection rule

No CR → no modification of protected components in production branches.
