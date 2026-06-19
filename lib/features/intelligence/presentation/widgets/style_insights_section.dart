import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/confidence_badge.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/mira_style_report.dart';

/// Confidence, severity, and improvement potential for style report.
class StyleInsightsSection extends StatelessWidget {
  final MiraStyleReport report;

  const StyleInsightsSection({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.checkroom_outlined, color: AppColors.secondary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('طبقة الثقة', style: AppTypography.titleMedium),
                    Text(
                      report.summaryAr,
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _InsightRow(
            label: 'ثقة التحليل',
            trailing: ConfidenceBadge(
              level: report.confidence >= 80
                  ? 'high'
                  : report.confidence >= 65
                      ? 'medium'
                      : 'low',
              label: '${report.confidence}%',
            ),
          ),
          if (report.severityLevel.isNotEmpty)
            _InsightRow(label: 'المستوى', value: report.severityLevel),
          if (report.strongestIssueAr.isNotEmpty)
            _InsightRow(label: 'أبرز نقطة', value: report.strongestIssueAr),
          if (report.improvementPotential > 0)
            _InsightRow(
              label: 'إمكانية التحسين',
              value: '${report.improvementPotential}%',
            ),
          _InsightRow(label: 'المناسبة', value: report.occasionSuitabilityAr),
        ],
      ),
    );
  }
}

class _InsightRow extends StatelessWidget {
  final String label;
  final String? value;
  final Widget? trailing;

  const _InsightRow({
    required this.label,
    this.value,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
            ),
          ),
          if (trailing != null)
            trailing!
          else if (value != null)
            Flexible(
              child: Text(
                value!,
                style: AppTypography.titleSmall,
                textAlign: TextAlign.end,
              ),
            ),
        ],
      ),
    );
  }
}
