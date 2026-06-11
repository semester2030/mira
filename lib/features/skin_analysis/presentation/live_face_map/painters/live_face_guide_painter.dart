import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../models/face_mesh_models.dart';
import 'smooth_path_builder.dart';

/// Face-aligned guide — follows MediaPipe outline, not a static oval.
class LiveFaceGuidePainter extends CustomPainter {
  final FaceMeshFrame frame;
  final double pulse;

  LiveFaceGuidePainter({
    required this.frame,
    required this.pulse,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (!frame.hasFace || frame.outline.length < 8) {
      _drawPlaceholder(canvas, size);
      return;
    }

    final path = SmoothPathBuilder.fromPoints(frame.outline, tension: 0.22);
    if (path.getBounds().isEmpty) {
      _drawPlaceholder(canvas, size);
      return;
    }

    final backdrop = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final mask = Path.combine(PathOperation.difference, backdrop, path);
    canvas.drawPath(mask, Paint()..color = Colors.black.withValues(alpha: 0.42));

    final glow = 0.55 + pulse * 0.35;
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.gold.withValues(alpha: glow)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4,
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.primary.withValues(alpha: 0.35 + pulse * 0.2)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );

    _drawCorners(canvas, path.getBounds());
  }

  void _drawPlaceholder(Canvas canvas, Size size) {
    final rect = Rect.fromCenter(
      center: Offset(size.width * 0.5, size.height * 0.48),
      width: size.width * 0.58,
      height: size.height * 0.68,
    );
    canvas.drawPath(
      Path()..addOval(rect),
      Paint()
        ..color = AppColors.gold.withValues(alpha: 0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
  }

  void _drawCorners(Canvas canvas, Rect rect) {
    const len = 22.0;
    final paint = Paint()
      ..color = AppColors.gold.withValues(alpha: 0.9)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    void corner(Offset origin, bool flipX, bool flipY) {
      final dx = flipX ? -1.0 : 1.0;
      final dy = flipY ? -1.0 : 1.0;
      canvas.drawLine(origin, origin + Offset(dx * len, 0), paint);
      canvas.drawLine(origin, origin + Offset(0, dy * len), paint);
    }

    corner(rect.topLeft, false, false);
    corner(rect.topRight, true, false);
    corner(rect.bottomLeft, false, true);
    corner(rect.bottomRight, true, true);
  }

  @override
  bool shouldRepaint(covariant LiveFaceGuidePainter oldDelegate) =>
      oldDelegate.frame != frame || oldDelegate.pulse != pulse;
}
