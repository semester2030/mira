# Architecture

```
FaceIntelligenceReport (frozen)
→ FaceResultProjector
→ FaceResultProjection
  ├── FaceExecutiveSummaryVm (primary + ≤3 insights + next action + advisor entry)
  ├── FaceResultMirrorVm (orientation + overlay eligibility)
  ├── limitations / regions / detailRefs
  └── numericVisibilityByMetric
→ Future 9F UI
```
