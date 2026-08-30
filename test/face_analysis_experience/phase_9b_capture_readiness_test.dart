import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/capture/capture.dart';

FaceCaptureQualityInput _base({
  required DateTime now,
  DateTime? frameTs,
  int? faceCount = 1,
  double? faceHeightVsGuideRatio = 0.9,
  double? centerOffsetXRatio = 0.0,
  double? centerOffsetYRatio = 0.0,
  double? yawDegrees = 0,
  double? pitchDegrees = 0,
  double? rollDegrees = 0,
  double? brightness01,
  double? blurVariance,
  bool? trackingAcceptable = true,
  double? normalizedBoxCenterX = 0.5,
  double? normalizedBoxCenterY = 0.5,
  bool? cameraReady = true,
  bool? permissionGranted = true,
  bool? cameraPaused = false,
  bool? controllerDisposed = false,
}) {
  return FaceCaptureQualityInput(
    frameTimestamp: frameTs ?? now,
    evaluationNow: now,
    faceCount: faceCount,
    faceHeightVsGuideRatio: faceHeightVsGuideRatio,
    centerOffsetXRatio: centerOffsetXRatio,
    centerOffsetYRatio: centerOffsetYRatio,
    yawDegrees: yawDegrees,
    pitchDegrees: pitchDegrees,
    rollDegrees: rollDegrees,
    brightness01: brightness01,
    blurVariance: blurVariance,
    trackingAcceptable: trackingAcceptable,
    normalizedBoxCenterX: normalizedBoxCenterX,
    normalizedBoxCenterY: normalizedBoxCenterY,
    cameraReady: cameraReady,
    permissionGranted: permissionGranted,
    cameraPaused: cameraPaused,
    controllerDisposed: controllerDisposed,
    primarySource: FaceCaptureSignalSource.derivedCapturePolicy,
  );
}

