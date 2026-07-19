# Garment Intelligence — Version Manifest v1.0.0

**Product:** Mira Garment Intelligence  
**Release version:** **1.0.0**  
**Status:** Production Approved · **Frozen**  
**Release date:** 2026-07-19  
**Freeze phase:** 6C.2  
**Machine-readable:** `docs/governance/GARMENT_INTELLIGENCE_VERSION_MANIFEST.json`

## Identifiers

| Field | Value |
|-------|--------|
| Subsystem version | `1.0.0` |
| Build / release identifier (frozen source) | `0.2.1-garment-intelligence-remediation` |
| Schema version | `garment-schema-v1` |
| Mapping version | `garment-mapping-v1` |
| Contract version | `garment-contract-v1` |
| Identity policy | `garment-identity-v1` |
| Runtime version | `fashion-runtime-v1` |
| Capability catalog | `fashion-cap-catalog-v1` |
| Capability id | `analyze_garment` |
| Compatibility | `garment-compat-v1` |
| Fashion platform compat | `fashion-compat-v1` |
| Architecture | `fashion-intelligence-arch-v1` |

## Dependencies (frozen at freeze time)

| Dependency | Pin |
|------------|-----|
| Wardrobe Foundation (6B) | `wardrobe-schema-v1` — refs only |
| Fashion Session | `fashion-session-v1` |
| Fashion Runtime | `fashion-runtime-v1` |
| Vision input (internal) | `FashionVisionDocument` schema `1.0.0` |
| Alias SSOT | `mira-api/src/vision/schema/fashion-aliases.ts` |

## Compatibility window

- **Wardrobe:** must store `garmentId` refs only; same evidence ⇒ same id (`garment-identity-v1`).
- **Outfit Intelligence (6D+):** may compose `CanonicalGarment[]`; must not redefine garment schema.
- **Styling / Recommendation / Knowledge Graph:** later phases; must not mutate GI engines without CR.
- **Providers:** FASHN/OpenAI (or successors) remain behind Vision adapters; never public DTOs.

## SemVer policy (release)

- **MAJOR** (`x.0.0`): breaking `CanonicalGarment` / public HTTP / identity formula / capability contract  
- **MINOR** (`1.x.0`): additive optional fields with safe defaults; new limitations codes that clients may ignore  
- **PATCH** (`1.0.x`): docs, tests, governance only (no behavioral change)

Changing identity formula, removing a public field, or re-exposing `FashionVisionDocument` / `DetectedGarment` on the public analyze path requires **MAJOR** + Change Request.

## Production path (frozen)

```
Image → Vision Platform (internal FashionVisionDocument)
  → GarmentMappingEngine → CanonicalGarment[]
  → FashionAnalysisPort / POST /ai/vision/outfit/analyze
  → garments + runtime (+ stripped meta)
  → Wardrobe may store garmentId refs
```

**Out of production GI path:** Flutter legacy `fashionVision` parser (documented migration debt TD-GI-02).
