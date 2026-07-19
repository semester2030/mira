# Server Face Presence (Phase 2.1)

## Detector

| Field | Value |
|-------|--------|
| Library | `@tensorflow-models/blazeface` + `@tensorflow/tfjs` |
| Backend | TensorFlow.js **cpu** |
| Identity | `blazeface_tfjs` |
| Class | `BlazeFacePresenceDetector` |
| Injection | `FACE_PRESENCE_DETECTOR` |

## Thresholds

Canonical: `CAPTURE_QUALITY_THRESHOLDS` (`cq-thresholds-v2.1`)

| Param | Value | Why |
|-------|------:|-----|
| `blazefaceMinScore` | 0.75 | High precision; photo-like lab faces ~0.99 |
| `requiredFaceCount` | 1 | Skin analysis is single-face only |

## Behavior

1. Structural checks (size/bytes/aspect) still run.
2. BlazeFace estimates faces on EXIF-oriented RGB.
3. Detections below `blazefaceMinScore` are discarded.
4. `faceCount` is **only** the count of surviving detections — never inferred as `1` from structure.
5. If the detector is unavailable → request rejected (`face_detector_unavailable`).

## Limitations

- No yaw/pitch/roll from BlazeFace (still ML Kit on device).
- Cartoon/emoji faces may or may not trigger BlazeFace; tiny emoji fixtures are used in tests as non-faces.
- CPU backend is slower than `tfjs-node` (optional future).

## Tests

`npm run test:phase2.1` — real face SVG, blank, cartoon, landscape, object, non-face solid.
