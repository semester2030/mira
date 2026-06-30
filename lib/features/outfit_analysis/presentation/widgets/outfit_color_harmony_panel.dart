import 'package:flutter/material.dart';

import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/helpers/vision_color_mapper.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/helpers/outfit_stylist_copy.dart';
import 'outfit_result_motion.dart';

/// Section 3 — color harmony with personalized «why» (P0).
class OutfitColorHarmonyPanel extends StatelessWidget {
  final OutfitAnalysis analysis;

  const OutfitColorHarmonyPanel({super.key, required this.analysis});

  @override
  Widget build(BuildContext context) {
    final insights = OutfitStylistCopy.colorHarmonyInsights(
      analysis,
      skin: AnalysisSession.lastSkin,
    );
    if (insights.isEmpty) return const SizedBox.shrink();

    final current = insights.where((i) => i.category == OutfitColorCategory.current).toList();
    final compatible =
        insights.where((i) => i.category == OutfitColorCategory.compatible).toList();
    final avoid = insights.where((i) => i.category == OutfitColorCategory.avoid).toList();

    return OutfitStaggerPop(
      index: 1,
      baseDelayMs: 120,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
          boxShadow: [
            BoxShadow(
              color: AppColors.gold.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.palette_rounded, color: AppColors.gold, size: 22),
                const SizedBox(width: 8),
                Text(
                  'انسجام الألوان',
                  style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'ألوان مخصصة لإطلالتك وبشرتك — مع السبب',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
            if (current.isNotEmpty) ...[
              const SizedBox(height: 16),
              _SectionHeader(title: 'ألوان إطلالتك الحالية', color: AppColors.textPrimary),
              ...current.map(_ColorInsightRow.new),
            ],
            if (compatible.isNotEmpty) ...[
              const SizedBox(height: 14),
              _SectionHeader(title: 'ألوان تناسبك', color: AppColors.success),
              ...compatible.map(_ColorInsightRow.new),
            ],
            if (avoid.isNotEmpty) ...[
              const SizedBox(height: 14),
              _SectionHeader(title: 'تجنّبي', color: AppColors.gold),
              ...avoid.map(_ColorInsightRow.new),
            ],
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final Color color;

  const _SectionHeader({required this.title, required this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: AppTypography.labelLarge.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ColorInsightRow extends StatelessWidget {
  final OutfitColorInsight insight;

  const _ColorInsightRow(this.insight);

  @override
  Widget build(BuildContext context) {
    final swatchColor = VisionColorMapper.toDisplayColor(insight.colorNameAr);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: swatchColor,
              border: Border.all(color: Colors.white, width: 2),
              boxShadow: [
                BoxShadow(
                  color: swatchColor.withValues(alpha: 0.35),
                  blurRadius: 8,
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  insight.colorNameAr,
                  style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  insight.whyAr,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
