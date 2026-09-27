# PHASE 5 — SKIN STRICT FRONTAL GEOMETRY

**Task:** `MIRA-P5-SKIN-STRICT-FRONTAL-GEOMETRY-2026-09-09`  
**Date:** 2026-09-09

## Scope

This closure covers only:

- capture quality
- frontal pose acceptance
- centering
- face scale
- post-capture validation
- same-image identity
- dynamic crop
- left/right correctness audit

Out of scope for this task:

- icon work
- visual polish
- report redesign
- backend rewrite
- new skin claims
- Phase 6

## Detector capability

### Live preview

- Technology: `mediapipe_face_mesh`
- File: `lib/features/skin_analysis/presentation/live_face_map/face_mesh_service.dart`
- Pipeline:
  - `FaceDetectorProcessor.create(model: FaceDetectionModel.fullRangeSparse, maxResults: 1, roiScaleY: 1.6, roiShiftY: -0.1)`
  - `FaceMeshProcessor.create(delegate: FaceMeshDelegate.xnnpack, enableSmoothing: true, enableRoiTracking: true, enableIris: true)`
  - `FaceMeshInferencePipeline`
- Outputs available live:
  - face bounding box
  - 468 mesh landmarks
  - region polygons
  - tracking quality
- Outputs **not** available live from the current exported frame contract:
  - explicit yaw
  - explicit pitch
  - explicit roll

### Post-capture validation

- Technology: `google_mlkit_face_detection`
- File: `lib/core/face_gate/face_gate_validator.dart`
- Options:
  - `performanceMode: accurate`
  - `minFaceSize: 0.08`
  - `enableLandmarks: true`
  - `enableContours: false`
  - `enableClassification: false`
  - `enableTracking: false`
- Outputs available after capture:
  - `faceCount`
  - `faceBox`
  - `imageSize`
  - `faceAreaRatio`
  - `headYawDegrees`
  - `headPitchDegrees`
  - `headRollDegrees`
  - `centerOffsetXRatio`
  - `centerOffsetYRatio`
  - `eyesVisible`
  - `mouthVisible`

## Current enforced limits in code

These are the actual enforced limits traced from the current engine and reused by this closure. No new arbitrary degrees were invented in this task.

### Live readiness / guide space

Source:

- `lib/features/face_analysis_experience/capture/policy/face_capture_readiness_policy.dart`
- `lib/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart`
- `lib/features/face_analysis_experience/presentation/capture/geometry/capture_guide_geometry.dart`

Values:

- face height vs guide height:
  - min = `0.74`
  - max = `1.06`
- center offset vs guide:
  - X = `0.13`
  - Y = `0.11`
- frame age max = `450ms`
- hold-still window = `500ms`

### Post-capture ML Kit gate / image space

Source:

- `lib/core/face_gate/face_gate_rules.dart`
- `lib/features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart`

Values:

- face count = exactly `1`
- face area ratio:
  - min = `0.05`
  - max = `0.92`
- yaw max = `35.0`
- pitch max = `30.0`
- roll max = `28.0`
- center offset:
  - X = `0.13`
  - Y = `0.11`
- blur floor = `28.0` Laplacian variance
- brightness range = `0.18` to `0.92`

## Implemented gate behavior

### Live alignment gate

File:

- `lib/features/skin_analysis/presentation/widgets/face_capture_panel.dart`

What changed:

- shutter readiness now depends on deterministic readiness output, not just “face exists”
- live guidance is sourced from one primary correction path
- live mesh region gate is also enforced before capture:
  - forehead
  - under-eye
  - nose
  - cheek
  - chin

Effective behavior now:

- `NOT_READY / ALIGNING / READY` are determined from the readiness evaluator
- capture does not proceed when readiness fails
- when mesh says a required region is missing, its message takes priority

### Post-capture validation

After the photo is taken:

1. raw captured image validated by ML Kit + quality gate  
2. image normalized/aligned by actual detected face box  
3. normalized image validated **again**  
4. only then accepted for analysis

If the normalized image fails:

- provider call does not start
- recapture is required

## Same-image contract

Required identity:

`VALIDATED_IMAGE == ANALYZED_IMAGE == CURRENT_REPORT_EPHEMERAL_IMAGE`

Implemented by:

- capture acceptance stores the normalized accepted image
- `FaceResultMirrorImageHold.prepareFrom(...)` copies that accepted image for the current report
- `SkinCaptureQualityGate.run(...)` now recognizes already-canonical aligned captures
- `SkinAnalysisApiDataSource.analyzeAndSave(...)` now uploads `gate.readyFile` directly
- the old extra `prepareForAnalysis(...)` transform was removed from the provider upload path for this flow

Result:

- the image that passed post-capture validation is the one sent to analysis
- the same accepted image remains the current ephemeral report image

## Dynamic face crop

File:

- `lib/features/skin_analysis/presentation/utils/face_image_processor.dart`

Current crop algorithm:

- EXIF bake / orientation normalization
- optional roll correction
- actual detected face box scaled into source image coordinates
- dynamic crop around the detected face
- target face height fraction = `0.58`
- min output short side = `1280`

This is dynamic by user face geometry, not a fixed global crop rectangle.

## Landmark / region alignment

### What is proven

- live preview uses real MediaPipe mesh landmarks
- `FaceIntelProductionBridge` extracts real normalized anchors from the accepted/aligned image
- current report region IDs were audited
- left/right cheek labels were corrected:
  - `cheeks_left` = `الخد الأيسر`
  - `cheeks_right` = `الخد الأيمن`

### What is **not yet fully closed**

The current Skin interactive report still renders region geometry from `LuxuryFaceGeometry`, which is a `LANDMARK_TEMPLATE` path system, not a per-user landmark-warped polygon system.

So this task closes:

- strict frontal capture
- same-image identity
- dynamic crop
- left/right label correctness

But does **not** prove:

- per-user landmark-warped final report regions

That item remains below the owner’s requested final geometry bar.

## Right / left + mirroring

Audit findings:

- live preview is mirrored for front camera
- still preview can remain mirrored for continuity
- EXIF is baked before validation/cropping
- result image for current analysis is ephemeral only
- a real label swap existed in `results_skin_map_panel.dart` and was fixed

Current status:

- known explicit cheek label swap = closed
- full end-to-end proof of zero left/right swaps on physical taps = still pending physical verification

## Tests run

- `test/face_gate_rules_test.dart`
- `test/face_mesh_quality_gate_test.dart`
- `test/face_analysis_experience/phase_9b_capture_readiness_test.dart`
- `test/face_analysis_experience/strict_frontal_geometry_contract_test.dart`

Static quality:

- targeted `flutter analyze` on strict-frontal files and tests: **no new findings**

## Physical iPhone evidence

App launch was re-verified on the physical iPhone from Cursor in this session.  
The full owner acceptance matrix below still requires manual execution on device:

- off-center reject
- yaw reject
- pitch reject
- roll reject
- too close reject
- too far reject
- clipped forehead/chin reject
- valid frontal ready
- accepted capture -> post-capture pass
- accepted capture -> analysis
- accepted capture -> current report image
- region tap correctness

## Current verdict

Implemented:

- frontal-only gate behavior in practice
- live deterministic readiness gating
- post-capture revalidation
- same-image identity contract
- dynamic crop
- cheek label correction
- zero persistent face-image storage

Not yet proven:

- landmark-aligned final report regions
- repeatability measurements from controlled physical runs
- full physical iPhone acceptance matrix

Therefore:

`STRICT FRONTAL GEOMETRY ACCEPTANCE = BLOCKED`
