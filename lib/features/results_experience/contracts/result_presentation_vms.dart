import 'result_enums.dart';

/// Base fields shared by public-safe presentation models.
class ResultItemBase {
  const ResultItemBase({
    required this.id,
    required this.titleAr,
    required this.summaryAr,
    required this.confidence,
    required this.evidenceRef,
    required this.visibility,
    required this.interaction,
    required this.limitation,
    this.analyticsId,
    this.titleEn = '',
    this.summaryEn = '',
  });

  final String id;
  final String titleAr;
  final String titleEn;
  final String summaryAr;
  final String summaryEn;
  final ConfidenceState confidence;
  final String evidenceRef;
  final VisibilityState visibility;
  final InteractionState interaction;
  final LimitationState limitation;
  final String? analyticsId;
}

class ResultScoreView {
  const ResultScoreView({
    required this.category,
    required this.direction,
    required this.value,
    required this.statusLabelAr,
    required this.colorRole,
    required this.numericVisible,
    required this.accessibilityTextAr,
  });

  final ScoreCategory category;
  final ScoreDirection direction;
  final double? value;
  final String statusLabelAr;
  final ColorRole colorRole;
  final bool numericVisible;
  final String accessibilityTextAr;
}

class ResultSummaryVM extends ResultItemBase {
  const ResultSummaryVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.vitality,
    required this.skinTypeAr,
    required this.headlineAr,
    super.analyticsId = 'results_summary',
  });

  final ResultScoreView vitality;
  final String skinTypeAr;
  final String headlineAr;
}

class ResultPriorityVM extends ResultItemBase {
  const ResultPriorityVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.rank,
    required this.concernLabelAr,
    required this.actionId,
    required this.actionLabelAr,
    required this.eligibilityReasonAr,
    required this.personalization,
    super.analyticsId,
  });

  final int rank;
  final String concernLabelAr;
  final String actionId;
  final String actionLabelAr;
  final String eligibilityReasonAr;
  final PersonalizationClass personalization;
}

class ResultMetricVM extends ResultItemBase {
  const ResultMetricVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.condition,
    required this.severityOrWellness,
    required this.statusLabelAr,
    required this.explanationAr,
    required this.evidenceAvailable,
    required this.comparisonEligible,
    this.recommendedActionAr,
    super.analyticsId,
  });

  final ResultScoreView? condition;
  final ResultScoreView? severityOrWellness;
  final String statusLabelAr;
  final String explanationAr;
  final String? recommendedActionAr;
  final bool evidenceAvailable;
  final bool comparisonEligible;
}

class ResultActionVM extends ResultItemBase {
  const ResultActionVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.personalization,
    required this.adviceConceptId,
    required this.owner,
    this.avoidAr = const [],
    this.routineStepId,
    super.analyticsId = 'results_immediate_action',
  });

  final PersonalizationClass personalization;
  final String adviceConceptId;
  final AdviceOwner owner;
  final List<String> avoidAr;
  /// Stable link into Personal Plan (Phase 8E). Null when no eligible step.
  final String? routineStepId;
}

class ResultRoutinePreviewVM extends ResultItemBase {
  const ResultRoutinePreviewVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.morningCount,
    required this.eveningCount,
    required this.hasSteps,
    super.analyticsId = 'results_routine_entry',
  });

  final int morningCount;
  final int eveningCount;
  final bool hasSteps;
}

class ResultMapConcernVM {
  const ResultMapConcernVM({
    required this.id,
    required this.labelAr,
    required this.evidenceRef,
    required this.visibility,
  });

  final String id;
  final String labelAr;
  final String evidenceRef;
  final VisibilityState visibility;
}

class ResultMapVM extends ResultItemBase {
  const ResultMapVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.mode,
    required this.badgeAr,
    required this.explanationAr,
    required this.concerns,
    required this.overlayType,
    required this.interactionEligible,
    super.analyticsId = 'results_map',
  });

  final MapPresentationMode mode;
  final String badgeAr;
  final String explanationAr;
  final List<ResultMapConcernVM> concerns;
  final String overlayType;
  final bool interactionEligible;
}

