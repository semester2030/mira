# Garment Intelligence — Protected Components v1.0.0

**Status:** Frozen · Major review + Change Request required for modification

## Frozen package root

`mira-api/src/fashion-intelligence/garment/**`

## Protected components

| Component | Path / symbol | Protection |
|-----------|---------------|------------|
| CanonicalGarment model | `canonical-garment.ts` | Schema freeze |
| Deterministic identity | `garment-identity.ts` + `GARMENT_IDENTITY_POLICY.md` | Formula freeze |
| Mapping Engine | `mapping-engine.ts` | Behavior freeze |
| Classification Engine | `classification-engine.ts` | Behavior freeze |
| Normalization Engine | `normalization-engine.ts` | Behavior freeze |
| Attribute Resolution Engine | `attribute-resolution-engine.ts` | Behavior freeze |
| Catalog Resolution Engine | `catalog-resolution-engine.ts` | Behavior freeze |
| Confidence Engine | `confidence-engine.ts` | Behavior freeze |
| Limitation Engine | `limitation-engine.ts` | Behavior freeze |
| Explainability Engine | `explainability-engine.ts` | Behavior freeze |
| Garment validators | `garment-validators.ts` | Contract freeze |
| Garment Intelligence Service | `garment-intelligence.service.ts` | Capability freeze |
| Golden fixtures | `garment/goldens/**` | Regression freeze |
| Phase 6C / 6C.1 tests | `phase6c-garment-intelligence.schema-tests.ts` | Must remain green |
| Shared fashion aliases (GI consumer) | `vision/schema/fashion-aliases.ts` | Alias SSOT — CR if changed for GI meaning |
| Public port contract | `ports/fashion/fashion-analysis.port.ts` (`FashionAnalysisPortResult`) | Public DTO freeze |
| Vision fashion adapter bridge | `ports/adapters/vision-fashion.adapter.ts` (GI mapping path only) | No silent failure; Canonical-only return |
| HTTP analyze surface | `ai/ai-gateway.controller.ts` · `POST vision/outfit/analyze` response shape | Public HTTP freeze |
| Capability registration | `analyze_garment` in `fashion-capability-catalog.ts` | Capability freeze |
| Runtime integration | Emit via existing `fashion-runtime-state` (no schema redesign) | Emit-only freeze |

## Explicitly out of this freeze (siblings)

Do **not** treat as GI-owned freezes (separate governance):

- Wardrobe Foundation schemas (6B)  
- Fashion Session schemas (6B)  
- Face / Skin / Beauty Experience  
- Provider SDKs (FASHN / OpenAI)  
- Outfit / Styling / Recommendation / Knowledge Graph / Taxonomy Service (future)

## Modification rule

Any edit to a protected component requires:

1. Filed Change Request under GI Change Policy  
2. Version bump per SemVer  
3. Regression: `npm run test:phase6c` (+ `test:phase6b` if wardrobe touch)  
4. Program approval before merge to production
