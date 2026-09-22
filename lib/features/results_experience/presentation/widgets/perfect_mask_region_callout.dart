import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../geometry/skin_face_map_visual_tokens.dart';

/// Contextual Face Explorer callout — informational only.
/// Does NOT define Perfect mask geometry. No landmark polygons.
class PerfectMaskRegionCallout extends StatelessWidget {
  const PerfectMaskRegionCallout({
    super.key,
    required this.regionLabelAr,
    required this.metricLabelAr,
    this.uiScore,
    required this.accent,
    this.visible = true,
  });

  final String regionLabelAr;
  final String metricLabelAr;
  final double? uiScore;
  final Color accent;
  final bool visible;

  @override
  Widget build(BuildContext context) {
    return AnimatedScale(
      scale: visible ? 1 : 0.92,
      duration: SkinFaceMapVisualTokens.calloutAppear,
      curve: Curves.easeOutCubic,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: SkinFaceMapVisualTokens.calloutAppear,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 148),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.analysisCalloutSurface,
            borderRadius: BorderRadius.circular(14),
            boxShadow: const [
              BoxShadow(
                color: AppColors.shadow,
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                regionLabelAr,
                style: AppTypography.labelSmall.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                metricLabelAr,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textTertiary,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (uiScore != null) ...[
                const SizedBox(height: 4),
                Text(
                  uiScore!.round().toString(),
                  style: AppTypography.titleSmall.copyWith(
                    fontWeight: FontWeight.w800,
                    color: accent,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Thin informational connector — never draws Perfect detection geometry.
class PerfectMaskCalloutConnector extends StatelessWidget {
  const PerfectMaskCalloutConnector({
    super.key,
    required this.accent,
  });

  final Color accent;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(28, 36),
      painter: _CalloutLinePainter(color: accent.withValues(alpha: 0.55)),
    );
  }
}

class _CalloutLinePainter extends CustomPainter {
  _CalloutLinePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.1
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final path = Path()
      ..moveTo(size.width * 0.15, size.height)
      ..quadraticBezierTo(
        size.width * 0.35,
        size.height * 0.45,
        size.width * 0.85,
        0,
      );
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _CalloutLinePainter oldDelegate) =>
      oldDelegate.color != color;
}
