import '../live_face_map/face_mesh_quality_gate.dart';
import 'skin_capture_ux_policy.dart';

/// Hold / auto-capture state for Skin — same critical gate as manual READY.
///
/// Soft-exit bands (center / scale / pose noise) keep the hold clock while
/// already holding; auto-fire still requires hard criticalReady.
class SkinCaptureHoldController {
  DateTime? _holdSince;
  DateTime? _lastAutoAttempt;
  SkinCaptureUxPhase _phase = SkinCaptureUxPhase.idle;
  bool _autoFireScheduled = false;

  SkinCaptureUxPhase get phase => _phase;
  bool get autoFireScheduled => _autoFireScheduled;

  /// 0–1 progress through [SkinCaptureUxPolicy.holdStillWindow].
  double holdProgress01(DateTime now) {
    final since = _holdSince;
    if (since == null || _phase != SkinCaptureUxPhase.holdStill) return 0;
    final ms = now.difference(since).inMilliseconds;
    final total = SkinCaptureUxPolicy.holdStillWindow.inMilliseconds;
    if (total <= 0) return 1;
    return (ms / total).clamp(0.0, 1.0);
  }

  bool get isHolding =>
      _phase == SkinCaptureUxPhase.holdStill ||
      _phase == SkinCaptureUxPhase.ready;

  void reset() {
    _holdSince = null;
    _phase = SkinCaptureUxPhase.idle;
    _autoFireScheduled = false;
  }

  void markCapturing() {
    _phase = SkinCaptureUxPhase.capturing;
    _autoFireScheduled = false;
    _holdSince = null;
  }

  void markCaptured() {
    _phase = SkinCaptureUxPhase.captured;
    _autoFireScheduled = false;
    _holdSince = null;
  }

  void releaseAfterFailure({DateTime? now}) {
    _lastAutoAttempt = now ?? DateTime.now();
    reset();
  }

  SkinCaptureHoldTick tick({
    required bool sessionInteractive,
    required bool criticalReady,
    required String? failReasonCode,
    required double? centerXAbs,
    required double? centerYAbs,
    double? faceScale,
    double? yawAbs,
    double? pitchAbs,
    double? rollAbs,
    required bool captureInProgress,
    required bool alreadyCaptured,
    required DateTime now,
  }) {
    if (alreadyCaptured) {
      _phase = SkinCaptureUxPhase.captured;
      return SkinCaptureHoldTick(
        phase: _phase,
        holdProgress01: 0,
        shouldAutoCapture: false,
        instructionAr: SkinCaptureInstruction.forReasonCode(null),
      );
    }
    if (captureInProgress) {
      _phase = SkinCaptureUxPhase.capturing;
      return const SkinCaptureHoldTick(
        phase: SkinCaptureUxPhase.capturing,
        holdProgress01: 0,
        shouldAutoCapture: false,
        instructionAr: '',
      );
    }
    if (!sessionInteractive) {
      reset();
      return SkinCaptureHoldTick(
        phase: SkinCaptureUxPhase.idle,
        holdProgress01: 0,
        shouldAutoCapture: false,
        instructionAr: SkinCaptureInstruction.forReasonCode('camera_not_ready'),
      );
    }

    final softHold = !criticalReady &&
        isHolding &&
        SkinCaptureUxPolicy.isSoftExitEligible(failReasonCode) &&
        _withinSoftExitBand(
          failReasonCode: failReasonCode,
          centerXAbs: centerXAbs,
          centerYAbs: centerYAbs,
          faceScale: faceScale,
          yawAbs: yawAbs,
          pitchAbs: pitchAbs,
          rollAbs: rollAbs,
        );
    final stayInHold = criticalReady || softHold;

    if (!stayInHold) {
      reset();
      _phase = SkinCaptureUxPhase.aligning;
      return SkinCaptureHoldTick(
        phase: _phase,
        holdProgress01: 0,
        shouldAutoCapture: false,
        instructionAr: SkinCaptureInstruction.forReasonCode(failReasonCode),
      );
    }

    _holdSince ??= now;
    _phase = SkinCaptureUxPhase.holdStill;

    final progress = holdProgress01(now);
    final heldLongEnough = progress >= 1.0;
    final cooledDown = _lastAutoAttempt == null ||
        now.difference(_lastAutoAttempt!) >= SkinCaptureUxPolicy.autoCooldown;

    var shouldAuto = false;
    if (criticalReady &&
        heldLongEnough &&
        cooledDown &&
        !_autoFireScheduled) {
      _phase = SkinCaptureUxPhase.ready;
      shouldAuto = true;
      _autoFireScheduled = true;
    }

    return SkinCaptureHoldTick(
      phase: _phase,
      holdProgress01: progress,
      shouldAutoCapture: shouldAuto,
      instructionAr: (criticalReady && heldLongEnough)
          ? SkinCaptureInstruction.readyManual
          : SkinCaptureInstruction.holdStill,
    );
  }

  bool _withinSoftExitBand({
    required String? failReasonCode,
    required double? centerXAbs,
    required double? centerYAbs,
    required double? faceScale,
    required double? yawAbs,
    required double? pitchAbs,
    required double? rollAbs,
  }) {
    // Pose soft-exit requires measured angles; missing → hard cancel.
    if (failReasonCode == 'mesh_yaw' ||
        failReasonCode == 'mesh_pitch' ||
        failReasonCode == 'mesh_roll' ||
        failReasonCode == 'mesh_pose_unavailable') {
      if (yawAbs == null || pitchAbs == null || rollAbs == null) return false;
    }
    if (failReasonCode == 'face_too_far' || failReasonCode == 'face_too_close') {
      if (faceScale == null) return false;
    }
    if (failReasonCode == 'face_off_center') {
      if (centerXAbs == null || centerYAbs == null) return false;
    }

    final maxX = FaceMeshQualityGate.maxCenterDriftX +
        SkinCaptureUxPolicy.centerExitHysteresis;
    final maxY = FaceMeshQualityGate.maxCenterDriftY +
        SkinCaptureUxPolicy.centerExitHysteresis;
    if (centerXAbs != null && centerXAbs > maxX) return false;
    if (centerYAbs != null && centerYAbs > maxY) return false;

    if (faceScale != null) {
      final minH = FaceMeshQualityGate.minFaceHeightRatio -
          SkinCaptureUxPolicy.scaleExitHysteresis;
      final maxH = FaceMeshQualityGate.maxFaceHeightRatio +
          SkinCaptureUxPolicy.scaleExitHysteresis;
      if (faceScale < minH || faceScale > maxH) return false;
    }

    final poseH = SkinCaptureUxPolicy.poseExitHysteresisDegrees;
    if (yawAbs != null &&
        yawAbs > FaceMeshQualityGate.maxYawDegrees + poseH) {
      return false;
    }
    if (pitchAbs != null &&
        pitchAbs > FaceMeshQualityGate.maxPitchDegrees + poseH) {
      return false;
    }
    if (rollAbs != null &&
        rollAbs > FaceMeshQualityGate.maxRollDegrees + poseH) {
      return false;
    }
    return true;
  }
}

class SkinCaptureHoldTick {
  final SkinCaptureUxPhase phase;
  final double holdProgress01;
  final bool shouldAutoCapture;
  final String instructionAr;

  const SkinCaptureHoldTick({
    required this.phase,
    required this.holdProgress01,
    required this.shouldAutoCapture,
    required this.instructionAr,
  });
}
