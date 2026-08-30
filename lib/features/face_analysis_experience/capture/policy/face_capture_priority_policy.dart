import '../contracts/capture_reason_codes.dart';
import '../contracts/face_capture_semantic.dart';

/// Deterministic guidance priority (lower index = higher priority).
///
/// Order derived from signal reliability + safety:
/// camera/permission hard blocks → face count → alignment/distance (mesh/box)
/// → pose (ML Kit) → lighting/blur (still metrics often optional live)
/// → stability → ready.
abstract final class FaceCapturePriorityPolicy {
  FaceCapturePriorityPolicy._();

  static const List<FaceCaptureReadinessState> order = [
    FaceCaptureReadinessState.permissionDenied,
    FaceCaptureReadinessState.cameraUnavailable,
    FaceCaptureReadinessState.initializing,
    FaceCaptureReadinessState.searchingFace,
    FaceCaptureReadinessState.multipleFaces,
    FaceCaptureReadinessState.alignFace,
    FaceCaptureReadinessState.moveCloser,
    FaceCaptureReadinessState.moveFarther,
    FaceCaptureReadinessState.adjustAngle,
    FaceCaptureReadinessState.improveLight,
    FaceCaptureReadinessState.qualityBlocked,
    FaceCaptureReadinessState.holdStill,
    FaceCaptureReadinessState.ready,
    FaceCaptureReadinessState.captureInProgress,
    FaceCaptureReadinessState.captured,
  ];

  static int severity(FaceCaptureReadinessState state) {
    final i = order.indexOf(state);
    return i < 0 ? 50 : i;
  }

  static String defaultReason(FaceCaptureReadinessState state) => switch (state) {
        FaceCaptureReadinessState.permissionDenied =>
          CaptureReasonCodes.permissionDenied,
        FaceCaptureReadinessState.cameraUnavailable =>
          CaptureReasonCodes.cameraUnavailable,
        FaceCaptureReadinessState.initializing =>
          CaptureReasonCodes.cameraInitializing,
        FaceCaptureReadinessState.searchingFace => CaptureReasonCodes.noFace,
        FaceCaptureReadinessState.multipleFaces =>
          CaptureReasonCodes.multipleFaces,
        FaceCaptureReadinessState.alignFace => CaptureReasonCodes.centerFace,
        FaceCaptureReadinessState.moveCloser => CaptureReasonCodes.moveCloser,
        FaceCaptureReadinessState.moveFarther => CaptureReasonCodes.moveFarther,
        FaceCaptureReadinessState.adjustAngle => CaptureReasonCodes.adjustPose,
        FaceCaptureReadinessState.improveLight => CaptureReasonCodes.lowLight,
        FaceCaptureReadinessState.qualityBlocked =>
          CaptureReasonCodes.qualityBlocked,
        FaceCaptureReadinessState.holdStill => CaptureReasonCodes.holdStill,
        FaceCaptureReadinessState.ready => CaptureReasonCodes.ready,
        FaceCaptureReadinessState.captureInProgress =>
          CaptureReasonCodes.captureInProgress,
        FaceCaptureReadinessState.captured => CaptureReasonCodes.captured,
      };
}
