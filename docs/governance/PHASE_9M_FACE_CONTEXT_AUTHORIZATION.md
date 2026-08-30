# Face Context Authorization

Ownership gate: `{ id: analysisId, userId }` on skinAnalysis.  
Unauthorized / missing → empty units (`face_context_no_authoritative_evidence`).  
Nested analysisId mismatch with stored face → selection collapsed to generalFaceResult.
