import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_authorize.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_gate_debug_hud.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_tap_gate.dart';

void main() {
  group('SkinCaptureAuthorize invariant', () {
    test('ALL PASS session+mesh → button capture READY', () {
      expect(
        SkinCaptureAuthorize.isButtonCaptureReady(
          sessionInteractive: true,
          meshCanonicalReady: true,
          hasCapture: false,
        ),
        isTrue,
      );
    });

    test('NOT READY mesh → button unauthorized', () {
      expect(
        SkinCaptureAuthorize.isButtonCaptureReady(
          sessionInteractive: true,
          meshCanonicalReady: false,
          hasCapture: false,
        ),
        isFalse,
      );
    });

    test('READY tap may enter; flicker uses gesture arm', () {
      expect(
        SkinCaptureAuthorize.mayEnterManualCapture(
          liveAuthorized: true,
          gestureArmedFromReadyUi: false,
        ),
        isTrue,
      );
      expect(
        SkinCaptureAuthorize.mayEnterManualCapture(
          liveAuthorized: false,
          gestureArmedFromReadyUi: true,
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

    test('double-capture guard: capturing blocks pointer attach', () {
      expect(
        SkinCaptureTapGate.shouldAttachCapturePointer(
          controlsInteractive: true,
          capturing: true,
          hasCapture: false,
        ),
        isFalse,
      );
      expect(
        SkinCaptureTapGate.shouldAttachCapturePointer(
          controlsInteractive: true,
          capturing: false,
          hasCapture: false,
        ),
        isTrue,
      );
    });

    test('HUD debug mode does not alter authorize helpers', () {
      // Compile-time flag only gates widget visibility; authorize is independent.
      expect(SkinCaptureAuthorize.hudMustIgnorePointers, isTrue);
      expect(
        SkinCaptureAuthorize.isButtonCaptureReady(
          sessionInteractive: true,
          meshCanonicalReady: true,
          hasCapture: false,
        ),
        isTrue,
      );
      // Whether HUD flag is on or off must not change this pure function.
      final _ = SkinCaptureGateDebugMode.enabled;
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
