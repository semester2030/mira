/// Law #40 truth classes for capture guidance visuals (presentation).
enum FaceCaptureTruthClass {
  /// From real mesh/landmarks/box.
  derived,

  /// Capture-policy decision over signals.
  derivedCapturePolicy,

  /// Educational guide oval / target frame.
  illustrative,

  /// Future glow / soft effects (9C+).
  decorative,

  /// Never claim analysis results at capture time.
  forbiddenAsAnalysis,
}

/// Internal signal source — never public.
enum FaceCaptureSignalSource {
  mediapipe,
  mlKit,
  imageQuality,
  camera,
  derivedCapturePolicy,
  unknown,
}
