import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/beauty_score_ring.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/mira_beauty_report.dart';

/// Section 1 — Overall beauty score hero (single aggregate score only).
class BeautyScoreHero extends StatelessWidget {
  final MiraBeautyReport report;

  const BeautyScoreHero({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        children: [
          Text(
            'MIRA BEAUTY REPORT',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.gold,
              letterSpacing: 1.4,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          BeautyScoreRing(
            score: report.overallBeautyScore.toDouble(),
            size: 140,
            label: 'مؤشر جمال البشرة',
          ),
          const SizedBox(height: 20),
          Text(
            report.headlineAr,
            style: AppTypography.titleLarge.copyWith(height: 1.45),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.goldLight.withValues(alpha: 0.45),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'نوع البشرة: ${report.skinTypeAr}',
              style: AppTypography.labelLarge.copyWith(color: AppColors.primaryDark),
            ),
          ),
        ],
      ),
    );
  }
}
