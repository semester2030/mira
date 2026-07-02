import 'dart:math' as math;
import 'dart:ui';

import 'package:image/image.dart' as img;

import '../../data/helpers/vision_color_mapper.dart';
import '../catalog/professional_color_matcher.dart';
import '../entities/detected_garment_color.dart';
import '../entities/garment_color_palette.dart';
import '../entities/outfit_body_pose_metrics.dart';
import '../entities/outfit_segment_map.dart';
import '../helpers/outfit_person_mask.dart';

/// KMeans garment color extraction — mask pixels + CIEDE2000 catalog matching.
abstract final class OutfitSegmentColorExtractor {
  OutfitSegmentColorExtractor._();

  static const _sampleTarget = 5000;
  static const _kMeansK = 4;
  static const _kMeansIter = 28;

  static GarmentColorPalette extractGarmentPalette(
    img.Image image, {
    required Iterable<OutfitSegmentRegion> regions,
    required OutfitBodyPoseMetrics pose,
  }) {
    final samples = <List<int>>[];
    for (final region in regions) {
      samples.addAll(
        _sampleRegion(
          image,
          region: region,
          pose: pose,
        ),
      );
    }
    if (samples.length < 16) return GarmentColorPalette.empty;

    final wb = _grayWorldAverages(samples);
    final clusters = _kMeans(samples, k: _kMeansK);
    if (clusters.isEmpty) return GarmentColorPalette.empty;

    final detailed = <DetectedGarmentColor>[];
    final seen = <String>{};

    for (final rgb in clusters) {
      final match = ProfessionalColorMatcher.matchRgb(
        rgb[0],
        rgb[1],
        rgb[2],
        avgR: wb.$1,
        avgG: wb.$2,
        avgB: wb.$3,
      );
      if (seen.contains(match.id)) continue;
      seen.add(match.id);
      detailed.add(DetectedGarmentColor.fromMatch(match));
    }

  detailed.sort((a, b) => b.confidence.compareTo(a.confidence));

    final named = detailed.map((d) => d.displayNameAr).toList();
    final coverage = (samples.length / _sampleTarget).clamp(0.0, 1.0);
    final spread = _clusterSpread(clusters);
    final avgConfidence = detailed.isEmpty
        ? 0.0
        : detailed.map((d) => d.confidence).reduce((a, b) => a + b) / detailed.length;
    final confidence = (avgConfidence * 0.7 + coverage * 0.15 + spread * 0.15).clamp(0.0, 0.99);

    return GarmentColorPalette(
      primaryColor: named.elementAtOrNull(0) ?? '',
      secondaryColor: named.elementAtOrNull(1) ?? '',
      accentColor: named.elementAtOrNull(2) ?? '',
      confidence: confidence,
      allColors: named,
      detailedColors: detailed,
    );
  }

  static List<String> extractRegionColors(
    img.Image image, {
    required OutfitSegmentRegion region,
    required OutfitBodyPoseMetrics pose,
    int maxColors = 3,
  }) {
    final samples = _sampleRegion(image, region: region, pose: pose);
    if (samples.isEmpty) return const [];

    final wb = _grayWorldAverages(samples);
    final clusters = _kMeans(samples, k: math.min(maxColors, _kMeansK));
    final out = <String>[];
    final seen = <String>{};

    for (final rgb in clusters) {
      final match = ProfessionalColorMatcher.matchRgb(
        rgb[0],
        rgb[1],
        rgb[2],
        avgR: wb.$1,
        avgG: wb.$2,
        avgB: wb.$3,
      );
      if (seen.contains(match.id)) continue;
      seen.add(match.id);
      out.add(match.displayNameAr);
    }
    return out;
  }

  static Map<OutfitSegmentZone, List<String>> extractAllZones(
    img.Image image,
    Iterable<OutfitSegmentRegion> regions, {
    required OutfitBodyPoseMetrics pose,
  }) {
    final map = <OutfitSegmentZone, List<String>>{};
    for (final region in regions) {
      map[region.zone] = extractRegionColors(
        image,
        region: region,
        pose: pose,
      );
    }
    return map;
  }

  static (double, double, double) _grayWorldAverages(List<List<int>> samples) {
    if (samples.isEmpty) return (128, 128, 128);
    var sr = 0.0, sg = 0.0, sb = 0.0;
    for (final s in samples) {
      sr += s[0];
      sg += s[1];
      sb += s[2];
    }
    final n = samples.length;
    return (sr / n, sg / n, sb / n);
  }

  static List<List<int>> _sampleRegion(
    img.Image image, {
    required OutfitSegmentRegion region,
    required OutfitBodyPoseMetrics pose,
  }) {
    final rect = _pixelRect(image, region.normalizedRect);
    if (rect.width < 2 || rect.height < 2) return const [];

    final step = math.max(
      1,
      math.sqrt(rect.width * rect.height / _sampleTarget).floor(),
    );

    final samples = <List<int>>[];
    for (var y = rect.top.toInt(); y < rect.bottom.toInt(); y += step) {
      for (var x = rect.left.toInt(); x < rect.right.toInt(); x += step) {
        final nx = x / image.width;
        final ny = y / image.height;
        if (!OutfitPersonMask.containsNormalized(pose, nx, ny)) continue;
        if (region.hasContour && !_pointInPolygon(Offset(nx, ny), region.normalizedPolygon)) {
          continue;
        }

        final pixel = image.getPixel(x, y);
        final r = pixel.r.toInt();
        final g = pixel.g.toInt();
        final b = pixel.b.toInt();
        if (_isSkinTone(r, g, b) || _isBackground(r, g, b) || _isShadow(r, g, b)) continue;
        if (ProfessionalColorMatcher.isSpecularHighlight(r, g, b)) continue;
        if (!_isGarmentPixel(r, g, b)) continue;
        samples.add([r, g, b]);
      }
    }
    return samples;
  }

