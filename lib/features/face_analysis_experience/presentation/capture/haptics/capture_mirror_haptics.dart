import '../../../presentation/shared/face_experience_haptics.dart';

/// Minimal D10 haptic choreography for capture mirror.
///
/// Transition-gated by [CaptureMirrorCoordinator] — never per frame.
abstract final class CaptureMirrorHaptics {
  CaptureMirrorHaptics._();

  static Future<void> onReadyEntered() => FaceExperienceHaptics.ready();

  static Future<void> onAutoEligible() => FaceExperienceHaptics.medium();

  static Future<void> onShutter() => FaceExperienceHaptics.captureCommit();
}
