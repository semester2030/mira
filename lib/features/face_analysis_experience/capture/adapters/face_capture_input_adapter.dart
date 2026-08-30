import '../../../../core/face_gate/face_gate_result.dart';
import '../../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import '../contracts/face_capture_quality_input.dart';
import '../contracts/face_capture_truth.dart';

/// Adapts existing LIVE capture signals → [FaceCaptureQualityInput].
///
/// Does not run Face Intelligence. Optional bridge for future 9C wiring.
abstract final class FaceCaptureInputAdapter {
  FaceCaptureInputAdapter._();

  static FaceCaptureQualityInput fromLiveMesh({
    required FaceMeshFrame? frame,
    required DateTime now,
    double? centerOffsetXRatio,
    double? centerOffsetYRatio,
    double? faceHeightVsGuideRatio,
    bool? cameraReady,
    bool? permissionGranted,
    bool? cameraPaused,
  }) {
    final hasFace = frame?.hasFace == true;
    return FaceCaptureQualityInput(
      frameTimestamp: frame?.timestamp ?? now,
      evaluationNow: now,
      cameraReady: cameraReady ?? true,
      permissionGranted: permissionGranted ?? true,
      cameraPaused: cameraPaused ?? false,
      faceCount: frame == null ? null : (hasFace ? 1 : 0),
      faceHeightVsGuideRatio: faceHeightVsGuideRatio,
      centerOffsetXRatio: centerOffsetXRatio,
      centerOffsetYRatio: centerOffsetYRatio,
      trackingAcceptable:
          frame == null ? null : frame.quality != FaceTrackingQuality.low,
      primarySource: FaceCaptureSignalSource.mediapipe,
    );
  }

  static FaceCaptureQualityInput fromFaceGate({
    required FaceGateResult gate,
    required DateTime now,
    DateTime? frameTimestamp,
    double? brightness01,
    double? blurVariance,
    bool? cameraReady,
  }) {
    return FaceCaptureQualityInput(
      frameTimestamp: frameTimestamp ?? now,
      evaluationNow: now,
      cameraReady: cameraReady ?? true,
      permissionGranted: true,
      faceCount: gate.faceCount ?? (gate.isAccepted ? 1 : null),
      faceAreaRatio: gate.faceAreaRatio,
      centerOffsetXRatio: gate.centerOffsetXRatio,
      centerOffsetYRatio: gate.centerOffsetYRatio,
      yawDegrees: gate.headYawDegrees,
      pitchDegrees: gate.headPitchDegrees,
      rollDegrees: gate.headRollDegrees,
      eyesVisible: gate.eyesVisible,
      brightness01: brightness01,
      blurVariance: blurVariance,
      primarySource: FaceCaptureSignalSource.mlKit,
    );
  }
}
