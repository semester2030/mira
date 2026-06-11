import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/beauty_journey.dart';

/// Phase 7c — Beauty Journey: current state → next goal → plan.
class BeautyJourneySection extends StatelessWidget {
  final BeautyJourney journey;

  const BeautyJourneySection({super.key, required this.journey});

  @override
  Widget build(BuildContext context) {
    if (!journey.enabled) return const SizedBox.shrink();

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.flag_outlined, color: AppColors.gold),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('رحلة عنايتك', style: AppTypography.titleMedium),
                    Text(
                      'الحالة → الهدف → الخطة',
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _GoalCard(goal: journey.nextGoal),
          if (journey.topOpportunity != null) ...[
            const SizedBox(height: 12),
            Text(journey.headlineAr, style: AppTypography.titleSmall),
            const SizedBox(height: 6),
            Text(
              journey.summaryAr,
              style: AppTypography.bodyMedium.copyWith(height: 1.55),
            ),
          ],
          if (journey.priorities.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text('أولوياتك', style: AppTypography.labelLarge),
            const SizedBox(height: 8),
            ...journey.priorities.map(_PriorityRow.new),
          ],
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.cardPink,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('خطة الوصول', style: AppTypography.labelLarge),
                const SizedBox(height: 6),
                Text(
                  journey.planSummaryAr,
                  style: AppTypography.bodySmall.copyWith(height: 1.5),
                ),
                const SizedBox(height: 8),
                Text(
                  journey.followUpAr,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GoalCard extends StatelessWidget {
  final JourneyGoal goal;

  const _GoalCard({required this.goal});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withValues(alpha: 0.08),
            AppColors.goldLight.withValues(alpha: 0.35),
          ],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            goal.headlineAr,
            style: AppTypography.titleSmall.copyWith(color: AppColors.primaryDark),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _ScorePill(label: 'الآن', value: goal.currentValue),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Icon(Icons.arrow_back_rounded, size: 18, color: AppColors.gold),
              ),
              _ScorePill(label: 'الهدف المقترح', value: goal.targetValue, highlight: true),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            goal.summaryAr,
            style: AppTypography.bodySmall.copyWith(height: 1.5),
          ),
        ],
      ),
    );
  }
}

class _ScorePill extends StatelessWidget {
  final String label;
  final int value;
  final bool highlight;

  const _ScorePill({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: highlight
                ? AppColors.gold.withValues(alpha: 0.2)
                : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            '$value',
            style: AppTypography.titleMedium.copyWith(
              color: highlight ? AppColors.gold : AppColors.primaryDark,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }
}

class _PriorityRow extends StatelessWidget {
  final JourneyPriority priority;

  const _PriorityRow(this.priority);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 12,
            backgroundColor: AppColors.primary.withValues(alpha: 0.12),
            child: Text(
              '${priority.rank}',
              style: AppTypography.labelSmall.copyWith(color: AppColors.primary),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  priority.labelAr,
                  style: AppTypography.labelLarge,
                ),
                Text(
                  '${priority.currentScore} · تحسّن محتمل +${priority.expectedGainPoints}',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
