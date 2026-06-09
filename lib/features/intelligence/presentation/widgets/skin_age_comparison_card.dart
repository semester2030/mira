import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../../../shared/widgets/confidence_badge.dart';
import '../../domain/entities/age_comparison.dart';
import '../../domain/entities/confidence_layer.dart';

/// Section 2 — Real age vs skin age with expandable insights.
class SkinAgeComparisonCard extends StatelessWidget {
  final AgeComparison comparison;
  final ChildSafety childSafety;
  final ConfidenceItem? confidence;

  const SkinAgeComparisonCard({
    super.key,
    required this.comparison,
    required this.childSafety,
    this.confidence,
  });

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
                  color: AppColors.goldLight.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.calendar_today_outlined, color: AppColors.gold),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('عمرك وعمر بشرتك', style: AppTypography.titleMedium),
                    Text(
                      comparison.enabled
                          ? 'مقارنة شخصية — بدون أرقام خام للبشرة'
                          : 'معلومات العمر',
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (childSafety.isMinor && childSafety.messageAr != null) ...[
            Text(
              childSafety.messageAr!,
              style: AppTypography.bodyMedium.copyWith(height: 1.55),
            ),
          ] else if (comparison.enabled) ...[
            if (confidence != null) ...[
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: ConfidenceBadge(
                  level: confidence!.level,
                  label: confidence!.level == 'high'
                      ? 'ثقة عالية'
                      : confidence!.level == 'medium'
                          ? 'ثقة متوسطة'
                          : 'ثقة منخفضة',
                ),
              ),
              const SizedBox(height: 10),
            ],
            Text(
              comparison.headlineAr,
              style: AppTypography.titleSmall.copyWith(color: AppColors.primaryDark),
            ),
            const SizedBox(height: 8),
            Text(
              comparison.summaryAr,
              style: AppTypography.bodyMedium.copyWith(height: 1.55),
            ),
            if (comparison.opportunitiesAr.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('فرص التحسين', style: AppTypography.labelLarge),
              const SizedBox(height: 6),
              ...comparison.opportunitiesAr.map(
                (o) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.lightbulb_outline, size: 16, color: AppColors.gold),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(o, style: AppTypography.bodySmall.copyWith(height: 1.45)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (comparison.insights.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...comparison.insights.map(
                (insight) => Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    title: Text(insight.titleAr, style: AppTypography.labelLarge),
                    children: [
                      Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          insight.bodyAr,
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ] else ...[
            Text(
              comparison.summaryAr,
              style: AppTypography.bodyMedium.copyWith(height: 1.55),
            ),
            if (comparison.needsBirthYear) ...[
              const SizedBox(height: 12),
              TextButton.icon(
                onPressed: () => Navigator.pushNamed(context, AppRoutes.profile),
                icon: const Icon(Icons.edit_outlined, size: 18),
                label: const Text('تحديث الملف الشخصي'),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
