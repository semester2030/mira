import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../../shared/geometry/face_anatomy_geometry.dart';
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
      center: Offset(size.width * 0.5, size.height * 0.50),
      width: size.width * 0.62,
      height: size.height * 0.72,
    );

    final facePath = FaceAnatomyGeometry.outlinePath(faceRect);

    _drawFaceBase(canvas, facePath, faceRect);
    _drawZoneHighlights(canvas, faceRect, facePath);
    if (showMarkers) _drawMarkers(canvas, faceRect, facePath);
    _drawFaceOutline(canvas, facePath);
    _drawZoneLabels(canvas, faceRect);
    if (showZoneScores) _drawZoneScoreBadges(canvas, faceRect);
  }

  void _drawFaceBase(Canvas canvas, Path facePath, Rect faceRect) {
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
    canvas.drawPath(facePath, paint);
  }

  void _drawZoneHighlights(Canvas canvas, Rect faceRect, Path facePath) {
    final highlightMap = {for (final z in zones.where((z) => z.highlight)) z.id: z};

    void drawZone(String id) {
      final zone = highlightMap[id];
      if (zone == null) return;
      final color = _parseHex(zone.highlightColor);
      final alpha = _heatmapAlpha(zone.zoneScore);
      final path = FaceAnatomyGeometry.zonePath(faceRect, id);
      if (path.getBounds().isEmpty) return;

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

    for (final id in [
      'forehead',
      'under_eye',
      'cheek_left',
      'cheek_right',
      'nose',
      'chin',
      'jawline',
    ]) {
      drawZone(id);
    }

    if (highlightMap.containsKey('t_zone')) {
      for (final id in ['forehead', 'nose', 'chin']) {
        drawZone(id);
      }
    }
  }

  void _drawMarkers(Canvas canvas, Rect faceRect, Path facePath) {
    for (final marker in markers) {
      final center = Offset(
        faceRect.left + faceRect.width * marker.x,
        faceRect.top + faceRect.height * marker.y,
      );
      if (!facePath.contains(center)) continue;
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
    final anchors = FaceAnatomyGeometry.zoneAnchors(faceRect);

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

  void _drawFaceOutline(Canvas canvas, Path facePath) {
    canvas.drawPath(
      facePath,
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

    label('الجبهة', Offset(faceRect.center.dx, faceRect.top + faceRect.height * 0.02));
    label('تحت العين', Offset(faceRect.center.dx, faceRect.top + faceRect.height * 0.26));
    label('الخد', Offset(faceRect.left - 4, faceRect.top + faceRect.height * 0.44), align: TextAlign.right);
    label('الخد', Offset(faceRect.right - 68, faceRect.top + faceRect.height * 0.44));
    label('الأنف', Offset(faceRect.center.dx, faceRect.top + faceRect.height * 0.48));
    label('الذقن', Offset(faceRect.center.dx, faceRect.top + faceRect.height * 0.72));
    label('الفك', Offset(faceRect.center.dx, faceRect.top + faceRect.height * 0.82));
  }

  double _heatmapAlpha(int? score) {
    if (score == null) return 0.38;
    final intensity = (100 - score.clamp(0, 100)) / 100;
    return 0.22 + intensity * 0.42;
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
