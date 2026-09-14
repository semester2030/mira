import 'capture_versions.dart';
import 'face_capture_semantic.dart';
import 'face_capture_truth.dart';

/// Public-safe guidance VM for future 9C (no provider/version leakage).
class FaceCaptureGuidanceVm {
  final FaceCaptureReadinessState state;
  final String titleAr;
  final String instructionAr;
  final String accessibilityLabel;
  final int severity;
  final bool isReady;
  final bool canManualCapture;
  final bool autoCaptureEligible;
  final FaceCaptureTruthClass truthClass;
  final String reasonCode;
  final String contractVersion;

  const FaceCaptureGuidanceVm({
    required this.state,
    required this.titleAr,
    required this.instructionAr,
    required this.accessibilityLabel,
    required this.severity,
    required this.isReady,
    required this.canManualCapture,
    required this.autoCaptureEligible,
    required this.truthClass,
    required this.reasonCode,
    this.contractVersion = FaceCaptureVersions.guidance,
  });
}
