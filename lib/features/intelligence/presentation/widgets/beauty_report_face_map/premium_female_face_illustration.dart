import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'luxury_face_geometry.dart';

/// Semi-realistic luxury beauty-tech face — CustomPaint, no cartoon / medical look.
abstract final class PremiumFemaleFaceIllustration {
  static const skinHighlight = Color(0xFFFFF8F4);
  static const skinBase = Color(0xFFF0D8CE);
  static const skinMid = Color(0xFFE8C9BE);
  static const skinShadow = Color(0xFFDDB8AB);
  static const skinContour = Color(0xFFC9A090);
  static const hairDark = Color(0xFF2E221C);
  static const hairMid = Color(0xFF4A382F);
  static const hairLight = Color(0xFF6E5648);
  static const lash = Color(0xFF3D322C);
  static const lip = Color(0xFFD49A9A);
  static const iris = Color(0xFF7A6354);

  static Rect bounds(Size size) => LuxuryFaceGeometry.bounds(size);

  static void paint(Canvas canvas, Size size) =>
      paintInBounds(canvas, bounds(size));

  static void paintInBounds(Canvas canvas, Rect b) {
    _drawHair(canvas, b);
    _drawNeck(canvas, b);
    _drawFaceBase(canvas, b);
    _drawFaceSculpt(canvas, b);
    _drawFeatures(canvas, b);
    _drawContour(canvas, b);
  }

  /// Hair slicked back — luxury editorial look.
  static void _drawHair(Canvas canvas, Rect b) {
    final back = LuxuryFaceGeometry.transform(b, Path()
      ..moveTo(100, 18)
      ..cubicTo(156, 20, 182, 52, 176, 98)
      ..cubicTo(170, 72, 152, 42, 100, 38)
      ..cubicTo(48, 42, 30, 72, 24, 98)
      ..cubicTo(18, 52, 44, 20, 100, 18)
      ..close());

    canvas.drawPath(
      back,
      Paint()
        ..shader = ui.Gradient.linear(
          LuxuryFaceGeometry.map(b, 0.15, 0.05),
          LuxuryFaceGeometry.map(b, 0.85, 0.40),
          [hairDark, hairMid, hairLight, hairDark],
          [0.0, 0.35, 0.65, 1.0],
        ),
    );

    for (final side in [-1.0, 1.0]) {
      final earCover = LuxuryFaceGeometry.transform(b, Path()
        ..moveTo(100 + side * 54, 88)
        ..cubicTo(100 + side * 62, 108, 100 + side * 58, 138, 100 + side * 48, 158)
        ..cubicTo(100 + side * 42, 128, 100 + side * 44, 102, 100 + side * 54, 88)
        ..close());
      canvas.drawPath(earCover, Paint()..color = hairMid.withValues(alpha: 0.85));
    }
  }

  static void _drawNeck(Canvas canvas, Rect b) {
    final path = LuxuryFaceGeometry.transform(b, Path()
      ..moveTo(76, 214)
      ..cubicTo(72, 248, 74, 270, 78, 278)
      ..lineTo(122, 278)
      ..cubicTo(126, 270, 128, 248, 124, 214)
      ..close());
    canvas.drawPath(
      path,
      Paint()
        ..shader = ui.Gradient.linear(
          LuxuryFaceGeometry.map(b, 0.5, 0.76),
          LuxuryFaceGeometry.map(b, 0.5, 0.98),
          [skinBase, skinShadow.withValues(alpha: 0.7)],
        ),
    );
  }

  static void _drawFaceBase(Canvas canvas, Rect b) {
    final face = LuxuryFaceGeometry.transform(b, LuxuryFaceGeometry.faceOutlineNorm());
    canvas.drawPath(
      face,
      Paint()
        ..shader = ui.Gradient.radial(
          LuxuryFaceGeometry.map(b, 0.48, 0.40),
          b.width * 0.55,
          [skinHighlight, skinBase, skinMid, skinShadow.withValues(alpha: 0.55)],
          [0.0, 0.4, 0.72, 1.0],
        ),
    );
  }

  static void _drawFaceSculpt(Canvas canvas, Rect b) {
    final face = LuxuryFaceGeometry.transform(b, LuxuryFaceGeometry.faceOutlineNorm());
    canvas.save();
    canvas.clipPath(face);

    for (final side in [-1.0, 1.0]) {
      final cheekShadow = Path()
        ..moveTo(b.center.dx + side * b.width * 0.06, b.top + b.height * 0.36)
        ..cubicTo(
          b.center.dx + side * b.width * 0.24,
          b.top + b.height * 0.46,
          b.center.dx + side * b.width * 0.22,
          b.top + b.height * 0.64,
          b.center.dx + side * b.width * 0.08,
          b.top + b.height * 0.60,
        )
        ..close();
      canvas.drawPath(
        cheekShadow,
        Paint()..color = skinContour.withValues(alpha: 0.14),
      );
    }

    final foreheadGlow = Path()
      ..moveTo(b.center.dx - b.width * 0.14, b.top + b.height * 0.16)
      ..cubicTo(
        b.center.dx,
        b.top + b.height * 0.12,
        b.center.dx + b.width * 0.14,
        b.top + b.height * 0.16,
        b.center.dx + b.width * 0.10,
        b.top + b.height * 0.24,
      )
      ..cubicTo(
        b.center.dx,
        b.top + b.height * 0.22,
        b.center.dx - b.width * 0.10,
        b.top + b.height * 0.24,
        b.center.dx - b.width * 0.14,
        b.top + b.height * 0.16,
      )
      ..close();
    canvas.drawPath(
      foreheadGlow,
      Paint()..color = Colors.white.withValues(alpha: 0.18),
    );

    final noseShadow = Path()
      ..moveTo(b.center.dx - b.width * 0.02, b.top + b.height * 0.36)
      ..cubicTo(
        b.center.dx - b.width * 0.06,
        b.top + b.height * 0.50,
        b.center.dx - b.width * 0.04,
        b.top + b.height * 0.58,
        b.center.dx,
        b.top + b.height * 0.56,
      )
      ..close();
    canvas.drawPath(
      noseShadow,
      Paint()..color = skinContour.withValues(alpha: 0.08),
    );

    canvas.restore();
  }

