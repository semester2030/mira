import 'capture_versions.dart';
import 'face_capture_semantic.dart';
import 'face_capture_truth.dart';

/// Deterministic readiness evaluation output (one primary state).
class FaceCaptureReadinessResult {
  final FaceCaptureReadinessState state;
  final String reasonCode;
  final bool isReady;
  final bool canManualCapture;
  final bool autoCaptureEligible;
  final FacePresenceKind presence;
  final AlignmentKind alignment;
  final DistanceKind distance;
  final PoseKind pose;
  final LightingKind lighting;
  final BlurKind blur;
  final StabilityKind stability;
  final Duration? readyStreak;
  final FaceCaptureTruthClass truthClass;
  final String contractVersion;
  final List<String> secondaryReasonCodes;

  const FaceCaptureReadinessResult({
    required this.state,
    required this.reasonCode,
    required this.isReady,
    required this.canManualCapture,
    required this.autoCaptureEligible,
    required this.presence,
    required this.alignment,
    required this.distance,
    required this.pose,
    required this.lighting,
    required this.blur,
    required this.stability,
    required this.truthClass,
    this.readyStreak,
    this.contractVersion = FaceCaptureVersions.readiness,
    this.secondaryReasonCodes = const [],
  });
}
