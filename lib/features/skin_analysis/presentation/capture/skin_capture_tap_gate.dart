import '../../../../core/face_gate/face_gate_result.dart';
import '../../../face_analysis_experience/capture/contracts/face_capture_guidance_vm.dart';
import '../../presentation/live_face_map/face_mesh_quality_gate.dart';
import '../../presentation/live_face_map/models/face_mesh_models.dart';

/// Single source of truth: UI READY ↔ capture authorization for Skin shutter.
///
/// Does NOT change pose/centering thresholds — only unifies which signals
/// authorize the shutter so READY cannot desync from tap handling.
abstract final class SkinCaptureTapGate {
  SkinCaptureTapGate._();

  /// Canonical capture-ready for Skin.
  ///
  /// Mirror ON: guidance.isReady AND live mesh gate accepted.
  /// Mirror OFF: live mesh gate accepted + paintable face quality
  /// (never depends on unset mirror guidance).
  static bool isCaptureReady({
    required bool mirrorEnabled,
    required FaceCaptureGuidanceVm? guidance,
    required FaceGateResult liveMeshGate,
    required FaceMeshFrame frame,
  }) {
    if (!liveMeshGate.isAccepted) return false;
    if (mirrorEnabled) {
      return guidance?.isReady == true;
    }
    return FaceMeshQualityGate.canTakePhoto(frame);
  }

  /// Shutter should receive pointers whenever the camera session is interactive.
  /// Readiness is enforced inside the capture handler — never by nulling onTap
  /// (which caused dead taps during READY flicker).
  static bool shouldAttachCapturePointer({
    required bool controlsInteractive,
    required bool capturing,
    required bool hasCapture,
  }) {
    if (!controlsInteractive) return false;
    if (capturing) return false;
    if (hasCapture) return true; // retake
    return true;
  }
}
