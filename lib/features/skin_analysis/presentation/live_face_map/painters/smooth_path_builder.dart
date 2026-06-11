import 'dart:ui';

import '../models/face_mesh_models.dart';

/// Converts landmark polygons into viewport paths.
class SmoothPathBuilder {
  SmoothPathBuilder._();

  /// Straight segments through each landmark — maximum boundary precision.
  static Path polygonPath(List<FaceMeshPoint> points) {
    if (points.length < 3) return Path();

    final path = Path()..moveTo(points.first.x, points.first.y);
    for (var i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y);
    }
    path.close();
    return path;
  }

  static Path fromPoints(List<FaceMeshPoint> points, {double tension = 0.42}) {
    if (points.length < 3) return Path();

    final offsets = points.map((p) => p.toOffset()).toList();
    if (offsets.length == 3) {
      return Path()
        ..moveTo(offsets[0].dx, offsets[0].dy)
        ..quadraticBezierTo(
          offsets[1].dx,
          offsets[1].dy,
          offsets[2].dx,
          offsets[2].dy,
        )
        ..close();
    }

    final path = Path()..moveTo(offsets[0].dx, offsets[0].dy);
    final n = offsets.length;

    for (var i = 0; i < n; i++) {
      final p0 = offsets[(i - 1 + n) % n];
      final p1 = offsets[i];
      final p2 = offsets[(i + 1) % n];
      final p3 = offsets[(i + 2) % n];

      final cp1 = Offset(
        p1.dx + (p2.dx - p0.dx) * tension / 6,
        p1.dy + (p2.dy - p0.dy) * tension / 6,
      );
      final cp2 = Offset(
        p2.dx - (p3.dx - p1.dx) * tension / 6,
        p2.dy - (p3.dy - p1.dy) * tension / 6,
      );

      path.cubicTo(cp1.dx, cp1.dy, cp2.dx, cp2.dy, p2.dx, p2.dy);
    }

    path.close();
    return path;
  }

  /// Reduces dense hulls to a smooth-friendly point count.
  static List<FaceMeshPoint> simplify(
    List<FaceMeshPoint> points, {
    int target = 12,
  }) {
    if (points.length <= target) return points;
    final step = points.length / target;
    return [
      for (var i = 0; i < target; i++) points[(i * step).floor() % points.length],
    ];
  }
}
