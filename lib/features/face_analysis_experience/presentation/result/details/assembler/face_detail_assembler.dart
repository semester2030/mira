import '../../../../projection/contracts/face_result_enums.dart';
import '../../../../projection/contracts/face_result_vms.dart';
import '../../../../projection/localization/face_result_copy.dart';
import '../contracts/face_detail_sheet_vm.dart';
import '../localization/face_detail_copy.dart';

/// Pure assembler — builds [FaceDetailSheetVm] from existing 9E projection only.
abstract final class FaceDetailAssembler {
  FaceDetailAssembler._();

  static FaceDetailSheetVm? fromDetailRef(
    FaceResultProjection projection,
    String detailRefId,
  ) {
    final primary = projection.executiveSummary.primary;
    if (primary != null && primary.detailRef.id == detailRefId) {
      return fromPrimary(projection, primary);
    }
    for (final insight in projection.executiveSummary.insights) {
      if (insight.detailRef.id == detailRefId) {
        return fromInsight(projection, insight);
      }
    }
    for (final lim in projection.limitations) {
      if (lim.id == detailRefId) {
        return _fromLimitation(projection, lim);
      }
    }
    return null;
  }

  static FaceDetailSheetVm fromPrimary(
    FaceResultProjection projection,
    FacePrimaryResultVm primary,
  ) {
    final retake = primary.eligibility ==
            FacePresentationEligibility.retakeRecommended ||
        primary.eligibility == FacePresentationEligibility.noUsableResult ||
        projection.executiveSummary.nextAction.kind == FaceNextActionKind.retake;

    final type = retake
        ? FaceDetailSheetType.retake
        : (primary.eligibility ==
                FacePresentationEligibility.displayWithQualification
            ? FaceDetailSheetType.limitedResult
            : FaceDetailSheetType.primaryResult);

    return FaceDetailSheetVm(
      detailId: primary.detailRef.id,
      type: type,
      titleAr: primary.titleAr,
      valueLabelAr: primary.valueLabelAr,
      whatAr: FaceDetailCopy.primaryWhat,
      observationAr: primary.valueLabelAr,
      meaningAr: primary.subtitleAr.isNotEmpty
          ? primary.subtitleAr
          : FaceDetailCopy.shapeMeaning,
      truth: _truth(primary.truthClass, helpful: true),
      confidenceAr: _confidenceText(
        primary.confidencePresentation,
        primary.confidenceQualifierAr,
      ),
      limitationAr: primary.limitation?.bodyAr,
      region: FacePresentationRegion.faceGeneral,
      primaryAction: retake
          ? FaceDetailPrimaryActionKind.retake
          : FaceDetailPrimaryActionKind.askMira,
      primaryActionLabelAr: retake
          ? FaceDetailCopy.retakeLabel
          : FaceDetailCopy.askMiraAboutThis,
      advisorEligible: !retake,
      advisorPromptAr: 'عن: ${primary.titleAr} ${primary.valueLabelAr}',
      related: _relatedFor(projection, excludeDetailId: primary.detailRef.id),
      preferredSize: FaceDetailSheetSize.medium,
    );
  }

  static FaceDetailSheetVm fromInsight(
    FaceResultProjection projection,
    FaceInsightVm insight,
  ) {
    final isSymmetry = insight.detailRef.owner == 'symmetry' ||
        insight.semanticKey.contains('symmetry');
    final retake = insight.eligibility ==
            FacePresentationEligibility.retakeRecommended ||
        projection.executiveSummary.nextAction.kind == FaceNextActionKind.retake;

    return FaceDetailSheetVm(
      detailId: insight.detailRef.id,
      type: retake
          ? FaceDetailSheetType.retake
          : FaceDetailSheetType.insight,
      titleAr: insight.titleAr,
      valueLabelAr: null,
      whatAr: FaceDetailCopy.insightWhat,
      observationAr: insight.bodyAr,
      meaningAr: isSymmetry
          ? FaceDetailCopy.symmetryMeaning
          : insight.bodyAr,
      truth: _truth(insight.truthClass, helpful: insight.detailRef.owner == 'shape'),
      confidenceAr: _confidenceText(insight.confidencePresentation, null),
      limitationAr: insight.limitation?.bodyAr,
      region: insight.relatedRegion,
      primaryAction: retake
          ? FaceDetailPrimaryActionKind.retake
          : FaceDetailPrimaryActionKind.askMira,
      primaryActionLabelAr: retake
          ? FaceDetailCopy.retakeLabel
          : FaceDetailCopy.askMiraAboutThis,
      advisorEligible: !retake,
      advisorPromptAr: 'عن: ${insight.titleAr}',
      related: _relatedFor(
        projection,
        excludeDetailId: insight.detailRef.id,
        preferRegion: insight.relatedRegion,
      ),
      preferredSize: FaceDetailSheetSize.medium,
      selectedInsightId: insight.id,
    );
  }

