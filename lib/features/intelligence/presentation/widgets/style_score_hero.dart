import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/beauty_score_ring.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/mira_style_report.dart';

/// Hero section — MIRA Style Report aggregate score.
class StyleScoreHero extends StatelessWidget {
  final MiraStyleReport report;

  const StyleScoreHero({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        children: [
          Text(
            'MIRA STYLE REPORT',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.gold,
              letterSpacing: 1.4,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          BeautyScoreRing(
            score: report.outfitScore.toDouble(),
            size: 140,
            label: 'مؤشر الإطلالة',
          ),
          const SizedBox(height: 20),
          Text(
            report.headlineAr,
            style: AppTypography.titleLarge.copyWith(height: 1.45),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 6,
            children: [
              _Badge(
                label: report.styleCategoryAr,
                color: AppColors.goldLight.withValues(alpha: 0.45),
              ),
              if (report.occasionReady)
                _Badge(
                  label: 'جاهزة للمناسبة',
                  color: AppColors.success.withValues(alpha: 0.15),
                  textColor: AppColors.success,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color color;
  final Color? textColor;

  const _Badge({
    required this.label,
    required this.color,
    this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: AppTypography.labelLarge.copyWith(
          color: textColor ?? AppColors.primaryDark,
        ),
      ),
    );
  }
}
