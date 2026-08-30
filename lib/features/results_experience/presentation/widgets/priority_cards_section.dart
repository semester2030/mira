import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../localization/personalization_labels.dart';
import 'results_confidence_chip.dart';

class PriorityCardsSection extends StatelessWidget {
  const PriorityCardsSection({
    super.key,
    required this.priorities,
    required this.onOpen,
  });

  final List<ResultPriorityVM> priorities;
  final ValueChanged<ResultPriorityVM> onOpen;

  @override
  Widget build(BuildContext context) {
    if (priorities.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.cardPink.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          'لا توجد أولويات عناية بارزة الآن — حافظي على روتين لطيف ومنتظم.',
          style: AppTypography.bodyMedium.copyWith(height: 1.45),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('أهم الأولويات', style: AppTypography.titleMedium),
        const SizedBox(height: 4),
        Text(
          'حتى ثلاث أولويات من تحليلك',
          style: AppTypography.bodySmall.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 12),
        ...priorities.take(3).map((p) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _PriorityCard(priority: p, onTap: () => onOpen(p)),
          );
        }),
      ],
    );
  }
}

class _PriorityCard extends StatelessWidget {
  const _PriorityCard({required this.priority, required this.onTap});

  final ResultPriorityVM priority;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final personalization = PersonalizationLabels.ar(priority.personalization);
    final confShort =
        ResultsConfidenceChip.shortLabelAr(priority.confidence);

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.goldLight.withValues(alpha: 0.55),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${priority.rank}',
                      style: AppTypography.labelLarge.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      priority.concernLabelAr,
                      style: AppTypography.titleSmall.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (priority.confidence == ConfidenceState.low)
                    Text(
                      'ثقة محدودة',
                      style: AppTypography.labelSmall.copyWith(
                        color: const Color(0xFF4A6572),
                      ),
                    )
                  else
                    Text(
                      'ثقة $confShort',
                      style: AppTypography.labelSmall.copyWith(
                        color: const Color(0xFF4A6572),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                priority.summaryAr,
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.4,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 8),
              Text(
                'الخطوة المقترحة: ${priority.actionLabelAr}',
                style: AppTypography.bodySmall.copyWith(
                  fontWeight: FontWeight.w600,
                  height: 1.35,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (personalization.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  personalization,
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.primaryDark,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
