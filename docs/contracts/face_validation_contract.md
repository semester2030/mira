# Face Validation Contract

**Version:** `face-validation-contract-v1`  
**Validation package:** `face-validation-v1`  
**Master contract:** `face-intel-contract-v1`  
**Phase:** 4F

## Goal

Prove internal consistency of:

```
Eligibility → Geometry → Shape/Findings → Recommendations → Face Report DTO
  → Localization → Provider isolation → Flutter parse/theme
```

Without adding end-user features. Auditors **fail loudly** — never silent repair.

## Artifacts

| Artifact | Path |
|----------|------|
| Auditors | `mira-api/src/intelligence/face-intelligence/validation/contract-audit.ts` |
| Fixtures | `.../validation/fixtures.ts` |
| Goldens | `.../validation/goldens/*.golden.json` |
| Suite | `npm run test:phase4f` |
| Deprecation plan | `docs/architecture/local-face-map-builder-deprecation.md` |

## Auditor checklist

1. Canonical face model catalog completeness  
2. Unavailable metrics never invent `normalizedValue`  
3. Findings traceable to available metrics  
4. Recommendations evidence + `productLockIn: false`  
5. Report required fields + `face-report-v1`  
6. Bilingual AR/EN pairs (no terminology drift vs catalog)  
7. Provider leakage ban (`rawYouCam`, tokens)  
8. Attractiveness / beauty-ranking ban  
9. FaceHealthMap separation note present  

## Goldens policy

Identical fixture inputs → identical shape id, finding ids, reco ids, layer ids, unavailable set (excluding `generatedAt`).  
**Forbidden:** changing geometry/shape formulas solely to match a golden without explicit approval.

## Regression

Phase 4F suite re-runs `test:phase4a`…`test:phase4e` and `test:phase3.5` to protect Skin Intelligence goldens and prior Face Intel stages.

## Forbidden

- Silent contract repair  
- Editing skin-intelligence goldens from Face work  
- Overloading FaceHealthMap as Face Intel schema  
- Removing `LocalFaceMapBuilder` without following the deprecation plan