  static FaceDetailSheetVm fromRegion(
    FaceResultProjection projection,
    FacePresentationRegion region,
  ) {
    final assoc = projection.regions.where((r) => r.region == region).toList();
    final insightIds = assoc.expand((a) => a.insightIds).toSet();
    final insights = projection.executiveSummary.insights
        .where((i) => insightIds.contains(i.id) || i.relatedRegion == region)
        .toList();

    if (insights.isEmpty) {
      return FaceDetailSheetVm(
        detailId: 'region_empty_${region.name}',
        type: FaceDetailSheetType.unsupported,
        titleAr: FaceDetailCopy.regionLabel(region.name),
        whatAr: FaceDetailCopy.regionWhat,
        observationAr: FaceDetailCopy.regionEmpty,
        meaningAr: FaceDetailCopy.regionEmptySupport,
        truth: const FaceDetailTruthPresentation(
          truthClass: FacePresentationTruthClass.illustrative,
          publicLabelAr: FaceDetailCopy.regionIllustrativeNote,
          showToUser: true,
        ),
        limitationAr: FaceDetailCopy.regionIllustrativeNote,
        region: region,
        primaryAction: FaceDetailPrimaryActionKind.askMira,
        primaryActionLabelAr: FaceDetailCopy.askMiraAboutThis,
        advisorEligible: true,
        advisorPromptAr: 'عن ملامح وجهي عمومًا',
        preferredSize: FaceDetailSheetSize.compact,
      );
    }

    if (insights.length == 1) {
      return fromInsight(projection, insights.first);
    }

    final lines = insights.map((i) => '• ${i.titleAr}').join('\n');
    return FaceDetailSheetVm(
      detailId: 'region_${region.name}',
      type: FaceDetailSheetType.region,
      titleAr: FaceDetailCopy.regionLabel(region.name),
      whatAr: FaceDetailCopy.regionWhat,
      observationAr: lines,
      meaningAr: FaceDetailCopy.regionIllustrativeNote,
      truth: const FaceDetailTruthPresentation(
        truthClass: FacePresentationTruthClass.illustrative,
        publicLabelAr: FaceDetailCopy.regionIllustrativeNote,
        showToUser: true,
      ),
      region: region,
      primaryAction: FaceDetailPrimaryActionKind.askMira,
      primaryActionLabelAr: FaceDetailCopy.askMiraAboutThis,
      advisorEligible: true,
      advisorPromptAr: 'عن منطقة ${FaceDetailCopy.regionLabel(region.name)}',
      related: [
        for (final i in insights)
          FaceDetailRelatedRef(
            detailRefId: i.detailRef.id,
            titleAr: i.titleAr,
          ),
      ],
      preferredSize: FaceDetailSheetSize.medium,
      selectedInsightId: insights.first.id,
    );
  }

  static FaceDetailSheetVm unsupported([String? id]) {
    return FaceDetailSheetVm(
      detailId: id ?? 'unsupported',
      type: FaceDetailSheetType.unsupported,
      titleAr: FaceResultCopy.emptyHeadline,
      whatAr: FaceDetailCopy.unsupported,
      observationAr: FaceDetailCopy.unsupported,
      meaningAr: FaceResultCopy.emptySupport,
      truth: const FaceDetailTruthPresentation(
        truthClass: FacePresentationTruthClass.derived,
      ),
      primaryAction: FaceDetailPrimaryActionKind.close,
      primaryActionLabelAr: FaceDetailCopy.closeLabel,
      preferredSize: FaceDetailSheetSize.compact,
    );
  }

