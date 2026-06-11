import 'dart:ui';

import '../../../../core/face_gate/face_gate_result.dart';
import 'models/face_mesh_models.dart';

/// Stricter gate using MediaPipe regions — blocks capture when mapping is unreliable.
abstract final class FaceMeshQualityGate {
  static const _requiredIds = <FaceRegionId>[
    FaceRegionId.forehead,
    FaceRegionId.underEye,
    FaceRegionId.nose,
    FaceRegionId.cheek,
    FaceRegionId.chin,
  ];

  /// Max drift of face center from guide center (fraction of guide size).
  static const maxCenterDriftX = 0.11;
  static const maxCenterDriftY = 0.10;

  /// Face height vs guide height — must fill the oval without clipping.
  static const minFaceHeightRatio = 0.74;
  static const maxFaceHeightRatio = 1.06;

  static FaceGateResult evaluate(FaceMeshFrame frame, Rect guideRect) {
    if (!frame.hasFace) {
      return const FaceGateResult.rejected(
        reasonCode: 'mesh_no_face',
        messageAr: 'لم نتعرف على الوجه — ثبّتي وجهك داخل الإطار.',
      );
    }

    if (frame.quality == FaceTrackingQuality.low) {
      return const FaceGateResult.rejected(
        reasonCode: 'mesh_low_quality',
        messageAr:
            'جودة التتبع ضعيفة — ثبّتي الجوال، حسّني الإضاءة، وانظري للكاميرا مباشرة.',
      );
    }

    for (final id in _requiredIds) {
      final active = frame.regions.where(
        (r) => r.id == id && r.points.length >= 3 && !r.suppressed,
      );
      if (active.isEmpty) {
        return FaceGateResult.rejected(
          reasonCode: 'mesh_region_missing',
          messageAr: _missingRegionMessage(id),
        );
      }
    }

    final box = frame.boundingBox;
    if (box == null) {
      return const FaceGateResult.rejected(
        reasonCode: 'mesh_no_bounds',
        messageAr: 'تعذر تحديد حدود الوجه — أعيدي المحاولة.',
      );
    }

    final driftX = (box.center.dx - guideRect.center.dx).abs() / guideRect.width;
    final driftY = (box.center.dy - guideRect.center.dy).abs() / guideRect.height;
    if (driftX > maxCenterDriftX || driftY > maxCenterDriftY) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_off_center',
        messageAr:
            'الوجه ليس في المنتصف — حرّكي وجهك داخل الإطار الذهبي ثم التقطي.',
      );
    }

    final heightRatio = box.height / guideRect.height;
    if (heightRatio < minFaceHeightRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_far',
        messageAr: 'الوجه بعيد — قرّبي الكاميرا حتى يملأ الإطار.',
      );
    }
    if (heightRatio > maxFaceHeightRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_close',
        messageAr: 'الوجه قريب جداً — تراجعي قليلاً حتى يظهر كاملاً.',
      );
    }

    return const FaceGateResult.accepted();
  }

  /// Strict validation after capture (optional).
  static bool isReadyForCapture(FaceMeshFrame frame, Rect guideRect) =>
      evaluate(frame, guideRect).isAccepted;

  /// Shutter enabled when the mesh sees a face with acceptable tracking.
  static bool canTakePhoto(FaceMeshFrame frame) =>
      frame.hasFace && frame.quality != FaceTrackingQuality.low;

  static String _missingRegionMessage(FaceRegionId id) => switch (id) {
        FaceRegionId.forehead =>
          'تعذر تحديد الجبهة بدقة — ارفعي ذقنك قليلاً وثبّتي الرأس.',
        FaceRegionId.underEye =>
          'تعذر تحديد منطقة تحت العين — تأكدي من وضوح العينين.',
        FaceRegionId.nose =>
          'تعذر تحديد الأنف بدقة — وجّهي وجهك نحو الكاميرا.',
        FaceRegionId.cheek =>
          'تعذر تحديد الخدين بدقة — أبقي وجهك داخل الإطار.',
        FaceRegionId.chin =>
          'تعذر تحديد الذقن بدقة — أظهري الذقن كاملاً داخل الإطار.',
        _ => 'تعذر تحديد مناطق الوجه — أعيدي المحاولة.',
      };
}
