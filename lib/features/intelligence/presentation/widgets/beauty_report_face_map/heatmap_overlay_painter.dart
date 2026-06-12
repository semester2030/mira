import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../domain/constants/report_face_map_spec.dart';
import 'organic_face_geometry.dart';

/// Premium skin heatmap — radial falloff, feathered edges, organic diffusion.
class HeatmapOverlayPainter extends CustomPainter {
  final List<FaceMapRegionHighlight> highlights;
  final Color highlightColor;
  final Rect faceBounds;
  final int concernScore;

  HeatmapOverlayPainter({
    required this.highlights,
    required this.highlightColor,
    required this.faceBounds,
    required this.concernScore,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final spread = ReportFaceMapSpec.scoreSpread(concernScore);
    final color = ReportFaceMapSpec.saturatedColor(highlightColor, concernScore);

    for (final item in highlights) {
      final regionId = ReportFaceMapSpec.regionId(item.region);
      final path = OrganicFaceGeometry.regionPath(faceBounds, regionId);
      if (path.getBounds().isEmpty) continue;

      final baseAlpha = ReportFaceMapSpec.fillOpacityFor(item.intensity, concernScore);
      _paintHeatmapZone(canvas, path, color, baseAlpha, spread);
    }
  }

  void _paintHeatmapZone(
    Canvas canvas,
    Path path,
    Color color,
    double baseAlpha,
    double spread,
  ) {
    final bounds = path.getBounds();
    final center = bounds.center;
    final radius = math.max(bounds.width, bounds.height) * 0.52 * spread;

    canvas.save();
    canvas.clipPath(path);

    // Core glow — stronger center opacity.
    canvas.drawPath(
      path,
      Paint()
        ..shader = ui.Gradient.radial(
          center,
          radius,
          [
            color.withValues(alpha: (baseAlpha * 1.35).clamp(0, 0.85)),
            color.withValues(alpha: baseAlpha * 0.72),
            color.withValues(alpha: baseAlpha * 0.18),
            color.withValues(alpha: 0),
          ],
          [0, 0.35, 0.72, 1],
        ),
    );

    // Diffusion layer — skin-like soft bleed.
    canvas.drawPath(
      path,
      Paint()
        ..color = color.withValues(alpha: baseAlpha * 0.28)
        ..maskFilter = ui.MaskFilter.blur(ui.BlurStyle.normal, 6 * spread),
    );

    // Edge feather — irregular organic boundary feel.
    canvas.drawPath(
      path,
      Paint()
        ..color = color.withValues(alpha: baseAlpha * 0.14)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..maskFilter = ui.MaskFilter.blur(ui.BlurStyle.normal, 4),
    );

    canvas.restore();

    // Outer halo — weaker edge opacity outside clip.
    canvas.drawPath(
      path,
      Paint()
        ..color = color.withValues(alpha: baseAlpha * 0.12)
        ..maskFilter = ui.MaskFilter.blur(ui.BlurStyle.normal, 9 * spread),
    );
  }

  @override
  bool shouldRepaint(covariant HeatmapOverlayPainter oldDelegate) =>
      oldDelegate.highlights != highlights ||
      oldDelegate.highlightColor != highlightColor ||
      oldDelegate.faceBounds != faceBounds ||
      oldDelegate.concernScore != concernScore;
}
