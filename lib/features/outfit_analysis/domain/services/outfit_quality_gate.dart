import 'dart:io';
import 'dart:math' as math;

import 'package:image/image.dart' as img;

import '../entities/outfit_capture_signals.dart';

class OutfitQualityResult {
  final bool passed;
  final String messageAr;
  final OutfitCaptureSignals signals;

  const OutfitQualityResult({
    required this.passed,
    required this.messageAr,
    required this.signals,
  });
}

/// Client-side outfit photo validation before upload.
abstract final class OutfitQualityGate {
  OutfitQualityGate._();

  static const _minEdge = 480;
  static const _maxEdge = 8000;
  static const _maxBytes = 12 * 1024 * 1024;
  static const _maxAspect = 2.8;

  static Future<OutfitQualityResult> evaluate(File file) async {
    if (!await file.exists()) {
      return const OutfitQualityResult(
        passed: false,
        messageAr: 'لم نستلم صورة — أعيدي رفع الإطلالة.',
        signals: OutfitCaptureSignals.neutral(),
      );
    }

    final bytes = await file.length();
    if (bytes > _maxBytes) {
      return const OutfitQualityResult(
        passed: false,
        messageAr: 'حجم الصورة كبير — استخدمي صورة أخف.',
        signals: OutfitCaptureSignals.neutral(),
      );
    }

    final raw = await file.readAsBytes();
    final decoded = img.decodeImage(raw);
    if (decoded == null) {
      return const OutfitQualityResult(
        passed: false,
        messageAr: 'تعذر قراءة الصورة — جرّبي JPG أو PNG واضح.',
        signals: OutfitCaptureSignals.neutral(),
      );
    }

    final image = img.bakeOrientation(decoded);
    if (image.width < _minEdge || image.height < _minEdge) {
      return const OutfitQualityResult(
        passed: false,
        messageAr:
            'الصورة صغيرة جداً — التقطي إطلالة كاملة بإضاءة جيدة (480px على الأقل).',
        signals: OutfitCaptureSignals.neutral(),
      );
    }

    if (image.width > _maxEdge || image.height > _maxEdge) {
      return const OutfitQualityResult(
        passed: false,
        messageAr: 'حجم الصورة كبير — استخدمي صورة أخف.',
        signals: OutfitCaptureSignals.neutral(),
      );
    }

    final shortEdge = math.min(image.width, image.height);
    final longEdge = math.max(image.width, image.height);
    if (longEdge / shortEdge > _maxAspect) {
      return const OutfitQualityResult(
        passed: false,
        messageAr: 'نسبة الصورة غير مناسبة — التقطي الإطلالة بشكل أوضح في الإطار.',
        signals: OutfitCaptureSignals.neutral(),
      );
    }

    final signals = OutfitCaptureSignals(
      lightingQuality: _estimateLighting(image),
      framingQuality: _estimateFraming(image.width, image.height),
      blurAmount: _estimateBlur(image),
    );

    return OutfitQualityResult(
      passed: true,
      messageAr: '',
      signals: signals,
    );
  }

  static double _estimateLighting(img.Image image) {
    final avg = _channelMean(image);
    if (avg < 55) return 0.42;
    if (avg < 75) return 0.58;
    if (avg > 215) return 0.55;
    if (avg > 190) return 0.68;
    return 0.82;
  }

  static double _estimateFraming(int width, int height) {
    final ratio = height / width;
    if (ratio >= 1.15 && ratio <= 2.1) return 0.86;
    if (ratio >= 0.95 && ratio <= 2.4) return 0.72;
    return 0.52;
  }

  static double _estimateBlur(img.Image image) {
    final stdev = _channelStdev(image);
    if (stdev < 18) return 0.42;
    if (stdev < 28) return 0.28;
    if (stdev < 38) return 0.16;
    return 0.08;
  }

  static double _channelMean(img.Image image) {
    var total = 0.0;
    var count = 0;
    final step = math.max(1, (image.width * image.height ~/ 8000));
    for (var y = 0; y < image.height; y += step) {
      for (var x = 0; x < image.width; x += step) {
        final p = image.getPixel(x, y);
        total += (p.r + p.g + p.b) / 3;
        count++;
      }
    }
    return count == 0 ? 128 : total / count;
  }

  static double _channelStdev(img.Image image) {
    final mean = _channelMean(image);
    var sumSq = 0.0;
    var count = 0;
    final step = math.max(1, (image.width * image.height ~/ 8000));
    for (var y = 0; y < image.height; y += step) {
      for (var x = 0; x < image.width; x += step) {
        final p = image.getPixel(x, y);
        final v = (p.r + p.g + p.b) / 3 - mean;
        sumSq += v * v;
        count++;
      }
    }
    if (count == 0) return 40;
    return math.sqrt(sumSq / count);
  }
}
