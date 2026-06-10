import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../models/face_mesh_models.dart';

/// Soft premium scan glow — no hard lines or debug geometry.
class ScanningLinePainter extends CustomPainter {
  final List<FaceMeshPoint> outline;
  final double progress;

  ScanningLinePainter({
    required this.outline,
    required this.progress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (outline.length < 8) return;

    final ys = outline.map((p) => p.y).toList()..sort();
    final top = ys.first;
    final bottom = ys.last;
    final y = top + (bottom - top) * progress;

    final beamRect = Rect.fromLTWH(0, y - 36, size.width, 72);
    canvas.drawRect(
      beamRect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.gold.withValues(alpha: 0),
            AppColors.gold.withValues(alpha: 0.22),
            AppColors.gold.withValues(alpha: 0),
          ],
        ).createShader(beamRect)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
  }

  @override
  bool shouldRepaint(covariant ScanningLinePainter oldDelegate) =>
      oldDelegate.progress != progress;
}