  static void _drawFeatures(Canvas canvas, Rect b) {
    _drawBrows(canvas, b);
    _drawEyes(canvas, b);
    _drawNose(canvas, b);
    _drawLips(canvas, b);
  }

  static void _drawBrows(Canvas canvas, Rect b) {
    final paint = Paint()
      ..color = hairDark.withValues(alpha: 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round;

    for (final side in [-1.0, 1.0]) {
      final path = LuxuryFaceGeometry.transform(b, Path()
        ..moveTo(100 + side * 10, 72)
        ..cubicTo(100 + side * 20, 68, 100 + side * 30, 70, 100 + side * 36, 74));
      canvas.drawPath(path, paint);
    }
  }

  static void _drawEyes(Canvas canvas, Rect b) {
    for (final side in [-1.0, 1.0]) {
      final eye = LuxuryFaceGeometry.transform(b, Path()
        ..moveTo(100 + side * 32, 98)
        ..cubicTo(100 + side * 22, 93, 100 + side * 12, 95, 100 + side * 10, 102)
        ..cubicTo(100 + side * 12, 109, 100 + side * 22, 111, 100 + side * 32, 106)
        ..cubicTo(100 + side * 34, 102, 100 + side * 34, 100, 100 + side * 32, 98)
        ..close());

      canvas.drawPath(eye, Paint()..color = Colors.white.withValues(alpha: 0.95));

      final irisPath = LuxuryFaceGeometry.transform(b, Path()
        ..addOval(Rect.fromCenter(
          center: Offset(100 + side * 22, 102),
          width: 10,
          height: 8,
        )));
      canvas.drawPath(
        irisPath,
        Paint()
          ..shader = ui.Gradient.radial(
            LuxuryFaceGeometry.map(b, 0.5 + side * 0.09, 0.365),
            b.width * 0.028,
            [const Color(0xFF9A7E6A), iris, hairDark.withValues(alpha: 0.85)],
            [0.0, 0.55, 1.0],
          ),
      );

      canvas.drawCircle(
        LuxuryFaceGeometry.map(b, 0.5 + side * 0.095, 0.358),
        b.width * 0.008,
        Paint()..color = Colors.white.withValues(alpha: 0.75),
      );

      canvas.drawPath(
        eye,
        Paint()
          ..color = lash.withValues(alpha: 0.4)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.0,
      );
    }
  }

  static void _drawNose(Canvas canvas, Rect b) {
    final bridge = LuxuryFaceGeometry.transform(b, Path()
      ..moveTo(100, 102)
      ..cubicTo(99, 122, 98, 140, 97, 150));
    canvas.drawPath(
      bridge,
      Paint()
        ..color = skinContour.withValues(alpha: 0.22)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.3
        ..strokeCap = StrokeCap.round,
    );

    final tip = LuxuryFaceGeometry.transform(b, Path()
      ..moveTo(93, 150)
      ..cubicTo(97, 154, 103, 154, 107, 150));
    canvas.drawPath(
      tip,
      Paint()
        ..color = skinContour.withValues(alpha: 0.18)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0,
    );
  }

  static void _drawLips(Canvas canvas, Rect b) {
    final lips = LuxuryFaceGeometry.transform(b, Path()
      ..moveTo(86, 174)
      ..cubicTo(92, 169, 108, 169, 114, 174)
      ..cubicTo(110, 180, 100, 182, 90, 180)
      ..cubicTo(86, 178, 84, 176, 86, 174)
      ..close());
    canvas.drawPath(
      lips,
      Paint()
        ..shader = ui.Gradient.linear(
          LuxuryFaceGeometry.map(b, 0.43, 0.61),
          LuxuryFaceGeometry.map(b, 0.57, 0.65),
          [lip.withValues(alpha: 0.5), lip.withValues(alpha: 0.72)],
        ),
    );
    canvas.drawPath(
      lips,
      Paint()
        ..color = lip.withValues(alpha: 0.3)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.7,
    );
  }

  static void _drawContour(Canvas canvas, Rect b) {
    final face = LuxuryFaceGeometry.transform(b, LuxuryFaceGeometry.faceOutlineNorm());
    canvas.drawPath(
      face,
      Paint()
        ..color = skinContour.withValues(alpha: 0.22)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 0.8,
    );
  }

  static Path zonePath(Rect bounds, String zoneId) =>
      LuxuryFaceGeometry.regionPath(bounds, zoneId);
}
