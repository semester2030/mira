# Garment Intelligence — Public Contract Inventory v1.0.0

**Status:** Frozen  
**Compatibility:** `garment-compat-v1`

## 1. Canonical DTOs (public)

| Contract | Location | Guarantee |
|----------|----------|-----------|
| `CanonicalGarment` | `mira-api/src/fashion-intelligence/garment/canonical-garment.ts` | Sole public garment model |
| `CanonicalGarmentMaterial` | same | Material kind: measured \| estimated \| unknown |
| `GarmentFieldConfidence` | same | Per-field confidence 0..1 |
| `GarmentExplainability` | same | Code + AR/EN reasons + evidenceRefs |
| `CanonicalFashionRuntime` (embedded) | `fashion-runtime-state.ts` | Existing 6B runtime vocabulary; `providerId` stripped on public |

## 2. Internal-only (not public contracts)

| Type | Status |
|------|--------|
| `FashionVisionDocument` | Internal Vision / adapter input only |
| `DetectedGarment` | `@internal` legacy type on port module — **must not** appear on public results |
| Provider raw payloads (`rawFashn`, `openaiRaw`, …) | Forbidden on public boundaries |

## 3. Public APIs

| API | Contract |
|-----|----------|
| `FashionAnalysisPort.analyze` | Returns `FashionAnalysisPortResult` with `garments: CanonicalGarment[]` |
| `POST /ai/vision/outfit/analyze` | HTTP: `garments`, `analysis`, `warnings`, `limitations`, `runtime`, stripped `meta` — **no** `fashionVision`, **no** provider vendor strings |
| `GarmentIntelligenceService.analyzeGarment` | Server capability entry; input = internal vision doc |

## 4. Capabilities

| Capability | Version pin | Requirements |
|------------|-------------|--------------|
| `analyze_garment` | catalog `fashion-cap-catalog-v1` | Mira mapping only; `providerRequirements: none` |

## 5. Runtime contracts

| Item | Guarantee |
|------|-----------|
| Status vocabulary | Existing Fashion runtime catalog (AVAILABLE / PARTIAL / DEGRADED / BLOCKED / FAILED / …) |
| Public strip | `toPublicFashionRuntime` omits `providerId` |
| Failure visibility | Mapping/validation failure → `ProviderPortError` (no silent empty success) |

## 6. Validation contracts

| Function | Guarantee |
|----------|-----------|
| `validateCanonicalGarment` / `validateCanonicalGarmentSet` | Ontology/catalog/leakage/duplicates |
| `assertValidGarments` | Throws on invalid set |
| `assertNonEmptyOnProceed` | Empty + `proceed` forbidden |
| `assertNoFashionProviderLeakage` | Expanded ban list (6C.1) |

## 7. Identity contract

| Item | Guarantee |
|------|-----------|
| Policy | `docs/governance/GARMENT_IDENTITY_POLICY.md` · `garment-identity-v1` |
| Formula | Content-addressed sha256 → `garm_<24 hex>` |
| Forbidden | `Date.now`, `Math.random`, `newTraceId` for `garmentId` |

## 8. Compatibility guarantees

1. Same Vision evidence slot + attributes ⇒ same `garmentId`.  
2. Wardrobe may rely on stable refs across remaps of identical evidence.  
3. Future Outfit/Styling phases consume CanonicalGarment; they do not own garment schema.  
4. Additive optional fields only under MINOR; removals require MAJOR + CR.
