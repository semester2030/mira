import 'dart:math' as math;
import 'dart:ui';

import 'package:image/image.dart' as img;

/// On-device pixel contour tracing (fallback when server unavailable).
abstract final class OutfitContourRefiner {
  OutfitContourRefiner._();

  static List<Offset> refine(
    img.Image image, {
    required Rect normalizedRect,
    List<Offset> visionPolygon = const [],
  }) {
    if (image.width < 8 || image.height < 8) {
      return visionPolygon.length >= 3 ? visionPolygon : _quad(normalizedRect);
    }

    final padX = normalizedRect.width * 0.02;
    final padY = normalizedRect.height * 0.02;
    final norm = Rect.fromLTRB(
      (normalizedRect.left - padX).clamp(0.0, 1.0),
      (normalizedRect.top - padY).clamp(0.0, 1.0),
      (normalizedRect.right + padX).clamp(0.0, 1.0),
      (normalizedRect.bottom + padY).clamp(0.0, 1.0),
    );

    final left = (norm.left * image.width).floor().clamp(0, image.width - 1);
    final top = (norm.top * image.height).floor().clamp(0, image.height - 1);
    final right = (norm.right * image.width).ceil().clamp(left + 1, image.width);
    final bottom = (norm.bottom * image.height).ceil().clamp(top + 1, image.height);
    final width = right - left;
    final height = bottom - top;
    if (width < 4 || height < 4) {
      return visionPolygon.length >= 3 ? visionPolygon : _quad(normalizedRect);
    }

    final mask = List<bool>.filled(width * height, false);
    var garmentCount = 0;

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        final pixel = image.getPixel(left + x, top + y);
        final r = pixel.r.toInt();
        final g = pixel.g.toInt();
        final b = pixel.b.toInt();
        if (_isGarment(r, g, b)) {
          mask[y * width + x] = true;
          garmentCount++;
        }
      }
    }

    if (garmentCount < width * height * 0.08) {
      return visionPolygon.length >= 3 ? visionPolygon : _quad(normalizedRect);
    }

    final edgeStep = math.max(1, math.min(width, height) ~/ 80);
    final points = <Offset>[];
    for (var y = 0; y < height; y += edgeStep) {
      for (var x = 0; x < width; x += edgeStep) {
        if (!_isEdge(mask, x, y, width, height)) continue;
        points.add(Offset((left + x) / image.width, (top + y) / image.height));
      }
    }

    if (points.length < 8) {
      return visionPolygon.length >= 3 ? visionPolygon : _quad(normalizedRect);
    }

    final hull = _convexHull(points);
    return _simplify(hull, 36);
  }

  static List<Offset> _quad(Rect rect) => [
        Offset(rect.left, rect.top),
        Offset(rect.right, rect.top),
        Offset(rect.right, rect.bottom),
        Offset(rect.left, rect.bottom),
      ];

  static bool _isGarment(int r, int g, int b) {
    if (_isSkin(r, g, b) || _isBackground(r, g, b)) return false;
    final maxC = math.max(r, math.max(g, b));
    final minC = math.min(r, math.min(g, b));
    return maxC - minC > 14;
  }

  static bool _isSkin(int r, int g, int b) {
    final maxC = math.max(r, math.max(g, b));
    final minC = math.min(r, math.min(g, b));
    if (maxC - minC < 12) return false;
    return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 12;
  }

  static bool _isBackground(int r, int g, int b) {
    final lum = 0.299 * r + 0.587 * g + 0.114 * b;
    final chroma = math.max(r, math.max(g, b)) - math.min(r, math.min(g, b));
    return lum > 238 || (lum > 210 && chroma < 18);
  }

  static bool _isEdge(List<bool> mask, int x, int y, int w, int h) {
    if (!mask[y * w + x]) return false;
    const dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    for (final (dx, dy) in dirs) {
      final nx = x + dx;
      final ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[ny * w + nx]) return true;
    }
    return false;
  }

  static List<Offset> _convexHull(List<Offset> points) {
    if (points.length < 3) return points;
    final cx = points.map((p) => p.dx).reduce((a, b) => a + b) / points.length;
    final cy = points.map((p) => p.dy).reduce((a, b) => a + b) / points.length;
    return [...points]
      ..sort((a, b) => math.atan2(a.dy - cy, a.dx - cx).compareTo(math.atan2(b.dy - cy, b.dx - cx)));
  }

  static List<Offset> _simplify(List<Offset> points, int maxPoints) {
    if (points.length <= maxPoints) return points;
    final step = (points.length / maxPoints).ceil();
    return [for (var i = 0; i < points.length; i += step) points[i]];
  }
}
