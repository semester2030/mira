import 'dart:math' as math;
import 'dart:ui';

import '../models/face_mesh_models.dart';
import '../painters/smooth_path_builder.dart';

/// Clipping, validation, and path construction for anatomical regions.
abstract final class RegionPathUtils {
  static Path smoothPath(List<FaceMeshPoint> points, {double tension = 0.36}) =>
      SmoothPathBuilder.fromPoints(points, tension: tension);

  static Path? clipToFaceOval(
    List<FaceMeshPoint> region,
    List<FaceMeshPoint> oval,
  ) {
    if (region.length < 3 || oval.length < 3) return null;

    final regionPath = smoothPath(region);
    final ovalPath = smoothPath(oval);
    if (regionPath.getBounds().isEmpty || ovalPath.getBounds().isEmpty) {
      return null;
    }

    try {
      final clipped = Path.combine(PathOperation.intersect, regionPath, ovalPath);
      return clipped.getBounds().isEmpty ? null : clipped;
    } on Object {
      return null;
    }
  }

  static double polygonArea(List<FaceMeshPoint> points) {
    if (points.length < 3) return 0;
    var sum = 0.0;
    for (var i = 0; i < points.length; i++) {
      final a = points[i];
      final b = points[(i + 1) % points.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return sum.abs() * 0.5;
  }

  static double minAreaRatio(FaceRegionId id) => switch (id) {
        FaceRegionId.forehead => 0.004,
        FaceRegionId.underEye => 0.001,
        FaceRegionId.nose => 0.002,
        FaceRegionId.cheek => 0.003,
        FaceRegionId.chin => 0.003,
        _ => 0.002,
      };

  static double maxAreaRatio(FaceRegionId id) => switch (id) {
        FaceRegionId.forehead => 0.28,
        FaceRegionId.underEye => 0.09,
        FaceRegionId.nose => 0.14,
        FaceRegionId.cheek => 0.20,
        FaceRegionId.chin => 0.16,
        _ => 0.20,
      };

  static bool shouldSuppress({
    required FaceRegionId id,
    required List<FaceMeshPoint> points,
    required List<FaceMeshPoint> faceOval,
    required bool isLeftSide,
    required Size viewportSize,
  }) {
    if (points.length < 3 || faceOval.length < 3) return true;

    final regionArea = polygonArea(points);
    final faceArea = polygonArea(faceOval);
    if (faceArea <= 1 || regionArea <= 1) return true;

    final ratio = regionArea / faceArea;
    if (ratio > maxAreaRatio(id) || ratio < minAreaRatio(id)) return true;

    if (!_pointsMostlyInsideOval(points, faceOval, minInsideRatio: 0.62)) {
      return true;
    }

    if (!_pointsInsideViewport(points, viewportSize)) return true;

    if (points.length <= 4 && _looksLikeLineOrTriangle(points)) return true;

    final faceCenterX =
        faceOval.map((p) => p.x).reduce((a, b) => a + b) / faceOval.length;
    final faceWidth = _spread(faceOval.map((p) => p.x));
    final regionCenterX =
        points.map((p) => p.x).reduce((a, b) => a + b) / points.length;

    if (id == FaceRegionId.cheek) {
      // Suppress only when the region clearly crosses the nose midline.
      if (isLeftSide && regionCenterX > faceCenterX + faceWidth * 0.02) {
        return true;
      }
      if (!isLeftSide && regionCenterX < faceCenterX - faceWidth * 0.02) {
        return true;
      }
    }

    if (id == FaceRegionId.nose) {
      if ((regionCenterX - faceCenterX).abs() > faceWidth * 0.16) {
        return true;
      }
    }

    if (id == FaceRegionId.underEye) {
      final minY = points.map((p) => p.y).reduce(math.min);
      final browBandY = _percentile(faceOval.map((p) => p.y), 0.28);
      if (minY < browBandY) return true;
    }

    if (id == FaceRegionId.chin) {
      final minY = points.map((p) => p.y).reduce(math.min);
      final maxY = points.map((p) => p.y).reduce(math.max);
      final faceTop = faceOval.map((p) => p.y).reduce(math.min);
      final faceBottom = faceOval.map((p) => p.y).reduce(math.max);
      final faceHeight = faceBottom - faceTop;
      if (maxY - minY > faceHeight * 0.30) return true;
      if (minY < faceTop + faceHeight * 0.52) return true;
    }

    return false;
  }

  static bool _pointsMostlyInsideOval(
    List<FaceMeshPoint> points,
    List<FaceMeshPoint> oval, {
    required double minInsideRatio,
  }) {
    var inside = 0;
    for (final point in points) {
      if (_pointInPolygon(point, oval)) inside++;
    }
    return inside / points.length >= minInsideRatio;
  }

  static bool _pointsInsideViewport(List<FaceMeshPoint> points, Size viewport) {
    for (final point in points) {
      if (point.x < -8 ||
          point.y < -8 ||
          point.x > viewport.width + 8 ||
          point.y > viewport.height + 8) {
        return false;
      }
    }
    return true;
  }

  static bool _looksLikeLineOrTriangle(List<FaceMeshPoint> points) {
    final bounds = _boundsOf(points);
    final w = bounds.width;
    final h = bounds.height;
    if (w <= 1 || h <= 1) return true;
    final aspect = w > h ? w / h : h / w;
    if (aspect > 8.5) return true;
    if (points.length <= 3 && polygonArea(points) < 40) return true;
    return false;
  }

  static bool _pointInPolygon(FaceMeshPoint point, List<FaceMeshPoint> polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final a = polygon[i];
      final b = polygon[j];
      final intersects = ((a.y > point.y) != (b.y > point.y)) &&
          (point.x <
              (b.x - a.x) * (point.y - a.y) / (b.y - a.y + 0.0001) + a.x);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  static Rect _boundsOf(List<FaceMeshPoint> points) {
    final xs = points.map((p) => p.x);
    final ys = points.map((p) => p.y);
    return Rect.fromLTRB(
      xs.reduce(math.min),
      ys.reduce(math.min),
      xs.reduce(math.max),
      ys.reduce(math.max),
    );
  }

  static double _spread(Iterable<double> values) {
    final list = values.toList();
    return list.reduce(math.max) - list.reduce(math.min);
  }

  static double _percentile(Iterable<double> values, double t) {
    final sorted = values.toList()..sort();
    final index = ((sorted.length - 1) * t).round().clamp(0, sorted.length - 1);
    return sorted[index];
  }
}
