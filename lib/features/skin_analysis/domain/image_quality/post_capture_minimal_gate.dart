import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

import '../../../../core/face_gate/face_gate_result.dart';
import '../../../../core/face_gate/face_gate_validator.dart';
import 'capture_quality_thresholds.dart';
import 'image_pixel_metrics.dart';

/// Post-capture gate for manual simple capture → analyze.
///
/// Hard rejects only when analysis is honestly impossible or Perfect HD will fail.
/// Does **not** apply the full legacy ImageQuality blocking set.
///
/// | Condition | Necessity |
/// |-----------|-----------|
/// | decode failure | required — no bytes |
/// | no face / multiple faces | required — Perfect is single-face |
/// | face area outside [0.05, 0.92] | required — extreme framing fails YouCam |
/// | short edge &lt; 1080 | required — Perfect HD (not SD 480) |
/// | blur Laplacian &lt; 28 | **advisory only** — threshold unverified vs HD success |
/// | brightness / exposure / shadow / pose / center | **not** local hard rejects |
abstract final class PostCaptureMinimalGate {
  PostCaptureMinimalGate._();

  /// Perfect HD Face Explorer — matches mira-api `HD_MIN_SHORT_SIDE`.
  static const int hdMinShortSidePx = 1080;

  static const version = 'post-capture-minimal-v1-hd1080';

  static Future<FaceGateResult> validate(File file) async {
    if (!await file.exists()) {
      return const FaceGateResult.rejected(
        reasonCode: 'missing_file',
        messageAr: 'لم يتم العثور على الصورة — أعيدي المحاولة.',
        messageEn: 'Image file missing — try again.',
      );
    }

    final bytes = await file.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      return const FaceGateResult.rejected(
        reasonCode: 'decode_failed',
        messageAr: 'تعذر قراءة الصورة — أعيدي الالتقاط.',
        messageEn: 'Could not read the image — retake the photo.',
      );
    }

    final oriented = img.bakeOrientation(decoded);
    final shortSide = math.min(oriented.width, oriented.height);
    if (shortSide < hdMinShortSidePx) {
      return FaceGateResult.rejected(
        reasonCode: 'resolution_below_hd',
        messageAr:
            'دقة الصورة غير كافية للتحليل المكاني — الضلع الأقصر '
            '$shortSide بكسل (المطلوب ≥ $hdMinShortSidePx). '
            'أعيدي الالتقاط بعد تحديث التطبيق؛ الاقتراب من الكاميرا لا يزيد دقة الملف.',
        messageEn:
            'Spatial analysis needs short side ≥ $hdMinShortSidePx px '
            '(got $shortSide). Retake after updating capture resolution; '
            'moving closer does not increase file pixel size.',
      );
    }

    final gate =
        await FaceGateValidator.instance.validatePresenceAndArea(file);
    if (!gate.isAccepted) {
      return gate;
    }

    // Advisory blur — never hard-block on cq-thresholds 28 without device proof.
    final blur = ImagePixelMetrics.blurLaplacianVariance(oriented);
    if (blur < CaptureQualityThresholds.minBlurVariance) {
      debugPrint(
        'Mira PostCaptureMinimalGate advisory_blur variance='
        '${blur.toStringAsFixed(1)} '
        'cq_min=${CaptureQualityThresholds.minBlurVariance} (not blocking)',
      );
    }

    return gate;
  }
}
