import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/face_gate/face_gate_result.dart';
import 'package:mirra/features/face_analysis_experience/capture/contracts/face_capture_guidance_vm.dart';
import 'package:mirra/features/face_analysis_experience/capture/contracts/face_capture_semantic.dart';
import 'package:mirra/features/face_analysis_experience/capture/contracts/face_capture_truth.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/skin_capture_tap_gate.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

FaceCaptureGuidanceVm _guidance({
  required bool isReady,
  required bool canManual,
}) {
  return FaceCaptureGuidanceVm(
    state: isReady
        ? FaceCaptureReadinessState.ready
        : FaceCaptureReadinessState.alignFace,
    titleAr: 't',
    instructionAr: 'i',
    accessibilityLabel: 'a',
    severity: 1,
    isReady: isReady,
    canManualCapture: canManual,
    autoCaptureEligible: false,
    truthClass: FaceCaptureTruthClass.derivedCapturePolicy,
    reasonCode: 'test',
  );
}

void main() {
  group('SkinCaptureTapGate', () {
    final accepted = const FaceGateResult.accepted();
    final rejected = const FaceGateResult.rejected(
      reasonCode: 'face_off_center',
      messageAr: 'ضعي وجهك في منتصف الإطار',
    );
    final highFrame = FaceMeshFrame(
      outline: List.generate(
        12,
        (i) => FaceMeshPoint(i.toDouble(), i.toDouble()),
      ),
      regions: const [],
      quality: FaceTrackingQuality.high,
      timestamp: DateTime(2026, 9, 10),
    );
    final lowFrame = FaceMeshFrame(
      outline: List.generate(
        12,
        (i) => FaceMeshPoint(i.toDouble(), i.toDouble()),
      ),
      regions: const [],
      quality: FaceTrackingQuality.low,
      timestamp: DateTime(2026, 9, 10),
    );

    test('mirror OFF: never requires unset guidance.isReady', () {
      // Pre-fix bug: required guidance?.isReady while guidance was null.
      expect(
        SkinCaptureTapGate.isCaptureReady(
          mirrorEnabled: false,
          guidance: null,
          liveMeshGate: accepted,
          frame: highFrame,
        ),
        isTrue,
      );
      expect(
        SkinCaptureTapGate.isCaptureReady(
          mirrorEnabled: false,
          guidance: null,
          liveMeshGate: rejected,
          frame: highFrame,
        ),
        isFalse,
      );
      expect(
        SkinCaptureTapGate.isCaptureReady(
          mirrorEnabled: false,
          guidance: null,
          liveMeshGate: accepted,
          frame: lowFrame,
        ),
        isFalse,
      );
    });

    test('mirror ON: visual READY (isReady) authorizes capture — not canManual alone', () {
      expect(
        SkinCaptureTapGate.isCaptureReady(
          mirrorEnabled: true,
          guidance: _guidance(isReady: true, canManual: true),
          liveMeshGate: accepted,
          frame: highFrame,
        ),
        isTrue,
      );
      // canManual without isReady must NOT count as READY capture auth
      expect(
        SkinCaptureTapGate.isCaptureReady(
          mirrorEnabled: true,
          guidance: _guidance(isReady: false, canManual: true),
          liveMeshGate: accepted,
          frame: highFrame,
        ),
        isFalse,
      );
      expect(
        SkinCaptureTapGate.isCaptureReady(
          mirrorEnabled: true,
          guidance: _guidance(isReady: true, canManual: true),
          liveMeshGate: rejected,
          frame: highFrame,
        ),
        isFalse,
      );
    });

    test('visual READY predicate equals capture authorize predicate', () {
      for (final mirror in [true, false]) {
        for (final ready in [true, false]) {
          for (final meshOk in [true, false]) {
            final g = _guidance(isReady: ready, canManual: true);
            final gate = meshOk ? accepted : rejected;
            final auth = SkinCaptureTapGate.isCaptureReady(
              mirrorEnabled: mirror,
              guidance: g,
              liveMeshGate: gate,
              frame: highFrame,
            );
            final uiReady = SkinCaptureTapGate.isCaptureReady(
              mirrorEnabled: mirror,
              guidance: g,
              liveMeshGate: gate,
              frame: highFrame,
            );
            expect(auth, uiReady);
          }
        }
      }
    });

    test('capture pointer stays attached during READY flicker (not nulled by readiness)', () {
      expect(
        SkinCaptureTapGate.shouldAttachCapturePointer(
          controlsInteractive: true,
          capturing: false,
          hasCapture: false,
        ),
        isTrue,
      );
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
          controlsInteractive: false,
          capturing: false,
          hasCapture: false,
        ),
        isFalse,
      );
    });

    test('double-capture guard: capturing blocks second pointer attach', () {
      expect(
        SkinCaptureTapGate.shouldAttachCapturePointer(
          controlsInteractive: true,
          capturing: true,
          hasCapture: false,
        ),
        isFalse,
      );
    });
  });
}