class ResultProgressPreviewVM extends ResultItemBase {
  const ResultProgressPreviewVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.comparability,
    required this.deltaVisible,
    required this.projectionVisible,
    this.deltaPoints,
    this.projectionEstimate,
    this.projectionLabelAr =
        'تقدير مستقبلي وليس قياساً',
    super.analyticsId = 'results_progress_entry',
  });

  final ProgressComparabilityState comparability;
  final bool deltaVisible;
  final bool projectionVisible;
  final int? deltaPoints;
  final int? projectionEstimate;
  final String projectionLabelAr;
}

class ResultProductVM extends ResultItemBase {
  const ResultProductVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.brandAr,
    required this.state,
    required this.matchPercent,
    required this.matchNumericVisible,
    required this.linkedConcernAr,
    required this.recommendationReasonAr,
    required this.usageContextAr,
    required this.disclosure,
    required this.skinTypeAr,
    this.ingredientEvidenceAr,
    this.qualificationReasonAr,
    super.analyticsId,
  });

  final String brandAr;
  final ProductRecommendationState state;
  final int? matchPercent;
  final bool matchNumericVisible;
  final String linkedConcernAr;
  final String recommendationReasonAr;
  final String usageContextAr;
  final ProductDisclosure disclosure;
  final String skinTypeAr;
  final String? ingredientEvidenceAr;
  final String? qualificationReasonAr;
}

class ResultConfidenceVM extends ResultItemBase {
  const ResultConfidenceVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.overall,
    required this.retakeSuggested,
    super.analyticsId = 'results_confidence',
  });

  final ConfidenceState overall;
  final bool retakeSuggested;
}

class ResultLimitationVM extends ResultItemBase {
  const ResultLimitationVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    super.analyticsId = 'results_limitation',
  });
}

class ResultAdvisorQuestionVM {
  const ResultAdvisorQuestionVM({
    required this.id,
    required this.textAr,
    required this.personalization,
    required this.evidenceRef,
    required this.visibility,
  });

  final String id;
  final String textAr;
  final PersonalizationClass personalization;
  final String evidenceRef;
  final VisibilityState visibility;
}

class ResultAdvisorEntryVM extends ResultItemBase {
  const ResultAdvisorEntryVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.publicNameAr,
    required this.suggestedQuestions,
    super.analyticsId = 'results_advisor_entry',
  }) : assert(publicNameAr != 'MCE');

  final String publicNameAr;
  final List<ResultAdvisorQuestionVM> suggestedQuestions;
}

class ResultRetakeVM extends ResultItemBase {
  const ResultRetakeVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.suggested,
    super.analyticsId = 'results_retake',
  });

  final bool suggested;
}

class ResultDisclosureVM extends ResultItemBase {
  const ResultDisclosureVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    super.analyticsId = 'results_disclosure',
  });
}

class ResultSkinAgeVM extends ResultItemBase {
  const ResultSkinAgeVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.estimateYears,
    required this.qualificationAr,
    required this.eligibleForSecondary,
    super.analyticsId = 'results_skin_age',
  });

  final int? estimateYears;
  final String qualificationAr;
  final bool eligibleForSecondary;
}

// ── Phase 8E — Personal Plan / Routine ──────────────────────────────────────

class ResultRoutineStepVM extends ResultItemBase {
  const ResultRoutineStepVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.period,
    required this.sequence,
    required this.instructionAr,
    required this.reasonAr,
    required this.personalization,
    required this.adviceConceptId,
    required this.completionEligible,
    required this.advisorEligible,
    super.analyticsId,
  });

  final RoutinePeriod period;
  final int sequence;
  final String instructionAr;
  final String reasonAr;
  final PersonalizationClass personalization;
  final String adviceConceptId;
  final bool completionEligible;
  final bool advisorEligible;
}

