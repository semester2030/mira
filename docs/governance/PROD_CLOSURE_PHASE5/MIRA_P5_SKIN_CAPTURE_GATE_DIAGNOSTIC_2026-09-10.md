# MIRA-P5-SKIN-CAPTURE-GATE-DIAGNOSTIC-2026-09-10

## Status (this package stage)

DIAGNOSTIC INSTRUMENTATION LANDED — physical matrix / root-cause class / fix **PENDING** owner HUD readings.

**NO thresholds changed. NO Face Map changes.**

## 1 — Canonical READY equation (production code)

Source of truth:

- `FaceCapturePanel._canonicalCaptureReady`
- `SkinCaptureTapGate.isCaptureReady`
- `FaceMeshQualityGate.evaluate`

```
_canonicalCaptureReady =
  previewSize != Size.zero
  AND cameraController != null
  AND cameraController.isInitialized
  AND SkinCaptureTapGate.isCaptureReady(...)

SkinCaptureTapGate.isCaptureReady =
  liveMeshGate.isAccepted
  AND (
    mirrorEnabled
      ? (guidance?.isReady == true)
      : FaceMeshQualityGate.canTakePhoto(frame)
  )

FaceMeshQualityGate.evaluate (ALL mandatory):
  hasFace
  AND quality != low
  AND region forehead present (points>=3, !suppressed)
  AND region underEye present
  AND region nose present
  AND region cheek present (any side)
  AND region chin present
  AND boundingBox != null
  AND |centerXDrift| / guideW <= 0.11
  AND |centerYDrift| / guideH <= 0.10
  AND faceHeight/guideHeight ∈ [0.74, 1.06]

FaceMeshQualityGate.canTakePhoto =
  hasFace AND quality != low
```

### Live yaw / pitch / roll

**NOT AVAILABLE** on live MediaPipe `FaceMeshFrame`.
Euler angles exist only on **post-capture** ML Kit (`FaceGateValidator` / `StrictFrontalCapturePolicy`: yaw≤15°, pitch≤15°, roll≤12°).

HUD shows YAW/PITCH/ROLL as `N/A live` — do not invent values.

### UI READY == CAPTURE READY

Visual `captureReady` uses `_canonicalCaptureReady` (same predicate). Tap handler rejects with `not_ready` when canonical false (no silent dead-null onTap).

## 2 — Before-fix thresholds (unchanged)

| Gate | Limit |
|------|-------|
| YAW (post-capture only) | 15° (`StrictFrontalCapturePolicy` / warnCombined) |
| PITCH (post-capture only) | 15° |
| ROLL (post-capture only) | 12° |
| CENTER X | ≤ 0.11 of guide width |
| CENTER Y | ≤ 0.10 of guide height |
| FACE SCALE (height vs guide) | 0.74 .. 1.06 |
| Regions | forehead, underEye, nose, cheek, chin |
| Mirror flag | `FaceCaptureMirrorFlag.enabled` (dart-define + entitlement) |

## 3 — Debug HUD (INTERNAL ONLY)

Enable:

```
--dart-define=MIRA_SKIN_CAPTURE_GATE_DEBUG=true
```

Also enabled when `MIRA_SKIN_CAPTURE_TAP_DEBUG=true`.

Shows live PASS/FAIL for every available gate + `CANONICAL READY` + `BLOCKING:` list.

Tap logs: `TAP_RECEIVED`, `BLOCKING_GATES`, `CANONICAL_READY`, `EARLY_RETURN_REASON`, `TAKE_PICTURE_CALLED`, plus `READY_TRANSITION` on flicker.

## 4 — Physical matrix A–J

Owner must record HUD rows for each position with thresholds **unchanged**. Fill `PHYSICAL_MATRIX.md` after device run.

## 5 — STOP rules

Face Map LOCKED · Iconography LOCKED · Visual polish LOCKED · Phase 6 LOCKED  
Fix only after proven blocking gates on ideal face.
