# FK-7 — Implementation Report

Package: `mira-api/src/fashion-knowledge/form-silhouette/`

| File | Role |
|------|------|
| `engineering-law-37.ts` | Law #37 |
| `models.ts` | Fabric/texture/silhouette/volume/proportion/complexity |
| `fact-projection.ts` | Safe facts + relationship projection |
| `eligibility.ts` | FK7 advice types + Mode B eligibility |
| `feature-flag.ts` | FORM_SILHOUETTE flag |
| `orchestrator.ts` | Projection → Mode A → Mode B → Claim Lock |
| `review-candidates.ts` | DRAFT/NEEDS_SOURCE only |
| `validation.ts` | Fail-closed + body-language |

Additive advice types: PRESERVE_VOLUME_CONTRAST, SIMPLIFY_TEXTURE, PRESERVE_TEXTURE_CONTRAST, ADJUST_LAYERING_DIRECTION, INCREASE_STRUCTURE, INCREASE_FLUIDITY, SIMPLIFY_SILHOUETTE, PRESERVE_STATEMENT_SILHOUETTE, ADJUST_LENGTH_RELATIONSHIP.
