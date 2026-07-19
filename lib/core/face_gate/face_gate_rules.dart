import '../../features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart';
import 'face_gate_result.dart';

/// Pure rules — shared by validator and unit tests.
/// Pose / area limits come from [CaptureQualityThresholds] (Phase 2.1 unified).
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

  static FaceGateResult evaluate({
    required int faceCount,
    required double faceAreaRatio,
    double? headYawDegrees,
    double? headPitchDegrees,
    double? headRollDegrees,
    double? centerOffsetXRatio,
    double? centerOffsetYRatio,
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

    if (headYawDegrees != null &&
        headYawDegrees.abs() > maxHeadYawDegrees) {
      return const FaceGateResult.rejected(
        reasonCode: 'head_turned',
        messageAr: 'وجّهي وجهك نحو الكاميرا مباشرة — لا التفات جانبي.',
        messageEn: 'Look straight at the camera — no side turn.',
      );
    }

    if (headPitchDegrees != null &&
        headPitchDegrees.abs() > maxHeadPitchDegrees) {
      return const FaceGateResult.rejected(
        reasonCode: 'head_pitch',
        messageAr: 'عدّلي زاوية الرأس عمودياً — انظري للكاميرا مباشرة.',
        messageEn: 'Adjust vertical head angle — look straight at the camera.',
      );
    }

    if (headRollDegrees != null &&
        headRollDegrees.abs() > maxHeadRollDegrees) {
      return const FaceGateResult.rejected(
        reasonCode: 'head_tilted',
        messageAr: 'عدّلي زاوية الرأس — انظري للكاميرا بشكل مستقيم.',
        messageEn: 'Straighten your head — look directly at the camera.',
      );
    }

    if (centerOffsetXRatio != null &&
        centerOffsetXRatio.abs() > maxCenterOffsetXRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_off_center',
        messageAr: 'الوجه ليس في المنتصف — ثبّتي وجهك داخل الإطار الذهبي.',
        messageEn: 'Center your face inside the guide frame.',
      );
    }

    if (centerOffsetYRatio != null &&
        centerOffsetYRatio.abs() > maxCenterOffsetYRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_off_center_vertical',
        messageAr:
            'عدّلي موضع الوجه عمودياً — اجعلي الجبهة والذقن داخل الإطار.',
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
