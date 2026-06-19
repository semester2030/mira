/// Deterministic body pose signals for full-body outfit capture.
class OutfitBodyPoseMetrics {
  final bool personDetected;
  final bool headDetected;
  final bool shouldersDetected;
  final bool torsoDetected;
  final bool legsDetected;
  final bool feetDetected;

  const OutfitBodyPoseMetrics({
    this.personDetected = false,
    this.headDetected = false,
    this.shouldersDetected = false,
    this.torsoDetected = false,
    this.legsDetected = false,
    this.feetDetected = false,
  });

  static const none = OutfitBodyPoseMetrics();

  bool get isFullBodyReady =>
      personDetected &&
      headDetected &&
      shouldersDetected &&
      torsoDetected &&
      legsDetected &&
      feetDetected;

  /// Minimum pose for post-capture acceptance when quality is good.
  bool get isCaptureAcceptable =>
      personDetected &&
      headDetected &&
      (shouldersDetected || torsoDetected);
}
