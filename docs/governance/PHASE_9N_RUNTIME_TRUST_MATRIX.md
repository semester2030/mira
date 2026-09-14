# Post-9M Runtime Trust Matrix (code)

| Step | Symbol / file |
|---|---|
| Result Mirror Ask Mira | `ResultsFaceMirrorScreen` → `AdvisorRouteArgs.face` |
| Flutter context | `FaceAdvisorContext` / `FaceAdvisorContextAssembler` |
| API DTO wire | `AdvisorFaceContext.toJson` (omits free text) → `AdvisorApiDataSource.chat` |
| HTTP | `POST /advisor/chat` · `AdvisorController` + FirebaseAuthGuard |
| DTO | `AdvisorChatDto` / `AdvisorFaceContextDto` |
| Service | `AdvisorService.chat` → `sanitizeFaceFocus` → `loadFaceEvidence` |
| Report resolve | `prisma.skinAnalysis.findFirst({ id: analysisId, userId })` → `extractMiraReportFromStored` → `faceIntelligence` |
| Projector | `projectFaceIntelligenceEvidence` |
| Seal | `BeautyAdvisorService.turn` → `sealAdvisorEvidenceEnvelope` |
| Plan/narrate | conversation planner + grounded response engine |

Proof: inspected production sources; not docs.
