import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_body_pose_metrics.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_capture_validation.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_capture_rules.dart';

void main() {
  group('OutfitLiveCapture rules', () {
    const fullBodyPose = OutfitBodyPoseMetrics(
      personDetected: true,
      headDetected: true,
      shouldersDetected: true,
      torsoDetected: true,
      legsDetected: true,
      feetDetected: true,
    );

    OutfitCaptureFrameMetrics metrics({OutfitBodyPoseMetrics pose = fullBodyPose}) {
      return OutfitCaptureFrameMetrics(
        brightness: 0.5,
        blurScore: 8,
        faceCount: 1,
        faceAreaRatio: 0.05,
        faceCenterYNormalized: 0.18,
        faceBottomYNormalized: 0.28,
        pose: pose,
      );
    }

    test('live mode allows capture while showing pose hints', () {
      final withHint = OutfitCaptureRules.evaluateLive(
        metrics(
          pose: const OutfitBodyPoseMetrics(
            personDetected: true,
            headDetected: true,
            shouldersDetected: true,
            torsoDetected: true,
            legsDetected: true,
            feetDetected: false,
          ),
        ),
      );
      expect(withHint.isValid, isTrue);
      expect(withHint.hint, OutfitCaptureHint.feetNotVisible);

      final invalid = OutfitCaptureRules.evaluateLive(
        metrics(pose: OutfitBodyPoseMetrics.none),
      );
      expect(invalid.isValid, isTrue);
      expect(invalid.hint, OutfitCaptureHint.bodyNotDetected);
    });

    test('shows feet hint when ankles missing', () {
      final result = OutfitCaptureRules.evaluateLive(
        metrics(
          pose: const OutfitBodyPoseMetrics(
            personDetected: true,
            headDetected: true,
            shouldersDetected: true,
            torsoDetected: true,
            legsDetected: true,
            feetDetected: false,
          ),
        ),
      );

      expect(result.isValid, isTrue);
      expect(result.hint, OutfitCaptureHint.feetNotVisible);
      expect(result.hintAr, 'الحذاء غير ظاهر');
    });

    test('still mode accepts photo with partial pose when quality is good', () {
      final result = OutfitCaptureRules.evaluateStill(
        metrics(
          pose: const OutfitBodyPoseMetrics(
            personDetected: true,
            headDetected: true,
            shouldersDetected: true,
            torsoDetected: true,
            legsDetected: false,
            feetDetected: false,
          ),
        ),
      );

      expect(result.isValid, isTrue);
    });

    test('quality gates remain deterministic', () {
      final lowLight = OutfitCaptureRules.evaluateLive(
        OutfitCaptureFrameMetrics(
          brightness: 0.1,
          blurScore: 8,
          faceCount: 1,
          faceAreaRatio: 0.05,
          faceCenterYNormalized: 0.18,
          faceBottomYNormalized: 0.28,
          pose: fullBodyPose,
        ),
      );

      expect(lowLight.hint, OutfitCaptureHint.lowLight);
    });
  });
}
