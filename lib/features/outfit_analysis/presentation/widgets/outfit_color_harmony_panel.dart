import 'package:flutter/material.dart';

import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/helpers/vision_color_mapper.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/helpers/outfit_stylist_copy.dart';
import 'outfit_result_motion.dart';

/// Section 3 — professional color harmony (CIEDE2000 + confidence).
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

    final palette = analysis.segmentMap?.garmentPalette;
    final avgConfidence = palette?.detailedColors.isNotEmpty == true
        ? palette!.detailedColors.map((d) => d.confidence).reduce((a, b) => a + b) /
            palette.detailedColors.length
        : null;

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
                Expanded(
                  child: Text(
                    'انسجام الألوان',
                    style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                if (avgConfidence != null)
                  _ConfidencePill(confidence: avgConfidence),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'مطابقة احترافية CIEDE2000 — 247 درجة لونية أزياء',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
            if (current.isNotEmpty) ...[
              const SizedBox(height: 16),
              const _SectionHeader(title: 'ألوان إطلالتك الحالية', color: AppColors.textPrimary),
              ...current.map(_ColorInsightRow.new),
            ],
            if (compatible.isNotEmpty) ...[
              const SizedBox(height: 14),
              const _SectionHeader(title: 'ألوان تناسبك', color: AppColors.success),
              ...compatible.map(_ColorInsightRow.new),
            ],
            if (avoid.isNotEmpty) ...[
              const SizedBox(height: 14),
              const _SectionHeader(title: 'تجنّبي', color: AppColors.gold),
              ...avoid.map(_ColorInsightRow.new),
            ],
          ],
        ),
      ),
    );
  }
}

class _ConfidencePill extends StatelessWidget {
  final double confidence;

  const _ConfidencePill({required this.confidence});

  @override
  Widget build(BuildContext context) {
    final pct = (confidence * 100).round();
    final color = confidence >= 0.86
        ? AppColors.success
        : confidence >= 0.72
            ? AppColors.gold
            : AppColors.textSecondary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        '$pct% دقة',
        style: AppTypography.labelSmall.copyWith(color: color, fontWeight: FontWeight.w700),
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
    final hex = insight.hex;
    final swatchColor = hex != null
        ? VisionColorMapper.hexToColor(hex)
        : VisionColorMapper.toDisplayColor(insight.colorNameAr);

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
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
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        insight.titleAr,
                        style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                    if (insight.confidence != null)
                      Text(
                        '${(insight.confidence! * 100).round()}%',
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
                if (hex != null || insight.matchTierAr != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (hex != null) hex.toUpperCase(),
                      if (insight.matchTierAr != null) insight.matchTierAr,
                    ].join(' · '),
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.textTertiary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
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
