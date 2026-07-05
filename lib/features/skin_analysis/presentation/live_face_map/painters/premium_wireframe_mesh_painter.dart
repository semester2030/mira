import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../models/face_mesh_models.dart';
import '../topology/mediapipe_wireframe_edges.dart';
import 'smooth_path_builder.dart';

/// TikTok-style live wireframe — glowing mesh, brackets, eye highlights.
class PremiumWireframeMeshPainter extends CustomPainter {
  final FaceMeshFrame frame;
  final List<FaceMeshPoint> landmarks;
  final double pulse;
  final bool lockOn;

  PremiumWireframeMeshPainter({
    required this.frame,
    required this.landmarks,
    required this.pulse,
    this.lockOn = false,
  });

  static const _meshCyan = Color(0xFF5CE1FF);
  static const _meshViolet = Color(0xFF9B7BFF);

  @override
  void paint(Canvas canvas, Size size) {
    if (!frame.hasFace || landmarks.length < 468) return;

    final glow = 0.45 + pulse * 0.55;
    final meshPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = lockOn ? 1.35 : 1.05
      ..isAntiAlias = true
      ..color = _meshCyan.withValues(alpha: 0.22 + glow * 0.38);

    final glowPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.8
      ..isAntiAlias = true
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3)
      ..color = _meshViolet.withValues(alpha: 0.08 + glow * 0.14);

    Offset? pointAt(int index) {
      if (index < 0 || index >= landmarks.length) return null;
      return landmarks[index].toOffset();
    }

    for (final (a, b) in MediapipeWireframeEdges.pairs) {
      final start = pointAt(a);
      final end = pointAt(b);
      if (start == null || end == null) continue;
      canvas.drawLine(start, end, glowPaint);
      canvas.drawLine(start, end, meshPaint);
    }

    if (frame.outline.length >= 8) {
      final oval = SmoothPathBuilder.fromPoints(frame.outline, tension: 0.18);
      canvas.drawPath(
        oval,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6
          ..isAntiAlias = true
          ..color = _meshCyan.withValues(alpha: 0.55 + pulse * 0.25),
      );
    }

    _paintEyeGlow(canvas, MediapipeWireframeEdges.leftEyeGlow, pointAt);
    _paintEyeGlow(canvas, MediapipeWireframeEdges.rightEyeGlow, pointAt);

    final dotPaint = Paint()
      ..isAntiAlias = true
      ..color = _meshCyan.withValues(alpha: 0.35 + pulse * 0.25);
    for (var i = 0; i < landmarks.length && i < 468; i += 3) {
      canvas.drawCircle(landmarks[i].toOffset(), 0.9, dotPaint);
    }

    final box = frame.boundingBox;
    if (box != null && !box.isEmpty) {
      _drawTrackingBrackets(canvas, box.inflate(8), glow, lockOn);
    }
  }

  void _paintEyeGlow(
    Canvas canvas,
    List<int> indices,
    Offset? Function(int index) pointAt,
  ) {
    final points = <Offset>[];
    for (final index in indices) {
      final p = pointAt(index);
      if (p != null) points.add(p);
    }
    if (points.length < 2) return;

    var cx = 0.0;
    var cy = 0.0;
    for (final p in points) {
      cx += p.dx;
      cy += p.dy;
    }
    final center = Offset(cx / points.length, cy / points.length);
    final radius = 10.0 + pulse * 6;

    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..shader = RadialGradient(
          colors: [
            _meshCyan.withValues(alpha: 0.55 + pulse * 0.25),
            _meshCyan.withValues(alpha: 0),
          ],
        ).createShader(Rect.fromCircle(center: center, radius: radius))
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
    );
  }

  void _drawTrackingBrackets(
    Canvas canvas,
    Rect rect,
    double glow,
    bool lockOn,
  ) {
    const len = 26.0;
    final color = lockOn
        ? AppColors.gold.withValues(alpha: 0.95)
        : _meshCyan.withValues(alpha: 0.65 + glow * 0.2);
    final paint = Paint()
      ..color = color
      ..strokeWidth = lockOn ? 3.4 : 2.6
      ..strokeCap = StrokeCap.round;

    void corner(Offset origin, double dx, double dy) {
      canvas.drawLine(origin, origin + Offset(dx * len, 0), paint);
      canvas.drawLine(origin, origin + Offset(0, dy * len), paint);
    }

    corner(rect.topLeft, 1, 1);
    corner(rect.topRight, -1, 1);
    corner(rect.bottomLeft, 1, -1);
    corner(rect.bottomRight, -1, -1);

    if (lockOn) {
      canvas.drawCircle(
        rect.center,
        math.max(rect.width, rect.height) * 0.52,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = AppColors.gold.withValues(alpha: 0.25 + pulse * 0.2),
      );
    }
  }

  @override
  bool shouldRepaint(covariant PremiumWireframeMeshPainter oldDelegate) =>
      oldDelegate.frame != frame ||
      oldDelegate.landmarks != landmarks ||
      oldDelegate.pulse != pulse ||
      oldDelegate.lockOn != lockOn;
}
