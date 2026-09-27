# PHASE 5 — SKIN FACE GEOMETRY PRECISION FINAL CLOSURE (STAGE 1)

**Task:** `MIRA-P5-SKIN-FACE-AND-VISUAL-FINAL-CLOSURE-2026-09-09`  
**Stage:** 1 of 2 (geometry only — Stage 2 not started)  
**Date:** 2026-09-09

## Absolute order

STAGE 1 MUST PASS before Stage 2 (icons / premium visual) may start.

## Landmark source (1.1)

| Item | Value |
|------|--------|
| Technology | MediaPipe Face Mesh (`mediapipe_face_mesh`) |
| Service | `lib/features/skin_analysis/presentation/live_face_map/face_mesh_service.dart` |
| Landmark count | ~468 (topology `MediapipeLandmarkIndices`) |
| Live pose Euler | NOT exported by current live mesh frame |
| Post-capture pose | ML Kit Face Detector Euler Y/X/Z (degrees) |
| Report regions | Per-user mesh via `LandmarkFaceRegionSession` + `LandmarkAlignedFaceGeometry` |
| Coordinate pipeline | image pixels → `FaceMappingContext` (contentSize=image, viewport=face display, `mirrorPreview=false`) → BoxFit.cover mapper → same Path for draw + hit |

## Strict frontal calibration (1.2)

Policy: `StrictFrontalCapturePolicy` (`strict-frontal-skin-v1`)

Evidence sources (not invented degrees):

| Limit | Value | Evidence |
|-------|-------|----------|
| maxYaw | **15°** | `CaptureQualityThresholds.warnCombinedAngleDegrees` promoted from soft-warn → hard Skin gate |
| maxPitch | **15°** | same |
| maxRoll | **12°** | `28 × (15/35)` scale from legacy maxRoll vs maxYaw |
| center X | **0.11** | `FaceMeshQualityGate.maxCenterDriftX` |
| center Y | **0.10** | `FaceMeshQualityGate.maxCenterDriftY` |
| face height vs guide | **0.74–1.06** | live oval fill constants |
| face area | **0.05–0.92** | cq-thresholds-v2.1 (unchanged area band) |

Legacy cq-thresholds-v2.1 (35° / 30° / 28°) remains for non-Skin Face Intelligence eligibility only — **not** Skin production acceptance.

## Gates (1.3–1.4)

- Live: `CaptureMirrorCoordinator(policy: StrictFrontalCapturePolicy.readiness)` + `FaceMeshQualityGate`
- Post-capture: `FaceGateValidator.validate(..., limits: StrictFrontalCapturePolicy.gateLimits)` on raw and again on aligned file
- READY only when all mandatory gates pass; one Arabic correction cue at a time

## Same image + ephemeral (1.5–1.6)

Unchanged contract: validated aligned file = analyzed = ephemeral report image.  
No Firebase/Postgres/object/gallery persistence of analysis face.

## Per-user regions (1.8–1.13)

- Current analysis interactive map: landmark polygons from accepted user image
- Draw path == hit-test path (`LandmarkAlignedFaceGeometry.hitTest`)
- Overlap rule: **smallest containing path area wins** (deterministic; not widget order)
- Accessibility: ±6 px soft edge only — no giant invisible boxes
- Template concern overlay from `LuxuryFaceGeometry` **disabled** for `FaceMapBaseMode.ephemeralUserImage`

## LuxuryFaceGeometry disposition (1.10)

**RETAIN_ONLY_FOR_HISTORY_ILLUSTRATION**

Removed from authoritative runtime alignment for current-user interactive face.

## Right / left (1.11)

- `cheeks_left` = MediaPipe `isLeftSide: true` = subject's anatomical left
- `cheeks_right` = MediaPipe `isLeftSide: false` = subject's anatomical right
- Report image uses `mirrorPreview: false` (no double mirror)

## Debug geometry (1.15)

`SkinGeometryDebugMode` — debug builds only via  
`--dart-define=MIRA_SKIN_GEOMETRY_DEBUG=true`  
Shows face box, landmarks, region outlines, tap point. Never production UX.

## Truth (global)

Skin Map truth remains **LANDMARK_TEMPLATE / illustrative**.  
Per-user warping = geometric alignment only.  
**FAKE PIXEL PRECISION = 0**

## Tests run

- `flutter analyze` (Stage 1 touch paths): No issues
- `landmark_aligned_face_geometry_test.dart`: PASS
- `strict_frontal_geometry_contract_test.dart`: PASS
- `face_gate_rules_test.dart`: PASS
- `phase_9b_capture_readiness_test.dart`: PASS

## Physical iPhone (1.18)

See `evidence/skin_face_geometry_final/IPHONE_EVIDENCE.md`

## Stage 1 gate status

Pending physical matrix completion before PASS / FAIL verdict.
