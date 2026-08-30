/// Phase 9J — Face history / comparison / retake contracts.
library;

/// Trait / result comparability class (presentation-owned).
enum FaceComparabilityClass {
  /// Structural geometry / shape — history OK, never "progress".
  structural,

  /// Legitimately changeable Face traits — only if frozen output supports.
  changeable,

  /// Highly capture-sensitive (pose/light/expression).
  contextual,

  /// Must not be compared.
  notComparable,
}

/// Gate for an analysis pair.
enum FaceComparabilityGate {
  comparable,
  comparableWithQualification,
  notComparable,
}

/// Neutral relationship for structural/contextual items — never IMPROVED/WORSE.
enum FaceComparisonRelationship {
  similar,
  differs,
  unavailable,
  notCompared,
}

enum FaceRetakeReason {
  lowQuality,
  lowConfidence,
  retakeRecommended,
  userRequested,
  staleResult,
}

enum FaceRetakeSource {
  resultMirror,
  detailSheet,
  guidance,
  history,
  advisor,
  legacy,
}

class FaceHistoryEntryVm {
  final String entryId;
  final String? reportId;
  final String analysisId;
  final DateTime? capturedAt;
  final String primaryLabelAr;
  final String? shapeId;
  final bool measurementEligible;
  final bool hasFaceIntelligence;
  final String qualityLabelAr;
  final String reportVersion;
  final String shapeVersion;
  final String intelligenceVersion;
  final int confidence;
  final FaceComparabilityGate selfGate;
  final String contractVersion;

  const FaceHistoryEntryVm({
    required this.entryId,
    required this.analysisId,
    required this.primaryLabelAr,
    required this.qualityLabelAr,
    required this.reportVersion,
    required this.shapeVersion,
    required this.intelligenceVersion,
    required this.confidence,
    required this.selfGate,
    this.reportId,
    this.capturedAt,
    this.shapeId,
    this.measurementEligible = false,
    this.hasFaceIntelligence = false,
    this.contractVersion = 'face-history-entry-vm-v1',
  });
}

class FaceHistorySurfaceVm {
  final List<FaceHistoryEntryVm> entries;
  final bool empty;
  final bool firstAnalysisOnly;
  final String headlineAr;
  final String supportAr;
  final String? currentEntryId;
  final bool comparisonAvailable;

  const FaceHistorySurfaceVm({
    required this.entries,
    required this.empty,
    required this.firstAnalysisOnly,
    required this.headlineAr,
    required this.supportAr,
    required this.comparisonAvailable,
    this.currentEntryId,
  });
}

class FaceComparisonItemVm {
  final String itemId;
  final String labelAr;
  final FaceComparabilityClass comparabilityClass;
  final String currentPresentationAr;
  final String previousPresentationAr;
  final FaceComparisonRelationship relationship;
  final String userLanguageAr;
  final String? qualificationAr;

  const FaceComparisonItemVm({
    required this.itemId,
    required this.labelAr,
    required this.comparabilityClass,
    required this.currentPresentationAr,
    required this.previousPresentationAr,
    required this.relationship,
    required this.userLanguageAr,
    this.qualificationAr,
  });
}

class FaceComparisonVm {
  final String comparisonId;
  final String currentAnalysisRef;
  final String previousAnalysisRef;
  final FaceComparabilityGate gate;
  final String comparisonReasonAr;
  final List<FaceComparisonItemVm> comparableItems;
  final List<FaceComparisonItemVm> historicalOnlyItems;
  final List<String> limitationsAr;
  final DateTime? currentCapturedAt;
  final DateTime? previousCapturedAt;
  final String contractVersion;

  const FaceComparisonVm({
    required this.comparisonId,
    required this.currentAnalysisRef,
    required this.previousAnalysisRef,
    required this.gate,
    required this.comparisonReasonAr,
    required this.comparableItems,
    required this.historicalOnlyItems,
    required this.limitationsAr,
    this.currentCapturedAt,
    this.previousCapturedAt,
    this.contractVersion = 'face-comparison-vm-v1',
  });

  bool get mayRender => gate != FaceComparabilityGate.notComparable;
}

class FaceRetakeRequestVm {
  final FaceRetakeReason reason;
  final FaceRetakeSource source;
  final String? currentAnalysisRef;
  final String recommendedCaptureGuidanceAr;
  final bool preserveHistory;

  const FaceRetakeRequestVm({
    required this.reason,
    required this.source,
    required this.recommendedCaptureGuidanceAr,
    this.currentAnalysisRef,
    this.preserveHistory = true,
  });
}

/// Law #40 truth entries for history/comparison surfaces.
class FaceHistoryTruthEntry {
  final String component;
  final String truthClass;
  final String notes;

  const FaceHistoryTruthEntry({
    required this.component,
    required this.truthClass,
    required this.notes,
  });
}

abstract final class FaceHistoryTruthManifest {
  FaceHistoryTruthManifest._();

  static const entries = <FaceHistoryTruthEntry>[
    FaceHistoryTruthEntry(
      component: 'history_primary_label',
      truthClass: 'PUBLIC_PROJECTION',
      notes: 'Projected from frozen Face primary / shape at analysis time',
    ),
    FaceHistoryTruthEntry(
      component: 'comparison_structural_diff',
      truthClass: 'PRESENTATION_DERIVED',
      notes: 'Difference indicator — not improvement/worsening',
    ),
    FaceHistoryTruthEntry(
      component: 'comparison_photo',
      truthClass: 'SOURCE_IMAGE',
      notes: 'If shown — lighting/angle may differ; not progress',
    ),
    FaceHistoryTruthEntry(
      component: 'history_open_motion',
      truthClass: 'PRESENTATION_ONLY',
      notes: 'Law #41 — opening history does not re-analyze',
    ),
  ];
}
