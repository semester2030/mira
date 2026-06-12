import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../domain/constants/report_face_map_spec.dart';
import 'organic_face_geometry.dart';

/// Micro-grain particle overlay — diffuse low-intensity texture.
class TextureGrainPainter extends CustomPainter {
  final Color color;
  final Rect faceBounds;
  final int concernScore;

  TextureGrainPainter({
    required this.color,
    required this.faceBounds,
    required this.concernScore,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final alpha = ReportFaceMapSpec.scoreOpacity(concernScore) * 0.55;
    final grainColor = ReportFaceMapSpec.saturatedColor(color, concernScore);
    final rng = math.Random(concernScore * 31 + 7);
    final particleCount = 90 + (concernScore * 0.6).round();

    final zones = [
      OrganicFaceGeometry.regionPath(faceBounds, 'cheek_wide_l'),
      OrganicFaceGeometry.regionPath(faceBounds, 'cheek_wide_r'),
      OrganicFaceGeometry.regionPath(faceBounds, 'forehead_wide'),
      OrganicFaceGeometry.regionPath(faceBounds, 'chin_center'),
    ];

    final bounds = faceBounds;
    var placed = 0;
    var attempts = 0;

    while (placed < particleCount && attempts < particleCount * 8) {
      attempts++;
      final x = bounds.left + rng.nextDouble() * bounds.width;
      final y = bounds.top + rng.nextDouble() * bounds.height;
      final point = Offset(x, y);

      final inside = zones.any((z) => z.contains(point));
      if (!inside) continue;

      final r = 0.35 + rng.nextDouble() * 0.9;
      canvas.drawCircle(
        point,
        r,
        Paint()
          ..color = grainColor.withValues(
            alpha: alpha * (0.25 + rng.nextDouble() * 0.55),
          )
          ..maskFilter = ui.MaskFilter.blur(
            ui.BlurStyle.normal,
            0.4 + rng.nextDouble() * 0.6,
          ),
      );
      placed++;
    }
  }

  @override
  bool shouldRepaint(covariant TextureGrainPainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.faceBounds != faceBounds ||
      oldDelegate.concernScore != concernScore;
}
