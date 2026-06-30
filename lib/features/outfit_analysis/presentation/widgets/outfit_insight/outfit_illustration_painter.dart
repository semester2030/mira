import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'outfit_insight_item.dart';

/// Vector-style fashion illustrations — colors driven by analysis.
class OutfitIllustrationPainter extends CustomPainter {
  final OutfitVisualKind kind;
  final Color primary;
  final Color accent;

  OutfitIllustrationPainter({
    required this.kind,
    required this.primary,
    required this.accent,
  });

  @override
  void paint(Canvas canvas, Size size) {
    switch (kind) {
      case OutfitVisualKind.blazer:
        _blazer(canvas, size);
      case OutfitVisualKind.shirt:
        _shirt(canvas, size);
      case OutfitVisualKind.jeans:
        _jeans(canvas, size);
      case OutfitVisualKind.pants:
        _pants(canvas, size);
      case OutfitVisualKind.dress:
        _dress(canvas, size);
      case OutfitVisualKind.skirt:
        _skirt(canvas, size);
      case OutfitVisualKind.shoes:
        _heels(canvas, size);
      case OutfitVisualKind.bag:
        _bag(canvas, size);
      case OutfitVisualKind.watch:
        _watch(canvas, size);
      case OutfitVisualKind.necklace:
        _necklace(canvas, size);
      case OutfitVisualKind.sunglasses:
        _sunglasses(canvas, size);
      case OutfitVisualKind.scarf:
        _scarf(canvas, size);
      case OutfitVisualKind.makeupCompact:
        _makeupCompact(canvas, size);
      case OutfitVisualKind.lipstick:
        _lipstick(canvas, size);
      case OutfitVisualKind.eyeshadow:
        _eyeshadow(canvas, size);
    }
  }

  void _blazer(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final body = Path()
      ..moveTo(w * 0.22, h * 0.18)
      ..lineTo(w * 0.78, h * 0.18)
      ..lineTo(w * 0.82, h * 0.88)
      ..lineTo(w * 0.18, h * 0.88)
      ..close();
    canvas.drawPath(body, _fill(primary));
    canvas.drawPath(body, _stroke(primary.darken(0.15)));

    final lapel = Path()
      ..moveTo(w * 0.5, h * 0.18)
      ..lineTo(w * 0.38, h * 0.42)
      ..lineTo(w * 0.5, h * 0.38)
      ..close();
    canvas.drawPath(lapel, _fill(accent));
    final lapelR = Path()
      ..moveTo(w * 0.5, h * 0.18)
      ..lineTo(w * 0.62, h * 0.42)
      ..lineTo(w * 0.5, h * 0.38)
      ..close();
    canvas.drawPath(lapelR, _fill(accent.darken(0.08)));
    canvas.drawCircle(Offset(w * 0.5, h * 0.52), w * 0.025, _fill(primary.darken(0.2)));
  }

