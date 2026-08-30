# PHASE 9I — Implementation Report

## Flutter
- Package: `lib/features/face_analysis_experience/advisor_context/`
- `AdvisorRouteArgs.face(...)` carries `FaceAdvisorContext`
- `MiraAdvisorScreen` Face sticky path → `/advisor/chat` (not MCE)
- Context label: «تسألين عن …»
- Return to mirror preserves selection state

## API (additive only)
- `AdvisorFaceContextDto` on `AdvisorChatDto`
- `projectFaceIntelligenceToEvidenceUnits`
- Face turns isolate Face evidence (no unrelated skin dump)
