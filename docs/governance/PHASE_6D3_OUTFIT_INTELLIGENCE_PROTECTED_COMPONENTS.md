# Outfit Intelligence v1.0.0 — Protected Components

**Status:** PRODUCTION FROZEN  
**Package root:** `mira-api/src/fashion-intelligence/outfit/**`

Changes to protected components require Change Request approval per `PHASE_6D3_OUTFIT_INTELLIGENCE_CHANGE_POLICY.md`.

## Engines (protected)

| Component | Path |
|-----------|------|
| Composition Engine | `composition-engine.ts` |
| Compatibility Engine | `compatibility-engine.ts` |
| Harmony Engine | `harmony-engine.ts` |
| Layering Engine | `layering-engine.ts` |
| Context Engine | `context-engine.ts` |
| Metrics Engine | `metrics-engine.ts` |
| Confidence Engine | `confidence-engine.ts` |
| Limitation Engine | `limitation-engine.ts` |
| Explainability Engine | `explainability-engine.ts` |
| Evaluation Engine (orchestrator) | `evaluation-engine.ts` |

## Evidence (protected)

| Component | Path |
|-----------|------|
| Outfit Evidence Graph + Builder | `outfit-evidence-graph.ts` |
| Law #31 finalize / link semantics | same |

## Contracts & identity (protected)

| Component | Path |
|-----------|------|
| CanonicalOutfit | `canonical-outfit.ts` |
| Outfit identity / deterministic IDs | `outfit-identity.ts` |
| Validators | `outfit-validators.ts` |

## Service boundary (protected)

| Component | Path |
|-----------|------|
| Outfit Intelligence Service | `outfit-intelligence.service.ts` |
| Package barrel | `index.ts` |

## Explicitly not owned (do not redefine)

- CanonicalGarment / Garment Intelligence  
- Wardrobe Foundation / Fashion Session  
- Fashion Runtime **schema** (consumed, not owned)  
- Provider SDKs  
- Styling Intelligence / Recommendation Engine / FKG / Taxonomy  

## Protection rule

No CR → no modification of protected components in production branches.
