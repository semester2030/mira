import '../contracts/capture_reason_codes.dart';
import '../contracts/face_capture_quality_input.dart';
import '../contracts/face_capture_readiness_result.dart';
import '../contracts/face_capture_semantic.dart';
import '../contracts/face_capture_truth.dart';
import '../policy/face_capture_hold_window_policy.dart';
import '../policy/face_capture_priority_policy.dart';
import '../policy/face_capture_readiness_policy.dart';
import 'face_capture_stability_history.dart';

/// Pure deterministic capture readiness evaluator (no Widget deps).
///
/// READY ≠ AUTO_CAPTURE_ELIGIBLE.
abstract final class FaceCaptureReadinessEvaluator {
  FaceCaptureReadinessEvaluator._();

  static FaceCaptureReadinessResult evaluate({
    required FaceCaptureQualityInput input,
    FaceCaptureReadinessPolicy policy = FaceCaptureReadinessPolicy.defaults,
    FaceCaptureStabilityHistory? history,
    DateTime? readySince,
    FaceCaptureReadinessState? previousState,
    bool captureInProgress = false,
    bool alreadyCaptured = false,
  }) {
    if (alreadyCaptured) {
      return _result(
        state: FaceCaptureReadinessState.captured,
        reason: CaptureReasonCodes.captured,
        presence: FacePresenceKind.unknown,
        alignment: AlignmentKind.unknown,
        distance: DistanceKind.unknown,
        pose: PoseKind.unknown,
        lighting: LightingKind.unknown,
        blur: BlurKind.unknown,
        stability: StabilityKind.unknown,
        isReady: false,
        canManual: false,
        autoEligible: false,
      );
    }
    if (captureInProgress) {
      return _result(
        state: FaceCaptureReadinessState.captureInProgress,
        reason: CaptureReasonCodes.captureInProgress,
        presence: FacePresenceKind.unknown,
        alignment: AlignmentKind.unknown,
        distance: DistanceKind.unknown,
        pose: PoseKind.unknown,
        lighting: LightingKind.unknown,
        blur: BlurKind.unknown,
        stability: StabilityKind.unknown,
        isReady: false,
        canManual: false,
        autoEligible: false,
      );
    }

    // Lifecycle hard blocks
    if (input.permissionGranted == false) {
      return _block(
        FaceCaptureReadinessState.permissionDenied,
        CaptureReasonCodes.permissionDenied,
      );
    }
    if (input.controllerDisposed == true || input.cameraReady == false) {
      return _block(
        FaceCaptureReadinessState.cameraUnavailable,
        CaptureReasonCodes.cameraUnavailable,
      );
    }
    if (input.cameraPaused == true) {
      return _block(
        FaceCaptureReadinessState.initializing,
        CaptureReasonCodes.cameraPaused,
      );
    }
    if (input.cameraReady == null && input.permissionGranted == null) {
      // Still booting when both unknown.
      return _block(
        FaceCaptureReadinessState.initializing,
        CaptureReasonCodes.cameraInitializing,
      );
    }

    // Frame freshness
    if (input.frameAge > policy.maxFrameAge) {
      return _block(
        FaceCaptureReadinessState.qualityBlocked,
        CaptureReasonCodes.staleFrame,
      );
    }

    final presence = _presence(input.faceCount);
    final alignment = _alignment(input, policy, previousState);
    final distance = _distance(input, policy, previousState);
    final pose = _pose(input, policy, previousState);
    final lighting = _lighting(input, policy);
    final blur = _blur(input, policy);
    final stability = _stability(input, policy, history);

    // Priority resolution — collect candidates then pick highest priority.
    FaceCaptureReadinessState? candidate;
    String? reason;
    final secondary = <String>[];

    void consider(FaceCaptureReadinessState s, String code) {
      if (candidate == null) {
        candidate = s;
        reason = code;
        return;
      }
      if (FaceCapturePriorityPolicy.severity(s) <
          FaceCapturePriorityPolicy.severity(candidate!)) {
        secondary.add(reason!);
        candidate = s;
        reason = code;
      } else if (s != candidate) {
        secondary.add(code);
      }
    }

    switch (presence) {
      case FacePresenceKind.noFace:
        consider(
          FaceCaptureReadinessState.searchingFace,
          CaptureReasonCodes.noFace,
        );
      case FacePresenceKind.multipleFaces:
        consider(
          FaceCaptureReadinessState.multipleFaces,
          CaptureReasonCodes.multipleFaces,
        );
      case FacePresenceKind.unknown:
        consider(
          FaceCaptureReadinessState.searchingFace,
          CaptureReasonCodes.faceUnknown,
        );
      case FacePresenceKind.singleFace:
        break;
    }

    if (presence == FacePresenceKind.singleFace) {
      if (input.trackingAcceptable == false) {
        consider(
          FaceCaptureReadinessState.holdStill,
          CaptureReasonCodes.holdStill,
        );
      }
      if (alignment == AlignmentKind.adjust) {
        consider(
          FaceCaptureReadinessState.alignFace,
          CaptureReasonCodes.centerFace,
        );
      }
      if (distance == DistanceKind.tooFar) {
        consider(
          FaceCaptureReadinessState.moveCloser,
          CaptureReasonCodes.moveCloser,
        );
      }
      if (distance == DistanceKind.tooClose) {
        consider(
          FaceCaptureReadinessState.moveFarther,
          CaptureReasonCodes.moveFarther,
        );
      }
      if (pose != PoseKind.good && pose != PoseKind.unknown) {
        final code = switch (pose) {
          PoseKind.turnLeft => CaptureReasonCodes.turnLeft,
          PoseKind.turnRight => CaptureReasonCodes.turnRight,
          PoseKind.lookUp => CaptureReasonCodes.lookUp,
          PoseKind.lookDown => CaptureReasonCodes.lookDown,
          PoseKind.straighten => CaptureReasonCodes.straighten,
          _ => CaptureReasonCodes.adjustPose,
        };
        consider(FaceCaptureReadinessState.adjustAngle, code);
      }
      if (lighting == LightingKind.tooDark) {
        consider(
          FaceCaptureReadinessState.improveLight,
          CaptureReasonCodes.lowLight,
        );
      }
      if (lighting == LightingKind.tooBright) {
        consider(
          FaceCaptureReadinessState.improveLight,
          CaptureReasonCodes.overexposed,
        );
      }
      if (blur == BlurKind.blurry && policy.requireBlurForReady) {
        consider(
          FaceCaptureReadinessState.qualityBlocked,
          CaptureReasonCodes.blurry,
        );
      } else if (blur == BlurKind.blurry) {
        secondary.add(CaptureReasonCodes.blurry);
      }
      if (stability == StabilityKind.moving) {
        consider(
          FaceCaptureReadinessState.holdStill,
          CaptureReasonCodes.holdStill,
        );
      }
    }

    // If any blocking candidate, return it.
    if (candidate != null && candidate != FaceCaptureReadinessState.ready) {
      final canManual = _manualAllowed(
        presence: presence,
        state: candidate!,
      );
      return _result(
        state: candidate!,
        reason: reason!,
        presence: presence,
        alignment: alignment,
        distance: distance,
        pose: pose,
        lighting: lighting,
        blur: blur,
        stability: stability,
        isReady: false,
        canManual: canManual,
        autoEligible: false,
        secondary: secondary,
      );
    }

    // All mandatory gates pass → READY (static frame).
    final readyOk = presence == FacePresenceKind.singleFace &&
        alignment != AlignmentKind.adjust &&
        distance == DistanceKind.good &&
        (pose == PoseKind.good || pose == PoseKind.unknown) &&
        (lighting == LightingKind.good ||
            lighting == LightingKind.unknown ||
            !policy.requireBrightnessForReady) &&
        (blur != BlurKind.blurry || !policy.requireBlurForReady) &&
        (stability != StabilityKind.moving) &&
        (input.eyesVisible != false || !policy.requireEyesVisibleForReady) &&
        (input.trackingAcceptable != false);

    if (!readyOk) {
      // Unknown distance/alignment without alternate signal → ask to align.
      final fallback = presence != FacePresenceKind.singleFace
          ? FaceCaptureReadinessState.searchingFace
          : FaceCaptureReadinessState.alignFace;
      return _result(
        state: fallback,
        reason: FaceCapturePriorityPolicy.defaultReason(fallback),
        presence: presence,
        alignment: alignment,
        distance: distance,
        pose: pose,
        lighting: lighting,
        blur: blur,
        stability: stability,
        isReady: false,
        canManual: presence == FacePresenceKind.singleFace,
        autoEligible: false,
        secondary: secondary,
      );
    }

    final streak = readySince == null
        ? Duration.zero
        : input.evaluationNow.difference(readySince);
    final holdOk = FaceCaptureHoldWindowPolicy.isHoldSatisfied(
      readySince: readySince,
      now: input.evaluationNow,
      hold: policy.holdStillWindow,
    );
    final stableEnough =
        stability == StabilityKind.stable || stability == StabilityKind.unknown;

    return _result(
      state: FaceCaptureReadinessState.ready,
      reason: holdOk && stableEnough
          ? CaptureReasonCodes.autoEligible
          : CaptureReasonCodes.ready,
      presence: presence,
      alignment: alignment,
      distance: distance,
      pose: pose,
      lighting: lighting,
      blur: blur,
      stability: stability,
      isReady: true,
      canManual: true,
      autoEligible: holdOk && stableEnough,
      readyStreak: streak.isNegative ? Duration.zero : streak,
      secondary: secondary,
    );
  }

