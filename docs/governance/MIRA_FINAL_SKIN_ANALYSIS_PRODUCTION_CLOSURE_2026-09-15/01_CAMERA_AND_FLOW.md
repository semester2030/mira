# Camera + auto flow

| Requirement | Status | Source |
|-------------|--------|--------|
| Perfect CameraKit MODERATE | ABSENT | docs/.../02_CAMERAKIT_EVIDENCE.md |
| Quality gate used | MediaPipe FaceMeshQualityGate + CaptureMirrorCoordinator | face_capture_panel.dart |
| Auto-capture | ON when skinInteractiveReportV1 (default true) | `_mirrorEnabled` |
| Extra «تحليل» / «بدء التحليل» after capture | REMOVED (happy path) | new_analysis_screen.dart |
| Auto analysis after accepted capture | YES | onImageChanged → onAnalyze post-frame |
| Modern result navigation | YES | ResultsReportEntry → SkinInteractiveReportScreen |
| Same image E2E | YES (session ephemeral hold of Perfect-input) | AnalysisSession |
| Persistent face storage | 0 | ephemeral registry |

Pose soft limits restored on FaceMeshQualityGate: yaw35/pitch30/roll28 (= cq-thresholds-v2.1).
