/// Skin capture UX policy — guidance vs critical, without rewriting mesh gates.
///
/// Analytical hard limits remain [FaceMeshQualityGate] / StrictFrontal.
/// This file classifies UX treatment, soft-exit eligibility, and hold timings.
abstract final class SkinCaptureUxPolicy {
  SkinCaptureUxPolicy._();

  static const version = 'skin-capture-ux-v2';

  /// Short hold before auto-capture (not a 3-2-1 countdown).
  static const holdStillWindow = Duration(milliseconds: 420);

  /// Exit hysteresis for centering (fraction of guide) while already READY.
  /// ENTRY uses FaceMeshQualityGate (0.13 / 0.11).
  /// Matches FaceCaptureReadinessPolicy.centerHysteresis.
  static const centerExitHysteresis = 0.02;

  /// Exit hysteresis for face scale while already READY.
  /// Matches FaceCaptureReadinessPolicy.distanceHysteresis.
  static const scaleExitHysteresis = 0.03;

  /// Exit hysteresis for pose noise (degrees) while already READY.
  /// ENTRY ceilings unchanged (15 / 15 / 12).
  static const poseExitHysteresisDegrees = 2.0;

  /// Cooldown after a failed/cancelled auto attempt.
  static const autoCooldown = Duration(milliseconds: 750);

  /// Analysis / geometry critical — hard block; never soft-exit anatomy.
  static const criticalReasonCodes = <String>{
    'mesh_no_face',
    'mesh_low_quality',
    'mesh_region_missing',
    'mesh_no_bounds',
    'mesh_pose_unavailable',
    'mesh_yaw',
    'mesh_pitch',
    'mesh_roll',
    'face_too_far',
    'face_too_close',
    'mesh_not_ready',
    'camera_not_ready',
  };

  /// Soft-exit eligible after READY (measurement noise only).
  static const softExitReasonCodes = <String>{
    'face_off_center',
    'face_too_far',
    'face_too_close',
    'mesh_yaw',
    'mesh_pitch',
    'mesh_roll',
  };

  /// Guidance / normalizable — crop can absorb small centering error.
  static const guidanceReasonCodes = <String>{
    'face_off_center',
  };

  static bool isCriticalReason(String? code) {
    if (code == null || code.isEmpty) return false;
    return criticalReasonCodes.contains(code);
  }

  static bool isGuidanceReason(String? code) {
    if (code == null || code.isEmpty) return false;
    return guidanceReasonCodes.contains(code);
  }

  static bool isSoftExitEligible(String? code) {
    if (code == null || code.isEmpty) return false;
    return softExitReasonCodes.contains(code);
  }
}

enum SkinCaptureUxPhase {
  idle,
  aligning,
  holdStill,
  ready,
  capturing,
  captured,
}

/// One highest-priority Arabic instruction for production UI.
abstract final class SkinCaptureInstruction {
  SkinCaptureInstruction._();

  static String forReasonCode(String? code) {
    return switch (code) {
      'mesh_no_face' || 'mesh_no_bounds' || 'mesh_region_missing' =>
        'أظهري الوجه كاملًا داخل الإطار',
      'mesh_low_quality' ||
      'mesh_pose_unavailable' ||
      'mesh_yaw' ||
      'mesh_pitch' =>
        'انظري مباشرة إلى الكاميرا',
      'mesh_roll' => 'اجعلي رأسك مستقيمًا',
      'face_too_far' => 'قرّبي الهاتف قليلًا',
      'face_too_close' => 'أبعدي الهاتف قليلًا',
      'face_off_center' => 'ضعي وجهك في منتصف الإطار',
      'mesh_not_ready' || 'camera_not_ready' => 'جاري تجهيز الكاميرا…',
      _ => 'ضعي وجهك داخل الإطار',
    };
  }

  static String get holdStill => 'ممتاز، ثبّتي قليلًا';
  static String get readyManual => 'ضعي وجهك داخل الإطار واضغطي للتصوير';
}
