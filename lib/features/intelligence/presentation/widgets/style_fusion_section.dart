import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/mira_style_report.dart';

/// Beauty + Fashion fusion — undertone-aware styling guidance.
class StyleFusionSection extends StatelessWidget {
  final StyleFusion fusion;
  final MiraStyleReport? styleReport;

  const StyleFusionSection({
    super.key,
    required this.fusion,
    this.styleReport,
  });

  @override
  Widget build(BuildContext context) {
    if (!fusion.enabled) return const SizedBox.shrink();

    return Column(
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
              child: const Icon(Icons.style_rounded, color: AppColors.gold, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('دمج الجمال والإطلالة', style: AppTypography.titleMedium),
                  Text(
                    'Undertone ${fusion.undertoneAr}',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (styleReport != null)
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(styleReport!.headlineAr, style: AppTypography.titleMedium),
                const SizedBox(height: 6),
                Text(styleReport!.summaryAr, style: AppTypography.bodyMedium.copyWith(height: 1.5)),
                const SizedBox(height: 8),
                Text(
                  '${styleReport!.styleCategoryAr} · ${styleReport!.colorCompatibilityAr}',
                  style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary),
                ),
              ],
            ),
          ),
        const SizedBox(height: 8),
        PremiumCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(fusion.headlineAr, style: AppTypography.titleMedium),
              const SizedBox(height: 6),
              Text(fusion.summaryAr, style: AppTypography.bodyMedium.copyWith(height: 1.5)),
              if (fusion.recommendedColorsAr.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text('ألوان تناسبك', style: AppTypography.labelLarge),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: fusion.recommendedColorsAr
                      .map(
                        (c) => Chip(
                          label: Text(c, style: AppTypography.labelSmall),
                          backgroundColor: AppColors.goldLight.withValues(alpha: 0.4),
                          side: BorderSide.none,
                        ),
                      )
                      .toList(),
                ),
              ],
              if (fusion.avoidColorsAr.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  'تجنّبي: ${fusion.avoidColorsAr.join(' · ')}',
                  style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                ),
              ],
              if (fusion.makeupHintAr.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text('مكياج: ${fusion.makeupHintAr}', style: AppTypography.bodySmall),
              ],
              if (fusion.accessoryHintAr.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text('إكسسوارات: ${fusion.accessoryHintAr}', style: AppTypography.bodySmall),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
