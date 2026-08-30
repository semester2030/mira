import '../../guidance/contracts/face_guidance_advisor_context.dart';
import '../../guidance/contracts/face_guidance_vms.dart';
import '../../presentation/result/contracts/face_result_selection_state.dart';
import '../../presentation/result/details/contracts/face_detail_sheet_vm.dart';
import '../../projection/contracts/face_result_enums.dart';
import '../../projection/contracts/face_result_vms.dart';
import '../contracts/face_advisor_context.dart';
import '../localization/face_advisor_context_copy.dart';

/// Pure deterministic Face → Advisor context assembler (Phase 9I).
///
/// Inputs: 9E / 9G / 9H public-safe models only.
/// No network · no LLM · no raw Face Intelligence parsing.
class FaceAdvisorContextAssembler {
  const FaceAdvisorContextAssembler();

  FaceAdvisorContext build({
    required FaceResultProjection projection,
    FaceResultSelectionState selection = FaceResultSelectionState.empty,
    FaceDetailSheetVm? openDetail,
    FaceGuidanceItemVm? selectedGuidance,
    FaceGuidanceAdvisorContext? guidanceContext,
    String? reportRef,
    bool evidenceStale = false,
  }) {
    // Priority: guidance → detail → insight → region → primary → general
    if (selectedGuidance != null || guidanceContext != null) {
      return _guidance(
        projection: projection,
        item: selectedGuidance,
        guidance: guidanceContext,
        reportRef: reportRef,
        evidenceStale: evidenceStale,
      );
    }
    if (openDetail != null) {
      return _detail(
        projection: projection,
        detail: openDetail,
        reportRef: reportRef,
        evidenceStale: evidenceStale,
      );
    }
    if (selection.selectedInsightId != null) {
      return _insight(
        projection: projection,
        insightId: selection.selectedInsightId!,
        region: selection.selectedRegion,
        reportRef: reportRef,
        evidenceStale: evidenceStale,
      );
    }
    if (selection.selectedRegion != null) {
      return _region(
        projection: projection,
        region: selection.selectedRegion!,
        detailRefId: selection.selectedDetailRefId,
        reportRef: reportRef,
        evidenceStale: evidenceStale,
      );
    }
    if (selection.selectedDetailRefId != null) {
      final primary = projection.executiveSummary.primary;
      if (primary != null &&
          primary.detailRef.id == selection.selectedDetailRefId) {
        return _primary(
          projection: projection,
          reportRef: reportRef,
          evidenceStale: evidenceStale,
        );
      }
    }
    final primary = projection.executiveSummary.primary;
    if (primary != null &&
        projection.completeness != FaceResultCompleteness.empty) {
      return _primary(
        projection: projection,
        reportRef: reportRef,
        evidenceStale: evidenceStale,
      );
    }
    return _general(
      projection: projection,
      reportRef: reportRef,
      evidenceStale: evidenceStale,
    );
  }

  FaceAdvisorContext _primary({
    required FaceResultProjection projection,
    String? reportRef,
    required bool evidenceStale,
  }) {
    final p = projection.executiveSummary.primary!;
    final retake = p.eligibility ==
            FacePresentationEligibility.retakeRecommended ||
        p.eligibility == FacePresentationEligibility.noUsableResult;
    final questions = retake
        ? const [
            FaceAdvisorContextCopy.qWhyRetake,
            FaceAdvisorContextCopy.qHowSure,
          ]
        : const [
            FaceAdvisorContextCopy.qWhatShapeMeans,
            FaceAdvisorContextCopy.qHowDetermined,
            FaceAdvisorContextCopy.qHowSure,
          ];
    return FaceAdvisorContext(
      analysisId: projection.mirror.analysisId,
      reportRef: reportRef,
      contextType: FaceAdvisorContextType.primaryResult,
      selectedResultId: p.resultId,
      selectedDetailRef: p.detailRef.id,
      evidenceRefs: [
        p.resultId,
        p.detailRef.id,
        if (p.evidenceAvailable) 'face_shape',
      ],
      limitationRefs: projection.limitations.map((l) => l.id).toList(),
      confidenceQualifier: p.confidenceQualifierAr,
      suggestedQuestionKeys: const [
        'face_shape_meaning',
        'face_shape_how',
        'face_confidence',
      ],
      suggestedQuestionsAr: questions,
      contextLabelAr: p.category == 'shape'
          ? FaceAdvisorContextCopy.aboutShape
          : FaceAdvisorContextCopy.aboutResult,
      initialQuestionAr: questions.first,
      publicFactAr: '${p.titleAr}: ${p.valueLabelAr}',
      evidenceStale: evidenceStale,
    );
  }

