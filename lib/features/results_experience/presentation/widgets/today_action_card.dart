import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../localization/personalization_labels.dart';

/// Exactly one primary action for today.
class TodayActionCard extends StatelessWidget {
  const TodayActionCard({
    super.key,
    required this.action,
    required this.onPrimaryCta,
    required this.onShowHow,
  });

  final ResultActionVM action;
  final VoidCallback onPrimaryCta;
  final VoidCallback onShowHow;

  static String periodLabel(ResultActionVM action) {
    final stepId = action.routineStepId ?? '';
    if (stepId.contains('pm') || stepId.contains('evening')) return 'مساءً';
    if (stepId.contains('am') ||
        stepId.contains('sun') ||
        action.adviceConceptId == 'today_focus') {
      return 'صباحاً';
    }
    switch (action.adviceConceptId) {
      case 'sunscreen':
        return 'صباحاً';
      case 'hydration':
      case 'moisturizer':
        return 'صباحاً ومساءً';
      default:
        return 'اليوم';
    }
  }

  @override
  Widget build(BuildContext context) {
    final period = periodLabel(action);
    final why = action.summaryAr;
    final personalization = PersonalizationLabels.ar(action.personalization);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.goldLight.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('خطوتك اليوم', style: AppTypography.titleMedium),
          const SizedBox(height: 4),
          Text(
            period,
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.primaryDark,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            action.titleAr == 'خطوتك اليوم' ? why : action.titleAr,
            style: AppTypography.titleSmall.copyWith(height: 1.35),
          ),
          const SizedBox(height: 8),
          Text(
            'لماذا تهم: $why',
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.textSecondary,
              height: 1.4,
            ),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          if (personalization.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              personalization,
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.primaryDark,
              ),
            ),
          ],
          const SizedBox(height: 14),
          FilledButton(
            onPressed: onPrimaryCta,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.gold,
              foregroundColor: AppColors.textPrimary,
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('ابدئي الآن'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: onShowHow,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(44),
              foregroundColor: AppColors.primaryDark,
              side: BorderSide(color: AppColors.gold.withValues(alpha: 0.5)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('اعرضي الطريقة'),
          ),
        ],
      ),
    );
  }
}

class TodayActionEmptyCard extends StatelessWidget {
  const TodayActionEmptyCard({super.key, required this.onOpenRoutine});

  final VoidCallback onOpenRoutine;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('خطوتك اليوم', style: AppTypography.titleMedium),
          const SizedBox(height: 8),
          Text(
            'لا توجد خطوة عاجلة الآن. يمكنك متابعة روتين لطيف عند الجاهزية.',
            style: AppTypography.bodyMedium.copyWith(height: 1.45),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: onOpenRoutine,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              foregroundColor: AppColors.primaryDark,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('أضيفي إلى روتين اليوم'),
          ),
        ],
      ),
    );
  }
}