class ResultRoutinePeriodVM {
  const ResultRoutinePeriodVM({
    required this.period,
    required this.titleAr,
    required this.steps,
  });

  final RoutinePeriod period;
  final String titleAr;
  final List<ResultRoutineStepVM> steps;
}

class ResultWeeklyAdjustmentVM extends ResultItemBase {
  const ResultWeeklyAdjustmentVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.frequencyAr,
    required this.instructionAr,
    required this.successSignalAr,
    required this.personalization,
    super.analyticsId = 'results_weekly_adjustment',
  });

  final String frequencyAr;
  final String instructionAr;
  final String successSignalAr;
  final PersonalizationClass personalization;
}

class ResultAvoidanceVM extends ResultItemBase {
  const ResultAvoidanceVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.personalization,
    required this.adviceConceptId,
    super.analyticsId,
  });

  final PersonalizationClass personalization;
  final String adviceConceptId;
}

class ResultRoutineAdvisorEntryVM {
  const ResultRoutineAdvisorEntryVM({
    required this.publicNameAr,
    required this.suggestedQuestions,
    required this.visibility,
  }) : assert(publicNameAr != 'MCE');

  final String publicNameAr;
  final List<ResultAdvisorQuestionVM> suggestedQuestions;
  final VisibilityState visibility;
}

class ResultPersonalPlanVM extends ResultItemBase {
  const ResultPersonalPlanVM({
    required super.id,
    required super.titleAr,
    required super.summaryAr,
    required super.confidence,
    required super.evidenceRef,
    required super.visibility,
    required super.interaction,
    required super.limitation,
    required this.focusAr,
    required this.activeStepCount,
    required this.primaryObjectiveAr,
    required this.isLimited,
    required this.reviewGuidanceAr,
    required this.morning,
    required this.evening,
    required this.weekly,
    required this.avoidances,
    required this.advisorEntry,
    required this.todayStepId,
    required this.eligible,
    super.analyticsId = 'results_personal_plan',
  });

  final String focusAr;
  final int activeStepCount;
  final String primaryObjectiveAr;
  final bool isLimited;
  final String reviewGuidanceAr;
  final ResultRoutinePeriodVM morning;
  final ResultRoutinePeriodVM evening;
  final ResultWeeklyAdjustmentVM? weekly;
  final List<ResultAvoidanceVM> avoidances;
  final ResultRoutineAdvisorEntryVM advisorEntry;
  final String? todayStepId;
  final bool eligible;
}

/// Root public-safe presentation model for a projected result experience.
class ResultExperience {
  const ResultExperience({
    required this.id,
    required this.projectionVersion,
    required this.flagVariant,
    required this.summary,
    required this.priorities,
    required this.immediateAction,
    required this.routinePreview,
    required this.personalPlan,
    required this.progressPreview,
    required this.advisorEntry,
    required this.metrics,
    required this.map,
    required this.products,
    required this.confidence,
    required this.limitations,
    required this.disclosures,
    required this.retake,
    required this.skinAge,
    required this.firstSurfaceIds,
    required this.ownedAdviceConceptIds,
  });

  final String id;
  final String projectionVersion;
  final String flagVariant;
  final ResultSummaryVM summary;
  final List<ResultPriorityVM> priorities;
  final ResultActionVM? immediateAction;
  final ResultRoutinePreviewVM routinePreview;
  final ResultPersonalPlanVM personalPlan;
  final ResultProgressPreviewVM progressPreview;
  final ResultAdvisorEntryVM advisorEntry;
  final List<ResultMetricVM> metrics;
  final ResultMapVM map;
  final List<ResultProductVM> products;
  final ResultConfidenceVM confidence;
  final List<ResultLimitationVM> limitations;
  final List<ResultDisclosureVM> disclosures;
  final ResultRetakeVM retake;
  final ResultSkinAgeVM skinAge;
  /// Contractual first-surface item ids (future UI). Max composition enforced.
  final List<String> firstSurfaceIds;
  final List<String> ownedAdviceConceptIds;
}
