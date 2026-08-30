import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../visibility/visibility_policy.dart';
import '../../semantics/metric_presentation_policy.dart';
import 'results_confidence_chip.dart';

class MetricsOverviewSection extends StatelessWidget {
  const MetricsOverviewSection({
    super.key,
    required this.metrics,
    required this.onOpen,
  });

  final List<ResultMetricVM> metrics;
  final ValueChanged<ResultMetricVM> onOpen;

  @override
  Widget build(BuildContext context) {
    final visible = metrics
        .where((m) => VisibilityPolicy.isPubliclyVisible(m.visibility))
        .toList();

    if (visible.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
        ),
        child: Text(
          'لا تتوفر مؤشرات قابلة للعرض حالياً. يمكنك مراجعة الملخص أو إعادة التحليل لاحقاً.',
          style: AppTypography.bodyMedium.copyWith(height: 1.45),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('المؤشرات', style: AppTypography.titleMedium),
        const SizedBox(height: 4),
        Text(
          'اضغطي لفهم المعنى والخطوة المناسبة',
          style: AppTypography.bodySmall.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 12),
        ...visible.map(
          (m) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _MetricCard(metric: m, onTap: () => onOpen(m)),
          ),
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.metric, required this.onTap});

  final ResultMetricVM metric;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = MetricPresentationPolicy.publicStatusAr(metric);
    final primary = MetricPresentationPolicy.primaryScore(metric);
    final severityPrimary = MetricPresentationPolicy.isSeverityPrimary(metric);
    final showNum = primary?.numericVisible == true && primary?.value != null;
    final roleColor = severityPrimary
        ? const Color(0xFFB07A3A)
        : AppColors.primaryDark;

    return Semantics(
      button: true,
      label:
          '${metric.titleAr}. الحالة $status. ${MetricPresentationPolicy.directionHintAr(metric)}. ثقة ${ResultsConfidenceChip.shortLabelAr(metric.confidence)}',
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: roleColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    severityPrimary
                        ? Icons.priority_high_rounded
                        : Icons.water_drop_outlined,
                    color: roleColor,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        metric.titleAr,
                        style: AppTypography.titleSmall.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        metric.summaryAr,
                        style: AppTypography.bodySmall.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.35,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          Text(
                            status,
                            style: AppTypography.labelSmall.copyWith(
                              color: roleColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            'ثقة ${ResultsConfidenceChip.shortLabelAr(metric.confidence)}',
                            style: AppTypography.labelSmall.copyWith(
                              color: const Color(0xFF4A6572),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (showNum)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 8),
                    child: Text(
                      '${primary!.value!.round()}',
                      style: AppTypography.titleMedium.copyWith(
                        color: roleColor,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                const Icon(Icons.chevron_left_rounded, color: AppColors.textTertiary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
