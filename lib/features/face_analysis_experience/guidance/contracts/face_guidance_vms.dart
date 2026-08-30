/// Phase 9H — Personal Guidance contracts / enums.
enum FaceGuidanceOwner {
  faceIntelligence,
  advisor,
  skin,
  fashion,
  genericStatic,
  legacy,
  unsupported,
}

enum FaceGuidanceType {
  stylingRecommendation,
  educational,
  retake,
  empty,
}

enum FaceGuidancePersonalizationLevel {
  personalized,
  contextual,
  general,
  educational,
}

enum FaceGuidanceEligibility {
  showPrimary,
  showSecondary,
  detailOnly,
  educationalOnly,
  hide,
  block,
}

enum FaceGuidanceActionKind {
  askMira,
  exploreResult,
  openOwnedFeature,
  retake,
  close,
}

class FaceGuidanceReasonVm {
  final String labelAr;
  final String explanationAr;
  final String? relatedResultTitleAr;
  final String? qualificationAr;

  const FaceGuidanceReasonVm({
    required this.labelAr,
    required this.explanationAr,
    this.relatedResultTitleAr,
    this.qualificationAr,
  });
}

class FaceGuidanceItemVm {
  final String guidanceId;
  final FaceGuidanceOwner owner;
  final FaceGuidanceType type;
  final String titleAr;
  final String bodyAr;
  final FaceGuidancePersonalizationLevel personalizationLevel;
  final FaceGuidanceReasonVm reason;
  final String? sourceResultRef;
  final String? sourceInsightRef;
  final String? sourceDetailRef;
  final String? frozenRecommendationRef;
  final String? confidencePresentationAr;
  final String? limitationAr;
  final FaceGuidanceActionKind primaryAction;
  final String primaryActionLabelAr;
  final int priority;
  final FaceGuidanceEligibility eligibility;
  final String category;
  final String contractVersion;

  const FaceGuidanceItemVm({
    required this.guidanceId,
    required this.owner,
    required this.type,
    required this.titleAr,
    required this.bodyAr,
    required this.personalizationLevel,
    required this.reason,
    required this.primaryAction,
    required this.primaryActionLabelAr,
    required this.priority,
    required this.eligibility,
    required this.category,
    this.sourceResultRef,
    this.sourceInsightRef,
    this.sourceDetailRef,
    this.frozenRecommendationRef,
    this.confidencePresentationAr,
    this.limitationAr,
    this.contractVersion = 'face-guidance-item-vm-v1',
  });
}

/// Compact surface output for 9F / dedicated sheet.
class FaceGuidanceSurfaceVm {
  final String surfaceId;
  final FaceGuidanceItemVm? primary;
  final List<FaceGuidanceItemVm> secondary;
  final bool retakeSupersedes;
  final bool empty;
  final String emptyHeadlineAr;
  final String emptySupportAr;
  final String contractVersion;

  const FaceGuidanceSurfaceVm({
    required this.surfaceId,
    required this.secondary,
    required this.retakeSupersedes,
    required this.empty,
    required this.emptyHeadlineAr,
    required this.emptySupportAr,
    this.primary,
    this.contractVersion = 'face-guidance-surface-vm-v1',
  });

  List<FaceGuidanceItemVm> get allItems => [
        if (primary != null) primary!,
        ...secondary,
      ];
}
