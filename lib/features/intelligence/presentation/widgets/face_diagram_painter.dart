import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../domain/entities/face_health_map.dart';

/// Premium face diagram with Playground-style zone heatmap, scores, and markers.
class FaceDiagramPainter extends CustomPainter {
  final List<FaceHealthZone> zones;
  final List<FaceHealthSpatialMarker> markers;
  final bool showZoneScores;
  final bool showMarkers;

  FaceDiagramPainter({
    required this.zones,
    this.markers = const [],
    this.showZoneScores = false,
    this.showMarkers = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final faceRect = Rect.fromCenter(
      center: Offset(size.width * 0.5, size.height * 0.52),
      width: size.width * 0.68,
      height: size.height * 0.82,
    );

    _drawFaceBase(canvas, faceRect);
    _drawZoneHighlights(canvas, faceRect);
    if (showMarkers) _drawMarkers(canvas, faceRect);
    _drawFaceOutline(canvas, faceRect);
    _drawZoneLabels(canvas, faceRect);
    if (showZoneScores) _drawZoneScoreBadges(canvas, faceRect);
  }

  void _drawFaceBase(Canvas canvas, Rect faceRect) {
    final path = _faceOutlinePath(faceRect);
    final paint = Paint()
      ..shader = ui.Gradient.linear(
        faceRect.topCenter,
        faceRect.bottomCenter,
        [
          const Color(0xFFFFF7FA),
          const Color(0xFFFADAE9),
          const Color(0xFFE8D5F2).withValues(alpha: 0.55),
        ],
      );
    canvas.drawPath(path, paint);
  }

  void _drawZoneHighlights(Canvas canvas, Rect faceRect) {
    final highlightMap = {for (final z in zones.where((z) => z.highlight)) z.id: z};

    void drawZone(String id, Path path, {Offset? scoreAnchor}) {
      final zone = highlightMap[id];
      if (zone == null) return;
      final color = _parseHex(zone.highlightColor);
      final alpha = _heatmapAlpha(zone.zoneScore);
      canvas.drawPath(
        path,
        Paint()
          ..color = color.withValues(alpha: alpha)
          ..style = PaintingStyle.fill,
      );
      canvas.drawPath(
        path,
        Paint()
          ..color = color.withValues(alpha: alpha + 0.12)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.4,
      );
    }

    drawZone('forehead', _foreheadPath(faceRect));
    drawZone('under_eye', _underEyePath(faceRect));
    drawZone('cheek_left', _cheekLeftPath(faceRect));
    drawZone('cheek_right', _cheekRightPath(faceRect));
    drawZone('nose', _nosePath(faceRect));
    drawZone('chin', _chinPath(faceRect));
    drawZone('jawline', _jawlinePath(faceRect));

    if (highlightMap.containsKey('t_zone')) {
      final tZone = Path()
        ..addPath(_foreheadPath(faceRect), Offset.zero)
        ..addPath(_nosePath(faceRect), Offset.zero)
        ..addPath(_chinPath(faceRect), Offset.zero);
      drawZone('t_zone', tZone);
    }
  }

  void _drawMarkers(Canvas canvas, Rect faceRect) {
    for (final marker in markers) {
      final center = Offset(
        faceRect.left + faceRect.width * marker.x,
        faceRect.top + faceRect.height * marker.y,
      );
      final radius = 3.5 + marker.severity * 0.8;
      canvas.drawCircle(
        center,
        radius + 2,
        Paint()..color = Colors.white.withValues(alpha: 0.85),
      );
      canvas.drawCircle(
        center,
        radius,
        Paint()..color = const Color(0xFFE74C3C).withValues(alpha: 0.75),
      );
    }
  }

  void _drawZoneScoreBadges(Canvas canvas, Rect faceRect) {
    final anchors = <String, Offset>{
      'forehead': Offset(faceRect.center.dx, faceRect.top + faceRect.height * 0.14),
      'under_eye': Offset(faceRect.center.dx, faceRect.top + faceRect.height * 0.32),
      'cheek_left': Offset(faceRect.left + faceRect.width * 0.22, faceRect.center.dy + 4),
      'cheek_right': Offset(faceRect.right - faceRect.width * 0.22, faceRect.center.dy + 4),
      'nose': Offset(faceRect.center.dx, faceRect.center.dy + 8),
      'chin': Offset(faceRect.center.dx, faceRect.bottom - faceRect.height * 0.1),
      't_zone': Offset(faceRect.center.dx, faceRect.center.dy - 8),
    };

    for (final zone in zones) {
      final score = zone.zoneScore;
      if (score == null || !zone.highlight) continue;
      final anchor = anchors[zone.id];
      if (anchor == null) continue;
      _drawScoreBadge(canvas, anchor, score, _parseHex(zone.highlightColor));
    }
  }

  void _drawScoreBadge(Canvas canvas, Offset center, int score, Color color) {
    const badgeR = 14.0;
    canvas.drawCircle(
      center,
      badgeR + 1.5,
      Paint()..color = Colors.white.withValues(alpha: 0.92),
    );
    canvas.drawCircle(
      center,
      badgeR,
      Paint()..color = color.withValues(alpha: 0.88),
    );
    final tp = TextPainter(
      text: TextSpan(
        text: '$score',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
  }

  void _drawFaceOutline(Canvas canvas, Rect faceRect) {
    canvas.drawPath(
      _faceOutlinePath(faceRect),
      Paint()
        ..color = const Color(0xFFC19EE0).withValues(alpha: 0.45)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6,
    );
  }

  void _drawZoneLabels(Canvas canvas, Rect faceRect) {
    const labelStyle = TextStyle(
      fontSize: 10,
      color: Color(0xFF6D5C5C),
      fontWeight: FontWeight.w500,
      height: 1.1,
    );

    void label(String text, Offset anchor, {TextAlign align = TextAlign.center}) {
      final painter = TextPainter(
        text: TextSpan(text: text, style: labelStyle),
        textAlign: align,
        textDirection: TextDirection.rtl,
      )..layout(maxWidth: 72);
      final offset = switch (align) {
        TextAlign.left => anchor,
        TextAlign.right => Offset(anchor.dx - painter.width, anchor.dy),
        _ => Offset(anchor.dx - painter.width / 2, anchor.dy),
      };
      painter.paint(canvas, offset);
    }

    label('الجبهة', Offset(faceRect.center.dx, faceRect.top - 6));
    label('تحت العين', Offset(faceRect.center.dx, faceRect.top + faceRect.height * 0.28));
    label('الخد', Offset(faceRect.left - 4, faceRect.center.dy), align: TextAlign.right);
    label('الخد', Offset(faceRect.right - 68, faceRect.center.dy));
    label('الأنف', Offset(faceRect.center.dx, faceRect.center.dy + 8));
    label('الذقن', Offset(faceRect.center.dx, faceRect.bottom - 18));
    label('الفك', Offset(faceRect.center.dx, faceRect.bottom + 2));
  }

  double _heatmapAlpha(int? score) {
    if (score == null) return 0.38;
    final intensity = (100 - score.clamp(0, 100)) / 100;
    return 0.22 + intensity * 0.42;
  }

  Path _faceOutlinePath(Rect r) {
    return Path()
      ..moveTo(r.center.dx, r.top + r.height * 0.02)
      ..quadraticBezierTo(r.right + r.width * 0.06, r.top + r.height * 0.22, r.right - r.width * 0.04, r.center.dy)
      ..quadraticBezierTo(r.right - r.width * 0.02, r.bottom - r.height * 0.08, r.center.dx, r.bottom)
      ..quadraticBezierTo(r.left + r.width * 0.02, r.bottom - r.height * 0.08, r.left + r.width * 0.04, r.center.dy)
      ..quadraticBezierTo(r.left - r.width * 0.06, r.top + r.height * 0.22, r.center.dx, r.top + r.height * 0.02)
      ..close();
  }

  Path _foreheadPath(Rect r) => Path()
    ..addOval(Rect.fromCenter(
      center: Offset(r.center.dx, r.top + r.height * 0.14),
      width: r.width * 0.78,
      height: r.height * 0.18,
    ));

  Path _underEyePath(Rect r) {
    final path = Path();
    final y = r.top + r.height * 0.32;
    path.addOval(Rect.fromCenter(center: Offset(r.center.dx - r.width * 0.18, y), width: r.width * 0.22, height: r.height * 0.08));
    path.addOval(Rect.fromCenter(center: Offset(r.center.dx + r.width * 0.18, y), width: r.width * 0.22, height: r.height * 0.08));
    return path;
  }

  Path _cheekLeftPath(Rect r) => Path()
    ..addOval(Rect.fromCenter(
      center: Offset(r.left + r.width * 0.22, r.center.dy + r.height * 0.04),
      width: r.width * 0.28,
      height: r.height * 0.22,
    ));

  Path _cheekRightPath(Rect r) => Path()
    ..addOval(Rect.fromCenter(
      center: Offset(r.right - r.width * 0.22, r.center.dy + r.height * 0.04),
      width: r.width * 0.28,
      height: r.height * 0.22,
    ));

  Path _nosePath(Rect r) => Path()
    ..addRRect(RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(r.center.dx, r.center.dy + r.height * 0.06),
        width: r.width * 0.14,
        height: r.height * 0.22,
      ),
      const Radius.circular(10),
    ));

  Path _chinPath(Rect r) => Path()
    ..addOval(Rect.fromCenter(
      center: Offset(r.center.dx, r.bottom - r.height * 0.1),
      width: r.width * 0.36,
      height: r.height * 0.14,
    ));

  Path _jawlinePath(Rect r) {
    final path = Path()
      ..moveTo(r.left + r.width * 0.18, r.bottom - r.height * 0.06)
      ..quadraticBezierTo(r.center.dx, r.bottom + r.height * 0.04, r.right - r.width * 0.18, r.bottom - r.height * 0.06);
    return path;
  }

  Color _parseHex(String hex) {
    final value = hex.replaceFirst('#', '');
    return Color(int.parse('FF$value', radix: 16));
  }

  @override
  bool shouldRepaint(covariant FaceDiagramPainter oldDelegate) =>
      oldDelegate.zones != zones ||
      oldDelegate.markers != markers ||
      oldDelegate.showZoneScores != showZoneScores ||
      oldDelegate.showMarkers != showMarkers;
}
