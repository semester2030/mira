# Frame feed audit — CameraKit usability closure

## Contract (Perfect sample 2.5.0)

- Pixel format required: `kCVPixelFormatType_420YpCbCr8BiPlanarFullRange`
- Sample sends `CMSampleBuffer` directly from `AVCaptureVideoDataOutput`
- Flutter `camera_avfoundation` yuv420 = **VideoRange** (not FullRange)

## MIRA before fix

| Item | Value |
|---|---|
| Preview (observed) | w=720 h=1280 yStride=768 uvStride=768 |
| Source format | VideoRange NV12 via Flutter |
| Sent as | FullRange label **without** luma expand |
| Effect | systematic dark bias → frequent `light=under_exposed` |
| HUD oval width | 0.58 × viewport (< MODERATE 0.65) → fill-oval still `too_small` |

## MIRA after fix

| Item | Change |
|---|---|
| Plane/stride | Keep stride-aware row copy (768→720 visible) |
| Pixel format | FullRange buffer + **VideoRange→FullRange Y/UV expand** |
| PTS | Monotonic (not always zero) |
| Exposure | `ExposureMode.auto` + `FocusMode.auto` on CameraKit path |
| HUD | CameraKit oval width 0.72 / height 0.84 (align to ≥0.65 face) |
| Pose thresholds | **unchanged** MODERATE yaw±10 pitch -15..+5 |
| faceSizeRatio | **unchanged** 0.65 |

## Pose degree

API exposes `facePoseDegree`; physical logs often show `deg=0.0` while `pose=bad`.  
POSE DEGREE AVAILABLE: YES (property exists)  
TELEMETRY RELIABLE: NO — do not gate capture on degree; FacePoseQuality is authoritative.
