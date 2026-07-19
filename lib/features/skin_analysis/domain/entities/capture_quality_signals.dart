/// Provenance for each capture signal component.
enum CaptureSignalProvenance {
  /// Pixel / detector measurement.
  measured,

  /// Explicitly not measured — no value may be treated as real.
  unavailable,

  /// Reserved for future documented estimates (never mixed with measured).
  estimated,

  /// Legacy BeautyScoreEngine default — not from Phase 2 quality gate.
  legacyNeutral,
}

/// Capture conditions that affect scoring confidence — not the skin metrics themselves.
class CaptureQualitySignals {
  final double lightingQuality;
  final double faceAngleDegrees;
  final double blurAmount;

  final CaptureSignalProvenance lightingProvenance;
  final CaptureSignalProvenance angleProvenance;
  final CaptureSignalProvenance blurProvenance;

  const CaptureQualitySignals({
    required this.lightingQuality,
    required this.faceAngleDegrees,
    required this.blurAmount,
    this.lightingProvenance = CaptureSignalProvenance.measured,
    this.angleProvenance = CaptureSignalProvenance.measured,
    this.blurProvenance = CaptureSignalProvenance.measured,
  });

  /// True only when lighting, angle, and blur were all measured.
  bool get fromMeasuredQuality =>
      lightingProvenance == CaptureSignalProvenance.measured &&
      angleProvenance == CaptureSignalProvenance.measured &&
      blurProvenance == CaptureSignalProvenance.measured;

  /// Explicit unavailable bundle — values must not be treated as measurements.
  const CaptureQualitySignals.unavailable()
      : lightingQuality = 0,
        faceAngleDegrees = 0,
        blurAmount = 0,
        lightingProvenance = CaptureSignalProvenance.unavailable,
        angleProvenance = CaptureSignalProvenance.unavailable,
        blurProvenance = CaptureSignalProvenance.unavailable;

  /// Legacy defaults when no capture metadata is available.
  const CaptureQualitySignals.neutral()
      : lightingQuality = 0.72,
        faceAngleDegrees = 10,
        blurAmount = 0.14,
        lightingProvenance = CaptureSignalProvenance.legacyNeutral,
        angleProvenance = CaptureSignalProvenance.legacyNeutral,
        blurProvenance = CaptureSignalProvenance.legacyNeutral;

  /// Confidence multiplier (0.55–1.0). Unavailable → floor 0.55 (no inflation).
  double get confidenceMultiplier {
    if (lightingProvenance == CaptureSignalProvenance.unavailable &&
        angleProvenance == CaptureSignalProvenance.unavailable &&
        blurProvenance == CaptureSignalProvenance.unavailable) {
      return 0.55;
    }

    var confidence = 1.0;

    if (lightingProvenance == CaptureSignalProvenance.measured) {
      if (lightingQuality < 0.40) {
        confidence -= 0.18;
      } else if (lightingQuality < 0.55) {
        confidence -= 0.12;
      } else if (lightingQuality < 0.68) {
        confidence -= 0.06;
      }
    }

    if (angleProvenance == CaptureSignalProvenance.measured) {
      if (faceAngleDegrees > 28) {
        confidence -= 0.16;
      } else if (faceAngleDegrees > 18) {
        confidence -= 0.10;
      } else if (faceAngleDegrees > 12) {
        confidence -= 0.05;
      }
    }

    if (blurProvenance == CaptureSignalProvenance.measured) {
      if (blurAmount > 0.40) {
        confidence -= 0.16;
      } else if (blurAmount > 0.25) {
        confidence -= 0.10;
      } else if (blurAmount > 0.16) {
        confidence -= 0.05;
      }
    }

    return confidence.clamp(0.55, 1.0);
  }

  int get confidencePercent =>
      (confidenceMultiplier * 100).round().clamp(55, 100);
}
