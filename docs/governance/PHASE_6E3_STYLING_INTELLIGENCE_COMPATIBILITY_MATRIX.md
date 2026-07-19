# Styling Intelligence v1.0.0 — Compatibility Matrix

**Freeze date:** 2026-07-19

| Peer / Consumer | Compatibility | Notes |
|-----------------|---------------|-------|
| **Wardrobe Foundation** | **Compatible** | Consumes wardrobe **refs** only; does not own wardrobe persistence |
| **Garment Intelligence v1.0.0** | **Compatible** | Consumes `CanonicalGarment` (frozen); does not evaluate garments |
| **Outfit Intelligence v1.0.0** | **Compatible** | Consumes public `CanonicalOutfit` + citations; does not replace Law #31 graph |
| **Skin / Face Intelligence v1.0.0** | **Compatible** | Consumes frozen report refs as Law #32 evidence |
| **Future Recommendation Engine** | **Forward-compatible (separate owner)** | Must not be implemented inside Styling; Law #26 |
| **Future / existing AI Beauty Advisor** | **Forward-compatible (consumer)** | May narrate profile facts; must not invent Canonical Style decisions |
| **Fashion Knowledge Graph / Taxonomy** | **Not integrated** | Accepted debt; must not replace frozen evidence sources |

## Compatibility version

`fashion-compat-v1`

## Breaking compatibility triggers

- Changing `style-schema-v1` semantics without MAJOR  
- Weakening Law #32 frozen-kind requirements  
- Enabling `recommendations` inside Styling ownership  
- Mutating OI/GI/Wardrobe engines from Styling  
