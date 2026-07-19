# Garment Intelligence — Compatibility Matrix v1.0.0

**Compat id:** `garment-compat-v1`  
**Platform compat:** `fashion-compat-v1`

## Matrix

| Consumer / peer | May | Must not |
|-----------------|-----|----------|
| **Wardrobe Foundation (6B)** | Store `garmentId` + `entityClass` refs; rely on identity stability | Embed garment attributes; redefine `CanonicalGarment`; invent ids |
| **Fashion Session / Runtime (6B)** | Attach GI attempts; emit existing runtime statuses | Redesign runtime schema for GI; put `providerId` on public DTOs |
| **Garment Intelligence (this freeze)** | Map internal Vision → CanonicalGarment | Call FASHN/OpenAI directly; expose Vision doc publicly |
| **Outfit Intelligence (6D+)** | Compose outfits from `CanonicalGarment` / `garmentId`s; own Outfit schema | Subclass-replace CanonicalGarment; bypass GI for public garment DTOs |
| **Styling Intelligence (future)** | Read attributes / styleHints / limitations | Mutate GI engines; fabricate garment fields without evidence |
| **Recommendation Engine (future)** | Use garment ids + catalogPieceId when present | Treat catalog as world-owner; invent season/occasion without evidence |
| **Knowledge Graph / Taxonomy (future)** | Become knowledge SSOT behind adapters | Force provider taxonomies into CanonicalGarment without CR |
| **Provider SDKs** | Serve Vision adapters only | Appear on public GI HTTP / CanonicalGarment |
| **Flutter client** | Migrate to `garments: CanonicalGarment[]` | Treat `fashionVision` as public SSOT after freeze (legacy debt only) |
| **Fashion platform freeze (future)** | Aggregate GI + Outfit + Styling freezes | Silently reopen GI without CR |

## Extension rules for future phases

**Allowed without GI CR (additive outside GI package):**

- New Outfit / Style / Reco schemas that **reference** `garmentId`  
- New capabilities that **call** `analyze_garment` or consume CanonicalGarment  
- New Vision providers behind existing adapter boundary if CanonicalGarment unchanged  

**Requires GI Change Request:**

- Any change under `fashion-intelligence/garment/**`  
- Public analyze HTTP / port garment shape  
- Identity formula / policy  
- Re-introduction of `FashionVisionDocument` or `DetectedGarment` on public success path  

## Backward compatibility

- Missing optional Canonical fields → treat as absent / limitation, never invent.  
- Wardrobe items with prior nondeterministic ids (pre-6C.1) are historical; new remaps use `garment-identity-v1`.  
- Pre-freeze Flutter `fashionVision` clients are incompatible with frozen HTTP — migrate (TD-GI-02).
