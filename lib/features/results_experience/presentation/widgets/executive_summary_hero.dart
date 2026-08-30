import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../localization/confidence_labels.dart';
import 'results_confidence_chip.dart';

/// One hero card — overall state + sentence + confidence + disclaimer entry.
class ExecutiveSummaryHero extends StatelessWidget {
  const ExecutiveSummaryHero({
    super.key,
    required this.summary,
    required this.confidence,
    required this.onDisclaimer,
    this.isStale = false,
    this.isPartial = false,
  });

  final ResultSummaryVM summary;
  final ResultConfidenceVM confidence;
  final VoidCallback onDisclaimer;
  final bool isStale;
  final bool isPartial;

  @override
  Widget build(BuildContext context) {
    final status = summary.vitality.statusLabelAr;
    final score = summary.vitality.value;
    final showScore = summary.vitality.numericVisible && score != null;
    final confSpec =
        ConfidencePresentationContract.forState(confidence.overall);

    return Semantics(
      header: true,
      label:
          '${summary.titleAr}. $status. ${summary.headlineAr}. ثقة ${ResultsConfidenceChip.shortLabelAr(confidence.overall)}',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.55)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'ملخص نتيجتك',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.gold,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.2,
              ),
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, constraints) {
                final scale =
                    MediaQuery.textScalerOf(context).scale(14) / 14;
                final stacked =
                    constraints.maxWidth < 320 || scale > 1.3;
                final textCol = Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      summary.headlineAr.isNotEmpty
                          ? summary.headlineAr
                          : summary.summaryAr,
                      style: AppTypography.titleLarge.copyWith(height: 1.35),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      [
                        if (summary.skinTypeAr.isNotEmpty)
                          'نوع البشرة: ${summary.skinTypeAr}',
                        if (status.isNotEmpty) 'الحالة: $status',
                      ].where((e) => e.isNotEmpty).join(' · '),
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ],
                );
                final badge = showScore
                    ? _VitalityBadge(
                        value: score!.round(),
                        status: status,
                        accessibility:
                            summary.vitality.accessibilityTextAr,
                      )
                    : null;
                if (badge == null) return textCol;
                if (stacked) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      textCol,
                      const SizedBox(height: 12),
                      badge,
                    ],
                  );
                }
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: textCol),
                    const SizedBox(width: 12),
                    badge,
                  ],
                );
              },
            ),
            const SizedBox(height: 12),
            Text(
              summary.summaryAr.isNotEmpty
                  ? summary.summaryAr
                  : summary.headlineAr,
              style: AppTypography.bodyMedium.copyWith(height: 1.5),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                ResultsConfidenceChip(state: confidence.overall),
                if (isStale)
                  _SoftTag(
                    label: 'نتيجة سابقة',
                    color: AppColors.warning,
                  ),
                if (isPartial)
                  _SoftTag(
                    label: 'نتيجة جزئية',
                    color: AppColors.info,
                  ),
              ],
            ),
            if (confidence.overall == ConfidenceState.low ||
                confidence.overall == ConfidenceState.unavailable) ...[
              const SizedBox(height: 8),
              Text(
                confSpec.explanationAr,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.35,
                ),
              ),
            ],
            const SizedBox(height: 10),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                onPressed: onDisclaimer,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(48, 36),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  'إخلاء المسؤولية',
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.primaryDark,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VitalityBadge extends StatelessWidget {
  const _VitalityBadge({
    required this.value,
    required this.status,
    required this.accessibility,
  });

  final int value;
  final String status;
  final String accessibility;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'مؤشر الحيوية $value. $status. $accessibility',
      child: Container(
        width: 72,
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.goldLight.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
        ),
        child: Column(
          children: [
            Text(
              '$value',
              style: AppTypography.titleLarge.copyWith(
                color: AppColors.primaryDark,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              status,
              textAlign: TextAlign.center,
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textSecondary,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _SoftTag extends StatelessWidget {
  const _SoftTag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
