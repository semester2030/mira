import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/face_gate/face_gate_rules.dart';

void main() {
  group('FaceGateRules', () {
    test('rejects zero faces', () {
      final r = FaceGateRules.evaluate(faceCount: 0, faceAreaRatio: 0);
      expect(r.isAccepted, isFalse);
      expect(r.reasonCode, 'no_face');
    });

    test('rejects multiple faces', () {
      final r = FaceGateRules.evaluate(faceCount: 2, faceAreaRatio: 0.2);
      expect(r.isAccepted, isFalse);
      expect(r.reasonCode, 'multiple_faces');
    });

    test('rejects face too small in frame', () {
      final r = FaceGateRules.evaluate(faceCount: 1, faceAreaRatio: 0.03);
      expect(r.isAccepted, isFalse);
      expect(r.reasonCode, 'face_too_small');
    });

    test('accepts typical selfie face ratio', () {
      final r = FaceGateRules.evaluate(
        faceCount: 1,
        faceAreaRatio: 0.25,
        headYawDegrees: 5,
        headRollDegrees: 3,
      );
      expect(r.isAccepted, isTrue);
    });

    test('rejects strong head turn', () {
      final r = FaceGateRules.evaluate(
        faceCount: 1,
        faceAreaRatio: 0.3,
        headYawDegrees: 48,
      );
      expect(r.isAccepted, isFalse);
      expect(r.reasonCode, 'head_turned');
    });

    test('rejects horizontally off-center face', () {
      final r = FaceGateRules.evaluate(
        faceCount: 1,
        faceAreaRatio: 0.25,
        centerOffsetXRatio: 0.18,
      );
      expect(r.isAccepted, isFalse);
      expect(r.reasonCode, 'face_off_center');
    });
  });
}
