import '../contracts/capture_versions.dart';
import '../contracts/face_capture_semantic.dart';
import '../policy/face_capture_readiness_policy.dart';

/// Prevents repeated auto-capture while readiness remains true.
///
/// 9B computes phase only — 9C owns actual shutter firing.
class FaceCaptureLatch {
  CaptureLatchPhase phase;
  DateTime? lastFiredAt;

  FaceCaptureLatch({
    this.phase = CaptureLatchPhase.idle,
    this.lastFiredAt,
  });

  static const version = FaceCaptureVersions.latch;

  /// Transition when AUTO_CAPTURE_ELIGIBLE becomes true.
  CaptureLatchPhase onEligible({
    required DateTime now,
    required FaceCaptureReadinessPolicy policy,
  }) {
    if (phase == CaptureLatchPhase.firing || phase == CaptureLatchPhase.captured) {
      return phase;
    }
    if (lastFiredAt != null &&
        now.difference(lastFiredAt!) < policy.autoCaptureCooldown) {
      return phase = CaptureLatchPhase.idle;
    }
    return phase = CaptureLatchPhase.eligible;
  }

  CaptureLatchPhase beginFiring(DateTime now) {
    phase = CaptureLatchPhase.firing;
    lastFiredAt = now;
    return phase;
  }

  CaptureLatchPhase markCaptured() => phase = CaptureLatchPhase.captured;

  CaptureLatchPhase reset() {
    phase = CaptureLatchPhase.idle;
    return phase;
  }

  /// Reset when face leaves / not ready / lifecycle interrupt.
  CaptureLatchPhase onNotReady() {
    if (phase == CaptureLatchPhase.eligible || phase == CaptureLatchPhase.idle) {
      return phase = CaptureLatchPhase.idle;
    }
    // After captured/firing, stay until explicit reset (retake/resume).
    return phase;
  }
}
