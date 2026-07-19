# Styling Intelligence v1.0.0 — Protected Components

**Status:** PRODUCTION FROZEN  
**Package root:** `mira-api/src/fashion-intelligence/styling/**`

Changes require Change Request approval per `PHASE_6E3_STYLING_INTELLIGENCE_CHANGE_POLICY.md`.

## Engines / modules (protected)

| Component | Path |
|-----------|------|
| Evidence Interpretation Engine | `evidence-interpretation-engine.ts` |
| Reasoning Engine | `reasoning-engine.ts` |
| Evaluation Engine (orchestrator) | `evaluation-engine.ts` |
| Decision Ledger | `decision-ledger.ts` |
| Style Memory (stateless helpers) | `style-memory.ts` |
| Law #32 frozen evidence helpers | `law32-frozen-evidence.ts` |
| Identity / deterministic IDs | `styling-identity.ts` |

## Contracts (protected)

| Component | Path |
|-----------|------|
| Canonical Styling Profile | `canonical-styling-profile.ts` |
| Styling evidence types | `styling-evidence.ts` |
| Validators (incl. Law #32) | `styling-validators.ts` |

## Service boundary (protected)

| Component | Path |
|-----------|------|
| Styling Intelligence Service | `styling-intelligence.service.ts` |
| Package barrel | `index.ts` |

## Goals / Progress / History

Owned inside Reasoning Engine + profile contracts (not separate packages). Protected as part of Reasoning Engine + Canonical Styling Profile freeze.

## Explicitly not owned (do not redefine)

- CanonicalGarment / Outfit / Wardrobe schemas  
- Skin / Face Intelligence  
- Fashion Runtime **schema**  
- Recommendation Engine / Marketplace / FKG / Taxonomy  
- Beauty Advisor conversation ownership  

## Protection rule

No CR → no modification of protected components in production branches.
