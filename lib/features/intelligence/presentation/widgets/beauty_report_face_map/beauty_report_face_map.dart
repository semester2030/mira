import 'package:flutter/material.dart';

import '../../../domain/constants/report_face_map_spec.dart';
import 'beauty_report_face_map_painter.dart';
import 'face_map_stack_widgets.dart';
import 'luxury_face_geometry.dart';
import 'premium_face_base_image.dart';

/// Premium beauty-tech face map — Stack: white canvas, face PNG, dynamic overlays.
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
          final color = ReportFaceMapSpec.colorFor(
            concernId,
            fallbackHex: highlightColorHex,
          );
          final highlights = ReportFaceMapSpec.highlightsFor(
            concernId,
            highlightZoneIds,
          );
          final factors = ReportFaceMapSpec.factorsFor(concernId);

          const faceInset = EdgeInsets.fromLTRB(52, 6, 10, 44);
          final faceArea = Rect.fromLTWH(
            faceInset.left,
            faceInset.top,
            size.width - faceInset.horizontal,
            size.height - faceInset.vertical,
          );
          final faceBounds = LuxuryFaceGeometry.faceBoundsIn(faceArea);

          return ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: Stack(
              fit: StackFit.expand,
              children: [
                const ColoredBox(color: ReportFaceMapSpec.mapBackground),
                PremiumFaceBaseImage.layer(faceBounds: faceBounds),
                Positioned.fromRect(
                  rect: faceArea,
                  child: AnimatedSwitcher(
                    duration: const Duration(
                      milliseconds: ReportFaceMapSpec.switchDurationMs,
                    ),
                    switchInCurve: Curves.easeOutCubic,
                    switchOutCurve: Curves.easeInCubic,
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: child,
                    ),
                    child: CustomPaint(
                      key: ValueKey('$concernId-$concernScore'),
                      painter: BeautyReportConcernPainter(
                        highlights: highlights,
                        highlightColor: color,
                        faceBounds: faceBounds,
                        concernScore: concernScore,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 8,
                  top: 52,
                  child: FaceMapFactorColumn(factors: factors, accent: color),
                ),
                Positioned(
                  right: 12,
                  bottom: 10,
                  child: FaceMapIntensityLegend(accent: color),
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
