import 'package:flutter/material.dart';

import '../../../domain/constants/report_face_map_spec.dart';
import 'animated_overlay_layer.dart';
import 'face_map_stack_widgets.dart';
import 'luxury_face_geometry.dart';
import 'premium_face_base_image.dart';

/// Stack(faceImage, animatedOverlayLayer) — premium guided face map.
class BeautyReportFaceMap extends StatelessWidget {
  final String concernId;
  final List<String> highlightZoneIds;
  final String? highlightColorHex;
  final int concernScore;

  static const mapHeight = 420.0;

  const BeautyReportFaceMap({
    super.key,
    required this.concernId,
    required this.highlightZoneIds,
    required this.concernScore,
    this.highlightColorHex,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: mapHeight,
      width: double.infinity,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final size = Size(constraints.maxWidth, mapHeight);
          final canonicalId = ReportFaceMapSpec.canonicalId(concernId);
          final color = ReportFaceMapSpec.colorFor(
            canonicalId,
            fallbackHex: highlightColorHex,
          );
          final highlights = ReportFaceMapSpec.highlightsFor(
            canonicalId,
            highlightZoneIds,
          );
          final factors = ReportFaceMapSpec.factorsFor(canonicalId);

          const faceInset = EdgeInsets.fromLTRB(52, 6, 10, 24);
          final faceArea = Rect.fromLTWH(
            faceInset.left,
            faceInset.top,
            size.width - faceInset.horizontal,
            size.height - faceInset.vertical,
          );
          final faceRect = LuxuryFaceGeometry.faceBoundsIn(faceArea);
          final paintBounds = LuxuryFaceGeometry.faceBoundsLocal(
            Size(faceRect.width, faceRect.height),
          );

          return ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              fit: StackFit.expand,
              children: [
                const ColoredBox(color: ReportFaceMapSpec.mapBackground),
                PremiumFaceBaseImage.layer(faceBounds: faceRect),
                Positioned.fromRect(
                  rect: faceRect,
                  child: AnimatedOverlayLayer(
                    concernId: canonicalId,
                    concernScore: concernScore,
                    color: color,
                    highlights: highlights,
                    paintBounds: paintBounds,
                    size: Size(faceRect.width, faceRect.height),
                  ),
                ),
                Positioned(
                  left: 8,
                  top: 52,
                  child: FaceMapFactorColumn(factors: factors, accent: color),
                ),
                Positioned(
                  right: 12,
                  bottom: 4,
                  child: FaceMapScoreLegend(
                    accent: color,
                    score: concernScore,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class AnimatedBeautyReportFaceMap extends BeautyReportFaceMap {
  const AnimatedBeautyReportFaceMap({
    super.key,
    required super.concernId,
    required super.highlightZoneIds,
    required super.concernScore,
    super.highlightColorHex,
  });
}
