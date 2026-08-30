/// Provider-independent frozen snapshot for projection.
/// Built from existing reports without modifying intelligence engines.
class FrozenPriorityInput {
  const FrozenPriorityInput({
    required this.id,
    required this.metricId,
    required this.titleAr,
    required this.evidenceAr,
    required this.severity,
    required this.confidenceLevel,
    this.actionHintAr,
  });

  final String id;
  final String metricId;
  final String titleAr;
  final String evidenceAr;
  final String severity;
  final String confidenceLevel;
  final String? actionHintAr;
}

class FrozenMetricInput {
  const FrozenMetricInput({
    required this.id,
    required this.displayNameAr,
    required this.available,
    required this.confidencePercent,
    this.normalizedWellnessValue,
    this.levelAr,
    this.reasonAr,
  });

  final String id;
  final String displayNameAr;
  final bool available;
  /// Wellness-oriented normalized 0–100 when available (higher better).
  final double? normalizedWellnessValue;
  final int confidencePercent;
  final String? levelAr;
  final String? reasonAr;
}

class FrozenProductInput {
  const FrozenProductInput({
    required this.id,
    required this.nameAr,
    required this.brandAr,
    required this.matchScore,
    this.linkedConcernId,
    this.linkedConcernAr,
    this.stepAr,
    this.ingredientEvidenceAr,
    this.disclosure = 'partner',
    this.hasRecommendationReason = false,
    this.recommendationReasonAr,
  });

  final String id;
  final String nameAr;
  final String brandAr;
  final int matchScore;
  final String? linkedConcernId;
  final String? linkedConcernAr;
  final String? stepAr;
  final String? ingredientEvidenceAr;
  final String disclosure;
  final bool hasRecommendationReason;
  final String? recommendationReasonAr;
}

class FrozenAdvisorClaimInput {
  const FrozenAdvisorClaimInput({
    required this.id,
    required this.statementAr,
    required this.available,
  });

  final String id;
  final String statementAr;
  final bool available;
}

class FrozenProgressInput {
  const FrozenProgressInput({
    required this.scanCount,
    required this.hasBaseline,
    this.deltaPoints,
    this.projectedScore30Days,
    this.metricCompatible = true,
    this.modelVersionCompatible = true,
    this.captureQualityCompatible = true,
    this.confidenceAdequate = true,
    this.intervalDays,
  });

  final int scanCount;
  final bool hasBaseline;
  final int? deltaPoints;
  final int? projectedScore30Days;
  final bool metricCompatible;
  final bool modelVersionCompatible;
  final bool captureQualityCompatible;
  final bool confidenceAdequate;
  final int? intervalDays;
}

/// Frozen routine step snapshot — presentation input only.
class FrozenRoutineStepInput {
  const FrozenRoutineStepInput({
    required this.id,
    required this.nameAr,
    required this.instructionAr,
    required this.period,
  });

  final String id;
  final String nameAr;
  final String instructionAr;
  /// `am` | `pm`
  final String period;
}

class ResultProjectionInput {
  const ResultProjectionInput({
    required this.analysisId,
    required this.vitalityScore,
    required this.skinTypeAr,
    required this.headlineAr,
    required this.summaryAr,
    required this.overallConfidencePercent,
    required this.priorities,
    required this.metrics,
    required this.products,
    required this.progress,
    required this.advisorClaims,
    this.morningStepCount = 0,
    this.eveningStepCount = 0,
    this.morningSteps = const [],
    this.eveningSteps = const [],
    this.weeklyPlanEnabled = false,
    this.weeklyHeadlineAr = '',
    this.weeklySummaryAr = '',
    this.skinAgeYears,
    this.skinAgeConfidenceLevel,
    this.mapEnabled = false,
    this.mapConcernIds = const [],
    this.disclaimerAr =
        'هذا التحليل تجميلي وإرشادي، وليس تشخيصاً طبياً.',
    this.retakeGuidanceAr,
    this.tipsAr = const [],
  });

  final String analysisId;
  final int vitalityScore;
  final String skinTypeAr;
  final String headlineAr;
  final String summaryAr;
  final int overallConfidencePercent;
  final List<FrozenPriorityInput> priorities;
  final List<FrozenMetricInput> metrics;
  final List<FrozenProductInput> products;
  final FrozenProgressInput progress;
  final List<FrozenAdvisorClaimInput> advisorClaims;
  final int morningStepCount;
  final int eveningStepCount;
  final List<FrozenRoutineStepInput> morningSteps;
  final List<FrozenRoutineStepInput> eveningSteps;
  final bool weeklyPlanEnabled;
  final String weeklyHeadlineAr;
  final String weeklySummaryAr;
  final int? skinAgeYears;
  final String? skinAgeConfidenceLevel;
  final bool mapEnabled;
  final List<String> mapConcernIds;
  final String disclaimerAr;
  final String? retakeGuidanceAr;
  final List<String> tipsAr;
}

/// Explicit clock/context — no implicit DateTime.now in projection.
class ResultProjectionContext {
  const ResultProjectionContext({
    required this.now,
    this.locale = 'ar',
    this.flagVariant = 'legacy',
  });

  final DateTime now;
  final String locale;
  final String flagVariant;
}