  static FacePresenceKind _presence(int? count) {
    if (count == null) return FacePresenceKind.unknown;
    if (count <= 0) return FacePresenceKind.noFace;
    if (count == 1) return FacePresenceKind.singleFace;
    return FacePresenceKind.multipleFaces;
  }

  static AlignmentKind _alignment(
    FaceCaptureQualityInput input,
    FaceCaptureReadinessPolicy policy,
    FaceCaptureReadinessState? previous,
  ) {
    final x = input.centerOffsetXRatio;
    final y = input.centerOffsetYRatio;
    if (x == null && y == null) return AlignmentKind.unknown;
    final ax = (x ?? 0).abs();
    final ay = (y ?? 0).abs();
    final wasAlign = previous == FaceCaptureReadinessState.alignFace;
    final maxX = wasAlign
        ? policy.maxCenterOffsetX - policy.centerHysteresis
        : policy.maxCenterOffsetX;
    final maxY = wasAlign
        ? policy.maxCenterOffsetY - policy.centerHysteresis
        : policy.maxCenterOffsetY;
    if (ax > maxX || ay > maxY) return AlignmentKind.adjust;
    return AlignmentKind.good;
  }

  static DistanceKind _distance(
    FaceCaptureQualityInput input,
    FaceCaptureReadinessPolicy policy,
    FaceCaptureReadinessState? previous,
  ) {
    // Prefer mesh height ratio when present; else face area ratio.
    final height = input.faceHeightVsGuideRatio;
    if (height != null) {
      final wasClose = previous == FaceCaptureReadinessState.moveFarther;
      final wasFar = previous == FaceCaptureReadinessState.moveCloser;
      final minH = wasFar
          ? policy.minFaceHeightVsGuide + policy.distanceHysteresis
          : policy.minFaceHeightVsGuide;
      final maxH = wasClose
          ? policy.maxFaceHeightVsGuide - policy.distanceHysteresis
          : policy.maxFaceHeightVsGuide;
      if (height < minH) return DistanceKind.tooFar;
      if (height > maxH) return DistanceKind.tooClose;
      return DistanceKind.good;
    }
    final area = input.faceAreaRatio;
    if (area == null) return DistanceKind.unknown;
    final wasClose = previous == FaceCaptureReadinessState.moveFarther;
    final wasFar = previous == FaceCaptureReadinessState.moveCloser;
    final minA = wasFar
        ? policy.minFaceAreaRatio + 0.01
        : policy.minFaceAreaRatio;
    final maxA = wasClose
        ? policy.maxFaceAreaRatio - 0.01
        : policy.maxFaceAreaRatio;
    if (area < minA) return DistanceKind.tooFar;
    if (area > maxA) return DistanceKind.tooClose;
    return DistanceKind.good;
  }

