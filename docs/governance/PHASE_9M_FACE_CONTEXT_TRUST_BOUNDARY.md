# Face Context Trust Boundary

| Field | Class |
|---|---|
| contextType, selected*Id/Ref, frozenRecommendationRef, evidenceRefs | IDENTIFIER |
| confidenceQualifier, personalizationLevel, contextLabelAr | DISPLAY_HINT |
| publicFactAr, reasonAr | UNTRUSTED_TEXT (ignored) |
| Stored FaceIntelligenceReportDto | SERVER_AUTHORITY |
| Client-asserted provenance | FORBIDDEN_AUTHORITY |

Direction: CLIENT refs → SERVER resolve report → reconcile → seal envelope.
