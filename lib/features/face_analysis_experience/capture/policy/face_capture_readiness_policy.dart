import '../../../skin_analysis/domain/image_quality/capture_quality_thresholds.dart';
import '../contracts/capture_versions.dart';
import '../contracts/face_capture_semantic.dart';

/// Centralized presentation capture thresholds (Phase 9B).
///
/// Pose/area/blur/brightness align with [CaptureQualityThresholds] (cq-thresholds-v2.1)
/// where shared. Mesh guide ratios align with FaceMeshQualityGate constants.
/// Does NOT modify Face Intelligence frozen measurement eligibility.
class FaceCaptureReadinessPolicy {
  final String version;

  final double minFaceAreaRatio;
  final double maxFaceAreaRatio;
  final double minFaceHeightVsGuide;
  final double maxFaceHeightVsGuide;

  final double maxCenterOffsetX;
  final double maxCenterOffsetY;

  /// Hysteresis band to reduce flicker near thresholds.
  final double centerHysteresis;
  final double distanceHysteresis;
  final double poseHysteresisDegrees;

  final double maxYawDegrees;
  final double maxPitchDegrees;
  final double maxRollDegrees;

  final double minBrightness;
  final double maxBrightness;
  final double minBlurVariance;

  final Duration maxFrameAge;
  final Duration holdStillWindow;
  final Duration autoCaptureCooldown;

  /// Normalized center movement across history to count as moving.
  final double stabilityMaxCenterDelta;
  final Duration stabilityWindow;

  final bool requireBrightnessForReady;
  final bool requireBlurForReady;
  final bool requireEyesVisibleForReady;

  const FaceCaptureReadinessPolicy({
    this.version = FaceCaptureVersions.thresholdManifest,
    this.minFaceAreaRatio = CaptureQualityThresholds.minFaceAreaRatio,
    this.maxFaceAreaRatio = CaptureQualityThresholds.maxFaceAreaRatio,
    this.minFaceHeightVsGuide = 0.74,
    this.maxFaceHeightVsGuide = 1.06,
    this.maxCenterOffsetX = 0.13,
    this.maxCenterOffsetY = 0.11,
    this.centerHysteresis = 0.02,
    this.distanceHysteresis = 0.03,
    this.poseHysteresisDegrees = 2.0,
    this.maxYawDegrees = CaptureQualityThresholds.maxYawDegrees,
    this.maxPitchDegrees = CaptureQualityThresholds.maxPitchDegrees,
    this.maxRollDegrees = CaptureQualityThresholds.maxRollDegrees,
    this.minBrightness = CaptureQualityThresholds.minBrightness,
    this.maxBrightness = CaptureQualityThresholds.maxBrightness,
    this.minBlurVariance = CaptureQualityThresholds.minBlurVariance,
    this.maxFrameAge = const Duration(milliseconds: 450),
    this.holdStillWindow = const Duration(milliseconds: 500),
    this.autoCaptureCooldown = const Duration(milliseconds: 1200),
    this.stabilityMaxCenterDelta = 0.018,
    this.stabilityWindow = const Duration(milliseconds: 280),
    this.requireBrightnessForReady = false,
    this.requireBlurForReady = false,
    this.requireEyesVisibleForReady = false,
  });

  static const FaceCaptureReadinessPolicy defaults = FaceCaptureReadinessPolicy();

  GateRequirement brightnessRequirement() => requireBrightnessForReady
      ? GateRequirement.mandatory
      : GateRequirement.optional;

  GateRequirement blurRequirement() =>
      requireBlurForReady ? GateRequirement.mandatory : GateRequirement.optional;
}