  static PoseKind _pose(
    FaceCaptureQualityInput input,
    FaceCaptureReadinessPolicy policy,
    FaceCaptureReadinessState? previous,
  ) {
    final yaw = input.yawDegrees;
    final pitch = input.pitchDegrees;
    final roll = input.rollDegrees;
    if (yaw == null && pitch == null && roll == null) return PoseKind.unknown;

    final hyst = previous == FaceCaptureReadinessState.adjustAngle
        ? policy.poseHysteresisDegrees
        : 0.0;
    final maxYaw = policy.maxYawDegrees - hyst;
    final maxPitch = policy.maxPitchDegrees - hyst;
    final maxRoll = policy.maxRollDegrees - hyst;

    if (roll != null && roll.abs() > maxRoll) return PoseKind.straighten;
    if (yaw != null && yaw.abs() > maxYaw) {
      // Positive yaw → SUBJECT_LEFT turn → ask turn right to correct (face camera).
      return yaw > 0 ? PoseKind.turnRight : PoseKind.turnLeft;
    }
    if (pitch != null && pitch.abs() > maxPitch) {
      return pitch > 0 ? PoseKind.lookDown : PoseKind.lookUp;
    }
    return PoseKind.good;
  }

  static LightingKind _lighting(
    FaceCaptureQualityInput input,
    FaceCaptureReadinessPolicy policy,
  ) {
    final b = input.brightness01;
    if (b == null) return LightingKind.unknown;
    if (b < policy.minBrightness) return LightingKind.tooDark;
    if (b > policy.maxBrightness) return LightingKind.tooBright;
    return LightingKind.good;
  }

