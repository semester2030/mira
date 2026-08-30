# Implementation Report

Package: `lib/features/face_analysis_experience/presentation/analysis/`

Integration:
- `FaceCapturePanel` shows `AnalysisMotionOverlay` when flag ON + `isAnalyzing`
- `NewAnalysisScreen` drives `AnalysisPipelineStatus` + handoff gate before navigation
- Flag OFF → legacy MiraScanningBadge / EducationalFaceRegionsPainter path unchanged

No backend / Face Intelligence changes.
