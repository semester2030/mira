import '../../../../core/face_gate/face_gate_rules.dart';
import '../../../skin_analysis/domain/image_quality/capture_quality_thresholds.dart';
import '../../../skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart';
import 'face_capture_readiness_policy.dart';

/// Skin production strict-frontal limits — evidence-derived, not invented.
///
/// Sources:
/// - Pose band: [CaptureQualityThresholds.warnCombinedAngleDegrees] (already
///   coded as the soft “good frontal” band) promoted to a hard Skin gate.
/// - Roll: scaled from legacy maxRoll using yaw ratio
///   `28 × (15 / 35) = 12`.
/// - Centering / scale: [FaceMeshQualityGate] live guide constants already
///   proven for oval fill without clipping.
///
/// Legacy `cq-thresholds-v2.1` pose ceilings (35° / 30° / 28°) remain for
/// non-Skin Face Intelligence measurement eligibility and are NOT Skin
/// production acceptance.
abstract final class StrictFrontalCapturePolicy {
  StrictFrontalCapturePolicy._();

  static const version = 'strict-frontal-skin-v1';

  static const maxYawDegrees = FaceMeshQualityGate.maxYawDegrees;
  static const maxPitchDegrees = FaceMeshQualityGate.maxPitchDegrees;

  /// Matches live mesh roll ceiling.
  static const maxRollDegrees = FaceMeshQualityGate.maxRollDegrees;

  static const maxCenterOffsetX = FaceMeshQualityGate.maxCenterDriftX;
  static const maxCenterOffsetY = FaceMeshQualityGate.maxCenterDriftY;

  static const minFaceHeightVsGuide = FaceMeshQualityGate.minFaceHeightRatio;
  static const maxFaceHeightVsGuide = FaceMeshQualityGate.maxFaceHeightRatio;

  static const minFaceAreaRatio = CaptureQualityThresholds.minFaceAreaRatio;
  static const maxFaceAreaRatio = CaptureQualityThresholds.maxFaceAreaRatio;

  static const FaceGateLimits gateLimits = FaceGateLimits(
    minFaceAreaRatio: minFaceAreaRatio,
    maxFaceAreaRatio: maxFaceAreaRatio,
    maxYawDegrees: maxYawDegrees,
    maxPitchDegrees: maxPitchDegrees,
    maxRollDegrees: maxRollDegrees,
    maxCenterOffsetXRatio: maxCenterOffsetX,
    maxCenterOffsetYRatio: maxCenterOffsetY,
  );

  /// Live + post-capture readiness policy for Skin capture.
  static const FaceCaptureReadinessPolicy readiness =
      FaceCaptureReadinessPolicy(
    version: version,
    minFaceAreaRatio: minFaceAreaRatio,
    maxFaceAreaRatio: maxFaceAreaRatio,
    minFaceHeightVsGuide: minFaceHeightVsGuide,
    maxFaceHeightVsGuide: maxFaceHeightVsGuide,
    maxCenterOffsetX: maxCenterOffsetX,
    maxCenterOffsetY: maxCenterOffsetY,
    maxYawDegrees: maxYawDegrees,
    maxPitchDegrees: maxPitchDegrees,
    maxRollDegrees: maxRollDegrees,
  );
}
