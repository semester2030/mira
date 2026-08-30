import '../../../../projection/contracts/face_result_enums.dart';

/// Detail sheet kinds (9G) — presentation only.
enum FaceDetailSheetType {
  primaryResult,
  insight,
  region,
  limitedResult,
  retake,
  unsupported,
}

enum FaceDetailSheetSize {
  compact,
  medium,
  expanded,
}

enum FaceDetailPrimaryActionKind {
  close,
  retake,
  askMira,
  exploreRelated,
}

/// Public-safe truth wording — never dump DERIVED/MEASURED raw enums to users.
class FaceDetailTruthPresentation {
  final String? publicLabelAr;
  final FacePresentationTruthClass truthClass;
  final bool showToUser;

  const FaceDetailTruthPresentation({
    required this.truthClass,
    this.publicLabelAr,
    this.showToUser = false,
  });
}

class FaceDetailRelatedRef {
  final String detailRefId;
  final String titleAr;

  const FaceDetailRelatedRef({
    required this.detailRefId,
    required this.titleAr,
  });
}

/// Sheet presentation VM — assembled solely from 9E projection.
class FaceDetailSheetVm {
  final String detailId;
  final FaceDetailSheetType type;
  final String titleAr;
  final String? valueLabelAr;
  final String whatAr;
  final String observationAr;
  final String meaningAr;
  final FaceDetailTruthPresentation truth;
  final String? confidenceAr;
  final String? limitationAr;
  final FacePresentationRegion? region;
  final FaceDetailPrimaryActionKind primaryAction;
  final String primaryActionLabelAr;
  final bool advisorEligible;
  final String? advisorPromptAr;
  final List<FaceDetailRelatedRef> related;
  final FaceDetailSheetSize preferredSize;
  final String? selectedInsightId;
  final String contractVersion;

  const FaceDetailSheetVm({
    required this.detailId,
    required this.type,
    required this.titleAr,
    required this.whatAr,
    required this.observationAr,
    required this.meaningAr,
    required this.truth,
    required this.primaryAction,
    required this.primaryActionLabelAr,
    required this.preferredSize,
    this.valueLabelAr,
    this.confidenceAr,
    this.limitationAr,
    this.region,
    this.advisorEligible = false,
    this.advisorPromptAr,
    this.related = const [],
    this.selectedInsightId,
    this.contractVersion = 'face-detail-sheet-vm-v1',
  });

  bool get isEmptyContent =>
      type == FaceDetailSheetType.unsupported ||
      (observationAr.isEmpty && meaningAr.isEmpty && valueLabelAr == null);
}
