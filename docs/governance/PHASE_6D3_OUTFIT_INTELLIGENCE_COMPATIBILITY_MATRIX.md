# Outfit Intelligence v1.0.0 — Compatibility Matrix

**Freeze date:** 2026-07-19

| Consumer / Peer | Compatibility | Notes |
|-----------------|---------------|-------|
| **Wardrobe Foundation** | **Compatible** | Outfit consumes garment refs only; does not store wardrobe state; session/runtime vocabulary shared |
| **Garment Intelligence v1.0.0** | **Compatible** | Input = `CanonicalGarment[]` (`garment-schema-v1`); Outfit does not redefine GI schemas |
| **Fashion Runtime** | **Compatible** | Emits `fashion-runtime-v1` via existing helpers; no schema redesign |
| **Future Styling Intelligence** | **Forward-compatible (consume-only)** | Must consume frozen CanonicalOutfit + garment refs; must not mutate Outfit engines without CR |
| **Recommendation Engine** | **Not integrated** | `recommendations` capability remains disabled; future Reco must not invent parallel outfit models |
| **Fashion Knowledge Graph** | **Not started** | Future FKG may cite outfit evidence IDs; must not replace Evidence Graph |
| **Taxonomy Service** | **Not started** | Outfit uses existing GI category/type ids; taxonomy evolution requires CR if slot mapping breaks |

## Compatibility version

`fashion-compat-v1`

## Breaking compatibility triggers

- Changing `outfit-schema-v1` field semantics without major bump  
- Making Evidence Graph a public required DTO  
- Calling providers from Outfit Intelligence  
- Redefining CanonicalGarment inside Outfit  

## Compatibility notes (6D.2 → Freeze)

- Bind to **schema versions**, not release label strings.  
- Capability-only APIs return validated graphs, not CanonicalOutfit (except analyze/compare).  
- Public `runtime.traceId` retained by contract.
