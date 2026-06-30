import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/pressable_scale.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/services/outfit_occasion_scoring.dart';
import 'outfit_result_motion.dart';

/// «إطلالتك X% لـ Y — جرّبي مناسبة Z» suggestion card.
class OutfitNextOccasionCard extends StatelessWidget {
  final OutfitAnalysis analysis;
  final VoidCallback? onTryOccasion;

  const OutfitNextOccasionCard({
    super.key,
    required this.analysis,
    this.onTryOccasion,
  });

  @override
  Widget build(BuildContext context) {
    final forecast = OutfitOccasionScoring.suggestNext(analysis);
    if (forecast == null) return const SizedBox.shrink();

    final currentScore = analysis.occasionMatchScore;
    final currentLabel = analysis.occasion.labelAr;
    final nextLabel = forecast.occasion.labelAr;
    final nextScore = forecast.projectedScore;

    final String body;
    if (forecast.deltaFromCurrent >= 3) {
      body = 'إطلالتك $currentScore% لـ $currentLabel — '
          'مناسبة $nextLabel قد تصل إلى $nextScore% مع نفس القطع.';
    } else if (forecast.deltaFromCurrent >= -3) {
      body = 'إطلالتك $currentScore% لـ $currentLabel — '
          'جرّبي $nextLabel لاكتشاف إطلالة جديدة ($nextScore%).';
    } else {
      body = 'لتحدي مختلف: $nextLabel قد تحتاج تعديلات ($nextScore%) '
          'مقارنة بـ $currentLabel ($currentScore%).';
    }

    return OutfitStaggerPop(
      index: 2,
      baseDelayMs: 200,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.primary.withValues(alpha: 0.12),
              AppColors.secondary.withValues(alpha: 0.1),
            ],
          ),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.event_available_rounded, color: AppColors.primary, size: 22),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'مناسبة تالية مقترحة',
                    style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                _OccasionChip(label: nextLabel),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              body,
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary, height: 1.55),
            ),
            const SizedBox(height: 12),
            PressableScale(
              onTap: () {
                HapticFeedback.selectionClick();
                onTryOccasion?.call();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'تحليل إطلالة لـ $nextLabel',
                      style: AppTypography.labelLarge.copyWith(
                        color: AppColors.secondary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Icon(Icons.arrow_back_rounded, size: 18, color: AppColors.secondary),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OccasionChip extends StatelessWidget {
  final String label;

  const _OccasionChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.secondary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          color: AppColors.secondary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
