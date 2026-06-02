import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/entities/skin_concern_score.dart';

/// Spider / radar chart for skin health matrix (Perfect Corp–style).
class SkinHealthRadarChart extends StatelessWidget {
  final List<SkinConcernScore> scores;
  final double size;

  const SkinHealthRadarChart({
    super.key,
    required this.scores,
    this.size = 260,
  });

  @override
  Widget build(BuildContext context) {
    if (scores.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(
          width: size,
          height: size,
          child: CustomPaint(
            painter: _RadarPainter(scores: scores),
          ),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.center,
          children: scores
              .map(
                (c) => _ScoreChip(
                  label: c.labelAr,
                  score: c.score,
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _ScoreChip extends StatelessWidget {
  final String label;
  final int score;

  const _ScoreChip({required this.label, required this.score});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Text(
        '$label · $score',
        style: AppTypography.labelSmall.copyWith(color: AppColors.textPrimary),
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  final List<SkinConcernScore> scores;

  _RadarPainter({required this.scores});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width * 0.34;
    final n = scores.length;
    if (n < 3) return;

    final angles = List.generate(n, (i) => -math.pi / 2 + (2 * math.pi * i / n));

    _drawGrid(canvas, center, radius, n, angles);
    _drawData(canvas, center, radius, angles);
    _drawLabels(canvas, center, radius * 1.28, angles);
  }

  void _drawGrid(
    Canvas canvas,
    Offset center,
    double radius,
    int n,
    List<double> angles,
  ) {
    final gridPaint = Paint()
      ..color = AppColors.border.withValues(alpha: 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    for (var ring = 1; ring <= 4; ring++) {
      final r = radius * ring / 4;
      final path = Path();
      for (var i = 0; i < n; i++) {
        final p = _point(center, r, angles[i]);
        if (i == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      path.close();
      canvas.drawPath(path, gridPaint);
    }

    for (var i = 0; i < n; i++) {
      canvas.drawLine(center, _point(center, radius, angles[i]), gridPaint);
    }
  }

  void _drawData(Canvas canvas, Offset center, double radius, List<double> angles) {
    final path = Path();
    for (var i = 0; i < scores.length; i++) {
      final r = radius * (scores[i].score / 100);
      final p = _point(center, r, angles[i]);
      if (i == 0) {
        path.moveTo(p.dx, p.dy);
      } else {
        path.lineTo(p.dx, p.dy);
      }
    }
    path.close();

    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.primary.withValues(alpha: 0.25)
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = AppColors.primary
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    for (var i = 0; i < scores.length; i++) {
      final r = radius * (scores[i].score / 100);
      final p = _point(center, r, angles[i]);
      canvas.drawCircle(p, 4, Paint()..color = AppColors.primaryDark);
    }
  }

  void _drawLabels(
    Canvas canvas,
    Offset center,
    double labelRadius,
    List<double> angles,
  ) {
    for (var i = 0; i < scores.length; i++) {
      final p = _point(center, labelRadius, angles[i]);
      final tp = TextPainter(
        text: TextSpan(
          text: scores[i].labelAr,
          style: AppTypography.labelSmall.copyWith(
            color: AppColors.textSecondary,
            fontSize: 11,
          ),
        ),
        textDirection: TextDirection.rtl,
      )..layout(maxWidth: 72);

      tp.paint(canvas, Offset(p.dx - tp.width / 2, p.dy - tp.height / 2));
    }
  }

  Offset _point(Offset center, double r, double angle) {
    return Offset(center.dx + r * math.cos(angle), center.dy + r * math.sin(angle));
  }

  @override
  bool shouldRepaint(covariant _RadarPainter oldDelegate) =>
      oldDelegate.scores != scores;
}
