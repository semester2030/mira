import 'dart:io';
import 'dart:math' as math;

import 'package:image/image.dart' as img;
import '../entities/outfit_capture_validation.dart';
import '../entities/outfit_photo_trust.dart';
import '../helpers/outfit_person_mask.dart';

/// Pre-capture trust gate — rejects screenshots, UI mockups, and non-outfit photos.
/// Reference: docs/mira-garment-recolor.html (privacy + trust charter)
abstract final class OutfitPhotoTrustGate {
  OutfitPhotoTrustGate._();

  static const minBodyHeightRatio = 0.36;
  static const minTrackingScore = 0.44;
  static const minFaceAreaRatio = 0.003;
  static const maxFaceAreaRatio = 0.24;

  static Future<OutfitPhotoTrustResult> evaluateFile(File file) async {
    if (!await file.exists()) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'missing_file',
        messageAr: 'لم نستلم صورة — أعيدي التقاط الإطلالة',
      );
    }

    final bytes = await file.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'decode_failed',
        messageAr: 'تعذّر قراءة الصورة — استخدمي JPG أو PNG واضح',
      );
    }

    final oriented = img.bakeOrientation(decoded);
    return evaluateImageOnly(oriented);
  }

  /// Still capture — requires pose + face metrics from ML Kit.
  static OutfitPhotoTrustResult evaluateStill({
    required OutfitCaptureFrameMetrics metrics,
    required img.Image image,
  }) {
    final poseResult = _evaluatePoseAndFace(metrics);
    if (poseResult.isAccepted) {
      // ML Kit verified person + face — accept studio / gallery / camera stills.
      return OutfitPhotoTrustResult.accepted;
    }

    // Face visible but pose weak — lenient path for saved gallery / studio shots.
    if (_isLenientGalleryStill(metrics)) {
      if (!_looksLikeScreenOrMarketing(image)) {
        return OutfitPhotoTrustResult.accepted;
      }
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'screen_or_marketing',
        messageAr:
            'هذه تبدو كسكرينشوت أو إعلان — اختاري صورة حقيقية لإطلالتك (جسم كامل)',
      );
    }

    return poseResult;
  }

  /// Saved photo with a clear face — do not require perfect pose landmarks.
  static bool _isLenientGalleryStill(OutfitCaptureFrameMetrics metrics) {
    if (metrics.faceCount != 1) return false;
    if (metrics.brightness < 0.18 || metrics.blurScore < 6.0) return false;
    if (metrics.faceAreaRatio > maxFaceAreaRatio) return false;
    final bodyHeight = OutfitPersonMask.bounds(metrics.pose)?.height ?? 0;
    if (bodyHeight < minBodyHeightRatio) return false;
    final minFace = bodyHeight >= 0.48 ? 0.0012 : minFaceAreaRatio;
    if (metrics.faceAreaRatio < minFace) return false;
    return metrics.pose.personDetected || metrics.pose.headDetected;
  }

  static OutfitPhotoTrustResult evaluateImageOnly(img.Image image) {
    if (image.width < 480 || image.height < 480) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'too_small',
        messageAr: 'الصورة صغيرة — التقطي إطلالة كاملة بجودة أعلى',
      );
    }

    if (image.width > image.height * 1.08) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'landscape',
        messageAr: 'استخدمي صورة عمودية لإطلالتك الكاملة — وليس سكرينشوت أفقي',
      );
    }

    if (_looksLikeScreenOrMarketing(image)) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'screen_or_marketing',
        messageAr:
            'هذه تبدو كسكرينشوت أو إعلان — التقطي صورة حقيقية لإطلالتك (جسم كامل)',
      );
    }

    return OutfitPhotoTrustResult.accepted;
  }

  static OutfitPhotoTrustResult _evaluatePoseAndFace(OutfitCaptureFrameMetrics metrics) {
    final pose = metrics.pose;

    if (metrics.faceCount < 1) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'no_face',
        messageAr: 'يجب أن يظهر وجهك في الصورة — التقطي إطلالة كاملة أمام الكاميرا',
      );
    }

    if (metrics.faceCount > 2) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'multi_face',
        messageAr: 'اختاري صورة لكِ وحدك — بدون سكرينشوت أو collage',
      );
    }

    final bodyHeightForFace = OutfitPersonMask.bounds(pose)?.height ?? 0;
    final minFaceArea = bodyHeightForFace >= 0.48 ? 0.0012 : minFaceAreaRatio;
    if (metrics.faceAreaRatio > maxFaceAreaRatio ||
        metrics.faceAreaRatio < minFaceArea) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'face_framing',
        messageAr: 'قربي أو ابعدي قليلاً — وجهك يجب أن يكون واضحاً ضمن إطلالة كاملة',
      );
    }

    if (!pose.personDetected || !pose.headDetected) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'no_person',
        messageAr: 'لم نتعرف على شخص في الصورة — التقطي جسمك كاملاً داخل الإطار',
      );
    }

    if (!pose.shouldersDetected && !pose.torsoDetected && !pose.legsDetected) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'incomplete_body',
        messageAr: 'أظهري الكتفين والجسم — صورة وجه فقط لا تكفي لتحليل الإطلالة',
      );
    }

    if (pose.trackingScore < minTrackingScore) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'low_pose_tracking',
        messageAr: 'وضعية الجسم غير واضحة — التقطي صورة أوضح لإطلالتك الكاملة',
      );
    }

    final bounds = OutfitPersonMask.bounds(pose);
    if (bounds == null || bounds.height < minBodyHeightRatio) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'body_too_small',
        messageAr:
            'جسمك يظهر صغيراً في الصورة — قرّبي من الكاميرا أو تجنّبي سكرينشوتات التطبيقات',
      );
    }

    if (metrics.faceCenterYNormalized > 0.42 && bounds.height < 0.48) {
      return const OutfitPhotoTrustResult(
        isAccepted: false,
        reasonCode: 'embedded_face',
        messageAr:
            'يبدو أن الوجه داخل صورة أخرى — التقطي إطلالتك مباشرة من الكاميرا',
      );
    }

    return OutfitPhotoTrustResult.accepted;
  }

  static bool _looksLikeScreenOrMarketing(img.Image image) {
    final centerVar = _regionVariance(image, 0.22, 0.12, 0.78, 0.88);
    // Person / outfit in frame — studio backdrop + solid dress still has subject texture.
    if (centerVar >= 520) return false;

    final topVar = _regionVariance(image, 0, 0, 1, 0.07);
    final sideMean = (_regionMean(image, 0, 0.08, 0.1, 0.92) +
            _regionMean(image, 0.9, 0.08, 1, 0.92)) /
        2;
    final centerMean = _regionMean(image, 0.22, 0.14, 0.78, 0.86);

    final flatBlocks = _flatBlockCount(image);

    // Phone screenshot: flat status bar + inset content card on uniform sides.
    if (topVar < 120 &&
        flatBlocks >= 7 &&
        (centerMean - sideMean).abs() > 32 &&
        centerVar < 420) {
      return true;
    }

    // Marketing card / app UI — flat everywhere including the center (no subject).
    if (flatBlocks >= 11 && topVar < 180 && centerVar < 380) return true;

    return false;
  }

  static int _flatBlockCount(img.Image image) {
    const cols = 6;
    const rows = 8;
    var flat = 0;
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        final left = col / cols;
        final top = row / rows;
        final right = (col + 1) / cols;
        final bottom = (row + 1) / rows;
        if (_regionVariance(image, left, top, right, bottom) < 420) {
          flat++;
        }
      }
    }
    return flat;
  }

  static double _regionMean(
    img.Image image,
    double left,
    double top,
    double right,
    double bottom,
  ) {
    final x0 = (left * image.width).round().clamp(0, image.width - 1);
    final y0 = (top * image.height).round().clamp(0, image.height - 1);
    final x1 = (right * image.width).round().clamp(x0 + 1, image.width);
    final y1 = (bottom * image.height).round().clamp(y0 + 1, image.height);

    var sum = 0.0;
    var count = 0;
    final stepX = math.max(1, (x1 - x0) ~/ 12);
    final stepY = math.max(1, (y1 - y0) ~/ 12);

    for (var y = y0; y < y1; y += stepY) {
      for (var x = x0; x < x1; x += stepX) {
        final p = image.getPixel(x, y);
        sum += (p.r + p.g + p.b) / 3;
        count++;
      }
    }
    return count == 0 ? 128 : sum / count;
  }

  static double _regionVariance(
    img.Image image,
    double left,
    double top,
    double right,
    double bottom,
  ) {
    final x0 = (left * image.width).round().clamp(0, image.width - 1);
    final y0 = (top * image.height).round().clamp(0, image.height - 1);
    final x1 = (right * image.width).round().clamp(x0 + 1, image.width);
    final y1 = (bottom * image.height).round().clamp(y0 + 1, image.height);

    final values = <double>[];
    final stepX = math.max(1, (x1 - x0) ~/ 10);
    final stepY = math.max(1, (y1 - y0) ~/ 10);

    for (var y = y0; y < y1; y += stepY) {
      for (var x = x0; x < x1; x += stepX) {
        final p = image.getPixel(x, y);
        values.add((p.r + p.g + p.b) / 3);
      }
    }
    if (values.length < 2) return 999;

    final mean = values.reduce((a, b) => a + b) / values.length;
    var sq = 0.0;
    for (final v in values) {
      final d = v - mean;
      sq += d * d;
    }
    return sq / values.length;
  }
}
