# P5 — SKIN FACE MAP LANDMARK PRECISION FINAL

**Task:** `MIRA-P5-SKIN-FACE-MAP-LANDMARK-PRECISION-FINAL-2026-09-10`  
**Date:** 2026-09-10

## Root cause (pre-fix)

Current-user Face Explorer still placed the ephemeral photo inside
`LuxuryFaceGeometry.faceBoundsIn` (template aspect) and historically used
template `regionPath` for taps. Landmark session existed but display container
remained template-coupled.

## Fix summary

1. Current-user display rect → `CurrentUserFaceDisplayGeometry.faceRectIn` (no Luxury aspect).
2. Image + landmark mapper share that exact rect + `BoxFit.cover`.
3. Draw + hit use same `LandmarkAlignedFaceGeometry` paths; critical-only hit set.
4. Fail-closed when five critical regions unavailable.
5. Crop tighten: `FaceAlignmentLimits.faceHeightFraction` 0.58 → **0.68**.
6. LuxuryFaceGeometry retained **history-only**.

## Landmark source

| Item | Value |
|------|--------|
| Tech | `mediapipe_face_mesh` Face Mesh |
| Expected count | 468 |
| Runtime proof | `FaceMeshService` rejects `< 468`; session requires `landmarkCount >= 400` + 5 critical paths |
| Mirror | `mirrorPreview: false` on report image |
| Pose live | not in mesh frame; post-capture ML Kit Euler |

## Same-image identity

Validated aligned path (`mira_face_aligned_*`) → upload → ephemeral hold →
`LandmarkFaceRegionSession.load(ephemeralUserImagePath)`.

## Automated tests

`test/results_experience/skin_face_map_landmark_precision_test.dart`

- Centroid 5/5
- Interior samples 100%
- Negative false positives 0
- Multi-face hash differential
- Same-person repeatability band (mean < 8px / max < 16px on synthetic ±2px jitter)

## Physical iPhone 10-tap

**NOT RUN** in this session (agent cannot perform owner finger taps).  
Therefore **FACE MAP PRECISION ACCEPTANCE = BLOCKED** pending owner matrix.

Candidate installed for owner review when device available.

## Icon / visual / Phase 6

NOT PERFORMED / LOCKED.
