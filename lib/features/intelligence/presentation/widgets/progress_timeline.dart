import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/gradients.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/entities/progress_forecast.dart';

/// Simple score timeline — 68 → 74 → 82 style chart.
class ProgressTimeline extends StatelessWidget {
  final List<ProgressTimelinePoint> points;

  const ProgressTimeline({super.key, required this.points});

  @override
  Widget build(BuildContext context) {
    if (points.length < 2) {
      return Text(
        'تحتاجين تحليلين على الأقل لعرض الرسم.',
        style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
      );
    }

    return SizedBox(
      height: 140,
      child: CustomPaint(
        painter: _TimelinePainter(points: points),
        child: Padding(
          padding: const EdgeInsets.only(top: 8, left: 4, right: 4, bottom: 24),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < points.length; i++) ...[
                if (i > 0) const Spacer(),
                _PointLabel(point: points[i]),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _PointLabel extends StatelessWidget {
  final ProgressTimelinePoint point;

  const _PointLabel({required this.point});

  @override
  Widget build(BuildContext context) {
    final date = point.createdAt;
    final label = '${date.day}/${date.month}';
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text(
          '${point.overallScore}',
          style: AppTypography.labelLarge.copyWith(color: AppColors.primaryDark),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary),
        ),
      ],
    );
  }
}

class _TimelinePainter extends CustomPainter {
  final List<ProgressTimelinePoint> points;

  _TimelinePainter({required this.points});

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;

    final minScore = points.map((p) => p.overallScore).reduce((a, b) => a < b ? a : b);
    final maxScore = points.map((p) => p.overallScore).reduce((a, b) => a > b ? a : b);
    final range = (maxScore - minScore).clamp(8, 100);

    final coords = <Offset>[];
    for (var i = 0; i < points.length; i++) {
      final x = (size.width / (points.length - 1)) * i;
      final normalized = (points[i].overallScore - minScore) / range;
      final y = size.height - 36 - (normalized * (size.height - 56));
      coords.add(Offset(x, y));
    }

    final linePaint = Paint()
      ..shader = AppGradients.progress.createShader(
        Rect.fromLTWH(0, 0, size.width, size.height),
      )
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path()..moveTo(coords.first.dx, coords.first.dy);
    for (var i = 1; i < coords.length; i++) {
      path.lineTo(coords[i].dx, coords[i].dy);
    }
    canvas.drawPath(path, linePaint);

    final dotPaint = Paint()..color = AppColors.primary;
    for (final point in coords) {
      canvas.drawCircle(point, 5, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _TimelinePainter oldDelegate) {
    return oldDelegate.points != points;
  }
}
