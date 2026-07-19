# Face Measurement / Geometry Contract

**Version:** `face-measurement-contract-v1`  
**Phase:** 4B  
**Formula id:** `face-geom-ratios-thirds-sym-v1`  
**Engine version:** `face-geometry-v1`

## Scope

Ratios · facial thirds balance · cautious symmetry.  
`faceShape` is produced in Phase 4C (`face-shape-hybrid-ratios-v1`); geometry pipeline alone still leaves it unavailable.

## Inputs

1. Measurement eligibility (`cq-thresholds-v2.1` + FaceGate reason codes)  
2. Geometry anchors (normalized 0–1) extracted via `MediapipeLandmarkIndices` constants  

## Formulas

| Metric | Formula |
|--------|---------|
| faceWidthHeightRatio | `dist(leftFace,rightFace) / dist(foreheadTop,chin)` |
| eyeSpacingRatio | `dist(leftEyeInner,rightEyeInner) / faceWidth` |
| noseToFaceWidthRatio | `dist(leftAla,rightAla) / faceWidth` |
| mouthToFaceWidthRatio | `dist(leftMouth,rightMouth) / faceWidth` |
| facialThirdsBalance | Vertical spans forehead→brow, brow→noseBase, noseBase→chin; score from low CV |
| symmetryCautious | Mean L/R deviations (eye y, mouth y, side x) → cautious score; lower confidence |

Normalized 0–100 values are **cosmetic balance vs typical bands**, not attractiveness.

## Unavailable

- Not eligible → all 4B metrics unavailable  
- Missing/invalid anchors → unavailable  
- Degenerate width/height → unavailable  
- Never invent 0 / average / neutral fillers  

## Forbidden

- Attractiveness / beauty ranking scores  
- Medical craniofacial diagnosis  
- Second MediaPipe index table  
- Computing faceShape in 4B  

## Index ownership

`lib/.../mediapipe_landmark_indices.dart` — sole owner of geometry anchor indices.
