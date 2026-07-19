import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../models/face_mesh_models.dart';

/// Soft premium scan glow — laser beam sweeps the face during live capture.
class ScanningLinePainter extends CustomPainter {
  final List<FaceMeshPoint> outline;
  final double progress;

  ScanningLinePainter({
    required this.outline,
    required this.progress,
  });

  static const _beamCyan = Color(0xFF5CE1FF);

  @override
  void paint(Canvas canvas, Size size) {
    if (outline.length < 8) return;

    final ys = outline.map((p) => p.y).toList()..sort();
    final top = ys.first;
    final bottom = ys.last;
    final y = top + (bottom - top) * progress;

    final beamRect = Rect.fromLTWH(0, y - 42, size.width, 84);
    canvas.drawRect(
      beamRect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            _beamCyan.withValues(alpha: 0),
            _beamCyan.withValues(alpha: 0.35),
            AppColors.gold.withValues(alpha: 0.28),
            _beamCyan.withValues(alpha: 0),
          ],
        ).createShader(beamRect)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
    );

    canvas.drawLine(
      Offset(0, y),
      Offset(size.width, y),
      Paint()
        ..strokeWidth = 1.4
        ..color = _beamCyan.withValues(alpha: 0.75),
    );
  }

  @override
  bool shouldRepaint(covariant ScanningLinePainter oldDelegate) =>
      oldDelegate.progress != progress;
}
