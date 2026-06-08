import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../../intelligence/domain/entities/mira_beauty_report.dart';

class DailyRoutineSection extends StatelessWidget {
  final DailyRoutinePlan plan;

  const DailyRoutineSection({super.key, required this.plan});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('روتينك اليومي', style: AppTypography.titleMedium),
        const SizedBox(height: 12),
        _RoutineBlock(title: '☀️ الصباح', steps: plan.morning),
        const SizedBox(height: 12),
        _RoutineBlock(title: '🌙 المساء', steps: plan.evening),
      ],
    );
  }
}

class _RoutineBlock extends StatelessWidget {
  final String title;
  final List<RoutineStep> steps;

  const _RoutineBlock({required this.title, required this.steps});

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTypography.labelLarge.copyWith(color: AppColors.primaryDark)),
          const SizedBox(height: 10),
          ...steps.map(
            (s) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.check_circle_outline, size: 18, color: AppColors.gold),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.nameAr, style: AppTypography.bodyMedium),
                        Text(
                          s.stepAr,
                          style: AppTypography.labelSmall.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
