class OutfitCaptureSignals {
  final double lightingQuality;
  final double framingQuality;
  final double blurAmount;

  const OutfitCaptureSignals({
    required this.lightingQuality,
    required this.framingQuality,
    required this.blurAmount,
  });

  const OutfitCaptureSignals.neutral()
      : lightingQuality = 0.74,
        framingQuality = 0.72,
        blurAmount = 0.12;

  double get confidenceMultiplier {
    var confidence = 1.0;

    if (lightingQuality < 0.42) {
      confidence -= 0.16;
    } else if (lightingQuality < 0.58) {
      confidence -= 0.10;
    } else if (lightingQuality < 0.70) {
      confidence -= 0.05;
    }

    if (framingQuality < 0.45) {
      confidence -= 0.14;
    } else if (framingQuality < 0.60) {
      confidence -= 0.08;
    }

    if (blurAmount > 0.38) {
      confidence -= 0.14;
    } else if (blurAmount > 0.22) {
      confidence -= 0.08;
    }

    return confidence.clamp(0.55, 1.0);
  }

  int get confidencePercent => (confidenceMultiplier * 100).round().clamp(55, 100);
}