  FaceAdvisorContext _insight({
    required FaceResultProjection projection,
    required String insightId,
    FacePresentationRegion? region,
    String? reportRef,
    required bool evidenceStale,
  }) {
    FaceInsightVm? insight;
    for (final i in projection.executiveSummary.insights) {
      if (i.id == insightId) {
        insight = i;
        break;
      }
    }
    if (insight == null) {
      return _general(
        projection: projection,
        reportRef: reportRef,
        evidenceStale: evidenceStale,
      );
    }
    final questions = const [
      FaceAdvisorContextCopy.qWhatRatioMeans,
      FaceAdvisorContextCopy.qIsStable,
      FaceAdvisorContextCopy.qExplainMore,
    ];
    return FaceAdvisorContext(
      analysisId: projection.mirror.analysisId,
      reportRef: reportRef,
      contextType: FaceAdvisorContextType.insight,
      selectedInsightId: insight.id,
      selectedDetailRef: insight.detailRef.id,
      selectedRegion: (region ?? insight.relatedRegion).name,
      selectedResultId: projection.executiveSummary.primary?.resultId,
      evidenceRefs: [insight.id, insight.detailRef.id, insight.semanticKey],
      confidenceQualifier: null,
      suggestedQuestionKeys: const [
        'face_insight_meaning',
        'face_insight_stable',
      ],
      suggestedQuestionsAr: questions,
      contextLabelAr: FaceAdvisorContextCopy.aboutInsight,
      initialQuestionAr: 'وش يعني: ${insight.titleAr}؟',
      publicFactAr: '${insight.titleAr}. ${insight.bodyAr}',
      evidenceStale: evidenceStale,
    );
  }

  FaceAdvisorContext _detail({
    required FaceResultProjection projection,
    required FaceDetailSheetVm detail,
    String? reportRef,
    required bool evidenceStale,
  }) {
    final questions = const [
      FaceAdvisorContextCopy.qExplainMore,
      FaceAdvisorContextCopy.qHowSure,
    ];
    return FaceAdvisorContext(
      analysisId: projection.mirror.analysisId,
      reportRef: reportRef,
      contextType: FaceAdvisorContextType.detail,
      selectedDetailRef: detail.detailId,
      selectedInsightId: detail.selectedInsightId,
      selectedRegion: detail.region?.name,
      selectedResultId: projection.executiveSummary.primary?.resultId,
      evidenceRefs: [
        detail.detailId,
        if (detail.selectedInsightId != null) detail.selectedInsightId!,
      ],
      confidenceQualifier: detail.confidenceAr,
      limitationRefs: [
        if (detail.limitationAr != null) 'detail_limitation',
      ],
      suggestedQuestionsAr: questions,
      suggestedQuestionKeys: const ['face_detail_explain'],
      contextLabelAr: FaceAdvisorContextCopy.aboutDetail,
      initialQuestionAr: 'وش يعني هذا؟',
      publicFactAr: [
        detail.titleAr,
        if (detail.valueLabelAr != null) detail.valueLabelAr!,
        detail.observationAr,
      ].where((s) => s.trim().isNotEmpty).join(' — '),
      evidenceStale: evidenceStale,
    );
  }

  FaceAdvisorContext _region({
    required FaceResultProjection projection,
    required FacePresentationRegion region,
    String? detailRefId,
    String? reportRef,
    required bool evidenceStale,
  }) {
    final related = projection.regions
        .where((r) => r.region == region)
        .expand((r) => r.insightIds)
        .toSet();
    final insights = projection.executiveSummary.insights
        .where((i) => related.contains(i.id) || i.relatedRegion == region)
        .toList();
    final facts = insights.isEmpty
        ? FaceAdvisorContextCopy.regionIllustrative
        : insights.map((i) => '${i.titleAr}: ${i.bodyAr}').join(' · ');
    return FaceAdvisorContext(
      analysisId: projection.mirror.analysisId,
      reportRef: reportRef,
      contextType: FaceAdvisorContextType.region,
      selectedRegion: region.name,
      selectedDetailRef: detailRefId,
      selectedInsightId: insights.isEmpty ? null : insights.first.id,
      evidenceRefs: [
        'region_${region.name}',
        ...insights.map((i) => i.id),
      ],
      suggestedQuestionsAr: const [
        FaceAdvisorContextCopy.qExplainMore,
      ],
      suggestedQuestionKeys: const ['face_region_associated'],
      contextLabelAr: FaceAdvisorContextCopy.aboutRegion,
      initialQuestionAr: 'وش عندي هنا؟',
      publicFactAr: facts,
      evidenceStale: evidenceStale,
    );
  }

