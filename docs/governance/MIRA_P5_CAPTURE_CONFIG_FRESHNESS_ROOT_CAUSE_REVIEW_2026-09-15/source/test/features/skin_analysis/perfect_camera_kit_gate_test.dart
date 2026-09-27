import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/presentation/capture/perfect_camera_kit_gate.dart';

void main() {
  group('PerfectCameraKitQuality mapping', () {
    test('does not invent degree 0 as a real measurement', () {
      final q = PerfectCameraKitQuality.fromMap({
        'ready': false,
        'isValid': true,
        'faceAreaOk': true,
        'facePoseOk': false,
        'lightingOk': true,
        'faceArea': 'good',
        'facePose': 'bad',
        'lighting': 'normal',
        'facePoseDegree': 0.0,
        'facePoseDegreeReliable': false,
        'guidanceCode': 'look_straight',
        'sessionId': 3,
      });
      expect(q.facePoseDegree, isNull);
      expect(q.facePoseDegreeReliable, isFalse);
      expect(q.sessionId, 3);
      expect(q.isValid, isTrue);
      expect(q.lightingOk, isTrue);
      expect(q.facePoseOk, isFalse);
    });

    test('accepts reliable non-zero degree', () {
      final q = PerfectCameraKitQuality.fromMap({
        'ready': true,
        'isValid': true,
        'faceAreaOk': true,
        'facePoseOk': true,
        'lightingOk': true,
        'faceArea': 'good',
        'facePose': 'good',
        'lighting': 'good',
        'facePoseDegree': 4.5,
        'facePoseDegreeReliable': true,
        'guidanceCode': 'ready',
        'sessionId': 1,
      });
      expect(q.facePoseDegree, 4.5);
      expect(q.ready, isTrue);
    });

    test('guidance and stable window constants', () {
      expect(PerfectCameraKitGate.stableWindow, const Duration(milliseconds: 800));
      expect(PerfectCameraKitGate.qualityFreshness, const Duration(milliseconds: 350));
      expect(
        PerfectCameraKitQuality.fromMap({
          'ready': false,
          'isValid': false,
          'faceAreaOk': false,
          'facePoseOk': false,
          'lightingOk': false,
          'guidanceCode': 'lighting_low',
          'facePoseDegreeReliable': false,
          'sessionId': 0,
        }).guidanceAr,
        'حسّني الإضاءة أمام وجهك',
      );
    });
  });
}
