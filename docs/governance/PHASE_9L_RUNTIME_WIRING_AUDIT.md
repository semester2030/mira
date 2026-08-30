# PHASE 9L — Runtime Wiring Audit

## Flags OFF (production default)
NewAnalysisScreen → FaceCapturePanel (legacy LiveFaceAnalysisOverlay + manual shutter) → SkinAnalysis → MiraReportNavigation.openAfterAnalysis → ResultsReportEntry → MiraBeautyReportScreen (or Results V2 if separate flag) → Ask Mira via AdvisorRouteArgs.skin → MCE SSE.

## Flags Capture+Motion+Result ON
InteractiveCaptureMirror → Soft Laser AnalysisMotionOverlay → image hold → ResultsFaceMirrorScreen (9E projector) → Details/Guidance/History → AdvisorRouteArgs.face → POST /advisor/chat.

## Edges proven in code
- ResultsReportEntry gates on FaceResultMirrorFlag + fromFreshAnalysis|fromHistory
- NewAnalysisScreen motion handoff + hold prepare
- FaceCapturePanel branches on FaceCaptureMirrorFlag / FaceAnalysisMotionFlag
- MiraAdvisorScreen `_useFaceAdvisorChat` before MCE

## Hybrid notes
- Result ON / Capture OFF: legacy capture still works; hold prepared if Result flag ON
- Capture ON / Motion OFF: interactive capture + legacy analyzing wait
- Motion ON / Result OFF: Soft Laser then legacy report (no mirror)
