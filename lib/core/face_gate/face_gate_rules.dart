import '../../features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart';
import 'face_gate_result.dart';

/// Explicit limits for [FaceGateRules.evaluate].
class FaceGateLimits {
  final double minFaceAreaRatio;
  final double maxFaceAreaRatio;
  final double maxYawDegrees;
  final double maxPitchDegrees;
  final double maxRollDegrees;
  final double maxCenterOffsetXRatio;
  final double maxCenterOffsetYRatio;

  const FaceGateLimits({
    required this.minFaceAreaRatio,
    required this.maxFaceAreaRatio,
    required this.maxYawDegrees,
    required this.maxPitchDegrees,
    required this.maxRollDegrees,
    required this.maxCenterOffsetXRatio,
    required this.maxCenterOffsetYRatio,
  });

  /// Legacy cq-thresholds-v2.1 (Face Intelligence / non-Skin paths).
  static const FaceGateLimits legacyCqV21 = FaceGateLimits(
    minFaceAreaRatio: CaptureQualityThresholds.minFaceAreaRatio,
    maxFaceAreaRatio: CaptureQualityThresholds.maxFaceAreaRatio,
    maxYawDegrees: CaptureQualityThresholds.maxYawDegrees,
    maxPitchDegrees: CaptureQualityThresholds.maxPitchDegrees,
    maxRollDegrees: CaptureQualityThresholds.maxRollDegrees,
    maxCenterOffsetXRatio: FaceGateRules.maxCenterOffsetXRatio,
    maxCenterOffsetYRatio: FaceGateRules.maxCenterOffsetYRatio,
  );
}

/// Pure rules — shared by validator and unit tests.
/// Default limits remain cq-thresholds-v2.1; Skin passes [StrictFrontalCapturePolicy].
abstract final class FaceGateRules {
  FaceGateRules._();

  static double get minFaceAreaRatio =>
      CaptureQualityThresholds.minFaceAreaRatio;
  static double get maxFaceAreaRatio =>
      CaptureQualityThresholds.maxFaceAreaRatio;
  static double get maxHeadYawDegrees => CaptureQualityThresholds.maxYawDegrees;
  static double get maxHeadPitchDegrees =>
      CaptureQualityThresholds.maxPitchDegrees;
  static double get maxHeadRollDegrees =>
      CaptureQualityThresholds.maxRollDegrees;

  /// Face center vs image center (fraction of image width/height).
  static const maxCenterOffsetXRatio = 0.13;
  static const maxCenterOffsetYRatio = 0.11;

  static FaceGateResult evaluatePresenceAndArea({
    required int faceCount,
    required double faceAreaRatio,
  }) {
    if (faceCount == 0) {
      return const FaceGateResult.rejected(
        reasonCode: 'no_face',
        messageAr:
            'لم نتعرف على وجه — التقطي selfie واضح وثبّتي وجهك في منتصف الإطار.',
        messageEn:
            'No face detected — take a clear selfie and center your face.',
      );
    }

    if (faceCount > 1) {
      return const FaceGateResult.rejected(
        reasonCode: 'multiple_faces',
        messageAr: 'وجدنا أكثر من وجه — التقطي صورة لوجه واحد فقط.',
        messageEn: 'Multiple faces detected — capture one face only.',
      );
    }

    if (faceAreaRatio < minFaceAreaRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_small',
        messageAr: 'الوجه بعيد جداً — قرّبي الكاميرا حتى يملأ الإطار.',
        messageEn: 'Face too far — move closer until it fills the frame.',
      );
    }

    if (faceAreaRatio > maxFaceAreaRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_large',
        messageAr:
            'الوجه قريب جداً أو مقصوص — تراجعي قليلاً حتى يظهر الوجه كاملاً.',
        messageEn: 'Face too close or cropped — move back slightly.',
      );
    }

    return const FaceGateResult.accepted();
  }

  static FaceGateResult evaluate({
    required int faceCount,
    required double faceAreaRatio,
    double? headYawDegrees,
    double? headPitchDegrees,
    double? headRollDegrees,
    double? centerOffsetXRatio,
    double? centerOffsetYRatio,
    FaceGateLimits limits = FaceGateLimits.legacyCqV21,
  }) {
    if (faceCount == 0) {
      return const FaceGateResult.rejected(
        reasonCode: 'no_face',
        messageAr: 'أظهري الوجه كاملًا داخل الإطار',
        messageEn:
            'No face detected — take a clear selfie and center your face.',
      );
    }

    if (faceCount > 1) {
      return const FaceGateResult.rejected(
        reasonCode: 'multiple_faces',
        messageAr: 'وجدنا أكثر من وجه — التقطي صورة لوجه واحد فقط.',
        messageEn: 'Multiple faces detected — capture one face only.',
      );
    }

    if (faceAreaRatio < limits.minFaceAreaRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_small',
        messageAr: 'قرّبي الهاتف قليلًا',
        messageEn: 'Face too far — move closer until it fills the frame.',
      );
    }

    if (faceAreaRatio > limits.maxFaceAreaRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_large',
        messageAr: 'أبعدي الهاتف قليلًا',
        messageEn: 'Face too close or cropped — move back slightly.',
      );
    }

    if (headYawDegrees != null &&
        headYawDegrees.abs() > limits.maxYawDegrees) {
      return const FaceGateResult.rejected(
        reasonCode: 'head_turned',
        messageAr: 'انظري مباشرة إلى الكاميرا',
        messageEn: 'Look straight at the camera — no side turn.',
      );
    }

    if (headPitchDegrees != null &&
        headPitchDegrees.abs() > limits.maxPitchDegrees) {
      final lookUp = headPitchDegrees > 0;
      return FaceGateResult.rejected(
        reasonCode: 'head_pitch',
        messageAr: lookUp ? 'اخفضي رأسك قليلًا' : 'ارفعي رأسك قليلًا',
        messageEn: lookUp
            ? 'Lower your chin slightly.'
            : 'Raise your chin slightly.',
      );
    }

    if (headRollDegrees != null &&
        headRollDegrees.abs() > limits.maxRollDegrees) {
      return const FaceGateResult.rejected(
        reasonCode: 'head_tilted',
        messageAr: 'اجعلي رأسك مستقيمًا',
        messageEn: 'Straighten your head — look directly at the camera.',
      );
    }

    if (centerOffsetXRatio != null &&
        centerOffsetXRatio.abs() > limits.maxCenterOffsetXRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_off_center',
        messageAr: 'ضعي وجهك في منتصف الإطار',
        messageEn: 'Center your face inside the guide frame.',
      );
    }

    if (centerOffsetYRatio != null &&
        centerOffsetYRatio.abs() > limits.maxCenterOffsetYRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_off_center_vertical',
        messageAr: 'أظهري الوجه كاملًا داخل الإطار',
        messageEn: 'Adjust vertical position — keep forehead and chin in frame.',
      );
    }

    return const FaceGateResult.accepted();
  }

  static double faceAreaRatio({
    required double boxWidth,
    required double boxHeight,
    required double imageWidth,
    required double imageHeight,
  }) {
    if (imageWidth <= 0 || imageHeight <= 0) return 0;
    final imageArea = imageWidth * imageHeight;
    return (boxWidth * boxHeight) / imageArea;
  }
}
