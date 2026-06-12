import 'package:flutter/material.dart';

import '../../../domain/constants/report_face_map_spec.dart';
import 'acne_spot_painter.dart';
import 'heatmap_overlay_painter.dart';
import 'texture_grain_painter.dart';
import 'wrinkle_line_painter.dart';

/// Dispatches to the correct premium renderer per concern type.
class BeautyReportConcernPainter extends CustomPainter {
  final String concernId;
  final List<FaceMapRegionHighlight> highlights;
  final Color highlightColor;
  final Rect faceBounds;
  final int concernScore;

  BeautyReportConcernPainter({
    required this.concernId,
    required this.highlights,
    required this.highlightColor,
    required this.faceBounds,
    required this.concernScore,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final mode = ReportFaceMapSpec.renderModeFor(concernId);
    final painter = switch (mode) {
      FaceMapRenderMode.heatmap => HeatmapOverlayPainter(
          highlights: highlights,
          highlightColor: highlightColor,
          faceBounds: faceBounds,
          concernScore: concernScore,
        ),
      FaceMapRenderMode.wrinkleLines => WrinkleLinePainter(
          color: highlightColor,
          faceBounds: faceBounds,
          concernScore: concernScore,
        ),
      FaceMapRenderMode.acneSpots => AcneSpotPainter(
          color: highlightColor,
          faceBounds: faceBounds,
          concernScore: concernScore,
        ),
      FaceMapRenderMode.textureGrain => TextureGrainPainter(
          color: highlightColor,
          faceBounds: faceBounds,
          concernScore: concernScore,
        ),
    };
    painter.paint(canvas, size);
  }

  @override
  bool shouldRepaint(covariant BeautyReportConcernPainter oldDelegate) =>
      oldDelegate.concernId != concernId ||
      oldDelegate.highlights != highlights ||
      oldDelegate.highlightColor != highlightColor ||
      oldDelegate.faceBounds != faceBounds ||
      oldDelegate.concernScore != concernScore;
}
