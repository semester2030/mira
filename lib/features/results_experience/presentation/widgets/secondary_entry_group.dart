import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../visibility/visibility_policy.dart';

class SecondaryEntryGroup extends StatelessWidget {
  const SecondaryEntryGroup({
    super.key,
    required this.routine,
    required this.progress,
    required this.advisor,
    required this.onRoutine,
    required this.onProgress,
    required this.onAdvisor,
  });

  final ResultRoutinePreviewVM routine;
  final ResultProgressPreviewVM progress;
  final ResultAdvisorEntryVM advisor;
  final VoidCallback onRoutine;
  final VoidCallback onProgress;
  final VoidCallback onAdvisor;

  @override
  Widget build(BuildContext context) {
    final tiles = [
      _EntryTile(
        title: 'روتينك',
        subtitle: routine.hasSteps ? 'صباح ومساء' : 'غير متاح الآن',
        icon: Icons.spa_outlined,
        enabled: VisibilityPolicy.isPubliclyVisible(routine.visibility) &&
            routine.hasSteps,
        analyticsHint: routine.analyticsId ?? 'results_routine_entry',
        onTap: onRoutine,
      ),
      _EntryTile(
        title: 'تقدمك',
        subtitle: progress.comparability == ProgressComparabilityState.comparable
            ? 'مقارنة متاحة'
            : 'يحتاج تحليلاً إضافياً',
        icon: Icons.trending_up_rounded,
        enabled: VisibilityPolicy.isPubliclyVisible(progress.visibility),
        analyticsHint: progress.analyticsId ?? 'results_progress_entry',
        onTap: onProgress,
      ),
      _EntryTile(
        title: 'مستشار ميرا',
        subtitle: 'اسألي عن نتيجتك',
        icon: Icons.chat_bubble_outline_rounded,
        enabled: VisibilityPolicy.isPubliclyVisible(advisor.visibility) &&
            advisor.publicNameAr == 'مستشار ميرا',
        analyticsHint: advisor.analyticsId ?? 'results_advisor_entry',
        onTap: onAdvisor,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('التالي', style: AppTypography.titleMedium),
        const SizedBox(height: 10),
        LayoutBuilder(
          builder: (context, constraints) {
            final scale = MediaQuery.textScalerOf(context).scale(14) / 14;
            final stacked = constraints.maxWidth < 340 || scale > 1.25;
            if (stacked) {
              return Column(
                children: [
                  for (var i = 0; i < tiles.length; i++) ...[
                    if (i > 0) const SizedBox(height: 8),
                    tiles[i],
                  ],
                ],
              );
            }
            return Row(
              children: [
                for (var i = 0; i < tiles.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(child: tiles[i]),
                ],
              ],
            );
          },
        ),
      ],
    );
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.enabled,
    required this.onTap,
    required this.analyticsHint,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  final String analyticsHint;

  @override
  Widget build(BuildContext context) {
    final fg = enabled ? AppColors.textPrimary : AppColors.textTertiary;
    return Semantics(
      button: true,
      enabled: enabled,
      label: '$title. $subtitle',
      child: Material(
        color: enabled
            ? AppColors.surface
            : AppColors.background.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.border.withValues(alpha: enabled ? 0.55 : 0.3),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, color: enabled ? AppColors.gold : fg, size: 22),
                const SizedBox(height: 10),
                Text(
                  title,
                  style: AppTypography.labelLarge.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.25,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                Opacity(
                  opacity: 0,
                  child: Text(analyticsHint, key: ValueKey(analyticsHint)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
