import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import '../../../skin_analysis/presentation/live_face_map/painters/smooth_path_builder.dart';
import 'landmark_aligned_face_geometry.dart';

/// Builds production VISUAL region paths from anatomical polygons.
///
/// Anatomical landmarks / hit paths remain the source of truth.
/// Visual paths are smooth, conservative, and clipped to a slightly expanded
/// hit shell so Bezier curves cannot balloon into hair/eyes/wrong cheek.
abstract final class SkinFaceMapVisualPathBuilder {
  SkinFaceMapVisualPathBuilder._();

  static const version = 'skin-face-map-visual-v1';

  /// Max allowed expansion of visual bounds vs hit bounds (fraction of size).
  static const maxBoundsExpansionFraction = 0.06;

  /// Hit shell scale around centroid used to clip smooth curves.
  static const hitShellScale = 1.05;

  static Path fromPolygon({
    required FaceRegionPolygon polygon,
    required String exploreId,
  }) {
    final hit = polygon.toLinearPath();
    if (hit.getBounds().isEmpty) return Path();

    final tension = _tensionFor(exploreId);
    final shrink = _shrinkFor(exploreId);
    final target = _simplifyTarget(exploreId);

    final simplified = SmoothPathBuilder.simplify(polygon.points, target: target);
    final shrunk = _shrinkTowardCentroid(simplified, shrink);
    var visual = SmoothPathBuilder.fromPoints(shrunk, tension: tension);
    if (visual.getBounds().isEmpty) return hit;

    final centroid =
        LandmarkAlignedFaceGeometry.polygonCentroid(hit) ?? hit.getBounds().center;
    final shell = _scalePathAround(hit, centroid, hitShellScale);
    try {
      final clipped = Path.combine(PathOperation.intersect, visual, shell);
      if (!clipped.getBounds().isEmpty) {
        visual = clipped;
      }
    } on Object {
      // Keep unclipped smooth path only if still contained enough.
    }

    if (!_withinExpansionBudget(hit: hit, visual: visual)) {
      // Fall back to soft quadratic near the linear hull (still non-jagged fill).
      return polygon.toPath(smoothness: 0.22);
    }
    return visual;
  }

  static Map<String, Path> visualPathsFromFrame(FaceMeshFrame frame) {
    final out = <String, Path>{};
    for (final region in frame.regions) {
      final id = LandmarkAlignedFaceGeometry.exploreIdForPolygon(region);
      if (id == null) continue;
      final path = fromPolygon(polygon: region, exploreId: id);
      if (path.getBounds().isEmpty) continue;
      out.putIfAbsent(id, () => path);
    }
    return out;
  }

  static double _tensionFor(String exploreId) => switch (exploreId) {
        'forehead' => 0.26,
        'cheeks_left' || 'cheeks_right' => 0.30,
        'nose' => 0.20,
        'chin' => 0.28,
        'under_eyes_left' || 'under_eyes_right' => 0.24,
        _ => 0.26,
      };

  static double _shrinkFor(String exploreId) => switch (exploreId) {
        'forehead' => 0.05,
        'cheeks_left' || 'cheeks_right' => 0.07,
        'nose' => 0.04,
        'chin' => 0.06,
        'under_eyes_left' || 'under_eyes_right' => 0.05,
        _ => 0.05,
      };

  static int _simplifyTarget(String exploreId) => switch (exploreId) {
        'nose' => 8,
        'chin' => 8,
        'under_eyes_left' || 'under_eyes_right' => 8,
        _ => 10,
      };

  static List<FaceMeshPoint> _shrinkTowardCentroid(
    List<FaceMeshPoint> points,
    double factor,
  ) {
    if (points.length < 3 || factor <= 0) return points;
    var cx = 0.0;
    var cy = 0.0;
    for (final p in points) {
      cx += p.x;
      cy += p.y;
    }
    cx /= points.length;
    cy /= points.length;
    final t = (1.0 - factor).clamp(0.7, 1.0);
    return [
      for (final p in points)
        FaceMeshPoint(
          cx + (p.x - cx) * t,
          cy + (p.y - cy) * t,
        ),
    ];
  }

  static Path _scalePathAround(Path path, Offset center, double scale) {
    final matrix = Matrix4.identity()
      ..translateByDouble(center.dx, center.dy, 0, 1)
      ..scaleByDouble(scale, scale, 1, 1)
      ..translateByDouble(-center.dx, -center.dy, 0, 1);
    return path.transform(matrix.storage);
  }

  static bool _withinExpansionBudget({
    required Path hit,
    required Path visual,
  }) {
    final hb = hit.getBounds();
    final vb = visual.getBounds();
    if (hb.isEmpty || vb.isEmpty) return false;
    final maxW = hb.width * (1 + maxBoundsExpansionFraction);
    final maxH = hb.height * (1 + maxBoundsExpansionFraction);
    if (vb.width > maxW || vb.height > maxH) return false;
    final padX = hb.width * maxBoundsExpansionFraction;
    final padY = hb.height * maxBoundsExpansionFraction;
    final allowed = hb.inflate(math.max(padX, padY));
    return allowed.contains(vb.topLeft) &&
        allowed.contains(vb.topRight) &&
        allowed.contains(vb.bottomLeft) &&
        allowed.contains(vb.bottomRight);
  }
}
