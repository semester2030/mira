import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/weekly_plan.dart';

/// Section 6 — 7-day structured improvement plan.
class WeeklyPlanSection extends StatelessWidget {
  final WeeklyPlan plan;

  const WeeklyPlanSection({super.key, required this.plan});

  @override
  Widget build(BuildContext context) {
    if (!plan.enabled || plan.days.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.secondary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.view_week_rounded, color: AppColors.secondary, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('خطة أسبوعية', style: AppTypography.titleMedium),
                  Text(
                    plan.summaryAr,
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...plan.days.map((day) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: PremiumCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: AppColors.goldLight.withValues(alpha: 0.6),
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '${day.dayIndex}',
                            style: AppTypography.labelSmall.copyWith(color: AppColors.primaryDark),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(day.labelAr, style: AppTypography.labelLarge),
                              Text(
                                day.focusAr,
                                style: AppTypography.bodySmall.copyWith(color: AppColors.secondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ...day.stepsAr.map(
                      (step) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.circle, size: 6, color: AppColors.gold),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(step, style: AppTypography.bodySmall.copyWith(height: 1.5)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )),
      ],
    );
  }
}
