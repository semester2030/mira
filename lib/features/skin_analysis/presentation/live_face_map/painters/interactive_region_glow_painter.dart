import 'package:flutter/material.dart';

import '../models/face_mesh_models.dart';
import '../scan_region_animation.dart';
import 'face_map_palette.dart';
import 'smooth_path_builder.dart';

/// Sequential region spotlight — one zone glows at a time during live scan.
class InteractiveRegionGlowPainter extends CustomPainter {
  final FaceMeshFrame frame;
  final double scanProgress;
  final double pulse;
  final bool dimInactive;

  InteractiveRegionGlowPainter({
    required this.frame,
    required this.scanProgress,
    required this.pulse,
    this.dimInactive = true,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (!frame.hasFace || !frame.quality.showRegions) return;

    final activeId = ScanRegionAnimation.activeRegionId(scanProgress);
    final ovalPath = SmoothPathBuilder.polygonPath(frame.outline);
    if (ovalPath.getBounds().isEmpty) return;

    canvas.save();
    canvas.clipPath(ovalPath);

    for (final region in frame.regions) {
      if (region.suppressed || region.points.length < 3) continue;
      final active = region.id == activeId;
      _paintRegion(canvas, region, active: active);
    }

    canvas.restore();
  }

  void _paintRegion(
    Canvas canvas,
    FaceRegionPolygon region, {
    required bool active,
  }) {
    final path = SmoothPathBuilder.polygonPath(region.points);
    if (path.getBounds().isEmpty) return;

    final base = FaceMapPalette.regionBorder(region.id);
    final fillAlpha = active ? 0.22 + pulse * 0.18 : (dimInactive ? 0.02 : 0.06);
    final strokeAlpha = active ? 0.92 : (dimInactive ? 0.12 : 0.35);

    if (active) {
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.fill
          ..isAntiAlias = true
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10)
          ..color = base.withValues(alpha: 0.35 + pulse * 0.2),
      );
    }

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.fill
        ..isAntiAlias = true
        ..color = base.withValues(alpha: fillAlpha),
    );

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = active ? 2.4 : 1.0
        ..isAntiAlias = true
        ..color = base.withValues(alpha: strokeAlpha),
    );
  }

  @override
  bool shouldRepaint(covariant InteractiveRegionGlowPainter oldDelegate) =>
      oldDelegate.frame != frame ||
      oldDelegate.scanProgress != scanProgress ||
      oldDelegate.pulse != pulse ||
      oldDelegate.dimInactive != dimInactive;
}
