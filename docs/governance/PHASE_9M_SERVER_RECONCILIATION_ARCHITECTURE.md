# Server Reconciliation Architecture

OPTION A implemented.

1. Auth user + `dto.analysisId` → `skinAnalysis.findFirst({ id, userId })`
2. Extract `miraReport.faceIntelligence`
3. Sanitize focus (strip publicFactAr/reasonAr)
4. `projectFaceIntelligenceEvidence(face, focus)` reconciles refs
5. Seal via existing BeautyAdvisor envelope path

No second Face DB. No LLM reconstructor.
