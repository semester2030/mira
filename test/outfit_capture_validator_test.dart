import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_body_pose_metrics.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_capture_validation.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_capture_rules.dart';

void main() {
  group('OutfitCaptureRules', () {
    const fullBodyPose = OutfitBodyPoseMetrics(
      personDetected: true,
      headDetected: true,
      shouldersDetected: true,
      torsoDetected: true,
      legsDetected: true,
      feetDetected: true,
    );

    OutfitCaptureFrameMetrics fullMetrics({
      OutfitBodyPoseMetrics pose = fullBodyPose,
      double brightness = 0.45,
      double blurScore = 12,
    }) {
      return OutfitCaptureFrameMetrics(
        brightness: brightness,
        blurScore: blurScore,
        faceCount: 1,
        faceAreaRatio: 0.05,
        faceCenterYNormalized: 0.18,
        faceBottomYNormalized: 0.28,
        pose: pose,
      );
    }

    test('live mode accepts full body pose with good quality', () {
      final result = OutfitCaptureRules.evaluateLive(fullMetrics());
      expect(result.isValid, isTrue);
      expect(result.hint, isNull);
    });

    test('still mode accepts photo with full body pose', () {
      final result = OutfitCaptureRules.evaluateStill(fullMetrics());
      expect(result.isValid, isTrue);
    });

    test('rejects low brightness with Arabic hint', () {
      final result = OutfitCaptureRules.evaluateStill(
        fullMetrics(brightness: 0.12),
      );

      expect(result.isValid, isFalse);
      expect(result.hint, OutfitCaptureHint.lowLight);
      expect(result.hintAr, 'الإضاءة ضعيفة');
    });

    test('rejects blurry still frames', () {
      final result = OutfitCaptureRules.evaluateStill(
        fullMetrics(blurScore: 5),
      );

      expect(result.hint, OutfitCaptureHint.blurry);
      expect(result.hintAr, 'الصورة غير واضحة');
    });

    test('asks user to move closer when face is too small', () {
      final result = OutfitCaptureRules.evaluateStill(
        OutfitCaptureFrameMetrics(
          brightness: 0.5,
          blurScore: 20,
          faceCount: 1,
          faceAreaRatio: 0.002,
          faceCenterYNormalized: 0.16,
          faceBottomYNormalized: 0.24,
          pose: OutfitBodyPoseMetrics.none,
        ),
      );

      expect(result.isValid, isFalse);
      expect(result.hint, OutfitCaptureHint.moveCloser);
      expect(result.hintAr, 'اقتربي قليلاً');
    });

    test('asks for full outfit when face dominates frame', () {
      final result = OutfitCaptureRules.evaluateStill(
        OutfitCaptureFrameMetrics(
          brightness: 0.5,
          blurScore: 20,
          faceCount: 1,
          faceAreaRatio: 0.28,
          faceCenterYNormalized: 0.28,
          faceBottomYNormalized: 0.48,
          pose: OutfitBodyPoseMetrics.none,
        ),
      );

      expect(result.isValid, isFalse);
      expect(result.hint, OutfitCaptureHint.showFullOutfit);
      expect(result.hintAr, 'أظهري كامل الإطلالة');
    });

    test('rejects when feet are not visible in live hints only', () {
      final result = OutfitCaptureRules.evaluateLive(
        fullMetrics(
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
  });
}
