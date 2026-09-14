import '../versioning/face_result_projection_versions.dart';
import 'face_result_enums.dart';

class FaceDetailRef {
  final String id;
  final String owner; // shape | geometry | symmetry | guidance | limitation
  final String? metricId;

  const FaceDetailRef({
    required this.id,
    required this.owner,
    this.metricId,
  });
}

class FaceLimitationVm {
  final String id;
  final String titleAr;
  final String bodyAr;
  final FacePresentationTruthClass truthClass;

  const FaceLimitationVm({
    required this.id,
    required this.titleAr,
    required this.bodyAr,
    this.truthClass = FacePresentationTruthClass.derived,
  });
}

class FacePrimaryResultVm {
  final String resultId;
  final String titleAr;
  final String subtitleAr;
  final String category; // shape | structural
  final String valueLabelAr;
  final FacePresentationTruthClass truthClass;
  final FacePresentationEligibility eligibility;
  final FaceConfidencePresentation confidencePresentation;
  final String? confidenceQualifierAr;
  final FaceDetailRef detailRef;
  final bool evidenceAvailable;
  final FaceLimitationVm? limitation;
  final String contractVersion;

  const FacePrimaryResultVm({
    required this.resultId,
    required this.titleAr,
    required this.subtitleAr,
    required this.category,
    required this.valueLabelAr,
    required this.truthClass,
    required this.eligibility,
    required this.confidencePresentation,
    required this.detailRef,
    required this.evidenceAvailable,
    this.confidenceQualifierAr,
    this.limitation,
    this.contractVersion = FaceResultProjectionVersions.primaryResult,
  });
}

class FaceInsightVm {
  final String id;
  final String semanticKey;
  final String titleAr;
  final String bodyAr;
  final int importance;
  final FacePresentationTruthClass truthClass;
  final FacePresentationRegion relatedRegion;
  final FaceDetailRef detailRef;
  final FaceConfidencePresentation confidencePresentation;
  final FaceLimitationVm? limitation;
  final FacePresentationEligibility eligibility;
  final String contractVersion;

  const FaceInsightVm({
    required this.id,
    required this.semanticKey,
    required this.titleAr,
    required this.bodyAr,
    required this.importance,
    required this.truthClass,
    required this.relatedRegion,
    required this.detailRef,
    required this.confidencePresentation,
    required this.eligibility,
    this.limitation,
    this.contractVersion = FaceResultProjectionVersions.insight,
  });
}

class FaceNextActionVm {
  final String id;
  final FaceNextActionKind kind;
  final String labelAr;
  final String? detailRefId;

  const FaceNextActionVm({
    required this.id,
    required this.kind,
    required this.labelAr,
    this.detailRefId,
  });
}

class FaceAdvisorEntryVm {
  final String analysisId;
  final String? selectedInsightId;
  final List<String> evidenceRefs;
  final List<String> suggestedQuestionKeys;

  const FaceAdvisorEntryVm({
    required this.analysisId,
    this.selectedInsightId,
    this.evidenceRefs = const [],
    this.suggestedQuestionKeys = const [],
  });
}

class FaceRegionAssociationVm {
  final FacePresentationRegion region;
  final List<String> insightIds;
  final FacePresentationTruthClass associationTruth;

  const FaceRegionAssociationVm({
    required this.region,
    required this.insightIds,
    this.associationTruth = FacePresentationTruthClass.illustrative,
  });
}

class FaceExecutiveSummaryVm {
  final String id;
  final FacePrimaryResultVm? primary;
  final List<FaceInsightVm> insights; // ≤3
  final FaceNextActionVm nextAction;
  final FaceAdvisorEntryVm advisorEntry;
  final FaceResultCompleteness completeness;
  final String headlineAr;
  final String supportAr;
  final String contractVersion;

  const FaceExecutiveSummaryVm({
    required this.id,
    required this.insights,
    required this.nextAction,
    required this.advisorEntry,
    required this.completeness,
    required this.headlineAr,
    required this.supportAr,
    this.primary,
    this.contractVersion = FaceResultProjectionVersions.executiveSummary,
  });
}

class FaceResultMirrorVm {
  final String analysisId;
  final String? imageRef;
  final FaceSubjectOrientation orientation;
  final bool contourAllowed;
  final bool anchorsAllowed;
  final bool interactiveRegionsAllowed;
  final FacePrimaryResultVm? primary;
  final List<String> insightRefs;
  final FaceExecutiveSummaryVm summary;
  final String contractVersion;

  const FaceResultMirrorVm({
    required this.analysisId,
    required this.orientation,
    required this.contourAllowed,
    required this.anchorsAllowed,
    required this.interactiveRegionsAllowed,
    required this.insightRefs,
    required this.summary,
    this.imageRef,
    this.primary,
    this.contractVersion = FaceResultProjectionVersions.mirrorVm,
  });
}

/// Root projection output for Phase 9F consumption.
class FaceResultProjection {
  final String projectionVersion;
  final FaceResultCompleteness completeness;
  final FaceExecutiveSummaryVm executiveSummary;
  final FaceResultMirrorVm mirror;
  final List<FaceLimitationVm> limitations;
  final List<FaceRegionAssociationVm> regions;
  final List<FaceDetailRef> detailRefs;
  final Map<String, FaceNumericVisibility> numericVisibilityByMetric;
  final bool measurementEligible;

  const FaceResultProjection({
    required this.projectionVersion,
    required this.completeness,
    required this.executiveSummary,
    required this.mirror,
    required this.limitations,
    required this.regions,
    required this.detailRefs,
    required this.numericVisibilityByMetric,
    required this.measurementEligible,
  });
}

class FaceResultProjectionContext {
  final String? imageRef;
  final FaceSubjectOrientation orientation;
  final bool preferArabic;

  const FaceResultProjectionContext({
    this.imageRef,
    this.orientation = FaceSubjectOrientation.subjectCanonical,
    this.preferArabic = true,
  });
}
