import 'package:flutter/material.dart';

import '../models/face_mesh_models.dart' as models;
import 'face_map_palette.dart';
import 'smooth_path_builder.dart';

/// Full-face educational map — all regions visible, each with its own color.
class EducationalFaceRegionsPainter extends CustomPainter {
  final models.FaceMeshFrame frame;

  EducationalFaceRegionsPainter({
    required this.frame,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (!frame.quality.showRegions || frame.outline.length < 8) return;

    final ovalPath = SmoothPathBuilder.polygonPath(frame.outline);
    final regions = frame.regions
        .where((r) => !r.suppressed && r.points.length >= 3)
        .toList()
      ..sort(
        (a, b) => FaceMapPalette.paintPriority(a.id)
            .compareTo(FaceMapPalette.paintPriority(b.id)),
      );

    _paintFaceOutline(canvas, ovalPath);

    for (final region in regions) {
      _paintRegion(canvas, region, ovalPath);
    }
  }

  void _paintFaceOutline(Canvas canvas, Path ovalPath) {
    if (ovalPath.getBounds().isEmpty) return;

    canvas.drawPath(
      ovalPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0
        ..strokeJoin = StrokeJoin.round
        ..isAntiAlias = true
        ..color = FaceMapPalette.faceOutline,
    );
  }

  void _paintRegion(
    Canvas canvas,
    models.FaceRegionPolygon region,
    Path ovalPath,
  ) {
    final path = SmoothPathBuilder.polygonPath(region.points);
    if (path.getBounds().isEmpty) return;

    canvas.save();
    canvas.clipPath(ovalPath);

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.fill
        ..isAntiAlias = true
        ..color = FaceMapPalette.regionFill(region.id),
    );

    canvas.restore();

    _paintPreciseBorder(canvas, path, ovalPath, region.id);
  }

  void _paintPreciseBorder(
    Canvas canvas,
    Path borderPath,
    Path ovalPath,
    models.FaceRegionId id,
  ) {
    canvas.save();
    canvas.clipPath(ovalPath);

    canvas.drawPath(
      borderPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = FaceMapPalette.contrastStrokeWidth
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round
        ..isAntiAlias = true
        ..color = FaceMapPalette.borderContrast,
    );

    canvas.drawPath(
      borderPath,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = FaceMapPalette.strokeWidth
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round
        ..isAntiAlias = true
        ..color = FaceMapPalette.regionBorder(id),
    );

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant EducationalFaceRegionsPainter oldDelegate) =>
      oldDelegate.frame != frame;
}