  void _shirt(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.28, h * 0.2)
      ..lineTo(w * 0.72, h * 0.2)
      ..lineTo(w * 0.76, h * 0.85)
      ..lineTo(w * 0.24, h * 0.85)
      ..close();
    canvas.drawPath(path, _fill(primary));
    canvas.drawLine(
      Offset(w * 0.5, h * 0.2),
      Offset(w * 0.5, h * 0.85),
      _stroke(primary.darken(0.12), width: 1.2),
    );
    for (var i = 0; i < 4; i++) {
      final y = h * (0.35 + i * 0.1);
      canvas.drawCircle(Offset(w * 0.5, y), 1.5, _fill(primary.darken(0.2)));
    }
  }

  void _jeans(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final left = Path()
      ..moveTo(w * 0.28, h * 0.12)
      ..lineTo(w * 0.48, h * 0.12)
      ..lineTo(w * 0.46, h * 0.92)
      ..lineTo(w * 0.22, h * 0.92)
      ..close();
    final right = Path()
      ..moveTo(w * 0.52, h * 0.12)
      ..lineTo(w * 0.72, h * 0.12)
      ..lineTo(w * 0.78, h * 0.92)
      ..lineTo(w * 0.54, h * 0.92)
      ..close();
    canvas.drawPath(left, _fill(primary));
    canvas.drawPath(right, _fill(primary.lighten(0.06)));
    canvas.drawLine(
      Offset(w * 0.5, h * 0.12),
      Offset(w * 0.5, h * 0.55),
      _stroke(primary.darken(0.15), width: 1.5),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.26, h * 0.1, w * 0.48, h * 0.06),
        Radius.circular(w * 0.02),
      ),
      _fill(primary.darken(0.1)),
    );
  }

  void _pants(Canvas canvas, Size size) {
    _jeans(canvas, size);
  }

  void _dress(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.35, h * 0.15)
      ..lineTo(w * 0.65, h * 0.15)
      ..lineTo(w * 0.85, h * 0.9)
      ..lineTo(w * 0.15, h * 0.9)
      ..close();
    canvas.drawPath(path, _fill(primary));
    canvas.drawPath(path, _stroke(primary.darken(0.12)));
    canvas.drawArc(
      Rect.fromLTWH(w * 0.35, h * 0.12, w * 0.3, h * 0.12),
      math.pi,
      math.pi,
      false,
      _stroke(accent, width: 2),
    );
  }

  void _skirt(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawRect(Rect.fromLTWH(w * 0.3, h * 0.12, w * 0.4, h * 0.18), _fill(accent));
    final skirt = Path()
      ..moveTo(w * 0.25, h * 0.3)
      ..lineTo(w * 0.75, h * 0.3)
      ..lineTo(w * 0.88, h * 0.88)
      ..lineTo(w * 0.12, h * 0.88)
      ..close();
    canvas.drawPath(skirt, _fill(primary));
  }

  void _heels(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final shoe = Path()
      ..moveTo(w * 0.15, h * 0.55)
      ..quadraticBezierTo(w * 0.35, h * 0.35, w * 0.72, h * 0.42)
      ..lineTo(w * 0.88, h * 0.48)
      ..lineTo(w * 0.82, h * 0.58)
      ..lineTo(w * 0.2, h * 0.58)
      ..close();
    canvas.drawPath(shoe, _fill(primary));
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.82, h * 0.58)
        ..lineTo(w * 0.92, h * 0.82)
        ..lineTo(w * 0.78, h * 0.82)
        ..close(),
      _fill(primary.darken(0.18)),
    );
    canvas.drawPath(shoe, _stroke(primary.darken(0.2), width: 1.2));
  }

  void _bag(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawArc(
      Rect.fromLTWH(w * 0.28, h * 0.08, w * 0.44, h * 0.35),
      math.pi,
      math.pi,
      false,
      _stroke(primary.darken(0.25), width: 3),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.18, h * 0.28, w * 0.64, h * 0.58),
        Radius.circular(w * 0.06),
      ),
      _fill(primary),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.18, h * 0.28, w * 0.64, h * 0.58),
        Radius.circular(w * 0.06),
      ),
      _stroke(primary.darken(0.15)),
    );
    canvas.drawLine(
      Offset(w * 0.18, h * 0.45),
      Offset(w * 0.82, h * 0.45),
      _stroke(accent, width: 2),
    );
  }

  void _watch(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.08, h * 0.38, w * 0.22, h * 0.24),
        const Radius.circular(4),
      ),
      _fill(accent),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.7, h * 0.38, w * 0.22, h * 0.24),
        const Radius.circular(4),
      ),
      _fill(accent),
    );
    canvas.drawCircle(Offset(w * 0.5, h * 0.5), w * 0.22, _fill(primary));
    canvas.drawCircle(Offset(w * 0.5, h * 0.5), w * 0.22, _stroke(primary.darken(0.2), width: 2));
    canvas.drawCircle(Offset(w * 0.5, h * 0.5), w * 0.16, _fill(const Color(0xFFFFF8F0)));
    canvas.drawLine(
      Offset(w * 0.5, h * 0.5),
      Offset(w * 0.5, h * 0.38),
      _stroke(primary.darken(0.3), width: 2),
    );
    canvas.drawLine(
      Offset(w * 0.5, h * 0.5),
      Offset(w * 0.62, h * 0.52),
      _stroke(primary.darken(0.3), width: 1.5),
    );
  }

  void _necklace(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawArc(
      Rect.fromLTWH(w * 0.12, h * 0.15, w * 0.76, h * 0.55),
      0.15,
      math.pi - 0.3,
      false,
      _stroke(primary, width: 3),
    );
    canvas.drawCircle(Offset(w * 0.5, h * 0.62), w * 0.1, _fill(accent));
    canvas.drawCircle(Offset(w * 0.5, h * 0.62), w * 0.1, _stroke(primary.darken(0.15), width: 1.5));
  }

  void _sunglasses(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.08, h * 0.38, w * 0.36, h * 0.28),
        Radius.circular(w * 0.08),
      ),
      _fill(primary.darken(0.35)),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.56, h * 0.38, w * 0.36, h * 0.28),
        Radius.circular(w * 0.08),
      ),
      _fill(primary.darken(0.35)),
    );
    canvas.drawLine(
      Offset(w * 0.44, h * 0.5),
      Offset(w * 0.56, h * 0.5),
      _stroke(primary.darken(0.2), width: 2.5),
    );
    canvas.drawLine(
      Offset(w * 0.08, h * 0.48),
      Offset(w * 0.02, h * 0.46),
      _stroke(primary.darken(0.2), width: 2),
    );
    canvas.drawLine(
      Offset(w * 0.92, h * 0.48),
      Offset(w * 0.98, h * 0.46),
      _stroke(primary.darken(0.2), width: 2),
    );
  }

  void _scarf(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.2, h * 0.2)
      ..quadraticBezierTo(w * 0.5, h * 0.45, w * 0.8, h * 0.22)
      ..lineTo(w * 0.75, h * 0.85)
      ..quadraticBezierTo(w * 0.45, h * 0.65, w * 0.25, h * 0.88)
      ..close();
    canvas.drawPath(path, _fill(primary));
    canvas.drawPath(path, _stroke(primary.darken(0.12)));
  }

  void _makeupCompact(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawOval(Rect.fromLTWH(w * 0.15, h * 0.35, w * 0.7, h * 0.45), _fill(accent));
    canvas.drawOval(Rect.fromLTWH(w * 0.15, h * 0.35, w * 0.7, h * 0.45), _stroke(primary.darken(0.1)));
    canvas.drawArc(
      Rect.fromLTWH(w * 0.22, h * 0.42, w * 0.56, h * 0.28),
      math.pi,
      math.pi,
      false,
      _fill(primary),
    );
    canvas.drawCircle(Offset(w * 0.35, h * 0.52), w * 0.08, _fill(primary.lighten(0.1)));
    canvas.drawCircle(Offset(w * 0.65, h * 0.52), w * 0.08, _fill(primary.darken(0.05)));
  }

  void _lipstick(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.38, h * 0.12, w * 0.24, h * 0.22),
        Radius.circular(w * 0.04),
      ),
      _fill(primary),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.35, h * 0.32, w * 0.3, h * 0.58),
        Radius.circular(w * 0.05),
      ),
      _fill(accent),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.35, h * 0.32, w * 0.3, h * 0.58),
        Radius.circular(w * 0.05),
      ),
      _stroke(primary.darken(0.15)),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.58, h * 0.15, w * 0.18, h * 0.72),
        Radius.circular(w * 0.04),
      ),
      _fill(primary.lighten(0.08)),
    );
  }

  void _eyeshadow(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.12, h * 0.38, w * 0.76, h * 0.42),
        Radius.circular(w * 0.04),
      ),
      _fill(accent),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.12, h * 0.38, w * 0.76, h * 0.42),
        Radius.circular(w * 0.04),
      ),
      _stroke(primary.darken(0.12)),
    );
    final cellW = w * 0.22;
    for (var i = 0; i < 3; i++) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(w * (0.16 + i * 0.24), h * 0.44, cellW, h * 0.18),
          Radius.circular(3),
        ),
        _fill(Color.lerp(primary, accent, i / 2)!),
      );
    }
  }

  Paint _fill(Color c) => Paint()..color = c..style = PaintingStyle.fill;

  Paint _stroke(Color c, {double width = 1.5}) => Paint()
    ..color = c
    ..style = PaintingStyle.stroke
    ..strokeWidth = width
    ..strokeJoin = StrokeJoin.round;

  @override
  bool shouldRepaint(covariant OutfitIllustrationPainter old) =>
      old.kind != kind || old.primary != primary || old.accent != accent;
}

extension _ColorTune on Color {
  Color darken(double amount) {
    final hsl = HSLColor.fromColor(this);
    return hsl.withLightness((hsl.lightness - amount).clamp(0.0, 1.0)).toColor();
  }

  Color lighten(double amount) {
    final hsl = HSLColor.fromColor(this);
    return hsl.withLightness((hsl.lightness + amount).clamp(0.0, 1.0)).toColor();
  }
}
