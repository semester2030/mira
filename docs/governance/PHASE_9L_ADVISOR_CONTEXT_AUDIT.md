# PHASE 9L — Advisor Context Audit

Result Mirror → AdvisorRouteArgs.face → MiraAdvisorScreen._sendViaFaceAdvisor → POST /advisor/chat.  
MCE not used for Face contextual turns when faceContext present.

**MAJOR-9L-01:** Server `projectFaceIntelligenceToEvidenceUnits` seals `focus.publicFactAr` / `focus.reasonAr` with provenance `canonical_face_report` without verifying text against stored report.
Evidence: `mira-api/src/beauty-advisor/evidence/face-intelligence-projector.ts` L158–193.