void main() {
  final now = DateTime.utc(2026, 8, 11, 12, 0, 0);
  const policy = FaceCaptureReadinessPolicy.defaults;

  group('FaceCaptureReadinessEvaluator', () {
    test('permission denied blocks', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, permissionGranted: false),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.permissionDenied);
      expect(r.canManualCapture, isFalse);
      expect(r.autoCaptureEligible, isFalse);
    });

    test('camera unavailable / disposed', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, controllerDisposed: true),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.cameraUnavailable);
    });

    test('paused → initializing', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, cameraPaused: true),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.initializing);
    });

    test('stale frame blocks', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(
          now: now,
          frameTs: now.subtract(const Duration(seconds: 2)),
        ),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.qualityBlocked);
      expect(r.reasonCode, CaptureReasonCodes.staleFrame);
    });

    test('no face', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, faceCount: 0),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.searchingFace);
      expect(r.presence, FacePresenceKind.noFace);
      expect(r.canManualCapture, isFalse);
    });

    test('multiple faces block — no silent select', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, faceCount: 2),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.multipleFaces);
      expect(r.canManualCapture, isFalse);
    });

    test('unknown face count', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, faceCount: null),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.searchingFace);
    });

    test('off-center → alignFace', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, centerOffsetXRatio: 0.25),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.alignFace);
      expect(r.alignment, AlignmentKind.adjust);
    });

    test('too far / too close via height ratio', () {
      final far = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, faceHeightVsGuideRatio: 0.5),
        policy: policy,
      );
      expect(far.state, FaceCaptureReadinessState.moveCloser);
      final close = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, faceHeightVsGuideRatio: 1.2),
        policy: policy,
      );
      expect(close.state, FaceCaptureReadinessState.moveFarther);
    });

    test('distance via faceAreaRatio when height missing', () {
      final input = FaceCaptureQualityInput(
        frameTimestamp: now,
        evaluationNow: now,
        faceCount: 1,
        faceAreaRatio: 0.02,
        centerOffsetXRatio: 0,
        centerOffsetYRatio: 0,
        yawDegrees: 0,
        pitchDegrees: 0,
        rollDegrees: 0,
        trackingAcceptable: true,
        cameraReady: true,
        permissionGranted: true,
      );
      final r = FaceCaptureReadinessEvaluator.evaluate(input: input);
      expect(r.state, FaceCaptureReadinessState.moveCloser);
    });

    test('yaw / pitch / roll pose cues (SUBJECT semantics)', () {
      final yawL = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, yawDegrees: 40),
        policy: policy,
      );
      expect(yawL.state, FaceCaptureReadinessState.adjustAngle);
      expect(yawL.pose, PoseKind.turnRight);
      expect(yawL.reasonCode, CaptureReasonCodes.turnRight);

      final yawR = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, yawDegrees: -40),
        policy: policy,
      );
      expect(yawR.pose, PoseKind.turnLeft);

      final pitch = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, pitchDegrees: 35),
        policy: policy,
      );
      expect(pitch.pose, PoseKind.lookDown);

      final roll = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, rollDegrees: 35),
        policy: policy,
      );
      expect(roll.pose, PoseKind.straighten);
    });

    test('lighting dark/bright when provided', () {
      final dark = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, brightness01: 0.05),
        policy: policy,
      );
      expect(dark.state, FaceCaptureReadinessState.improveLight);
      expect(dark.reasonCode, CaptureReasonCodes.lowLight);

      final bright = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, brightness01: 0.98),
        policy: policy,
      );
      expect(bright.reasonCode, CaptureReasonCodes.overexposed);
    });

    test('blur optional by default — does not block READY', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, blurVariance: 5),
        policy: policy,
        readySince: now.subtract(const Duration(seconds: 1)),
      );
      expect(r.isReady, isTrue);
      expect(r.secondaryReasonCodes, contains(CaptureReasonCodes.blurry));
    });

    test('blur mandatory when policy requires', () {
      const p = FaceCaptureReadinessPolicy(requireBlurForReady: true);
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, blurVariance: 5),
        policy: p,
      );
      expect(r.state, FaceCaptureReadinessState.qualityBlocked);
    });

    test('READY vs AUTO_CAPTURE_ELIGIBLE distinct', () {
      final readyOnly = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now),
        policy: policy,
        readySince: now, // streak 0
      );
      expect(readyOnly.isReady, isTrue);
      expect(readyOnly.autoCaptureEligible, isFalse);
      expect(readyOnly.state, FaceCaptureReadinessState.ready);

      final eligible = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now),
        policy: policy,
        readySince: now.subtract(const Duration(milliseconds: 600)),
      );
      expect(eligible.isReady, isTrue);
      expect(eligible.autoCaptureEligible, isTrue);
      expect(eligible.reasonCode, CaptureReasonCodes.autoEligible);
    });

    test('stability moving → holdStill', () {
      final history = FaceCaptureStabilityHistory();
      final t0 = now.subtract(const Duration(milliseconds: 100));
      history.push(
        FaceCaptureStabilitySample(timestamp: t0, centerX: 0.4, centerY: 0.5),
        keep: const Duration(seconds: 2),
      );
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(
          now: now,
          frameTs: now,
          normalizedBoxCenterX: 0.55,
          normalizedBoxCenterY: 0.5,
        ),
        policy: policy,
        history: history,
      );
      expect(r.state, FaceCaptureReadinessState.holdStill);
      expect(r.stability, StabilityKind.moving);
    });

    test('priority: multiple faces beats pose', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, faceCount: 2, yawDegrees: 50),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.multipleFaces);
    });

    test('priority: align beats distance when both bad — higher priority wins', () {
      // align severity < moveCloser severity → align wins if both considered.
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(
          now: now,
          centerOffsetXRatio: 0.3,
          faceHeightVsGuideRatio: 0.4,
        ),
        policy: policy,
      );
      expect(r.state, FaceCaptureReadinessState.alignFace);
    });

    test('manual fallback allowed for pose issues, not for no face', () {
      final pose = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, yawDegrees: 50),
        policy: policy,
      );
      expect(pose.canManualCapture, isTrue);
      final none = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, faceCount: 0),
        policy: policy,
      );
      expect(none.canManualCapture, isFalse);
    });

    test('capture in progress / captured', () {
      final a = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now),
        captureInProgress: true,
      );
      expect(a.state, FaceCaptureReadinessState.captureInProgress);
      final b = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now),
        alreadyCaptured: true,
      );
      expect(b.state, FaceCaptureReadinessState.captured);
    });

    test('hysteresis reduces flicker near center threshold', () {
      const p = FaceCaptureReadinessPolicy(
        maxCenterOffsetX: 0.13,
        centerHysteresis: 0.02,
      );
      final first = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, centerOffsetXRatio: 0.14),
        policy: p,
      );
      expect(first.state, FaceCaptureReadinessState.alignFace);

      // Same 0.12 would be good normally; after align, need tighter 0.11
      final still = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, centerOffsetXRatio: 0.12),
        policy: p,
        previousState: FaceCaptureReadinessState.alignFace,
      );
      expect(still.state, FaceCaptureReadinessState.alignFace);

      final cleared = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, centerOffsetXRatio: 0.05),
        policy: p,
        previousState: FaceCaptureReadinessState.alignFace,
      );
      expect(cleared.isReady, isTrue);
    });

    test('threshold boundaries for area', () {
      final justBelow = FaceCaptureQualityInput(
        frameTimestamp: now,
        evaluationNow: now,
        faceCount: 1,
        faceAreaRatio: policy.minFaceAreaRatio - 0.0001,
        centerOffsetXRatio: 0,
        centerOffsetYRatio: 0,
        yawDegrees: 0,
        pitchDegrees: 0,
        rollDegrees: 0,
        trackingAcceptable: true,
        cameraReady: true,
        permissionGranted: true,
      );
      expect(
        FaceCaptureReadinessEvaluator.evaluate(input: justBelow).state,
        FaceCaptureReadinessState.moveCloser,
      );

      final equal = FaceCaptureQualityInput(
        frameTimestamp: now,
        evaluationNow: now,
        faceCount: 1,
        faceAreaRatio: policy.minFaceAreaRatio,
        centerOffsetXRatio: 0,
        centerOffsetYRatio: 0,
        yawDegrees: 0,
        pitchDegrees: 0,
        rollDegrees: 0,
        trackingAcceptable: true,
        cameraReady: true,
        permissionGranted: true,
      );
      expect(
        FaceCaptureReadinessEvaluator.evaluate(input: equal).isReady,
        isTrue,
      );
    });

    test('determinism: same input → same state', () {
      final input = _base(now: now);
      final a = FaceCaptureReadinessEvaluator.evaluate(input: input);
      final b = FaceCaptureReadinessEvaluator.evaluate(input: input);
      expect(a.state, b.state);
      expect(a.reasonCode, b.reasonCode);
      expect(a.autoCaptureEligible, b.autoCaptureEligible);
    });

    test('hold window uses timestamps not frame counts', () {
      final eligible = FaceCaptureHoldWindowPolicy.isHoldSatisfied(
        readySince: now.subtract(const Duration(milliseconds: 500)),
        now: now,
      );
      expect(eligible, isTrue);
      final notYet = FaceCaptureHoldWindowPolicy.isHoldSatisfied(
        readySince: now.subtract(const Duration(milliseconds: 100)),
        now: now,
      );
      expect(notYet, isFalse);
    });
  });

  group('FaceCaptureLatch', () {
    test('eligible → firing → captured without repeat', () {
      final latch = FaceCaptureLatch();
      final p1 = latch.onEligible(now: now, policy: policy);
      expect(p1, CaptureLatchPhase.eligible);
      latch.beginFiring(now);
      expect(latch.phase, CaptureLatchPhase.firing);
      latch.markCaptured();
      expect(latch.phase, CaptureLatchPhase.captured);
      // Still in cooldown
      final again = latch.onEligible(
        now: now.add(const Duration(milliseconds: 100)),
        policy: policy,
      );
      expect(again, CaptureLatchPhase.captured);
    });

    test('reset after retake', () {
      final latch = FaceCaptureLatch(phase: CaptureLatchPhase.captured);
      expect(latch.reset(), CaptureLatchPhase.idle);
    });
  });

  group('FaceCaptureGuidanceMapper', () {
    test('Arabic microcopy for ready / auto eligible', () {
      final ready = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now),
        readySince: now,
      );
      final vm = FaceCaptureGuidanceMapper.toVm(ready);
      expect(vm.titleAr, isNotEmpty);
      expect(vm.instructionAr, contains('جاهزة'));
      expect(vm.truthClass, FaceCaptureTruthClass.derivedCapturePolicy);

      final elig = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now),
        readySince: now.subtract(const Duration(milliseconds: 600)),
      );
      final vm2 = FaceCaptureGuidanceMapper.toVm(elig);
      expect(vm2.instructionAr, contains('ممتاز'));
      expect(vm2.autoCaptureEligible, isTrue);
    });

    test('accessibility label combines title + instruction', () {
      final r = FaceCaptureReadinessEvaluator.evaluate(
        input: _base(now: now, faceCount: 0),
      );
      final vm = FaceCaptureGuidanceMapper.toVm(r);
      expect(vm.accessibilityLabel, contains(vm.titleAr));
    });
  });
}
