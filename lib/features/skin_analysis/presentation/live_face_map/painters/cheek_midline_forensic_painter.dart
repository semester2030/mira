import 'package:flutter/material.dart';

import '../models/face_mesh_models.dart';
import '../utils/cheek_midline_crossing.dart';

/// DEBUG ONLY — anatomical midline + left/right cheek polygons + anchors.
class CheekMidlineForensicPainter extends CustomPainter {
  final FaceMeshFrame frame;
  final List<FaceMeshPoint> landmarks;
  final double? midlineX;
  final List<FaceMeshPoint> midlineAnchors;
  final bool anatomicalLeftIsLowerX;

  CheekMidlineForensicPainter({
    required this.frame,
    required this.landmarks,
    required this.midlineX,
    required this.midlineAnchors,
    required this.anatomicalLeftIsLowerX,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final midX = midlineX;
    if (midX == null) return;

    // A — Anatomical midline (vertical through central face axis).
    final top = midlineAnchors.isEmpty
        ? 0.0
        : midlineAnchors.map((p) => p.y).reduce((a, b) => a < b ? a : b) - 20;
    final bottom = midlineAnchors.isEmpty
        ? size.height
        : midlineAnchors.map((p) => p.y).reduce((a, b) => a > b ? a : b) + 20;
    canvas.drawLine(
      Offset(midX, top),
      Offset(midX, bottom),
      Paint()
        ..color = const Color(0xFFFFFF00)
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke,
    );

    // Midline anchor dots (cyan).
    final midDot = Paint()..color = const Color(0xFF00E5FF);
    for (final p in midlineAnchors) {
      canvas.drawCircle(p.toOffset(), 4, midDot);
    }

    FaceRegionPolygon? left;
    FaceRegionPolygon? right;
    for (final r in frame.regions) {
      if (r.id != FaceRegionId.cheek) continue;
      if (r.isLeftSide) {
        left ??= r;
      } else {
        right ??= r;
      }
    }

    // B — Right cheek (magenta), C — Left cheek (lime).
    if (right != null) {
      _drawCheek(
        canvas,
        right,
        stroke: const Color(0xFFFF00AA),
        fill: const Color(0x55FF00AA),
      );
      _drawIndexedAnchors(
        canvas,
        CheekMidlineCrossing.rightCheekLandmarkIndices,
        const Color(0xFFFF80D0),
      );
    }
    if (left != null) {
      _drawCheek(
        canvas,
        left,
        stroke: const Color(0xFF76FF03),
        fill: const Color(0x5576FF03),
      );
      _drawIndexedAnchors(
        canvas,
        CheekMidlineCrossing.leftCheekLandmarkIndices,
        const Color(0xFFB2FF59),
      );
    }

    // Tiny legend top-left of painter area.
    final tp = TextPainter(
      text: TextSpan(
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontFamily: 'Courier',
          height: 1.3,
        ),
        children: [
          const TextSpan(
            text: 'MIDLINE yellow\n',
            style: TextStyle(color: Color(0xFFFFFF00)),
          ),
          const TextSpan(
            text: 'RIGHT cheek magenta\n',
            style: TextStyle(color: Color(0xFFFF00AA)),
          ),
          const TextSpan(
            text: 'LEFT cheek lime\n',
            style: TextStyle(color: Color(0xFF76FF03)),
          ),
          TextSpan(
            text:
                'anatL lowerX=${anatomicalLeftIsLowerX ? "YES" : "NO"} midX=${midX.toStringAsFixed(1)}',
          ),
        ],
      ),
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: 220);
    tp.paint(canvas, Offset(8, size.height - 72));
  }

  void _drawCheek(
    Canvas canvas,
    FaceRegionPolygon region, {
    required Color stroke,
    required Color fill,
  }) {
    if (region.points.length < 3) return;
    final path = Path()
      ..moveTo(region.points.first.x, region.points.first.y);
    for (var i = 1; i < region.points.length; i++) {
      path.lineTo(region.points[i].x, region.points[i].y);
    }
    path.close();
    canvas.drawPath(path, Paint()..color = fill);
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..color = stroke,
    );
  }

  void _drawIndexedAnchors(Canvas canvas, List<int> indices, Color color) {
    if (landmarks.length < 468) return;
    final paint = Paint()..color = color;
    for (final i in indices) {
      if (i < 0 || i >= landmarks.length) continue;
      canvas.drawCircle(landmarks[i].toOffset(), 3.2, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CheekMidlineForensicPainter oldDelegate) =>
      oldDelegate.frame != frame ||
      oldDelegate.midlineX != midlineX ||
      oldDelegate.anatomicalLeftIsLowerX != anatomicalLeftIsLowerX;
}
