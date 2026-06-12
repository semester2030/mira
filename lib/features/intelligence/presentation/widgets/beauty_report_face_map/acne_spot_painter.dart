import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../domain/constants/report_face_map_spec.dart';

/// Soft circular spot clusters — not area masks.
class AcneSpotPainter extends CustomPainter {
  final Color color;
  final Rect faceBounds;
  final int concernScore;

  AcneSpotPainter({
    required this.color,
    required this.faceBounds,
    required this.concernScore,
  });

  static const _foreheadSpots = [
    (0.38, 0.24),
    (0.50, 0.22),
    (0.62, 0.25),
    (0.45, 0.28),
    (0.55, 0.27),
  ];

  static const _chinSpots = [
    (0.44, 0.78),
    (0.50, 0.80),
    (0.56, 0.79),
    (0.48, 0.82),
  ];

  static const _cheekSpots = [
    (0.30, 0.48),
    (0.34, 0.52),
    (0.70, 0.48),
    (0.66, 0.52),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final alpha = ReportFaceMapSpec.scoreOpacity(concernScore);
    final spotColor = ReportFaceMapSpec.saturatedColor(color, concernScore);
    final density = 3 + (concernScore / 18).floor();
    final rng = math.Random(concernScore * 17);

    final allSpots = [
      ..._foreheadSpots,
      ..._chinSpots,
      ..._cheekSpots,
    ];

    final count = math.min(allSpots.length, density);
    for (var i = 0; i < count; i++) {
      final (nx, ny) = allSpots[i];
      final jitterX = (rng.nextDouble() - 0.5) * 0.018;
      final jitterY = (rng.nextDouble() - 0.5) * 0.018;
      _drawSpot(
        canvas,
        spotColor,
        alpha,
        nx + jitterX,
        ny + jitterY,
        3.2 + rng.nextDouble() * 2.4,
      );
    }
  }

  void _drawSpot(
    Canvas canvas,
    Color color,
    double alpha,
    double nx,
    double ny,
    double radius,
  ) {
    final b = faceBounds;
    final center = Offset(
      b.left + b.width * nx,
      b.top + b.height * ny,
    );
    final r = radius * (b.width / 200);

    canvas.drawCircle(
      center,
      r * 1.6,
      Paint()
        ..color = color.withValues(alpha: alpha * 0.22)
        ..maskFilter = ui.MaskFilter.blur(ui.BlurStyle.normal, r * 0.8),
    );
    canvas.drawCircle(
      center,
      r,
      Paint()
        ..shader = ui.Gradient.radial(
          center,
          r,
          [
            color.withValues(alpha: alpha * 0.85),
            color.withValues(alpha: alpha * 0.35),
            color.withValues(alpha: 0),
          ],
          [0, 0.55, 1],
        ),
    );
  }

  @override
  bool shouldRepaint(covariant AcneSpotPainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.faceBounds != faceBounds ||
      oldDelegate.concernScore != concernScore;
}
