# Face Alignment (Phase 2)

## Purpose

Deterministic, non-distorting alignment so provider-ready crops are stable across retakes of the same pose.

## Reference landmarks

Phase 2 uses **ML Kit face bounding box center** (not 68-point warp). Eye/mouth landmarks are used only for visibility flags in quality, not for geometric warping.

## Algorithm

1. Bake EXIF orientation.
2. Map face box into oriented pixel space.
3. Optional **roll correction** if `1.5° ≤ |roll| ≤ 28°`:
   - Expand padded crop around face
   - `copyRotate` by `−roll` (rigid rotation — no stretch)
   - Re-center box on padded canvas
4. Crop to viewport aspect with face height ≈ **58%** of crop height.
5. Ensure short side ≥ **1280** via proportional resize (no anamorphic stretch).
6. Encode JPEG quality **95**.

Constants: `FaceAlignmentLimits` in `face_image_processor.dart`.

## Crop margins

| Parameter | Value |
|-----------|-------|
| faceHeightFraction | 0.58 |
| roll pad | 40% of max(face W, H) |
| viewport aspect | From `FaceImageProcessor.viewportAspectRatio` or source aspect |

## Output resolution

- Minimum short side: **1280 px**
- Aspect: capture viewport aspect (matches on-screen preview)
- No forced square, no forced symmetry

## Rotation limits

| Limit | Value |
|-------|-------|
| maxAbsRollDegrees | 28° |
| Pitch / yaw warp | **Not applied** (would distort geometry) |

Head pose outside quality thresholds is **blocked by the quality gate**, not “corrected” into existence.

## Known limitations

- Roll correction after padded rotate approximates face center; extreme rolls are rejected by gate instead.
- No 3D pose unwarp (yaw/pitch).
- No landmark-based affine that could stretch cheeks/eyes.
- Gallery images without reliable EXIF may differ slightly from camera preview.

## Repeatability

Same oriented pixels + same face box → same crop math. JPEG encode at fixed quality is byte-stable for identical pixel buffers.
