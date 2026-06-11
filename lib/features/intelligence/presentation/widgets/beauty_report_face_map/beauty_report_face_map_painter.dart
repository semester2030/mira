import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../domain/constants/report_face_map_spec.dart';
import 'luxury_face_geometry.dart';

/// Per-region intensity overlays — premium beauty map, not medical paint.
class BeautyReportConcernPainter extends CustomPainter {
  final List<FaceMapRegionHighlight> highlights;
  final Color highlightColor;
  final Rect faceBounds;
  final int concernScore;

  BeautyReportConcernPainter({
    required this.highlights,
    required this.highlightColor,
    required this.faceBounds,
    required this.concernScore,
  });

  @override
  void paint(Canvas canvas, Size size) {
    for (final item in highlights) {
      final path = LuxuryFaceGeometry.regionPath(
        faceBounds,
        ReportFaceMapSpec.regionId(item.region),
      );
      if (path.getBounds().isEmpty) continue;

      final fillAlpha = ReportFaceMapSpec.fillOpacityFor(item.intensity, concernScore);

      canvas.drawPath(
        path,
        Paint()
          ..color = highlightColor.withValues(alpha: fillAlpha)
          ..style = PaintingStyle.fill
          ..maskFilter = ui.MaskFilter.blur(
            ui.BlurStyle.normal,
            ReportFaceMapSpec.blurSigma,
          ),
      );

      canvas.drawPath(
        path,
        Paint()
          ..color = highlightColor.withValues(alpha: ReportFaceMapSpec.borderOpacity)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8
          ..strokeJoin = StrokeJoin.round,
      );
    }
  }

  @override
  bool shouldRepaint(covariant BeautyReportConcernPainter oldDelegate) =>
      oldDelegate.highlights != highlights ||
      oldDelegate.highlightColor != highlightColor ||
      oldDelegate.faceBounds != faceBounds ||
      oldDelegate.concernScore != concernScore;
}
