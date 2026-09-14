import '../contracts/face_history_vms.dart';
import '../localization/face_history_copy.dart';

/// Canonical Face retake request builder (presentation only).
abstract final class FaceRetakePolicy {
  FaceRetakePolicy._();

  /// Navigator.pop result token — NewAnalysisScreen clears capture on this.
  static const popResult = 'face_retake_requested';

  static FaceRetakeRequestVm build({
    required FaceRetakeReason reason,
    required FaceRetakeSource source,
    String? currentAnalysisRef,
    String? customGuidanceAr,
  }) {
    return FaceRetakeRequestVm(
      reason: reason,
      source: source,
      currentAnalysisRef: currentAnalysisRef,
      recommendedCaptureGuidanceAr:
          customGuidanceAr ?? FaceHistoryCopy.captureGuidance,
      preserveHistory: true,
    );
  }
}
