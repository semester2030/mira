import 'face_gate_result.dart';

/// Pure rules — shared by validator and unit tests.
abstract final class FaceGateRules {
  FaceGateRules._();

  /// Minimum face bounding-box area vs full image (5%).
  static const minFaceAreaRatio = 0.05;

  /// Maximum face area — avoids extreme crops that are not full-face selfies.
  static const maxFaceAreaRatio = 0.95;

  static const maxHeadYawDegrees = 42.0;
  static const maxHeadRollDegrees = 32.0;

  /// Face center vs image center (fraction of image width/height).
  static const maxCenterOffsetXRatio = 0.13;
  static const maxCenterOffsetYRatio = 0.11;

  static FaceGateResult evaluate({
    required int faceCount,
    required double faceAreaRatio,
    double? headYawDegrees,
    double? headRollDegrees,
    double? centerOffsetXRatio,
    double? centerOffsetYRatio,
  }) {
    if (faceCount == 0) {
      return const FaceGateResult.rejected(
        reasonCode: 'no_face',
        messageAr:
            'لم نتعرف على وجه — التقطي selfie واضح وثبّتي وجهك في منتصف الإطار.',
      );
    }

    if (faceCount > 1) {
      return const FaceGateResult.rejected(
        reasonCode: 'multiple_faces',
        messageAr:
            'وجدنا أكثر من وجه — التقطي صورة لوجه واحد فقط.',
      );
    }

    if (faceAreaRatio < minFaceAreaRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_small',
        messageAr:
            'الوجه بعيد جداً — قرّبي الكاميرا حتى يملأ الإطار.',
      );
    }

    if (faceAreaRatio > maxFaceAreaRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_large',
        messageAr:
            'الوجه قريب جداً أو مقصوص — تراجعي قليلاً حتى يظهر الوجه كاملاً.',
      );
    }

    if (headYawDegrees != null &&
        headYawDegrees.abs() > maxHeadYawDegrees) {
      return const FaceGateResult.rejected(
        reasonCode: 'head_turned',
        messageAr:
            'وجّهي وجهك نحو الكاميرا مباشرة — لا التفات جانبي.',
      );
    }

    if (headRollDegrees != null &&
        headRollDegrees.abs() > maxHeadRollDegrees) {
      return const FaceGateResult.rejected(
        reasonCode: 'head_tilted',
        messageAr:
            'عدّلي زاوية الرأس — انظري للكاميرا بشكل مستقيم.',
      );
    }

    if (centerOffsetXRatio != null &&
        centerOffsetXRatio.abs() > maxCenterOffsetXRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_off_center',
        messageAr:
            'الوجه ليس في المنتصف — ثبّتي وجهك داخل الإطار الذهبي.',
      );
    }

    if (centerOffsetYRatio != null &&
        centerOffsetYRatio.abs() > maxCenterOffsetYRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_off_center_vertical',
        messageAr:
            'عدّلي موضع الوجه عمودياً — اجعلي الجبهة والذقن داخل الإطار.',
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
