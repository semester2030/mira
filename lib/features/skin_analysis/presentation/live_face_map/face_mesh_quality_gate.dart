import 'dart:ui';

import '../../../../core/face_gate/face_gate_result.dart';
import 'models/face_mesh_models.dart';

/// Live MediaPipe guidance only — never claims skin analysis.
/// Messages: AR + EN, short, professional, accessible.
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
        messageEn: 'No face found — keep your face inside the guide.',
      );
    }

    if (frame.quality == FaceTrackingQuality.low) {
      return const FaceGateResult.rejected(
        reasonCode: 'mesh_low_quality',
        messageAr: 'ثبّتي الجوال · حسّني الإضاءة · انظري للكاميرا.',
        messageEn: 'Hold still · improve lighting · look at the camera.',
      );
    }

    for (final id in _requiredIds) {
      final active = frame.regions.where(
        (r) => r.id == id && r.points.length >= 3 && !r.suppressed,
      );
      if (active.isEmpty) {
        return FaceGateResult.rejected(
          reasonCode: 'mesh_region_missing',
          messageAr: _missingRegionMessageAr(id),
          messageEn: _missingRegionMessageEn(id),
        );
      }
    }

    final box = frame.boundingBox;
    if (box == null) {
      return const FaceGateResult.rejected(
        reasonCode: 'mesh_no_bounds',
        messageAr: 'تعذر تحديد حدود الوجه — أعيدي المحاولة.',
        messageEn: 'Could not locate face bounds — try again.',
      );
    }

    final driftX =
        (box.center.dx - guideRect.center.dx).abs() / guideRect.width;
    final driftY =
        (box.center.dy - guideRect.center.dy).abs() / guideRect.height;
    if (driftX > maxCenterDriftX || driftY > maxCenterDriftY) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_off_center',
        messageAr: 'ضعّي وجهك في المنتصف داخل الإطار.',
        messageEn: 'Center your face in the guide frame.',
      );
    }

    final heightRatio = box.height / guideRect.height;
    if (heightRatio < minFaceHeightRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_far',
        messageAr: 'قرّبي الكاميرا — الوجه بعيد.',
        messageEn: 'Move closer — face is too far.',
      );
    }
    if (heightRatio > maxFaceHeightRatio) {
      return const FaceGateResult.rejected(
        reasonCode: 'face_too_close',
        messageAr: 'تراجعي قليلاً — الوجه قريب جداً.',
        messageEn: 'Move farther — face is too close.',
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

  static String _missingRegionMessageAr(FaceRegionId id) => switch (id) {
        FaceRegionId.forehead => 'ارفعي ذقنك قليلاً — الجبهة غير واضحة.',
        FaceRegionId.underEye => 'أظهري العينين بوضوح.',
        FaceRegionId.nose => 'انظري مباشرة للكاميرا — الأنف غير واضح.',
        FaceRegionId.cheek => 'أبعدي الشعر أو العائق عن الخدين.',
        FaceRegionId.chin => 'أظهري الذقن كاملاً داخل الإطار.',
        _ => 'أزيلي أي عائق عن الوجه وأعيدي المحاولة.',
      };

  static String _missingRegionMessageEn(FaceRegionId id) => switch (id) {
        FaceRegionId.forehead => 'Lift your chin slightly — forehead unclear.',
        FaceRegionId.underEye => 'Keep both eyes clearly visible.',
        FaceRegionId.nose => 'Look straight at the camera — nose unclear.',
        FaceRegionId.cheek => 'Move hair or obstruction away from cheeks.',
        FaceRegionId.chin => 'Keep your chin fully inside the frame.',
        _ => 'Remove any face obstruction and try again.',
      };
}
