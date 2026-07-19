import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../face_tracking_quality.dart';
import '../models/face_mesh_models.dart';
import 'smooth_path_builder.dart';

/// Progress ring around the face — fills as tracking quality improves.
class FaceTrackingRingPainter extends CustomPainter {
  final FaceMeshFrame frame;
  final double pulse;
  final bool lockOn;

  FaceTrackingRingPainter({
    required this.frame,
    required this.pulse,
    this.lockOn = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (!frame.hasFace || frame.outline.length < 8) return;

    final path = SmoothPathBuilder.fromPoints(frame.outline, tension: 0.2);
    final bounds = path.getBounds();
    if (bounds.isEmpty) return;

    final progress = switch (frame.quality) {
      FaceTrackingQuality.high => 1.0,
      FaceTrackingQuality.medium => 0.72,
      FaceTrackingQuality.low => 0.34,
    };

    final metrics = path.computeMetrics().toList();
    if (metrics.isEmpty) return;

    final metric = metrics.first;
    final total = metric.length;
    final sweep = total * progress;
    if (sweep <= 0) return;

    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..isAntiAlias = true
      ..color = Colors.white.withValues(alpha: 0.12);

    final progressPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = lockOn ? 3.8 : 3.2
      ..strokeCap = StrokeCap.round
      ..isAntiAlias = true
      ..shader = SweepGradient(
        startAngle: -math.pi / 2,
        endAngle: 3 * math.pi / 2,
        colors: lockOn
            ? [
                AppColors.gold,
                AppColors.goldLight,
                AppColors.secondary,
                AppColors.gold,
              ]
            : [
                const Color(0xFF5CE1FF),
                AppColors.secondary,
                AppColors.primary,
                const Color(0xFF5CE1FF),
              ],
      ).createShader(bounds.inflate(12));

    canvas.drawPath(path, trackPaint);

    final arc = metric.extractPath(0, sweep);
    canvas.drawPath(arc, progressPaint);

    if (lockOn) {
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 6
          ..isAntiAlias = true
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8)
          ..color = AppColors.gold.withValues(alpha: 0.18 + pulse * 0.22),
      );
    }
  }

  @override
  bool shouldRepaint(covariant FaceTrackingRingPainter oldDelegate) =>
      oldDelegate.frame != frame ||
      oldDelegate.pulse != pulse ||
      oldDelegate.lockOn != lockOn;
}
