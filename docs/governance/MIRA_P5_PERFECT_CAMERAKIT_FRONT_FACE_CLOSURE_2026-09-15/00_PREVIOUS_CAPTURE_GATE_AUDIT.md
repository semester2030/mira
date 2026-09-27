# Previous Skin capture-gate audit (pre CameraKit)

| Item | Current production |
|------|-------------------|
| Preview owner | `FaceCapturePanel` + Flutter `camera` plugin |
| Live gate | MediaPipe `FaceMeshQualityGate` |
| Auto-capture path | `CaptureMirrorCoordinator` when `skinInteractiveReportV1` |
| Post-capture gate | `FaceGateValidator` + `CaptureQualityThresholds` |
| Documented loose pose (cq-v2.1 / mesh soft) | yaw ±35°, pitch ±30°, roll ±28° |
| Perfect CameraKit | **NOT IN REPO** |

Owner rejection: loose pose allows visibly tilted faces. Correct fix = Perfect Mobile CameraKit MODERATE as **final** Skin capture owner.
