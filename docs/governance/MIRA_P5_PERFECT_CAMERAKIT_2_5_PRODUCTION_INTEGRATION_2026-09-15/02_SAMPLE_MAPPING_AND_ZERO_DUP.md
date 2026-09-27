# Official sample → MIRA mapping

| Sample-iOS-CameraKitDemo | MIRA |
|---|---|
| Own `AVCaptureSession` | Flutter `CameraController` (existing) — **not duplicated** |
| `CameraKit.create(withModelPath:)` | `PerfectCameraKitChannel.initialize` |
| `onCameraOpen(isFront)` | after camera init + lazy on first frame |
| `sendCameraBuffer(CMSampleBuffer)` | Dart forwards Y+UV → native NV12 FullRange buffer |
| `CameraKitDelegate.checkedResult` | EventChannel `mira/perfect_camerakit/quality` |
| `setCameraKitLevel(.moderate)` | same |
| Manual shutter in sample | MIRA auto-capture after 800ms stable ready |
| Model files in sample bundle | CocoaPods `PerfectCameraKitModels` resource bundle |

# Zero-duplication audit

| Owner | Count when CameraKit active |
|---|---|
| CAMERA PREVIEW | 1 (`FaceCapturePanel`) |
| CAMERAKIT | 1 (`PerfectCameraKitOwner`) |
| QUALITY DECISION | 1 (`PerfectCameraKitGate` / native checkedResult) |
| CAPTURE STATE | 1 (`FaceCapturePanel._capturing`) |
| AUTO-CAPTURE | 1 (`_onCameraKitQuality`) |
| AUTO-ANALYSIS | 1 (`NewAnalysisScreen.onImageChanged`) |

Capture Mirror final gate/auto-fire: **disabled** when `_cameraKitActive`.
MediaPipe FaceMesh: overlay only — **not** final Skin capture gate.
