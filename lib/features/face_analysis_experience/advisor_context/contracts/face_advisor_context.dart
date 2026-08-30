/// Phase 9I — Canonical Face → Advisor context contract (presentation-owned).
///
/// Face Experience provides context; Advisor provides conversation.
/// No raw geometry / mesh / image / canonical bodies.
library;

enum FaceAdvisorContextType {
  primaryResult,
  insight,
  detail,
  region,
  guidance,
  generalFaceResult,
}

/// Public-safe Face Advisor context — refs + approved public facts only.
class FaceAdvisorContext {
  final String analysisId;
  final String? reportRef;
  final FaceAdvisorContextType contextType;
  final String? selectedResultId;
  final String? selectedInsightId;
  final String? selectedDetailRef;
  final String? selectedRegion;
  final String? selectedGuidanceId;
  final String? frozenRecommendationRef;
  final List<String> evidenceRefs;
  final List<String> limitationRefs;
  final String? confidenceQualifier;
  final List<String> suggestedQuestionKeys;
  final List<String> suggestedQuestionsAr;
  final String contextLabelAr;
  final String? initialQuestionAr;
  /// Display-only public fact (UI). **Not evidence authority.**
  ///
  /// Phase 9M: still assembled for local presentation / suggested prompts, but
  /// **not serialized** to `/advisor/chat`. Server reconciles selection refs
  /// against the stored Face Intelligence report.
  final String? publicFactAr;

  /// Display-only guidance reason (UI). **Not evidence authority.**
  ///
  /// Phase 9M: not serialized to the API. Server uses frozen recommendation
  /// `reasonAr` from the authoritative stored report when guidance resolves.
  final String? reasonAr;
  final String? personalizationLevel;
  final String resultVersion;
  final bool evidenceStale;
  final String contractVersion;

  const FaceAdvisorContext({
    required this.analysisId,
    required this.contextType,
    required this.contextLabelAr,
    this.reportRef,
    this.selectedResultId,
    this.selectedInsightId,
    this.selectedDetailRef,
    this.selectedRegion,
    this.selectedGuidanceId,
    this.frozenRecommendationRef,
    this.evidenceRefs = const [],
    this.limitationRefs = const [],
    this.confidenceQualifier,
    this.suggestedQuestionKeys = const [],
    this.suggestedQuestionsAr = const [],
    this.initialQuestionAr,
    this.publicFactAr,
    this.reasonAr,
    this.personalizationLevel,
    this.resultVersion = 'face-result-projection-v1',
    this.evidenceStale = false,
    this.contractVersion = 'face-advisor-context-v1',
  });

  /// API-safe payload (no authority / provider / envelope keys).
  Map<String, dynamic> toJson() {
    return {
      'contextType': contextType.name,
      'analysisId': analysisId,
      if (reportRef != null && reportRef!.isNotEmpty) 'reportRef': reportRef,
      if (selectedResultId != null) 'selectedResultId': selectedResultId,
      if (selectedInsightId != null) 'selectedInsightId': selectedInsightId,
      if (selectedDetailRef != null) 'selectedDetailRef': selectedDetailRef,
      if (selectedRegion != null) 'selectedRegion': selectedRegion,
      if (selectedGuidanceId != null) 'selectedGuidanceId': selectedGuidanceId,
      if (frozenRecommendationRef != null)
        'frozenRecommendationRef': frozenRecommendationRef,
      if (evidenceRefs.isNotEmpty) 'evidenceRefs': evidenceRefs,
      if (limitationRefs.isNotEmpty) 'limitationRefs': limitationRefs,
      if (confidenceQualifier != null) 'confidenceQualifier': confidenceQualifier,
      if (suggestedQuestionKeys.isNotEmpty)
        'suggestedQuestionKeys': suggestedQuestionKeys,
      // Phase 9M: publicFactAr / reasonAr are DISPLAY_ONLY — never sent as
      // evidence authority. Server ignores them even if an old client sends them.
      if (personalizationLevel != null)
        'personalizationLevel': personalizationLevel,
      'resultVersion': resultVersion,
      'evidenceStale': evidenceStale,
      'contextLabelAr': contextLabelAr,
    };
  }

  static const forbiddenAuthorityKeys = [
    'provider',
    'envelopeId',
    'traceId',
    'canonical',
    'mesh',
    'landmarks',
    'geometry',
    'rawConfidence',
    'beautyScore',
    'attractiveness',
  ];
}
