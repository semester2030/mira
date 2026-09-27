# Camera ownership audit — Perfect CameraKit 2.5.0

| Responsibility | Existing MIRA owner | CameraKit integration |
|---|---|---|
| Camera preview | `FaceCapturePanel` + Flutter `CameraController` | **REUSE** — single preview |
| AVCaptureSession / native path | `camera_avfoundation` plugin | **REUSE** — no second session |
| Preview-frame delivery | `CameraController.startImageStream` | **EXTEND** — forward NV12 to CameraKit |
| Capture action | `FaceCapturePanel._capture` | **REUSE** — triggered by CameraKit stable ready |
| Capture state | `_capturing` / `_cameraKitAutoQueued` | **REUSE / EXTEND** |
| Quality HUD | Capture Mirror overlay chrome | **EXTEND** — Arabic guidance from CameraKit codes |
| Auto-capture | was CaptureMirrorCoordinator | **REPLACE final gate** with Perfect CameraKit |
| Auto-analysis | `NewAnalysisScreen.onImageChanged` | **REUSE** — unchanged |
| Ephemeral captured image | parent `_capturedImage` | **REUSE** — same file end-to-end |

## Perfect requirement → MIRA owner → action

| Perfect requirement | MIRA owner | Action |
|---|---|---|
| External camera frames | Flutter camera stream | Forward via MethodChannel |
| `onCameraOpen` | after `CameraController.initialize` | Call once |
| Quality callbacks | `PerfectCameraKitGate` | Sole Skin final quality owner |
| MODERATE presets | native `setCameraKitLevel(.moderate)` | Official yaw±10°, size 0.65, etc. |
| Stable window ~800ms | Dart `PerfectCameraKitGate.stableWindow` | App-level (SDK has no built-in latch) |
| Auto capture | `_onCameraKitQuality` → `_capture(fromAuto: true)` | One shot |
| Same image | skip `alignForAnalysis` when CameraKit | Zero warp |

ACTIVE DUPLICATE RESPONSIBILITIES = 0 when `_cameraKitActive` (Capture Mirror gate disabled).
