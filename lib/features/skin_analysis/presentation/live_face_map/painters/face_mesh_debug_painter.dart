import 'package:flutter/material.dart';

import '../models/face_mesh_models.dart';

/// Developer-only debug overlay — landmark dots, face oval, bounding box.
class FaceMeshDebugPainter extends CustomPainter {
  final FaceMeshFrame frame;
  final List<FaceMeshPoint> landmarks;

  FaceMeshDebugPainter({
    required this.frame,
    required this.landmarks,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (frame.outline.length >= 3) {
      final oval = Path()
        ..moveTo(frame.outline.first.x, frame.outline.first.y);
      for (var i = 1; i < frame.outline.length; i++) {
        oval.lineTo(frame.outline[i].x, frame.outline[i].y);
      }
      oval.close();

      canvas.drawPath(
        oval,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = Colors.lightGreenAccent.withValues(alpha: 0.7),
      );
    }

    final box = frame.boundingBox;
    if (box != null && !box.isEmpty) {
      canvas.drawRect(
        box,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = Colors.amber.withValues(alpha: 0.8),
      );
    }

    final dotPaint = Paint()..color = Colors.cyanAccent.withValues(alpha: 0.85);
    for (final point in landmarks) {
      canvas.drawCircle(point.toOffset(), 1.2, dotPaint);
    }

    for (final region in frame.regions) {
      if (region.points.length < 3) continue;
      final color = region.suppressed
          ? Colors.redAccent.withValues(alpha: 0.5)
          : Colors.white.withValues(alpha: 0.35);
      final path = Path()
        ..moveTo(region.points.first.x, region.points.first.y);
      for (var i = 1; i < region.points.length; i++) {
        path.lineTo(region.points[i].x, region.points[i].y);
      }
      path.close();
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8
          ..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(covariant FaceMeshDebugPainter oldDelegate) =>
      oldDelegate.frame != frame || oldDelegate.landmarks != landmarks;
}
