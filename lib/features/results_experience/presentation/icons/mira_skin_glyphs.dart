import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';

/// Semantic Skin/Beauty glyphs — CustomPainter language (no Material / emoji).
///
/// Stroke and optical size stay consistent across the Skin experience.
abstract final class MiraSkinGlyphs {
  MiraSkinGlyphs._();

  static const double defaultSize = 22;

  static Widget of(
    MiraSkinGlyphId id, {
    double size = defaultSize,
    Color? color,
    bool selected = false,
  }) {
    final c = color ??
        (selected ? AppColors.primaryDark : AppColors.textSecondary);
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _SkinGlyphPainter(id: id, color: c, selected: selected),
      ),
    );
  }

  static MiraSkinGlyphId forConcern(String concernOrMetricId) {
    final id = concernOrMetricId.toLowerCase();
    if (id.contains('hydrat') || id.contains('moisture') || id.contains('ترطيب')) {
      return MiraSkinGlyphId.hydration;
    }
    if (id.contains('pigment') || id.contains('spot') || id.contains('تصبغ')) {
      return MiraSkinGlyphId.pigmentation;
    }
    if (id.contains('wrinkle') || id.contains('تجاعيد')) {
      return MiraSkinGlyphId.wrinkles;
    }
    if (id.contains('texture') || id.contains('ملمس')) {
      return MiraSkinGlyphId.texture;
    }
    if (id.contains('pore') || id.contains('مسام')) {
      return MiraSkinGlyphId.pores;
    }
    if (id.contains('red') || id.contains('احمرار')) {
      return MiraSkinGlyphId.redness;
    }
    if (id.contains('sebum') || id.contains('oil') || id.contains('دهون')) {
      return MiraSkinGlyphId.sebum;
    }
    return MiraSkinGlyphId.skinCare;
  }
}

enum MiraSkinGlyphId {
  hydration,
  pigmentation,
  wrinkles,
  texture,
  pores,
  redness,
  sebum,
  skinCare,
  protection,
  morning,
  evening,
  routine,
  journey,
  history,
  information,
  confidence,
  askMira,
  region,
  chevron,
}

class _SkinGlyphPainter extends CustomPainter {
  _SkinGlyphPainter({
    required this.id,
    required this.color,
    required this.selected,
  });

  final MiraSkinGlyphId id;
  final Color color;
  final bool selected;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = selected ? 1.85 : 1.55
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;

    final fill = Paint()
      ..color = color.withValues(alpha: selected ? 0.22 : 0.12)
      ..style = PaintingStyle.fill;

    final c = Offset(size.width / 2, size.height / 2);
    final r = size.shortestSide * 0.38;

