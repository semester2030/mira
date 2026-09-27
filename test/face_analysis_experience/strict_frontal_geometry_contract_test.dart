import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/face_gate/face_gate_rules.dart';
import 'package:mirra/features/face_analysis_experience/capture/contracts/face_capture_semantic.dart';
import 'package:mirra/features/face_analysis_experience/capture/policy/strict_frontal_capture_policy.dart';
import 'package:mirra/features/intelligence/presentation/widgets/beauty_report_face_map/luxury_face_geometry.dart';
import 'package:mirra/features/results_experience/presentation/geometry/landmark_aligned_face_geometry.dart';
import 'package:mirra/features/skin_analysis/presentation/utils/face_image_processor.dart';

void main() {
  group('Strict frontal geometry contract', () {
    test('Skin strict policy exposes evidence-derived limits', () {
      const p = StrictFrontalCapturePolicy.readiness;
      expect(p.maxYawDegrees, 15);
      expect(p.maxPitchDegrees, 15);
      expect(p.maxRollDegrees, 12);
      expect(p.maxCenterOffsetX, 0.13);
      expect(p.maxCenterOffsetY, 0.11);
      expect(p.minFaceHeightVsGuide, 0.74);
      expect(p.maxFaceHeightVsGuide, 1.06);
      expect(p.version, StrictFrontalCapturePolicy.version);
    });

    test('strict gate fails closed outside Skin yaw/pitch/roll limits', () {
      expect(
        FaceGateRules.evaluate(
          faceCount: 1,
          faceAreaRatio: 0.25,
          headYawDegrees: 15.01,
          limits: StrictFrontalCapturePolicy.gateLimits,
        ).reasonCode,
        'head_turned',
      );
      expect(
        FaceGateRules.evaluate(
          faceCount: 1,
          faceAreaRatio: 0.25,
          headPitchDegrees: 15.01,
          limits: StrictFrontalCapturePolicy.gateLimits,
        ).reasonCode,
        'head_pitch',
      );
      expect(
        FaceGateRules.evaluate(
          faceCount: 1,
          faceAreaRatio: 0.25,
          headRollDegrees: 12.01,
          limits: StrictFrontalCapturePolicy.gateLimits,
        ).reasonCode,
        'head_tilted',
      );
    });

    test('strict centering tolerance is tighter than legacy cq', () {
      expect(
        FaceGateRules.evaluate(
          faceCount: 1,
          faceAreaRatio: 0.25,
          centerOffsetXRatio: 0.1301,
          limits: StrictFrontalCapturePolicy.gateLimits,
        ).reasonCode,
        'face_off_center',
      );
      expect(
        FaceGateRules.evaluate(
          faceCount: 1,
          faceAreaRatio: 0.25,
          centerOffsetYRatio: 0.1101,
          limits: StrictFrontalCapturePolicy.gateLimits,
        ).reasonCode,
        'face_off_center_vertical',
      );
    });

    test('same-image contract recognizes canonical aligned capture path', () {
      expect(
        FaceImageProcessor.isCanonicalAlignedCapturePath(
          '/tmp/${FaceAlignmentLimits.alignedNamePrefix}123.jpg',
        ),
        isTrue,
      );
      expect(
        FaceImageProcessor.isCanonicalAlignedCapturePath('/tmp/capture.jpg'),
        isFalse,
      );
    });

    test('LuxuryFaceGeometry retained only for history illustration disposition', () {
      expect(
        LandmarkAlignedFaceGeometry.disposition.contains(
          'RETAIN_ONLY_FOR_HISTORY_ILLUSTRATION',
        ),
        isTrue,
      );
      expect(LuxuryFaceGeometry.regionNorm('cheeks_left'), isNotNull);
      expect(LuxuryFaceGeometry.regionNorm('cheeks_right'), isNotNull);
    });

    test('strict frontal states retain exact pose reason internally', () {
      expect(PoseKind.turnLeft.name, 'turnLeft');
      expect(PoseKind.turnRight.name, 'turnRight');
      expect(PoseKind.straighten.name, 'straighten');
    });
  });
}
