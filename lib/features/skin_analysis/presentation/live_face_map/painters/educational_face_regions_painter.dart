import 'package:flutter/material.dart';

import '../models/face_mesh_models.dart' as models;
import '../scan_region_animation.dart';
import 'face_map_palette.dart';
import 'smooth_path_builder.dart';

/// Premium sequential region fills — single purple, no multi-color AR mask.
class EducationalFaceRegionsPainter extends CustomPainter {
  final models.FaceMeshFrame frame;
  final double scanProgress;
  final bool sequentialScan;

  EducationalFaceRegionsPainter({
    required this.frame,
    required this.scanProgress,
    this.sequentialScan = true,
  });

  static const _visibleRegions = {
    models.FaceRegionId.forehead,
    models.FaceRegionId.underEye,
    models.FaceRegionId.nose,
    models.FaceRegionId.cheek,
    models.FaceRegionId.chin,
  };

  @override
  void paint(Canvas canvas, Size size) {
    if (!sequentialScan) return;

    for (final region in frame.regions) {
      if (!region.isValid || !_visibleRegions.contains(region.id)) continue;

      final strength = ScanRegionAnimation.strengthFor(region.id, scanProgress);
      if (strength <= 0.01) continue;

      _paintRegion(canvas, region, strength);
    }
  }

  void _paintRegion(
    Canvas canvas,
    models.FaceRegionPolygon region,
    double strength,
  ) {
    final simplified = SmoothPathBuilder.simplify(region.points, target: 14);
    final path = SmoothPathBuilder.fromPoints(simplified, tension: 0.48);
    final bounds = path.getBounds().inflate(22);
    final fill = FaceMapPalette.regionFill(strength);
    final glow = FaceMapPalette.glow(strength);

    canvas.drawPath(
      path,
      Paint()
        ..color = glow
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18),
    );

    canvas.drawPath(
      path,
      Paint()
        ..shader = RadialGradient(
          center: Alignment.center,
          radius: 1.2,
          colors: [
            fill,
            FaceMapPalette.primary.withValues(alpha: 0.02),
          ],
        ).createShader(bounds),
    );

    canvas.drawPath(
      path,
      Paint()
        ..color = fill.withValues(alpha: (fill.a * 0.85).clamp(0.08, 0.15))
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
    );
  }

  @override
  bool shouldRepaint(covariant EducationalFaceRegionsPainter oldDelegate) =>
      oldDelegate.frame != frame ||
      oldDelegate.scanProgress != scanProgress ||
      oldDelegate.sequentialScan != sequentialScan;
}
