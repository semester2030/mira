import '../../../intelligence/domain/entities/face_intelligence_report.dart';
import '../../projection/contracts/face_result_enums.dart';
import '../../projection/contracts/face_result_vms.dart';
import '../../projection/localization/face_result_copy.dart';
import '../contracts/face_guidance_vms.dart';
import '../localization/face_guidance_copy.dart';
import '../policies/face_guidance_deduplication.dart';
import '../policies/face_guidance_eligibility_policy.dart';
import '../policies/face_guidance_ownership_policy.dart';
import '../policies/face_guidance_priority_policy.dart';
import '../validators/face_guidance_validators.dart';

/// Pure Personal Guidance assembler (Phase 9H).
///
/// Selects / classifies / dedupes frozen Face recommendations — never invents new ones.
class FaceGuidanceAssembler {
  const FaceGuidanceAssembler();

  FaceGuidanceSurfaceVm build({
    required FaceResultProjection projection,
    required List<FaceIntelRecommendation> recommendations,
    String? selectedInsightId,
    String? selectedDetailRefId,
  }) {
    if (_retake(projection)) {
      final surface = FaceGuidanceSurfaceVm(
        surfaceId: 'guidance_${projection.mirror.analysisId}',
        primary: _retakeItem(projection),
        secondary: const [],
        retakeSupersedes: true,
        empty: false,
        emptyHeadlineAr: FaceGuidanceCopy.emptyHeadline,
        emptySupportAr: FaceGuidanceCopy.emptySupport,
      );
      FaceGuidanceValidators.assertPublicSafe(surface);
      return surface;
    }

    final primary = projection.executiveSummary.primary;
    final lowConfidence = primary?.eligibility ==
            FacePresentationEligibility.displayWithQualification ||
        primary?.confidenceQualifierAr != null;
    final measurementEligible = projection.measurementEligible;
    final hasSource = primary != null && measurementEligible;

    final deduped = FaceGuidanceDeduplication.dedupe(recommendations);
    final insightTitles =
        projection.executiveSummary.insights.map((i) => i.titleAr);
    final insightBodies =
        projection.executiveSummary.insights.map((i) => i.bodyAr);

    final candidates = <FaceGuidanceItemVm>[];
    for (final rec in deduped) {
      if (FaceGuidanceValidators.containsForbidden(
        '${rec.titleAr} ${rec.bodyAr}',
      )) {
        continue;
      }
      if (FaceGuidanceDeduplication.overlapsInsightCopy(
        titleAr: rec.titleAr,
        bodyAr: rec.bodyAr,
        insightTitles: insightTitles,
        insightBodies: insightBodies,
      )) {
        continue;
      }

      final owner = FaceGuidanceOwnershipPolicy.ownerForCategory(rec.category);
      if (owner == FaceGuidanceOwner.unsupported) continue;

      var level = FaceGuidanceEligibilityPolicy.classify(
        category: rec.category,
        hasSource: hasSource && owner == FaceGuidanceOwner.faceIntelligence,
        measurementEligible: measurementEligible,
      );

      // No source ⇒ cannot stay personalized.
      if (level == FaceGuidancePersonalizationLevel.personalized && !hasSource) {
        level = FaceGuidancePersonalizationLevel.general;
      }

      final eligibility = FaceGuidanceEligibilityPolicy.eligibilityFor(
        level: level,
        owner: owner,
        hasSource: hasSource,
        retakeRecommended: false,
        lowConfidence: lowConfidence,
      );
      if (eligibility == FaceGuidanceEligibility.hide ||
          eligibility == FaceGuidanceEligibility.block) {
        continue;
      }

      // General advice never on primary Personal Guidance surface.
      if (level == FaceGuidancePersonalizationLevel.general) {
        continue;
      }

      candidates.add(
        _fromRecommendation(
          projection: projection,
          rec: rec,
          owner: owner,
          level: level,
          eligibility: eligibility,
          lowConfidence: lowConfidence,
        ),
      );
    }

    if (selectedDetailRefId != null || selectedInsightId != null) {
      candidates.sort((a, b) {
        final aRel = isRelatedToSelection(
          a,
          selectedInsightId: selectedInsightId,
          selectedDetailRefId: selectedDetailRefId,
        );
        final bRel = isRelatedToSelection(
          b,
          selectedInsightId: selectedInsightId,
          selectedDetailRefId: selectedDetailRefId,
        );
        if (aRel != bRel) return aRel ? -1 : 1;
        return FaceGuidancePriorityPolicy.sortKey(a)
            .compareTo(FaceGuidancePriorityPolicy.sortKey(b));
      });
    }

    final selected = FaceGuidancePriorityPolicy.selectTop(candidates);
    final FaceGuidanceItemVm? primaryItem =
        selected.isEmpty ? null : selected.first;
    final secondary = selected.length <= 1
        ? const <FaceGuidanceItemVm>[]
        : selected.skip(1).toList(growable: false);

    final surface = FaceGuidanceSurfaceVm(
      surfaceId: 'guidance_${projection.mirror.analysisId}',
      primary: primaryItem,
      secondary: secondary,
      retakeSupersedes: false,
      empty: primaryItem == null,
      emptyHeadlineAr: FaceGuidanceCopy.emptyHeadline,
      emptySupportAr: FaceGuidanceCopy.emptySupport,
    );
    FaceGuidanceValidators.assertPublicSafe(surface);
    return surface;
  }

