/// Deterministic motion phases for post-capture analysis presentation (9D).
enum AnalysisMotionPhase {
  settling,
  contourReveal,
  scanPass,
  ambientWait,
  completing,
  handoff,
  error,
}

/// Real client pipeline signal — not invented analysis.
enum AnalysisPipelineStatus {
  idle,
  running,
  succeeded,
  failed,
}

/// Honest presentation stages (PRESENTATION_GROUP over real Loading wait).
///
/// Bloc only exposes Loading/Success/Failure — stages are timed UX groups
/// during [AnalysisPipelineStatus.running], not fake measured progress.
enum AnalysisPresentationStage {
  settlingImage,
  confirmingQuality,
  reviewingFeatures,
  buildingDetails,
  preparingMirror,
  ambientWaiting,
  completing,
  error,
}

/// Law #40 truth classes for 9D visuals.
enum AnalysisMotionTruthClass {
  sourceImage,
  derived,
  decorative,
  presentationGroup,
  forbidden,
}
