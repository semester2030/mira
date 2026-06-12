import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../domain/constants/report_face_map_spec.dart';

/// Thin curved wrinkle lines — visually distinct from area heatmaps.
class WrinkleLinePainter extends CustomPainter {
  final Color color;
  final Rect faceBounds;
  final int concernScore;

  WrinkleLinePainter({
    required this.color,
    required this.faceBounds,
    required this.concernScore,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final alpha = ReportFaceMapSpec.scoreOpacity(concernScore);
    final strokeColor = ReportFaceMapSpec.saturatedColor(color, concernScore);
    final lineCount = 2 + (concernScore / 35).floor();

    _drawForeheadLines(canvas, strokeColor, alpha, lineCount);
    _drawCrowFeet(canvas, strokeColor, alpha, lineCount);
    _drawNasolabialFolds(canvas, strokeColor, alpha);
  }

  void _drawForeheadLines(
    Canvas canvas,
    Color color,
    double alpha,
    int count,
  ) {
    final b = faceBounds;
    for (var i = 0; i < count; i++) {
      final yNorm = 0.26 + i * 0.035;
      final path = Path()
        ..moveTo(b.left + b.width * 0.28, b.top + b.height * yNorm)
        ..cubicTo(
          b.left + b.width * 0.42,
          b.top + b.height * (yNorm - 0.012),
          b.left + b.width * 0.58,
          b.top + b.height * (yNorm + 0.008),
          b.left + b.width * 0.72,
          b.top + b.height * yNorm,
        );

      _strokeLayered(canvas, path, color, alpha * 0.85, 0.7);
    }
  }

  void _drawCrowFeet(
    Canvas canvas,
    Color color,
    double alpha,
    int count,
  ) {
    final b = faceBounds;
    final sides = [
      (startX: 0.22, dir: -1.0),
      (startX: 0.78, dir: 1.0),
    ];

    for (final side in sides) {
      for (var i = 0; i < math.min(count, 3); i++) {
        final yNorm = 0.36 + i * 0.028;
        final x = b.left + b.width * side.startX;
        final y = b.top + b.height * yNorm;
        final path = Path()
          ..moveTo(x, y)
          ..cubicTo(
            x + b.width * 0.04 * side.dir,
            y + b.height * 0.012,
            x + b.width * 0.07 * side.dir,
            y + b.height * 0.022,
            x + b.width * 0.09 * side.dir,
            y + b.height * 0.018,
          );
        _strokeLayered(canvas, path, color, alpha * 0.78, 0.55);
      }
    }
  }

  void _drawNasolabialFolds(Canvas canvas, Color color, double alpha) {
    final b = faceBounds;
    for (final startX in [0.38, 0.62]) {
      final path = Path()
        ..moveTo(b.left + b.width * startX, b.top + b.height * 0.52)
        ..cubicTo(
          b.left + b.width * (startX - 0.02),
          b.top + b.height * 0.60,
          b.left + b.width * (startX - 0.01),
          b.top + b.height * 0.68,
          b.left + b.width * (startX + 0.04),
          b.top + b.height * 0.72,
        );
      _strokeLayered(canvas, path, color, alpha * 0.72, 0.65);
    }
  }

  void _strokeLayered(
    Canvas canvas,
    Path path,
    Color color,
    double alpha,
    double width,
  ) {
    canvas.drawPath(
      path,
      Paint()
        ..color = color.withValues(alpha: alpha * 0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = width + 1.8
        ..strokeCap = StrokeCap.round
        ..maskFilter = ui.MaskFilter.blur(ui.BlurStyle.normal, 2.5),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = color.withValues(alpha: alpha)
        ..style = PaintingStyle.stroke
        ..strokeWidth = width
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = color.withValues(alpha: alpha * 0.45)
        ..style = PaintingStyle.stroke
        ..strokeWidth = width * 0.45
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant WrinkleLinePainter oldDelegate) =>
      oldDelegate.color != color ||
      oldDelegate.faceBounds != faceBounds ||
      oldDelegate.concernScore != concernScore;
}
