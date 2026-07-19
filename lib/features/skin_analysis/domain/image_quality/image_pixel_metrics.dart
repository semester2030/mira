import 'dart:math' as math;

import 'package:image/image.dart' as img;

/// Phase 2 — real pixel measurements (Laplacian blur, luminance stats).
/// Documented thresholds live in docs/architecture/image-quality.md
abstract final class ImagePixelMetrics {
  ImagePixelMetrics._();

  /// Mean luma 0–1.
  static double averageBrightness(img.Image image) {
    if (image.width < 2 || image.height < 2) return 0;
    var sum = 0.0;
    var count = 0;
    final yStep = math.max(1, image.height ~/ 72);
    final xStep = math.max(1, image.width ~/ 48);
    for (var y = 0; y < image.height; y += yStep) {
      for (var x = 0; x < image.width; x += xStep) {
        final p = image.getPixel(x, y);
        sum += _luma(p.r.toDouble(), p.g.toDouble(), p.b.toDouble());
        count++;
      }
    }
    return count == 0 ? 0 : (sum / count) / 255.0;
  }

  /// Std-dev of luma / 255 → 0–1 contrast proxy.
  static double contrastScore(img.Image image) {
    if (image.width < 2 || image.height < 2) return 0;
    final samples = <double>[];
    final yStep = math.max(1, image.height ~/ 72);
    final xStep = math.max(1, image.width ~/ 48);
    for (var y = 0; y < image.height; y += yStep) {
      for (var x = 0; x < image.width; x += xStep) {
        final p = image.getPixel(x, y);
        samples.add(_luma(p.r.toDouble(), p.g.toDouble(), p.b.toDouble()));
      }
    }
    if (samples.length < 2) return 0;
    final mean = samples.reduce((a, b) => a + b) / samples.length;
    var sumSq = 0.0;
    for (final s in samples) {
      final d = s - mean;
      sumSq += d * d;
    }
    final std = math.sqrt(sumSq / samples.length);
    return (std / 255.0).clamp(0.0, 1.0);
  }

  /// Laplacian variance on luma (higher = sharper). Typical selfie: 40–400+.
  static double blurLaplacianVariance(img.Image image) {
    final w = image.width;
    final h = image.height;
    if (w < 8 || h < 8) return 0;

    final xStep = math.max(1, w ~/ 48);
    final yStep = math.max(1, h ~/ 72);
    var sum = 0.0;
    var sumSq = 0.0;
    var count = 0;

    for (var y = yStep; y < h - yStep; y += yStep) {
      for (var x = xStep; x < w - xStep; x += xStep) {
        final c = _lumaAt(image, x, y);
        final lap = (-4 * c +
                _lumaAt(image, x - xStep, y) +
                _lumaAt(image, x + xStep, y) +
                _lumaAt(image, x, y - yStep) +
                _lumaAt(image, x, y + yStep))
            .abs();
        sum += lap;
        sumSq += lap * lap;
        count++;
      }
    }
    if (count == 0) return 0;
    final mean = sum / count;
    return math.max(0.0, (sumSq / count) - (mean * mean));
  }

  /// Fraction of pixels with luma > 245 (0–1).
  static double overExposureRatio(img.Image image) {
    return _extremeRatio(image, (l) => l > 245);
  }

  /// Fraction of pixels with luma < 18 (0–1).
  static double underExposureRatio(img.Image image) {
    return _extremeRatio(image, (l) => l < 18);
  }

  /// |mean(left half) - mean(right half)| / 255 → shadow imbalance 0–1.
  static double shadowImbalance(img.Image image) {
    if (image.width < 4) return 0;
    final mid = image.width ~/ 2;
    var leftSum = 0.0;
    var leftN = 0;
    var rightSum = 0.0;
    var rightN = 0;
    final yStep = math.max(1, image.height ~/ 48);
    final xStep = math.max(1, image.width ~/ 64);
    for (var y = 0; y < image.height; y += yStep) {
      for (var x = 0; x < mid; x += xStep) {
        leftSum += _lumaAt(image, x, y);
        leftN++;
      }
      for (var x = mid; x < image.width; x += xStep) {
        rightSum += _lumaAt(image, x, y);
        rightN++;
      }
    }
    if (leftN == 0 || rightN == 0) return 0;
    return ((leftSum / leftN) - (rightSum / rightN)).abs() / 255.0;
  }

  static double _extremeRatio(img.Image image, bool Function(double luma) pred) {
    var hit = 0;
    var count = 0;
    final yStep = math.max(1, image.height ~/ 64);
    final xStep = math.max(1, image.width ~/ 48);
    for (var y = 0; y < image.height; y += yStep) {
      for (var x = 0; x < image.width; x += xStep) {
        final l = _lumaAt(image, x, y);
        if (pred(l)) hit++;
        count++;
      }
    }
    return count == 0 ? 0 : hit / count;
  }

  static double _lumaAt(img.Image image, int x, int y) {
    final p = image.getPixel(x.clamp(0, image.width - 1), y.clamp(0, image.height - 1));
    return _luma(p.r.toDouble(), p.g.toDouble(), p.b.toDouble());
  }

  static double _luma(double r, double g, double b) =>
      r * 0.299 + g * 0.587 + b * 0.114;
}
