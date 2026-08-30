import 'face_guidance_vms.dart';

/// Advisor context preparation for Phase 9I — refs only, no invented advice.
class FaceGuidanceAdvisorContext {
  final String analysisId;
  final String? guidanceId;
  final String? frozenRecommendationRef;
  final String? sourceResultRef;
  final String? sourceDetailRef;
  final String? sourceInsightRef;
  final String? suggestedPromptAr;
  final List<String> evidenceRefs;

  const FaceGuidanceAdvisorContext({
    required this.analysisId,
    this.guidanceId,
    this.frozenRecommendationRef,
    this.sourceResultRef,
    this.sourceDetailRef,
    this.sourceInsightRef,
    this.suggestedPromptAr,
    this.evidenceRefs = const [],
  });

  factory FaceGuidanceAdvisorContext.fromItem({
    required String analysisId,
    required FaceGuidanceItemVm item,
  }) {
    final refs = <String>[
      if (item.frozenRecommendationRef != null) item.frozenRecommendationRef!,
      if (item.sourceResultRef != null) item.sourceResultRef!,
      if (item.sourceDetailRef != null) item.sourceDetailRef!,
      if (item.sourceInsightRef != null) item.sourceInsightRef!,
    ];
    return FaceGuidanceAdvisorContext(
      analysisId: analysisId,
      guidanceId: item.guidanceId,
      frozenRecommendationRef: item.frozenRecommendationRef,
      sourceResultRef: item.sourceResultRef,
      sourceDetailRef: item.sourceDetailRef,
      sourceInsightRef: item.sourceInsightRef,
      suggestedPromptAr: 'عن الإرشاد: ${item.titleAr}',
      evidenceRefs: refs,
    );
  }
}
