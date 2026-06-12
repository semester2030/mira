import 'package:flutter/material.dart';

import '../../../domain/constants/report_face_map_spec.dart';
import 'beauty_report_face_map_painter.dart';

/// Animated overlay — fade + subtle scale, driven by concern + score.
class AnimatedOverlayLayer extends StatelessWidget {
  final String concernId;
  final int concernScore;
  final Color color;
  final List<FaceMapRegionHighlight> highlights;
  final Rect paintBounds;
  final Size size;

  const AnimatedOverlayLayer({
    super.key,
    required this.concernId,
    required this.concernScore,
    required this.color,
    required this.highlights,
    required this.paintBounds,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      key: ValueKey('$concernId-$concernScore'),
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: ReportFaceMapSpec.switchDurationMs),
      curve: Curves.easeOutCubic,
      builder: (context, t, _) {
        return Opacity(
          opacity: t,
          child: Transform.scale(
            scale: 0.97 + (0.03 * t),
            child: CustomPaint(
              size: size,
              painter: BeautyReportConcernPainter(
                highlights: highlights,
                highlightColor: color,
                faceBounds: paintBounds,
                concernScore: concernScore,
              ),
            ),
          ),
        );
      },
    );
  }
}
