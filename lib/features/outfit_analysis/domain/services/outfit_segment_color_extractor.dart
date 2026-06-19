import 'dart:math' as math;
import 'dart:ui';

import 'package:image/image.dart' as img;

import '../../data/helpers/vision_color_mapper.dart';
import '../entities/outfit_segment_map.dart';

/// Region-based color extraction — ignores skin, hair, and background heuristics.
abstract final class OutfitSegmentColorExtractor {
  OutfitSegmentColorExtractor._();

  static const _sampleTarget = 5000;

  static List<String> extractRegionColors(
    img.Image image, {
    required Rect normalizedRect,
    int maxColors = 4,
  }) {
    final rect = _pixelRect(image, normalizedRect);
    if (rect.width < 2 || rect.height < 2) return const [];

    final samples = <List<int>>[];
    final step = math.max(
      1,
      math.sqrt(rect.width * rect.height / _sampleTarget).floor(),
    );

    for (var y = rect.top.toInt(); y < rect.bottom.toInt(); y += step) {
      for (var x = rect.left.toInt(); x < rect.right.toInt(); x += step) {
        final pixel = image.getPixel(x, y);
        final r = pixel.r.toInt();
        final g = pixel.g.toInt();
        final b = pixel.b.toInt();
        if (_isSkinTone(r, g, b) || _isBackground(r, g, b)) continue;
        samples.add([r, g, b]);
      }
    }

    if (samples.isEmpty) return const [];

    final clusters = _clusterColors(samples, maxColors: maxColors);
    return clusters
        .map(
          (rgb) => VisionColorMapper.fromRgb(
            rgb[0] / 255,
            rgb[1] / 255,
            rgb[2] / 255,
          ),
        )
        .toSet()
        .toList();
  }

  static Map<OutfitSegmentZone, List<String>> extractAllZones(
    img.Image image,
    Iterable<OutfitSegmentRegion> regions,
  ) {
    final map = <OutfitSegmentZone, List<String>>{};
    for (final region in regions) {
      map[region.zone] = extractRegionColors(
        image,
        normalizedRect: region.normalizedRect,
      );
    }
    return map;
  }

  static Rect _pixelRect(img.Image image, Rect normalized) {
    final left = (normalized.left * image.width).clamp(0, image.width - 1).floor();
    final top = (normalized.top * image.height).clamp(0, image.height - 1).floor();
    final right = (normalized.right * image.width).clamp(left + 1, image.width).floor();
    final bottom = (normalized.bottom * image.height).clamp(top + 1, image.height).floor();
    return Rect.fromLTRB(left.toDouble(), top.toDouble(), right.toDouble(), bottom.toDouble());
  }

  static bool _isSkinTone(int r, int g, int b) {
    final maxC = math.max(r, math.max(g, b));
    final minC = math.min(r, math.min(g, b));
    if (maxC - minC < 12) return false;
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 12) return true;
    if (r > 180 && g > 140 && b > 120 && (r - b) < 40) return true;
    return false;
  }

  static bool _isBackground(int r, int g, int b) {
    final luminance = (r * 0.299 + g * 0.587 + b * 0.114);
    if (luminance > 245 || luminance < 8) return true;
    final spread = math.max(r, math.max(g, b)) - math.min(r, math.min(g, b));
    return spread < 3 && luminance > 230;
  }

  static List<List<int>> _clusterColors(
    List<List<int>> samples, {
    required int maxColors,
  }) {
    final buckets = <String, List<int>>{};
    for (final rgb in samples) {
      final key = '${(rgb[0] ~/ 24) * 24}_${(rgb[1] ~/ 24) * 24}_${(rgb[2] ~/ 24) * 24}';
      buckets.putIfAbsent(key, () => [0, 0, 0, 0]);
      final bucket = buckets[key]!;
      bucket[0] += rgb[0];
      bucket[1] += rgb[1];
      bucket[2] += rgb[2];
      bucket[3] += 1;
    }

    final ranked = buckets.values.toList()
      ..sort((a, b) => b[3].compareTo(a[3]));

    return ranked.take(maxColors).map((bucket) {
      final count = bucket[3];
      return [
        (bucket[0] / count).round(),
        (bucket[1] / count).round(),
        (bucket[2] / count).round(),
      ];
    }).toList();
  }
}
