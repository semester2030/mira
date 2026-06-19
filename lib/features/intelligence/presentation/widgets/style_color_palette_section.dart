import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../../outfit_analysis/domain/entities/outfit_report.dart';

/// Dominant and alternative color chips from outfit analysis.
class StyleColorPaletteSection extends StatelessWidget {
  final OutfitReport report;

  const StyleColorPaletteSection({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    final styleReport = report.miraStyleReport;
    final dominant = styleReport?.dominantColorsAr ?? report.dominantColors;
    final alternatives =
        styleReport?.alternativeLooksAr ?? report.alternativeColors;

    if (dominant.isEmpty && alternatives.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('لوحة الألوان', style: AppTypography.titleMedium),
        const SizedBox(height: 12),
        PremiumCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (dominant.isNotEmpty) ...[
                Text('الألوان الرئيسية', style: AppTypography.labelLarge),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: dominant.map(_colorChip).toList(),
                ),
              ],
              if (alternatives.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text('بدائل مقترحة', style: AppTypography.labelLarge),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: alternatives.map(_altChip).toList(),
                ),
              ],
              if (styleReport?.colorCompatibilityAr.isNotEmpty == true) ...[
                const SizedBox(height: 12),
                Text(
                  styleReport!.colorCompatibilityAr,
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _colorChip(String color) {
    return Chip(
      label: Text(color, style: AppTypography.labelSmall),
      backgroundColor: AppColors.primary.withValues(alpha: 0.08),
      side: BorderSide(color: AppColors.primary.withValues(alpha: 0.2)),
    );
  }

  Widget _altChip(String color) {
    return Chip(
      label: Text(color, style: AppTypography.labelSmall),
      backgroundColor: AppColors.goldLight.withValues(alpha: 0.35),
      side: BorderSide.none,
    );
  }
}
