import 'package:flutter/material.dart';

import '../../domain/entities/outfit_body_pose_metrics.dart';
import '../../domain/entities/outfit_body_silhouette.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// Full-body outfit framing guide — adapts to detected body bounds when available.
class OutfitBodyGuideOverlay extends StatelessWidget {
  final bool frameReady;
  final double pulse;
  final OutfitBodyPoseMetrics pose;

  const OutfitBodyGuideOverlay({
    super.key,
    required this.frameReady,
    required this.pulse,
    this.pose = OutfitBodyPoseMetrics.none,
  });

  static Rect guideRect(Size size, {OutfitBodyPoseMetrics pose = OutfitBodyPoseMetrics.none}) {
    if (pose.bodyBounds != null && pose.hasDetailedTracking) {
      final b = pose.bodyBounds!;
      final padX = b.width * 0.06;
      final padY = b.height * 0.04;
      return Rect.fromLTRB(
        ((b.left - padX).clamp(0.0, 1.0)) * size.width,
        ((b.top - padY).clamp(0.0, 1.0)) * size.height,
        ((b.right + padX).clamp(0.0, 1.0)) * size.width,
        ((b.bottom + padY).clamp(0.0, 1.0)) * size.height,
      );
    }

    final width = size.width * 0.78;
    final height = size.height * 0.88;
    return Rect.fromCenter(
      center: Offset(size.width * 0.5, size.height * 0.52),
      width: width,
      height: height,
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final guide = guideRect(size, pose: pose);
        final borderColor = frameReady ? AppColors.secondary : AppColors.gold;
        final glow = 0.45 + pulse * 0.35;

        return Stack(
          fit: StackFit.expand,
          children: [
            CustomPaint(
              painter: _OutfitGuideMaskPainter(
                guideRect: guide,
                borderColor: borderColor.withValues(alpha: glow),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              top: guide.top - 34,
              child: Text(
                pose.hasDetailedTracking
                    ? 'تتبّع الجسم — ${pose.silhouette.labelAr}'
                    : 'ضعي جسمك بالكامل داخل الإطار',
                textAlign: TextAlign.center,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.onPrimary.withValues(alpha: 0.9),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              top: guide.top + 12,
              child: Text(
                'الرأس',
                textAlign: TextAlign.center,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.gold.withValues(alpha: 0.75),
                  fontSize: 10,
                ),
              ),
            ),
            Positioned(
              left: guide.left + 12,
              top: guide.top + guide.height * 0.18,
              child: _GuideTag(label: 'الكتف'),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: size.height - guide.bottom + 8,
              child: Text(
                'يجب أن تظهر الرأس، القطع، والحذاء',
                textAlign: TextAlign.center,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.onPrimary.withValues(alpha: 0.88),
                ),
              ),
            ),
            Positioned(
              left: guide.left + 12,
              bottom: size.height - guide.bottom + 36,
              child: _GuideTag(label: 'الحذاء'),
            ),
            Positioned(
              right: guide.right - 12,
              top: guide.top + guide.height * 0.42,
              child: _GuideTag(label: 'الإطلالة', alignEnd: true),
            ),
          ],
        );
      },
    );
  }
}

class _GuideTag extends StatelessWidget {
  final String label;
  final bool alignEnd;

  const _GuideTag({required this.label, this.alignEnd = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          color: AppColors.onPrimary.withValues(alpha: 0.92),
        ),
        textAlign: alignEnd ? TextAlign.end : TextAlign.start,
      ),
    );
  }
}

class _OutfitGuideMaskPainter extends CustomPainter {
  final Rect guideRect;
  final Color borderColor;

  _OutfitGuideMaskPainter({
    required this.guideRect,
    required this.borderColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final outer = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final inner = Path()
      ..addRRect(
        RRect.fromRectAndRadius(guideRect, const Radius.circular(28)),
      );
    final mask = Path.combine(PathOperation.difference, outer, inner);
    canvas.drawPath(mask, Paint()..color = Colors.black.withValues(alpha: 0.46));

    canvas.drawRRect(
      RRect.fromRectAndRadius(guideRect, const Radius.circular(28)),
      Paint()
        ..color = borderColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.6,
    );

    _drawGuideLines(canvas);
    _drawCorners(canvas, guideRect);
  }

  void _drawGuideLines(Canvas canvas) {
    final paint = Paint()
      ..color = AppColors.onPrimary.withValues(alpha: 0.12)
      ..strokeWidth = 1;

    for (final fraction in [0.16, 0.34, 0.82]) {
      final y = guideRect.top + guideRect.height * fraction;
      canvas.drawLine(
        Offset(guideRect.left + 16, y),
        Offset(guideRect.right - 16, y),
        paint,
      );
    }
  }

  void _drawCorners(Canvas canvas, Rect rect) {
    const len = 24.0;
    final paint = Paint()
      ..color = AppColors.gold.withValues(alpha: 0.92)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    void corner(Offset origin, bool flipX, bool flipY) {
      final dx = flipX ? -1.0 : 1.0;
      final dy = flipY ? -1.0 : 1.0;
      canvas.drawLine(origin, origin + Offset(dx * len, 0), paint);
      canvas.drawLine(origin, origin + Offset(0, dy * len), paint);
    }

    corner(rect.topLeft + const Offset(12, 12), false, false);
    corner(rect.topRight + const Offset(-12, 12), true, false);
    corner(rect.bottomLeft + const Offset(12, -12), false, true);
    corner(rect.bottomRight + const Offset(-12, -12), true, true);
  }

  @override
  bool shouldRepaint(covariant _OutfitGuideMaskPainter oldDelegate) {
    return oldDelegate.guideRect != guideRect ||
        oldDelegate.borderColor != borderColor;
  }
}
