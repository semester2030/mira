# PHASE 9H — Guidance Contract

`FaceGuidanceItemVm` fields justified by existing data:
guidanceId, owner, type, titleAr, bodyAr, personalizationLevel, reason,
sourceResultRef, sourceInsightRef, sourceDetailRef, frozenRecommendationRef,
confidencePresentationAr, limitationAr, primaryAction, primaryActionLabelAr,
priority, eligibility, category.

Surface: `FaceGuidanceSurfaceVm` with primary + secondary + empty/retake flags.
Version pins: `face-guidance-item-vm-v1` / `face-guidance-surface-vm-v1`.
