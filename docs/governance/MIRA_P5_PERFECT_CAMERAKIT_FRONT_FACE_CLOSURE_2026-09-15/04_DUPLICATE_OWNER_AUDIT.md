# Duplicate-owner audit (current)

| Responsibility | Owners today | Target after CameraKit |
|----------------|--------------|------------------------|
| Camera preview | FaceCapturePanel (1) | 1 |
| Capture quality final gate | MediaPipe + CaptureMirror (+ post FaceGate) | **Perfect CameraKit only (1)** |
| Auto-capture | CaptureMirrorCoordinator | CameraKit stable ready → same shutter path (1) |
| Auto-analysis | NewAnalysisScreen onImageChanged | unchanged (1) |

ACTIVE DUPLICATE RESPONSIBILITIES today: MediaPipe vs intended CameraKit (CameraKit missing).
After SDK: MediaPipe must not be final Skin capture gate.
