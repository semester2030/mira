import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/mira_beauty_report.dart';

/// Section 5 — Daily treatment plan (AM/PM) without raw metric labels.
class TreatmentPlanSection extends StatelessWidget {
  final DailyRoutinePlan plan;

  const TreatmentPlanSection({super.key, required this.plan});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionHeader(
          icon: Icons.schedule_rounded,
          title: 'روتينك اليومي',
          subtitle: 'خطوات مخصصة — بدون أرقام تقنية',
        ),
        const SizedBox(height: 12),
        _RoutineBlock(title: '☀️ الصباح', steps: plan.morning),
        const SizedBox(height: 12),
        _RoutineBlock(title: '🌙 المساء', steps: plan.evening),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.goldLight.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: AppColors.gold, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTypography.titleMedium),
              Text(
                subtitle,
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
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
          Text(
            title,
            style: AppTypography.labelLarge.copyWith(color: AppColors.primaryDark),
          ),
          const SizedBox(height: 12),
          ...steps.map(
            (s) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.check_circle_outline, size: 18, color: AppColors.gold),
                  const SizedBox(width: 10),
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
