import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/beauty_score_ring.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/mira_beauty_report.dart';
import '../../domain/entities/result_provenance.dart';

/// Section 1 — Skin Vitality Index hero (legacy field: overallBeautyScore).
class BeautyScoreHero extends StatelessWidget {
  final MiraBeautyReport report;

  const BeautyScoreHero({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    if (!report.canDisplayInProduction) {
      return PremiumCard(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Text(
          report.provenance?.unavailableReason ??
              'النتيجة غير متاحة للعرض في الإنتاج.',
          style: AppTypography.bodyMedium,
          textAlign: TextAlign.center,
        ),
      );
    }

    return PremiumCard(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        children: [
          Text(
            'MIRA SKIN REPORT',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.gold,
              letterSpacing: 1.4,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 16),
          BeautyScoreRing(
            score: report.skinVitalityIndex.toDouble(),
            size: 140,
            label: report.displayScoreLabelAr,
          ),
          const SizedBox(height: 12),
          Text(
            report.scoreSupportingAr,
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.textSecondary,
              height: 1.45,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
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
              style: AppTypography.labelLarge
                  .copyWith(color: AppColors.primaryDark),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            report.disclaimerAr.isNotEmpty
                ? report.disclaimerAr
                : CosmeticCopy.disclaimerAr,
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textSecondary,
              height: 1.4,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