  static BlurKind _blur(
    FaceCaptureQualityInput input,
    FaceCaptureReadinessPolicy policy,
  ) {
    final v = input.blurVariance;
    if (v == null) return BlurKind.unknown;
    if (v < policy.minBlurVariance) return BlurKind.blurry;
    return BlurKind.sharpEnough;
  }

  static StabilityKind _stability(
    FaceCaptureQualityInput input,
    FaceCaptureReadinessPolicy policy,
    FaceCaptureStabilityHistory? history,
  ) {
    if (history == null) return StabilityKind.unknown;
    if (input.normalizedBoxCenterX == null ||
        input.normalizedBoxCenterY == null) {
      return StabilityKind.unknown;
    }
    history.push(
      FaceCaptureStabilitySample(
        timestamp: input.frameTimestamp,
        centerX: input.normalizedBoxCenterX!,
        centerY: input.normalizedBoxCenterY!,
      ),
      keep: policy.stabilityWindow * 3,
    );
    final delta = history.maxCenterDelta(
      window: policy.stabilityWindow,
      now: input.evaluationNow,
    );
    if (delta == null) return StabilityKind.unknown;
    if (delta > policy.stabilityMaxCenterDelta) return StabilityKind.moving;
    return StabilityKind.stable;
  }

  /// Manual fallback: never bypass no-face / multiple-faces.
  static bool _manualAllowed({
    required FacePresenceKind presence,
    required FaceCaptureReadinessState state,
  }) {
    if (presence == FacePresenceKind.noFace ||
        presence == FacePresenceKind.multipleFaces ||
        presence == FacePresenceKind.unknown) {
      return false;
    }
    if (state == FaceCaptureReadinessState.permissionDenied ||
        state == FaceCaptureReadinessState.cameraUnavailable ||
        state == FaceCaptureReadinessState.initializing) {
      return false;
    }
    return true;
  }

  static FaceCaptureReadinessResult _block(
    FaceCaptureReadinessState state,
    String reason,
  ) {
    return _result(
      state: state,
      reason: reason,
      presence: FacePresenceKind.unknown,
      alignment: AlignmentKind.unknown,
      distance: DistanceKind.unknown,
      pose: PoseKind.unknown,
      lighting: LightingKind.unknown,
      blur: BlurKind.unknown,
      stability: StabilityKind.unknown,
      isReady: false,
      canManual: false,
      autoEligible: false,
    );
  }

  static FaceCaptureReadinessResult _result({
    required FaceCaptureReadinessState state,
    required String reason,
    required FacePresenceKind presence,
    required AlignmentKind alignment,
    required DistanceKind distance,
    required PoseKind pose,
    required LightingKind lighting,
    required BlurKind blur,
    required StabilityKind stability,
    required bool isReady,
    required bool canManual,
    required bool autoEligible,
    Duration? readyStreak,
    List<String> secondary = const [],
  }) {
    return FaceCaptureReadinessResult(
      state: state,
      reasonCode: reason,
      isReady: isReady,
      canManualCapture: canManual,
      autoCaptureEligible: autoEligible,
      presence: presence,
      alignment: alignment,
      distance: distance,
      pose: pose,
      lighting: lighting,
      blur: blur,
      stability: stability,
      readyStreak: readyStreak,
      truthClass: FaceCaptureTruthClass.derivedCapturePolicy,
      secondaryReasonCodes: secondary,
    );
  }
}