  /// Guidance items whose source detail matches the open 9G sheet.
  List<FaceGuidanceItemVm> relatedToDetail({
    required FaceGuidanceSurfaceVm surface,
    required String detailRefId,
  }) {
    return surface.allItems
        .where((i) => i.sourceDetailRef == detailRefId)
        .toList(growable: false);
  }

  static bool isRelatedToSelection(
    FaceGuidanceItemVm item, {
    String? selectedInsightId,
    String? selectedDetailRefId,
  }) {
    if (selectedDetailRefId != null &&
        item.sourceDetailRef == selectedDetailRefId) {
      return true;
    }
    if (selectedInsightId != null &&
        item.sourceInsightRef == selectedInsightId) {
      return true;
    }
    return false;
  }

  bool _retake(FaceResultProjection projection) {
    final summary = projection.executiveSummary;
    return summary.nextAction.kind == FaceNextActionKind.retake ||
        summary.completeness == FaceResultCompleteness.empty ||
        summary.primary?.eligibility ==
            FacePresentationEligibility.retakeRecommended ||
        summary.primary?.eligibility ==
            FacePresentationEligibility.noUsableResult ||
        !projection.measurementEligible;
  }

  FaceGuidanceItemVm _retakeItem(FaceResultProjection projection) {
    return FaceGuidanceItemVm(
      guidanceId: 'guidance_retake_${projection.mirror.analysisId}',
      owner: FaceGuidanceOwner.faceIntelligence,
      type: FaceGuidanceType.retake,
      titleAr: FaceGuidanceCopy.retakeHeadline,
      bodyAr: FaceGuidanceCopy.retakeBody,
      personalizationLevel: FaceGuidancePersonalizationLevel.contextual,
      reason: FaceGuidanceReasonVm(
        labelAr: FaceGuidanceCopy.whyLabel,
        explanationAr: projection.executiveSummary.supportAr.isNotEmpty
            ? projection.executiveSummary.supportAr
            : FaceResultCopy.emptySupport,
      ),
      primaryAction: FaceGuidanceActionKind.retake,
      primaryActionLabelAr: FaceGuidanceCopy.retakeAction,
      priority: 0,
      eligibility: FaceGuidanceEligibility.showPrimary,
      category: 'retake',
      limitationAr: FaceGuidanceCopy.cosmeticLimitation,
      sourceResultRef: projection.executiveSummary.primary?.resultId,
    );
  }

  FaceGuidanceItemVm _fromRecommendation({
    required FaceResultProjection projection,
    required FaceIntelRecommendation rec,
    required FaceGuidanceOwner owner,
    required FaceGuidancePersonalizationLevel level,
    required FaceGuidanceEligibility eligibility,
    required bool lowConfidence,
  }) {
    final primary = projection.executiveSummary.primary;
    final shapeLabel = primary?.valueLabelAr;
    final isEdu = rec.category == 'educational';
    final reason = FaceGuidanceReasonVm(
      labelAr: FaceGuidanceCopy.whyLabel,
      explanationAr: shapeLabel != null &&
              (rec.category == 'hairstyle' ||
                  rec.category == 'makeup_contour' ||
                  rec.category == 'eyewear')
          ? FaceGuidanceCopy.reasonForShape(shapeLabel)
          : FaceGuidanceCopy.reasonForCategory(
              FaceGuidanceCopy.categoryLabelAr(rec.category),
            ),
      relatedResultTitleAr: primary != null
          ? '${primary.titleAr}: ${primary.valueLabelAr}'
          : null,
      qualificationAr: lowConfidence ? primary?.confidenceQualifierAr : null,
    );

    return FaceGuidanceItemVm(
      guidanceId: 'guidance_${rec.id}',
      owner: owner,
      type: isEdu
          ? FaceGuidanceType.educational
          : FaceGuidanceType.stylingRecommendation,
      titleAr: rec.titleAr,
      bodyAr: rec.bodyAr,
      personalizationLevel: level,
      reason: reason,
      sourceResultRef: primary?.resultId,
      sourceDetailRef: primary?.detailRef.id,
      frozenRecommendationRef: rec.id,
      confidencePresentationAr: lowConfidence
          ? (primary?.confidenceQualifierAr ?? 'ثقة محدودة لهذه النتيجة')
          : null,
      limitationAr: FaceGuidanceCopy.cosmeticLimitation,
      primaryAction: FaceGuidanceActionKind.askMira,
      primaryActionLabelAr: FaceGuidanceCopy.askMiraAction,
      priority: FaceGuidancePriorityPolicy.categoryRank(rec.category),
      eligibility: eligibility,
      category: rec.category,
    );
  }
}