  FaceAdvisorContext _guidance({
    required FaceResultProjection projection,
    FaceGuidanceItemVm? item,
    FaceGuidanceAdvisorContext? guidance,
    String? reportRef,
    required bool evidenceStale,
  }) {
    final g = guidance;
    final title = item?.titleAr ?? 'هذا الإرشاد';
    final body = item?.bodyAr ?? '';
    final reason = item?.reason.explanationAr ?? g?.suggestedPromptAr;
    final questions = const [
      FaceAdvisorContextCopy.qWhyGuidance,
      FaceAdvisorContextCopy.qExplainMore,
    ];
    return FaceAdvisorContext(
      analysisId: g?.analysisId ?? projection.mirror.analysisId,
      reportRef: reportRef,
      contextType: FaceAdvisorContextType.guidance,
      selectedGuidanceId: item?.guidanceId ?? g?.guidanceId,
      frozenRecommendationRef:
          item?.frozenRecommendationRef ?? g?.frozenRecommendationRef,
      selectedResultId: item?.sourceResultRef ?? g?.sourceResultRef,
      selectedDetailRef: item?.sourceDetailRef ?? g?.sourceDetailRef,
      selectedInsightId: item?.sourceInsightRef ?? g?.sourceInsightRef,
      evidenceRefs: [
        ...(g?.evidenceRefs ?? const <String>[]),
        if (item?.frozenRecommendationRef != null)
          item!.frozenRecommendationRef!,
        if (item?.sourceResultRef != null) item!.sourceResultRef!,
      ],
      confidenceQualifier: item?.confidencePresentationAr,
      personalizationLevel: item?.personalizationLevel.name,
      reasonAr: reason,
      publicFactAr: '$title. $body'.trim(),
      suggestedQuestionsAr: questions,
      suggestedQuestionKeys: const ['face_guidance_why'],
      contextLabelAr: FaceAdvisorContextCopy.aboutGuidance,
      initialQuestionAr: g?.suggestedPromptAr ?? 'ليش نصحتيني بهذا؟',
      evidenceStale: evidenceStale,
    );
  }

  FaceAdvisorContext _general({
    required FaceResultProjection projection,
    String? reportRef,
    required bool evidenceStale,
  }) {
    final summary = projection.executiveSummary;
    final primary = summary.primary;
    final refs = <String>[
      if (primary != null) primary.resultId,
      ...summary.insights.take(3).map((i) => i.id),
      ...summary.advisorEntry.evidenceRefs,
    ];
    final empty = summary.completeness == FaceResultCompleteness.empty ||
        primary == null;
    return FaceAdvisorContext(
      analysisId: projection.mirror.analysisId,
      reportRef: reportRef,
      contextType: FaceAdvisorContextType.generalFaceResult,
      selectedResultId: primary?.resultId,
      evidenceRefs: refs,
      confidenceQualifier: primary?.confidenceQualifierAr,
      suggestedQuestionsAr: empty
          ? const [FaceAdvisorContextCopy.qWhyRetake]
          : const [
              FaceAdvisorContextCopy.qWhatShapeMeans,
              FaceAdvisorContextCopy.qExplainMore,
            ],
      suggestedQuestionKeys: summary.advisorEntry.suggestedQuestionKeys,
      contextLabelAr: FaceAdvisorContextCopy.aboutGeneral,
      initialQuestionAr: empty
          ? FaceAdvisorContextCopy.qWhyRetake
          : FaceAdvisorContextCopy.qWhatShapeMeans,
      publicFactAr: empty
          ? summary.supportAr
          : '${summary.headlineAr}. ${summary.supportAr}',
      evidenceStale: evidenceStale,
    );
  }
}