  static List<List<int>> _kMeans(List<List<int>> samples, {required int k}) {
    if (samples.isEmpty) return const [];
    if (samples.length <= k) return samples;

    final centroids = _initCentroids(samples, k);
    var assignments = List<int>.filled(samples.length, 0);

    for (var iter = 0; iter < _kMeansIter; iter++) {
      var moved = false;
      for (var i = 0; i < samples.length; i++) {
        final next = _nearestCentroid(samples[i], centroids);
        if (next != assignments[i]) {
          assignments[i] = next;
          moved = true;
        }
      }
      if (!moved && iter > 2) break;

      final sums = List.generate(k, (_) => [0, 0, 0, 0]);
      for (var i = 0; i < samples.length; i++) {
        final bucket = sums[assignments[i]];
        bucket[0] += samples[i][0];
        bucket[1] += samples[i][1];
        bucket[2] += samples[i][2];
        bucket[3] += 1;
      }

      for (var c = 0; c < k; c++) {
        if (sums[c][3] == 0) continue;
        centroids[c] = [
          (sums[c][0] / sums[c][3]).round(),
          (sums[c][1] / sums[c][3]).round(),
          (sums[c][2] / sums[c][3]).round(),
        ];
      }
    }

    final ranked = List.generate(k, (index) {
      final count = assignments.where((a) => a == index).length;
      return (index, count);
    })
      ..sort((a, b) => b.$2.compareTo(a.$2));

    return [
      for (final (index, count) in ranked)
        if (count > 0) centroids[index],
    ];
  }

  static List<List<int>> _initCentroids(List<List<int>> samples, int k) {
    final centroids = <List<int>>[];
    final stride = (samples.length / k).floor().clamp(1, samples.length);
    for (var i = 0; i < k; i++) {
      centroids.add(List<int>.from(samples[(i * stride).clamp(0, samples.length - 1)]));
    }
    return centroids;
  }

  static int _nearestCentroid(List<int> sample, List<List<int>> centroids) {
    var best = 0;
    var bestDist = 1 << 30;
    for (var i = 0; i < centroids.length; i++) {
      final c = centroids[i];
      final d = _distSq(sample, c);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  static int _distSq(List<int> a, List<int> b) =>
      (a[0] - b[0]) * (a[0] - b[0]) +
      (a[1] - b[1]) * (a[1] - b[1]) +
      (a[2] - b[2]) * (a[2] - b[2]);

  static double _clusterSpread(List<List<int>> clusters) {
    if (clusters.length < 2) return 0.45;
    var total = 0.0;
    for (var i = 0; i < clusters.length; i++) {
      for (var j = i + 1; j < clusters.length; j++) {
        total += math.sqrt(_distSq(clusters[i], clusters[j]).toDouble());
      }
    }
    return (total / 441.0).clamp(0.0, 1.0);
  }

  static bool _pointInPolygon(Offset p, List<Offset> polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final xi = polygon[i].dx;
      final yi = polygon[i].dy;
      final xj = polygon[j].dx;
      final yj = polygon[j].dy;
      final intersect = ((yi > p.dy) != (yj > p.dy)) &&
          (p.dx < (xj - xi) * (p.dy - yi) / (yj - yi + 0.0001) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  static Rect _pixelRect(img.Image image, Rect normalized) {
    final left = (normalized.left * image.width).clamp(0, image.width - 1).floor();
    final top = (normalized.top * image.height).clamp(0, image.height - 1).floor();
    final right = (normalized.right * image.width).clamp(left + 1, image.width).floor();
    final bottom = (normalized.bottom * image.height).clamp(top + 1, image.height).floor();
    return Rect.fromLTRB(left.toDouble(), top.toDouble(), right.toDouble(), bottom.toDouble());
  }

  static bool _isGarmentPixel(int r, int g, int b) {
    if (_isSkinTone(r, g, b) || _isBackground(r, g, b) || _isShadow(r, g, b)) {
      return false;
    }
    final maxC = math.max(r, math.max(g, b));
    final minC = math.min(r, math.min(g, b));
    final luminance = (r * 0.299 + g * 0.587 + b * 0.114);
    return (maxC - minC > 10) || (luminance > 30 && luminance < 225);
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
    return spread < 4 && luminance > 228;
  }

  static bool _isShadow(int r, int g, int b) {
    final luminance = (r * 0.299 + g * 0.587 + b * 0.114);
    final spread = math.max(r, math.max(g, b)) - math.min(r, math.min(g, b));
    return luminance < 28 && spread < 10;
  }
}

extension _ElementAtOrNull<E> on List<E> {
  E? elementAtOrNull(int index) => index >= 0 && index < length ? this[index] : null;
}
