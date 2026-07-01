import '../entities/outfit_body_pose_metrics.dart';
import '../entities/outfit_capture_validation.dart';

/// Deterministic outfit framing rules — full body, not face-only.
abstract final class OutfitCaptureRules {
  OutfitCaptureRules._();

  static const minBrightness = 0.18;
  static const minBlurScoreStill = 8.0;
  static const minBlurScoreLive = 2.5;
  static const minFaceAreaRatio = 0.003;
  static const maxFaceAreaRatio = 0.24;
  static const maxFaceCenterY = 0.45;
  static const maxFaceBottomY = 0.52;

  /// Live camera — quality gates only. Pose shows hints but never blocks shutter.
  static OutfitCaptureValidationResult evaluateLive(OutfitCaptureFrameMetrics metrics) {
    final quality = _evaluateQuality(metrics);
    if (quality != null) return quality;

    final poseHint = _poseProgressHint(metrics.pose);
    if (poseHint != null) {
      return OutfitCaptureValidationResult(
        isValid: true,
        hint: poseHint,
        hintAr: hintMessage(poseHint),
        metrics: metrics,
      );
    }

    return OutfitCaptureValidationResult(
      isValid: true,
      hint: null,
      hintAr: 'الإطار جاهز — التقطي إطلالتك',
      metrics: metrics,
    );
  }

  /// Post-capture validation — stricter, but accepts realistic full-body photos.
  static OutfitCaptureValidationResult evaluateStill(OutfitCaptureFrameMetrics metrics) {
    final quality = _evaluateQuality(metrics, blurMin: minBlurScoreStill);
    if (quality != null) return quality;

    final pose = metrics.pose;
    if (pose.isFullBodyReady) {
      return _acceptStill(metrics);
    }

    if (pose.isCaptureAcceptable) {
      if (!pose.feetDetected) {
        return _acceptStill(
          metrics,
          hintAr: 'تم التقاط الصورة — حاولي إظهار الحذاء في الإطار',
        );
      }
      return _acceptStill(metrics);
    }

    if (metrics.faceCount > 0 &&
        metrics.brightness >= minBrightness &&
        metrics.blurScore >= minBlurScoreStill) {
      if (metrics.faceAreaRatio > maxFaceAreaRatio ||
          metrics.faceCenterYNormalized > maxFaceCenterY) {
        return _invalid(OutfitCaptureHint.showFullOutfit, metrics);
      }
      if (metrics.faceAreaRatio < minFaceAreaRatio) {
        return _invalid(OutfitCaptureHint.moveCloser, metrics);
      }
      return _acceptStill(
        metrics,
        hintAr: 'تم التقاط الإطلالة — تأكدي أن الجسم كاملاً داخل الإطار',
      );
    }

    if (!pose.personDetected && !pose.headDetected) {
      return _invalid(
        OutfitCaptureHint.bodyNotDetected,
        metrics,
        'ضعي جسمك بالكامل داخل الإطار',
      );
    }

    return _invalid(OutfitCaptureHint.showFullOutfit, metrics);
  }

  static OutfitCaptureHint? _poseProgressHint(OutfitBodyPoseMetrics pose) {
    if (!pose.personDetected && !pose.headDetected) {
      return OutfitCaptureHint.bodyNotDetected;
    }
    if (!pose.headDetected || !pose.shouldersDetected) {
      return OutfitCaptureHint.showFullOutfit;
    }
    if (!pose.torsoDetected || !pose.legsDetected) {
      return OutfitCaptureHint.showFullOutfit;
    }
    if (!pose.feetDetected) {
      return OutfitCaptureHint.feetNotVisible;
    }
    return null;
  }

  static OutfitCaptureValidationResult? _evaluateQuality(
    OutfitCaptureFrameMetrics metrics, {
    double blurMin = minBlurScoreLive,
  }) {
    if (metrics.brightness < minBrightness) {
      return _invalid(OutfitCaptureHint.lowLight, metrics);
    }
    if (metrics.blurScore < blurMin) {
      return _invalid(OutfitCaptureHint.blurry, metrics);
    }
    return null;
  }

  static String hintMessage(OutfitCaptureHint hint) {
    return switch (hint) {
      OutfitCaptureHint.moveCloser => 'اقتربي قليلاً',
      OutfitCaptureHint.showFullOutfit => 'أظهري كامل الإطلالة',
      OutfitCaptureHint.feetNotVisible => 'الحذاء غير ظاهر',
      OutfitCaptureHint.lowLight => 'الإضاءة ضعيفة',
      OutfitCaptureHint.blurry => 'الصورة غير واضحة',
      OutfitCaptureHint.bodyNotDetected => 'ضعي جسمك بالكامل داخل الإطار',
      OutfitCaptureHint.notOutfitPhoto =>
        'التقطي صورة إطلالة حقيقية — لا سكرينشوت ولا صور تطبيقات',
    };
  }

  static OutfitCaptureValidationResult _acceptStill(
    OutfitCaptureFrameMetrics metrics, {
    String hintAr = 'تم التقاط الإطلالة بنجاح',
  }) {
    return OutfitCaptureValidationResult(
      isValid: true,
      hint: null,
      hintAr: hintAr,
      metrics: metrics,
    );
  }

  static OutfitCaptureValidationResult _invalid(
    OutfitCaptureHint hint,
    OutfitCaptureFrameMetrics metrics, [
    String? customHintAr,
  ]) {
    return OutfitCaptureValidationResult(
      isValid: false,
      hint: hint,
      hintAr: customHintAr ?? hintMessage(hint),
      metrics: metrics,
    );
  }
}
