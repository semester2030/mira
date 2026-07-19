/// Canonical capture-quality thresholds (Phase 2.1).
/// Mirror of mira-api `capture-quality.thresholds.ts` — keep values identical.
///
/// Version: cq-thresholds-v2.1
/// Configurability: compile-time constants (bump version when changing).
abstract final class CaptureQualityThresholds {
  CaptureQualityThresholds._();

  static const version = 'cq-thresholds-v2.1';

  static const minBlurVariance = 28.0;
  static const warnBlurVariance = 55.0;

  static const minBrightness = 0.18;
  static const maxBrightness = 0.92;
  static const idealBrightnessLow = 0.32;
  static const idealBrightnessHigh = 0.78;

  static const maxOverExposureRatio = 0.18;
  static const maxUnderExposureRatio = 0.22;
  static const maxShadowImbalance = 0.35;
  static const warnShadowImbalance = 0.22;

  static const minShortEdgePx = 480;

  static const minFaceAreaRatio = 0.05;
  static const maxFaceAreaRatio = 0.92;

  /// Unified head-pose limits (ML Kit client + qc mapper).
  static const maxYawDegrees = 35.0;
  static const maxPitchDegrees = 30.0;
  static const maxRollDegrees = 28.0;
  static const warnCombinedAngleDegrees = 15.0;

  /// Contrast & dynamicRange are informational only (Option A) — not scored.
  static const contrastDynamicRangeRole = 'informational';
}

/// Backward-compatible alias for Phase 2 imports/tests.
abstract final class ImageQualityThresholds {
  ImageQualityThresholds._();
  static const minBlurVariance = CaptureQualityThresholds.minBlurVariance;
  static const warnBlurVariance = CaptureQualityThresholds.warnBlurVariance;
  static const minBrightness = CaptureQualityThresholds.minBrightness;
  static const maxBrightness = CaptureQualityThresholds.maxBrightness;
}
