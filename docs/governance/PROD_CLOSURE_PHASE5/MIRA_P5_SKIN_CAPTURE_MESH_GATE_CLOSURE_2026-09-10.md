# MIRA-P5-SKIN-CAPTURE-MESH-GATE-CLOSURE-2026-09-10

## CHEEK ROOT CAUSE (proven in code + prior HUD)

Live `MediapipeLandmarkIndices.leftCheek/rightCheek` included under-eye bleed
indices. Polygons were built then `RegionPathUtils.shouldSuppress` marked
`suppressed=true` (typically `area_too_large` and/or `cheek_crossed_midline`).

Gate predicate: `id==cheek && points>=3 && !suppressed` → empty → `mesh_region_missing`.

Landmarks were PRESENT; availability contract failed.

### Exact landmark fix (malar-only)

LEFT: `50,101,36,205,207,187,147,123,116,203,206,216,212,214,192,213`
RIGHT: `280,352,411,427,425,266,330,351,416,433,376,401`

Removed bleed L:`117,118,119,120,121,128,245,189` R:`347,346,340,265,261,448-453,412`

Report indices now alias live sets (single source). Gate requires BOTH left+right cheeks.

RIGHT_LEFT_SWAP: 0 (isLeftSide tied to anatomical index lists; preview mirror flips coords only).

## CENTER-Y EQUATION

```
centerY = (boundingBox.center.dy - guide.center.dy) / guide.height
guide.center.dy = viewport.height * 0.48
guide.height = viewport.height * 0.68
threshold: |centerY| <= 0.10
```

NOT absolute normalized Y (`box.cy / viewport.height` ≈ 0.48 when centered).

HUD now shows `CENTER Y DRIFT` plus `CY box/guide/abs` diagnostics.
Threshold NOT loosened. Measurement semantics documented; physical confirm pending.

## HEAD POSE METHOD

`FaceMeshHeadPoseEstimator` from existing MediaPipe 3D landmarks (z-depth):
- yaw: atan2(leftFace.z - rightFace.z, faceWidth)
- pitch: atan2(midZ - nose.z, faceHeight)
- roll: atan2(eyeDy, eyeDx)

Limits (existing Skin StrictFrontal / live gate — not invented):
YAW ≤ 15° · PITCH ≤ 15° · ROLL ≤ 12°

Wired into `FaceMeshQualityGate.evaluate` + mirror coordinator input.

## CANONICAL READY

Unchanged single predicate: cameraReady ∧ SkinCaptureTapGate.isCaptureReady
(mesh gate now includes both cheeks + live pose).

## PHYSICAL IPHONE

Diagnostic build installed with HUD. Owner must confirm:
LEFT/RIGHT CHEEK PASS → CENTER Y PASS → YAW/PITCH/ROLL numeric PASS → READY YES → 3/3 capture.

Face Map / icons / polish / Phase 6: LOCKED.
