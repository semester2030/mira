/// Governed presentation timing — not backend SLA.
class AnalysisMotionTimingPolicy {
  final Duration settling;
  final Duration contourReveal;
  final Duration scanPass;
  final Duration completing;
  final Duration maxDelayAfterSuccess;
  final Duration reduceSettling;
  final Duration reduceStageStep;

  const AnalysisMotionTimingPolicy({
    this.settling = const Duration(milliseconds: 280),
    this.contourReveal = const Duration(milliseconds: 400),
    this.scanPass = const Duration(milliseconds: 1400),
    this.completing = const Duration(milliseconds: 360),
    this.maxDelayAfterSuccess = const Duration(milliseconds: 450),
    this.reduceSettling = const Duration(milliseconds: 160),
    this.reduceStageStep = const Duration(milliseconds: 600),
  });

  static const AnalysisMotionTimingPolicy defaults =
      AnalysisMotionTimingPolicy();

  Duration get dramaticEnd => settling + contourReveal + scanPass;

  /// Soft minimum choreography before allowing early complete cut.
  Duration get softMinChoreography =>
      settling + contourReveal + Duration(milliseconds: scanPass.inMilliseconds ~/ 2);

  String get version => 'face-analysis-motion-timing-v1';
}
