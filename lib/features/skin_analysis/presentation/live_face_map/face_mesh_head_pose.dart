import 'dart:math' as math;

import 'package:mediapipe_face_mesh/mediapipe_face_mesh.dart';

import 'topology/mediapipe_landmark_indices.dart';

/// Live head pose from existing MediaPipe 3D landmarks — no extra ML model.
///
/// Convention (aligned with FaceCaptureQualityInput D12 / Skin Face Gate):
/// - yaw > 0 → face turned toward SUBJECT_LEFT
/// - pitch > 0 → face tilted up (chin farther / forehead closer)
/// - roll > 0 → subject's right eye lower than left (tilt toward right shoulder)
class FaceMeshHeadPose {
  final double yawDegrees;
  final double pitchDegrees;
  final double rollDegrees;

  const FaceMeshHeadPose({
    required this.yawDegrees,
    required this.pitchDegrees,
    required this.rollDegrees,
  });
}

/// Geometric pose from Face Mesh topology (468 points with z-depth).
abstract final class FaceMeshHeadPoseEstimator {
  FaceMeshHeadPoseEstimator._();

  /// Legacy pitch (nose protrusion vs forehead–chin midZ). Frontal faces
  /// systematically read ≈ +15°…+18° because the nose is closer than midZ.
  /// Kept only for regression proof of the baseline bug — not used for gating.
  static double legacyNoseProtrusionPitchDegrees(
    List<FaceMeshLandmark> landmarks,
  ) {
    final nose = landmarks[MediapipeLandmarkIndices.geometryNoseTip];
    final chin = landmarks[MediapipeLandmarkIndices.geometryChin];
    final forehead = landmarks[MediapipeLandmarkIndices.geometryForeheadTop];
    final faceHeight = (chin.y - forehead.y).abs().clamp(1e-4, 2.0);
    final midZ = (forehead.z + chin.z) * 0.5;
    return math.atan2(midZ - nose.z, faceHeight) * 180.0 / math.pi;
  }

  static FaceMeshHeadPose? fromLandmarks(List<FaceMeshLandmark> landmarks) {
    if (landmarks.length < 468) return null;

    final lEye = landmarks[MediapipeLandmarkIndices.geometryLeftEyeOuter];
    final rEye = landmarks[MediapipeLandmarkIndices.geometryRightEyeOuter];
    final chin = landmarks[MediapipeLandmarkIndices.geometryChin];
    final forehead = landmarks[MediapipeLandmarkIndices.geometryForeheadTop];
    final lFace = landmarks[MediapipeLandmarkIndices.geometryLeftFace];
    final rFace = landmarks[MediapipeLandmarkIndices.geometryRightFace];

    // Roll — eye line in the image plane (degrees).
    final eyeDx = rEye.x - lEye.x;
    final eyeDy = rEye.y - lEye.y;
    if (eyeDx.abs() < 1e-6 && eyeDy.abs() < 1e-6) return null;
    final roll = math.atan2(eyeDy, eyeDx) * 180.0 / math.pi;

    // Yaw — left/right face depth asymmetry (MediaPipe z; more + = farther).
    final faceWidth = (rFace.x - lFace.x).abs().clamp(1e-4, 2.0);
    final yaw = math.atan2(lFace.z - rFace.z, faceWidth) * 180.0 / math.pi;

    // Pitch — nodding of the face plane (forehead↔chin depth), NOT nose
    // protrusion. Frontal (forehead.z ≈ chin.z) → pitch ≈ 0.
    // Look up: chin farther (z↑) than forehead → positive.
    final faceHeight = (chin.y - forehead.y).abs().clamp(1e-4, 2.0);
    final pitch =
        math.atan2(chin.z - forehead.z, faceHeight) * 180.0 / math.pi;

    if (!_finite(yaw) || !_finite(pitch) || !_finite(roll)) return null;

    return FaceMeshHeadPose(
      yawDegrees: yaw,
      pitchDegrees: pitch,
      rollDegrees: roll,
    );
  }

  static bool _finite(double v) => v.isFinite;
}
