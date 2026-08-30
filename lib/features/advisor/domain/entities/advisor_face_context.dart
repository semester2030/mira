/// Public-safe Face request context for POST /advisor/chat (mirrors API DTO).
///
/// Phase 9M trust: selection refs are IDENTIFIERS. [publicFactAr]/[reasonAr]
/// are UNTRUSTED / DISPLAY_ONLY and are **not** serialized (server ignores them
/// even from old clients).
class AdvisorFaceContext {
  final String contextType;
  final String? analysisId;
  final String? reportRef;
  final String? selectedResultId;
  final String? selectedInsightId;
  final String? selectedDetailRef;
  final String? selectedRegion;
  final String? selectedGuidanceId;
  final String? frozenRecommendationRef;
  final List<String> evidenceRefs;
  final List<String> limitationRefs;
  final String? confidenceQualifier;
  /// UNTRUSTED_CLIENT_INPUT — retained for local/tests; not sent on the wire.
  final String? publicFactAr;
  /// UNTRUSTED_CLIENT_INPUT — retained for local/tests; not sent on the wire.
  final String? reasonAr;
  final String? personalizationLevel;
  final String? contextLabelAr;
  final String? resultVersion;
  final bool? evidenceStale;

  const AdvisorFaceContext({
    required this.contextType,
    this.analysisId,
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
    this.publicFactAr,
    this.reasonAr,
    this.personalizationLevel,
    this.contextLabelAr,
    this.resultVersion,
    this.evidenceStale,
  });

  Map<String, dynamic> toJson() => {
        'contextType': contextType,
        if (analysisId != null && analysisId!.isNotEmpty)
          'analysisId': analysisId,
        if (reportRef != null && reportRef!.isNotEmpty) 'reportRef': reportRef,
        if (selectedResultId != null) 'selectedResultId': selectedResultId,
        if (selectedInsightId != null) 'selectedInsightId': selectedInsightId,
        if (selectedDetailRef != null) 'selectedDetailRef': selectedDetailRef,
        if (selectedRegion != null) 'selectedRegion': selectedRegion,
        if (selectedGuidanceId != null)
          'selectedGuidanceId': selectedGuidanceId,
        if (frozenRecommendationRef != null)
          'frozenRecommendationRef': frozenRecommendationRef,
        if (evidenceRefs.isNotEmpty) 'evidenceRefs': evidenceRefs,
        if (limitationRefs.isNotEmpty) 'limitationRefs': limitationRefs,
        if (confidenceQualifier != null)
          'confidenceQualifier': confidenceQualifier,
        // 9M: do not send publicFactAr / reasonAr — server is evidence authority.
        if (personalizationLevel != null)
          'personalizationLevel': personalizationLevel,
        if (contextLabelAr != null) 'contextLabelAr': contextLabelAr,
        if (resultVersion != null) 'resultVersion': resultVersion,
        if (evidenceStale != null) 'evidenceStale': evidenceStale,
      };

  static const forbiddenAuthorityKeys = [
    'provider',
    'envelopeId',
    'traceId',
    'mesh',
    'landmarks',
    'beautyScore',
    'attractiveness',
  ];
}
