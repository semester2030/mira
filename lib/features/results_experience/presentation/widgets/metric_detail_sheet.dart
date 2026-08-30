import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_enums.dart';
import '../../contracts/result_presentation_vms.dart';
import '../../semantics/metric_presentation_policy.dart';
import 'results_confidence_chip.dart';

Future<void> showMetricDetailSheet({
  required BuildContext context,
  required ResultMetricVM metric,
  required VoidCallback onAskMira,
  VoidCallback? onRetake,
  VoidCallback? onOpenRoutine,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    builder: (ctx) => MetricDetailSheet(
      metric: metric,
      onAskMira: onAskMira,
      onRetake: onRetake,
      onOpenRoutine: onOpenRoutine,
    ),
  );
}

class MetricDetailSheet extends StatelessWidget {
  const MetricDetailSheet({
    super.key,
    required this.metric,
    required this.onAskMira,
    this.onRetake,
    this.onOpenRoutine,
  });

  final ResultMetricVM metric;
  final VoidCallback onAskMira;
  final VoidCallback? onRetake;
  final VoidCallback? onOpenRoutine;

  @override
  Widget build(BuildContext context) {
    final status = MetricPresentationPolicy.publicStatusAr(metric);
    final action = MetricPresentationPolicy.ownedActionAr(metric);
    final why = MetricPresentationPolicy.whyMattersAr(metric);
    final direction = MetricPresentationPolicy.directionHintAr(metric);
    final primary = MetricPresentationPolicy.primaryScore(metric);
    final retake =
        metric.confidence == ConfidenceState.low ||
        metric.confidence == ConfidenceState.unavailable;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(metric.titleAr, style: AppTypography.titleLarge),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _Chip(label: status, tone: AppColors.primaryDark),
                  ResultsConfidenceChip(state: metric.confidence, compact: true),
                  if (metric.comparisonEligible)
                    const _Chip(label: 'قابل للمقارنة لاحقاً', tone: Color(0xFF4A6572)),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                metric.explanationAr.isNotEmpty
                    ? metric.explanationAr
                    : metric.summaryAr,
                style: AppTypography.bodyMedium.copyWith(height: 1.5),
              ),
              const SizedBox(height: 10),
              Text(
                direction,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              if (primary?.value != null && primary!.numericVisible) ...[
                const SizedBox(height: 8),
                Text(
                  'القيمة المعروضة: ${primary.value!.round()} — $status',
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Text('لماذا تهم', style: AppTypography.titleSmall),
              const SizedBox(height: 6),
              Text(why, style: AppTypography.bodyMedium.copyWith(height: 1.45)),
              const SizedBox(height: 16),
              Text('خطوتك المرتبطة', style: AppTypography.titleSmall),
              const SizedBox(height: 6),
              Text(action, style: AppTypography.bodyMedium.copyWith(height: 1.45)),
              if (metric.limitation != LimitationState.none) ...[
                const SizedBox(height: 14),
                Text(
                  'ملاحظة: قد تختلف القراءة باختلاف الإضاءة وجودة الصورة.',
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () {
                  Navigator.pop(context);
                  onAskMira();
                },
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: AppColors.textPrimary,
                  minimumSize: const Size.fromHeight(48),
                ),
                child: const Text('اسألي مستشار ميرا عن هذا المؤشر'),
              ),
              if (onOpenRoutine != null) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    onOpenRoutine!();
                  },
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                  ),
                  child: const Text('عرض الخطوة في روتينك'),
                ),
              ],
              if (retake && onRetake != null) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () {
                    Navigator.pop(context);
                    onRetake!();
                  },
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                  ),
                  child: const Text('أعيدي التحليل'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.tone});

  final String label;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          color: tone,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
