/// Capture conditions that affect scoring confidence — not the skin metrics themselves.
class CaptureQualitySignals {
  /// 0–1 where 1 = well-lit, even exposure.
  final double lightingQuality;

  /// Combined head yaw/pitch estimate in degrees (0 = frontal).
  final double faceAngleDegrees;

  /// 0–1 where 0 = sharp, 1 = heavily blurred.
  final double blurAmount;

  const CaptureQualitySignals({
    required this.lightingQuality,
    required this.faceAngleDegrees,
    required this.blurAmount,
  });

  /// Neutral defaults when no capture metadata is available.
  const CaptureQualitySignals.neutral()
      : lightingQuality = 0.72,
        faceAngleDegrees = 10,
        blurAmount = 0.14;

  /// Confidence multiplier applied to the final score (0.55–1.0).
  double get confidenceMultiplier {
    var confidence = 1.0;

    if (lightingQuality < 0.40) {
      confidence -= 0.18;
    } else if (lightingQuality < 0.55) {
      confidence -= 0.12;
    } else if (lightingQuality < 0.68) {
      confidence -= 0.06;
    }

    if (faceAngleDegrees > 28) {
      confidence -= 0.16;
    } else if (faceAngleDegrees > 18) {
      confidence -= 0.10;
    } else if (faceAngleDegrees > 12) {
      confidence -= 0.05;
    }

    if (blurAmount > 0.40) {
      confidence -= 0.16;
    } else if (blurAmount > 0.25) {
      confidence -= 0.10;
    } else if (blurAmount > 0.16) {
      confidence -= 0.05;
    }

    return confidence.clamp(0.55, 1.0);
  }

  /// Human-readable confidence 0–100 for UI layers.
  int get confidencePercent => (confidenceMultiplier * 100).round().clamp(55, 100);
}
