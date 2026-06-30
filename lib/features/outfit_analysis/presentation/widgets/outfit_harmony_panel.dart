import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import 'outfit_result_motion.dart';

/// «تناسق الإطلالة معك» — animated harmony bars.
class OutfitHarmonyPanel extends StatelessWidget {
  final int skinToneScore;
  final int occasionScore;
  final int colorHarmonyScore;
  final bool showSkinTone;

  const OutfitHarmonyPanel({
    super.key,
    required this.skinToneScore,
    required this.occasionScore,
    required this.colorHarmonyScore,
    this.showSkinTone = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'تناسق الإطلالة معك',
          style: AppTypography.titleMedium.copyWith(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 14),
        if (showSkinTone) ...[
          OutfitAnimatedHarmonyBar(
            label: 'توافق لون بشرتك',
            score: skinToneScore,
            delayMs: 120,
          ),
          const SizedBox(height: 10),
        ],
        OutfitAnimatedHarmonyBar(
          label: 'ملاءمة المناسبة',
          score: occasionScore,
          delayMs: showSkinTone ? 260 : 120,
        ),
        const SizedBox(height: 10),
        OutfitAnimatedHarmonyBar(
          label: 'انسجام الألوان',
          score: colorHarmonyScore,
          delayMs: showSkinTone ? 400 : 260,
        ),
        const SizedBox(height: 8),
        Text(
          'مقاييس فرعية — درجة الإطلالة الكلية في الأعلى',
          style: AppTypography.labelSmall.copyWith(
            color: AppColors.textSecondary.withValues(alpha: 0.85),
            height: 1.35,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
