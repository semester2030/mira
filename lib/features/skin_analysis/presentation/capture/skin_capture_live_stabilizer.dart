import 'dart:ui';

import '../../../../core/face_gate/face_gate_result.dart';
import '../live_face_map/face_mesh_quality_gate.dart';
import '../live_face_map/models/face_mesh_models.dart';
import 'skin_capture_ux_policy.dart';

/// Live READY stabilizer — ENTRY uses [FaceMeshQualityGate] limits;
/// EXIT applies validated hysteresis so measurement noise does not reset HOLD.
///
/// Does not loosen yaw/pitch/roll ENTRY ceilings.
class SkinCaptureLiveStabilizer {
  bool _wasAccepted = false;

  void reset() => _wasAccepted = false;

  FaceGateResult evaluate(FaceMeshFrame frame, Rect guideRect) {
    final raw = FaceMeshQualityGate.evaluate(frame, guideRect);
    if (raw.isAccepted) {
      _wasAccepted = true;
      return raw;
    }

    if (!_wasAccepted) {
      return raw;
    }

    // Soft exit: only for gates classified as normalizable/guidance noise.
    if (_softExitStillValid(frame, guideRect, raw.reasonCode)) {
      return const FaceGateResult.accepted();
    }

    _wasAccepted = false;
    return raw;
  }

  bool _softExitStillValid(
    FaceMeshFrame frame,
    Rect guideRect,
    String? reason,
  ) {
    if (reason == null) return false;
    if (SkinCaptureUxPolicy.isCriticalReason(reason) &&
        !SkinCaptureUxPolicy.isSoftExitEligible(reason)) {
      return false;
    }

    final box = frame.boundingBox;
    if (box == null) return false;

    final driftX =
        (box.center.dx - guideRect.center.dx).abs() / guideRect.width;
    final driftY =
        (box.center.dy - guideRect.center.dy).abs() / guideRect.height;
    final heightRatio = box.height / guideRect.height;
    final yaw = frame.yawDegrees;
    final pitch = frame.pitchDegrees;
    final roll = frame.rollDegrees;

    final maxX = FaceMeshQualityGate.maxCenterDriftX +
        SkinCaptureUxPolicy.centerExitHysteresis;
    final maxY = FaceMeshQualityGate.maxCenterDriftY +
        SkinCaptureUxPolicy.centerExitHysteresis;
    final minH = FaceMeshQualityGate.minFaceHeightRatio -
        SkinCaptureUxPolicy.scaleExitHysteresis;
    final maxH = FaceMeshQualityGate.maxFaceHeightRatio +
        SkinCaptureUxPolicy.scaleExitHysteresis;
    final poseH = SkinCaptureUxPolicy.poseExitHysteresisDegrees;

    if (driftX > maxX || driftY > maxY) return false;
    if (heightRatio < minH || heightRatio > maxH) return false;
    if (yaw == null || pitch == null || roll == null) return false;
    if (yaw.abs() > FaceMeshQualityGate.maxYawDegrees + poseH) return false;
    if (pitch.abs() > FaceMeshQualityGate.maxPitchDegrees + poseH) {
      return false;
    }
    if (roll.abs() > FaceMeshQualityGate.maxRollDegrees + poseH) return false;

    // Regions / quality / anatomy are never soft-exited.
    if (reason == 'mesh_no_face' ||
        reason == 'mesh_low_quality' ||
        reason == 'mesh_region_missing' ||
        reason == 'mesh_no_bounds') {
      return false;
    }
    return SkinCaptureUxPolicy.isSoftExitEligible(reason);
  }
}