  static FaceDetailSheetVm _fromLimitation(
    FaceResultProjection projection,
    FaceLimitationVm lim,
  ) {
    final retake = projection.executiveSummary.nextAction.kind ==
        FaceNextActionKind.retake;
    return FaceDetailSheetVm(
      detailId: lim.id,
      type: retake
          ? FaceDetailSheetType.retake
          : FaceDetailSheetType.limitedResult,
      titleAr: lim.titleAr,
      whatAr: FaceDetailCopy.limitedResultTitle,
      observationAr: lim.bodyAr,
      meaningAr: retake
          ? FaceDetailCopy.retakePriority
          : lim.bodyAr,
      truth: FaceDetailTruthPresentation(truthClass: lim.truthClass),
      limitationAr: lim.bodyAr,
      primaryAction: retake
          ? FaceDetailPrimaryActionKind.retake
          : FaceDetailPrimaryActionKind.close,
      primaryActionLabelAr: retake
          ? FaceDetailCopy.retakeLabel
          : FaceDetailCopy.closeLabel,
      preferredSize: FaceDetailSheetSize.compact,
    );
  }

  static FaceDetailTruthPresentation _truth(
    FacePresentationTruthClass truthClass, {
    required bool helpful,
  }) {
    if (!helpful) {
      return FaceDetailTruthPresentation(truthClass: truthClass);
    }
    switch (truthClass) {
      case FacePresentationTruthClass.derived:
        return const FaceDetailTruthPresentation(
          truthClass: FacePresentationTruthClass.derived,
          publicLabelAr: FaceDetailCopy.truthDerivedHelpful,
          showToUser: true,
        );
      case FacePresentationTruthClass.measured:
        return const FaceDetailTruthPresentation(
          truthClass: FacePresentationTruthClass.measured,
          publicLabelAr: FaceDetailCopy.truthMeasuredHelpful,
          showToUser: true,
        );
      case FacePresentationTruthClass.illustrative:
        return const FaceDetailTruthPresentation(
          truthClass: FacePresentationTruthClass.illustrative,
          publicLabelAr: FaceDetailCopy.regionIllustrativeNote,
          showToUser: true,
        );
      default:
        return FaceDetailTruthPresentation(truthClass: truthClass);
    }
  }

  static String? _confidenceText(
    FaceConfidencePresentation presentation,
    String? qualifier,
  ) {
    if (qualifier != null && qualifier.isNotEmpty) return qualifier;
    switch (presentation) {
      case FaceConfidencePresentation.show:
      case FaceConfidencePresentation.showAsQualifier:
        return 'الثقة كافية لعرض هذه الملاحظة.';
      case FaceConfidencePresentation.detailOnly:
        return 'تفاصيل الثقة متاحة هنا عند الحاجة.';
      case FaceConfidencePresentation.hide:
        return null;
    }
  }

  static List<FaceDetailRelatedRef> _relatedFor(
    FaceResultProjection projection, {
    required String excludeDetailId,
    FacePresentationRegion? preferRegion,
  }) {
    final out = <FaceDetailRelatedRef>[];
    for (final i in projection.executiveSummary.insights) {
      if (i.detailRef.id == excludeDetailId) continue;
      if (preferRegion != null && i.relatedRegion != preferRegion) continue;
      out.add(
        FaceDetailRelatedRef(
          detailRefId: i.detailRef.id,
          titleAr: i.titleAr,
        ),
      );
      if (out.length >= 2) break;
    }
    if (out.isEmpty) {
      for (final i in projection.executiveSummary.insights) {
        if (i.detailRef.id == excludeDetailId) continue;
        out.add(
          FaceDetailRelatedRef(
            detailRefId: i.detailRef.id,
            titleAr: i.titleAr,
          ),
        );
        if (out.length >= 2) break;
      }
    }
    return out;
  }
}
