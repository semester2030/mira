import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_authorize.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_hold_controller.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_ux_policy.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart';

void main() {
  group('SkinCaptureUxPolicy classification', () {
    test('critical vs guidance reason codes', () {
      expect(SkinCaptureUxPolicy.isCriticalReason('mesh_yaw'), isTrue);
      expect(SkinCaptureUxPolicy.isCriticalReason('mesh_pitch'), isTrue);
      expect(SkinCaptureUxPolicy.isCriticalReason('mesh_roll'), isTrue);
      expect(SkinCaptureUxPolicy.isCriticalReason('face_too_far'), isTrue);
      expect(SkinCaptureUxPolicy.isCriticalReason('face_too_close'), isTrue);
      expect(SkinCaptureUxPolicy.isCriticalReason('mesh_region_missing'), isTrue);
      expect(SkinCaptureUxPolicy.isGuidanceReason('face_off_center'), isTrue);
      expect(SkinCaptureUxPolicy.isCriticalReason('face_off_center'), isFalse);
    });

    test('one instruction mapping — single string per reason', () {
      expect(
        SkinCaptureInstruction.forReasonCode('face_too_far'),
        'قرّبي الهاتف قليلًا',
      );
      expect(
        SkinCaptureInstruction.forReasonCode('face_too_close'),
        'أبعدي الهاتف قليلًا',
      );
      expect(
        SkinCaptureInstruction.forReasonCode('face_off_center'),
        'ضعي وجهك في منتصف الإطار',
      );
      expect(
        SkinCaptureInstruction.forReasonCode('mesh_roll'),
        'اجعلي رأسك مستقيمًا',
      );
      expect(SkinCaptureInstruction.holdStill, contains('ثبّتي'));
    });
  });

  group('SkinCaptureHoldController', () {
    test('does not auto-fire before hold window', () {
      final c = SkinCaptureHoldController();
      final t0 = DateTime.utc(2026, 9, 11, 12, 0, 0);
      final tick = c.tick(
        sessionInteractive: true,
        criticalReady: true,
        failReasonCode: null,
        centerXAbs: 0.02,
        centerYAbs: 0.02,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0,
      );
      expect(tick.shouldAutoCapture, isFalse);
      expect(tick.phase, SkinCaptureUxPhase.holdStill);
      expect(tick.holdProgress01, lessThan(1));
    });

    test('auto-fires after stable hold window', () {
      final c = SkinCaptureHoldController();
      final t0 = DateTime.utc(2026, 9, 11, 12, 0, 0);
      c.tick(
        sessionInteractive: true,
        criticalReady: true,
        failReasonCode: null,
        centerXAbs: 0.02,
        centerYAbs: 0.02,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0,
      );
      final t1 = t0.add(SkinCaptureUxPolicy.holdStillWindow);
      final tick = c.tick(
        sessionInteractive: true,
        criticalReady: true,
        failReasonCode: null,
        centerXAbs: 0.02,
        centerYAbs: 0.02,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t1,
      );
      expect(tick.shouldAutoCapture, isTrue);
      expect(tick.phase, SkinCaptureUxPhase.ready);
    });

    test('hard fail cancels hold immediately', () {
      final c = SkinCaptureHoldController();
      final t0 = DateTime.utc(2026, 9, 11, 12, 0, 0);
      c.tick(
        sessionInteractive: true,
        criticalReady: true,
        failReasonCode: null,
        centerXAbs: 0.02,
        centerYAbs: 0.02,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0,
      );
      final cancel = c.tick(
        sessionInteractive: true,
        criticalReady: false,
        failReasonCode: 'mesh_yaw',
        centerXAbs: 0.02,
        centerYAbs: 0.02,
        yawAbs: FaceMeshQualityGate.maxYawDegrees + 5,
        pitchAbs: 0,
        rollAbs: 0,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0.add(const Duration(milliseconds: 100)),
      );
      expect(cancel.shouldAutoCapture, isFalse);
      expect(cancel.holdProgress01, 0);
      expect(cancel.instructionAr, 'انظري مباشرة إلى الكاميرا');
    });

    test('centering exit hysteresis keeps hold inside exit band', () {
      final c = SkinCaptureHoldController();
      final t0 = DateTime.utc(2026, 9, 11, 12, 0, 0);
      c.tick(
        sessionInteractive: true,
        criticalReady: true,
        failReasonCode: null,
        centerXAbs: 0.02,
        centerYAbs: 0.02,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0,
      );
      final softCx = FaceMeshQualityGate.maxCenterDriftX + 0.01;
      final soft = c.tick(
        sessionInteractive: true,
        criticalReady: false,
        failReasonCode: 'face_off_center',
        centerXAbs: softCx,
        centerYAbs: 0.02,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0.add(const Duration(milliseconds: 100)),
      );
      expect(soft.holdProgress01, greaterThan(0));
      expect(soft.instructionAr, SkinCaptureInstruction.holdStill);

      final outside = FaceMeshQualityGate.maxCenterDriftX +
          SkinCaptureUxPolicy.centerExitHysteresis +
          0.01;
      final cancelled = c.tick(
        sessionInteractive: true,
        criticalReady: false,
        failReasonCode: 'face_off_center',
        centerXAbs: outside,
        centerYAbs: 0.02,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0.add(const Duration(milliseconds: 150)),
      );
      expect(cancelled.holdProgress01, 0);
      expect(cancelled.instructionAr, 'ضعي وجهك في منتصف الإطار');
    });

    test('auto-capture cancelled while capturing / already captured', () {
      final c = SkinCaptureHoldController();
      final t0 = DateTime.utc(2026, 9, 11, 12, 0, 0);
      expect(
        c
            .tick(
              sessionInteractive: true,
              criticalReady: true,
              failReasonCode: null,
              centerXAbs: 0,
              centerYAbs: 0,
              captureInProgress: true,
              alreadyCaptured: false,
              now: t0,
            )
            .shouldAutoCapture,
        isFalse,
      );
      expect(
        c
            .tick(
              sessionInteractive: true,
              criticalReady: true,
              failReasonCode: null,
              centerXAbs: 0,
              centerYAbs: 0,
              captureInProgress: false,
              alreadyCaptured: true,
              now: t0,
            )
            .shouldAutoCapture,
        isFalse,
      );
    });

    test('duplicate auto fire suppressed until release', () {
      final c = SkinCaptureHoldController();
      final t0 = DateTime.utc(2026, 9, 11, 12, 0, 0);
      c.tick(
        sessionInteractive: true,
        criticalReady: true,
        failReasonCode: null,
        centerXAbs: 0,
        centerYAbs: 0,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0,
      );
      final fire = c.tick(
        sessionInteractive: true,
        criticalReady: true,
        failReasonCode: null,
        centerXAbs: 0,
        centerYAbs: 0,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0.add(SkinCaptureUxPolicy.holdStillWindow),
      );
      expect(fire.shouldAutoCapture, isTrue);
      final again = c.tick(
        sessionInteractive: true,
        criticalReady: true,
        failReasonCode: null,
        centerXAbs: 0,
        centerYAbs: 0,
        captureInProgress: false,
        alreadyCaptured: false,
        now: t0.add(
          SkinCaptureUxPolicy.holdStillWindow +
              const Duration(milliseconds: 50),
        ),
      );
      expect(again.shouldAutoCapture, isFalse);
    });
  });

  group('SkinCaptureAuthorize auto/manual race', () {
    test('manual and auto share live READY gate', () {
      expect(
        SkinCaptureAuthorize.isButtonCaptureReady(
          sessionInteractive: true,
          meshCanonicalReady: true,
          hasCapture: false,
        ),
        isTrue,
      );
      expect(
        SkinCaptureAuthorize.mayEnterManualCapture(
          liveAuthorized: true,
          gestureArmedFromReadyUi: false,
        ),
        isTrue,
      );
      expect(
        SkinCaptureAuthorize.mayEnterAutoCapture(
          liveAuthorized: true,
          holdArmedFromStableReady: false,
        ),
        isTrue,
      );
    });

    test('hold arm covers READY flicker for auto only', () {
      expect(
        SkinCaptureAuthorize.mayEnterAutoCapture(
          liveAuthorized: false,
          holdArmedFromStableReady: true,
        ),
        isTrue,
      );
      expect(
        SkinCaptureAuthorize.mayEnterManualCapture(
          liveAuthorized: false,
          gestureArmedFromReadyUi: false,
        ),
        isFalse,
      );
    });

    test('HUD flag does not change authorize outcomes', () {
      expect(SkinCaptureAuthorize.hudMustIgnorePointers, isTrue);
      expect(
        SkinCaptureAuthorize.isButtonCaptureReady(
          sessionInteractive: true,
          meshCanonicalReady: true,
          hasCapture: false,
        ),
        isTrue,
      );
    });
  });
}