    switch (id) {
      case MiraSkinGlyphId.hydration:
        final path = Path()
          ..moveTo(c.dx, c.dy - r)
          ..cubicTo(
            c.dx + r * 0.85,
            c.dy - r * 0.2,
            c.dx + r * 0.7,
            c.dy + r * 0.75,
            c.dx,
            c.dy + r,
          )
          ..cubicTo(
            c.dx - r * 0.7,
            c.dy + r * 0.75,
            c.dx - r * 0.85,
            c.dy - r * 0.2,
            c.dx,
            c.dy - r,
          );
        canvas.drawPath(path, fill);
        canvas.drawPath(path, stroke);
      case MiraSkinGlyphId.pigmentation:
        canvas.drawCircle(c.translate(-r * 0.35, -r * 0.15), r * 0.28, fill);
        canvas.drawCircle(c.translate(-r * 0.35, -r * 0.15), r * 0.28, stroke);
        canvas.drawCircle(c.translate(r * 0.35, r * 0.1), r * 0.38, fill);
        canvas.drawCircle(c.translate(r * 0.35, r * 0.1), r * 0.38, stroke);
        canvas.drawCircle(c.translate(0, r * 0.45), r * 0.18, stroke);
      case MiraSkinGlyphId.wrinkles:
        for (var i = -1; i <= 1; i++) {
          final y = c.dy + i * r * 0.45;
          canvas.drawLine(
            Offset(c.dx - r * 0.75, y),
            Offset(c.dx + r * 0.75, y),
            stroke,
          );
        }
      case MiraSkinGlyphId.texture:
        for (var row = 0; row < 3; row++) {
          for (var col = 0; col < 3; col++) {
            final o = Offset(
              c.dx - r * 0.55 + col * r * 0.55,
              c.dy - r * 0.55 + row * r * 0.55,
            );
            canvas.drawCircle(o, r * 0.12, stroke);
          }
        }
      case MiraSkinGlyphId.pores:
        canvas.drawCircle(c, r * 0.22, fill);
        canvas.drawCircle(c, r * 0.22, stroke);
        canvas.drawCircle(c.translate(-r * 0.55, -r * 0.35), r * 0.14, stroke);
        canvas.drawCircle(c.translate(r * 0.55, -r * 0.2), r * 0.16, stroke);
        canvas.drawCircle(c.translate(-r * 0.2, r * 0.55), r * 0.13, stroke);
      case MiraSkinGlyphId.redness:
        final blush = Path()
          ..addOval(Rect.fromCenter(center: c, width: r * 1.6, height: r * 1.1));
        canvas.drawPath(blush, fill);
        canvas.drawPath(blush, stroke);
      case MiraSkinGlyphId.sebum:
        canvas.drawCircle(c, r * 0.55, fill);
        canvas.drawCircle(c, r * 0.55, stroke);
        canvas.drawCircle(c.translate(0, -r * 0.15), r * 0.18, stroke);
      case MiraSkinGlyphId.skinCare:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: c, width: r * 1.1, height: r * 1.55),
            Radius.circular(r * 0.25),
          ),
          stroke,
        );
        canvas.drawLine(
          Offset(c.dx, c.dy - r * 0.55),
          Offset(c.dx, c.dy + r * 0.35),
          stroke,
        );
      case MiraSkinGlyphId.protection:
        final shield = Path()
          ..moveTo(c.dx, c.dy - r)
          ..lineTo(c.dx + r * 0.75, c.dy - r * 0.35)
          ..lineTo(c.dx + r * 0.55, c.dy + r * 0.55)
          ..lineTo(c.dx, c.dy + r)
          ..lineTo(c.dx - r * 0.55, c.dy + r * 0.55)
          ..lineTo(c.dx - r * 0.75, c.dy - r * 0.35)
          ..close();
        canvas.drawPath(shield, fill);
        canvas.drawPath(shield, stroke);
      case MiraSkinGlyphId.morning:
        canvas.drawCircle(c, r * 0.35, fill);
        canvas.drawCircle(c, r * 0.35, stroke);
        for (var i = 0; i < 8; i++) {
          final a = i * math.pi / 4;
          final inner = Offset(
            c.dx + r * 0.5 * math.cos(a),
            c.dy + r * 0.5 * math.sin(a),
          );
          final outer = Offset(
            c.dx + r * 0.9 * math.cos(a),
            c.dy + r * 0.9 * math.sin(a),
          );
          canvas.drawLine(inner, outer, stroke);
        }
      case MiraSkinGlyphId.evening:
        final moon = Path()
          ..addOval(Rect.fromCircle(center: c.translate(-r * 0.1, 0), radius: r * 0.7));
        canvas.drawPath(moon, stroke);
        canvas.drawCircle(c.translate(r * 0.25, -r * 0.1), r * 0.55, Paint()
          ..color = AppColors.background
          ..style = PaintingStyle.fill);
        canvas.drawCircle(c.translate(r * 0.25, -r * 0.1), r * 0.55, stroke);
      case MiraSkinGlyphId.routine:
        canvas.drawCircle(c, r * 0.75, stroke);
        canvas.drawArc(
          Rect.fromCircle(center: c, radius: r * 0.45),
          -1.2,
          4.2,
          false,
          stroke,
        );
      case MiraSkinGlyphId.journey:
        final path = Path()
          ..moveTo(c.dx - r, c.dy + r * 0.4)
          ..quadraticBezierTo(c.dx - r * 0.2, c.dy - r, c.dx + r, c.dy - r * 0.2);
        canvas.drawPath(path, stroke);
        canvas.drawCircle(Offset(c.dx + r, c.dy - r * 0.2), r * 0.14, fill);
        canvas.drawCircle(Offset(c.dx + r, c.dy - r * 0.2), r * 0.14, stroke);
      case MiraSkinGlyphId.history:
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromCenter(center: c, width: r * 1.5, height: r * 1.3),
            Radius.circular(r * 0.2),
          ),
          stroke,
        );
        canvas.drawLine(
          Offset(c.dx - r * 0.45, c.dy - r * 0.15),
          Offset(c.dx + r * 0.45, c.dy - r * 0.15),
          stroke,
        );
        canvas.drawLine(
          Offset(c.dx - r * 0.45, c.dy + r * 0.2),
          Offset(c.dx + r * 0.25, c.dy + r * 0.2),
          stroke,
        );
      case MiraSkinGlyphId.information:
        canvas.drawCircle(c, r * 0.85, stroke);
        canvas.drawLine(
          Offset(c.dx, c.dy - r * 0.15),
          Offset(c.dx, c.dy + r * 0.4),
          stroke,
        );
        canvas.drawCircle(Offset(c.dx, c.dy - r * 0.45), r * 0.08, fill);
      case MiraSkinGlyphId.confidence:
        canvas.drawCircle(c, r * 0.75, stroke);
        canvas.drawCircle(c, r * 0.35, fill);
      case MiraSkinGlyphId.askMira:
        final bubble = RRect.fromRectAndRadius(
          Rect.fromCenter(center: c.translate(0, -r * 0.1), width: r * 1.6, height: r * 1.15),
          Radius.circular(r * 0.35),
        );
        canvas.drawRRect(bubble, fill);
        canvas.drawRRect(bubble, stroke);
        canvas.drawLine(
          Offset(c.dx - r * 0.15, c.dy + r * 0.45),
          Offset(c.dx - r * 0.45, c.dy + r * 0.9),
          stroke,
        );
      case MiraSkinGlyphId.region:
        canvas.drawOval(
          Rect.fromCenter(center: c, width: r * 1.3, height: r * 1.6),
          stroke,
        );
      case MiraSkinGlyphId.chevron:
        final path = Path()
          ..moveTo(c.dx + r * 0.25, c.dy - r * 0.55)
          ..lineTo(c.dx - r * 0.25, c.dy)
          ..lineTo(c.dx + r * 0.25, c.dy + r * 0.55);
        canvas.drawPath(path, stroke);
    }
  }

  @override
  bool shouldRepaint(covariant _SkinGlyphPainter oldDelegate) =>
      oldDelegate.id != id ||
      oldDelegate.color != color ||
      oldDelegate.selected != selected;
}
