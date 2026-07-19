# Garment Intelligence — Contract Freeze Report v1.0.0

**Date:** 2026-07-19  
**Compat:** `garment-compat-v1`

## Frozen public contracts

1. `CanonicalGarment` (+ material, fieldConfidence, explainability)  
2. `FashionAnalysisPortResult.garments: CanonicalGarment[]`  
3. `POST /ai/vision/outfit/analyze` success shape (Canonical garments; no `fashionVision`)  
4. `analyze_garment` capability semantics (Mira mapping only)  
5. Identity policy `garment-identity-v1`  
6. Validation + leakage rules as of 6C.1  
7. Golden `blazer_beige.vision.json` identity pin behavior  

## Explicitly not frozen as public GI contracts

- `FashionVisionDocument` (internal)  
- `DetectedGarment` (internal type only)  
- Wardrobe / Session schemas (6B ownership)  
- Provider SDK contracts  

## Guarantee

Breaking changes to the frozen list require MAJOR version + Change Request.
