import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/face_intelligence_report.dart';

/// Phase 4E — Face Intelligence presentation (cosmetic, theme-unified).
/// Feature layers are styling narratives — not FaceHealthMap heatmap truth.
class FaceIntelligenceSection extends StatelessWidget {
  final FaceIntelligenceReport report;
  final bool preferEnglish;

  const FaceIntelligenceSection({
    super.key,
    required this.report,
    this.preferEnglish = false,
  });

  @override
  Widget build(BuildContext context) {
    final summary =
        preferEnglish ? report.executiveSummaryEn : report.executiveSummaryAr;
    final available =
        report.metrics.where((m) => m.isAvailable).take(8).toList();
    final unavailable = report.metrics.where((m) => !m.isAvailable).length;
    final recs = report.recommendations
        .where((r) => r.category != 'educational')
        .take(4)
        .toList();
    final layers = report.featureLayers.take(4).toList();

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            preferEnglish ? 'Face intelligence' : 'ذكاء الملامح',
            style: AppTypography.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(
            summary,
            style: AppTypography.bodyMedium.copyWith(height: 1.55),
          ),
          const SizedBox(height: 10),
          Text(
            preferEnglish
                ? '${report.shape.isAvailable ? (report.shape.displayNameEn ?? report.shape.shapeId ?? '—') : 'Shape unavailable'} · confidence ${report.confidence} · ${report.reportVersion}'
                : '${report.shape.isAvailable ? (report.shape.displayNameAr ?? report.shape.shapeId ?? '—') : 'الشكل غير متاح'} · ثقة ${report.confidence} · ${report.reportVersion}',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          if (layers.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              preferEnglish ? 'Feature layers' : 'طبقات الملامح',
              style: AppTypography.titleSmall,
            ),
            const SizedBox(height: 4),
            Text(
              preferEnglish
                  ? 'Styling narratives — not a skin health heatmap.'
                  : 'طبقات تنسيق سردية — ليست خريطة حرارة لصحة البشرة.',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textSecondary,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 6),
            ...layers.map((layer) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      preferEnglish ? layer.titleEn : layer.titleAr,
                      style: AppTypography.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      preferEnglish ? layer.detailEn : layer.detailAr,
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
          if (available.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              preferEnglish ? 'Geometry & shape metrics' : 'مقاييس الهندسة والشكل',
              style: AppTypography.titleSmall,
            ),
            const SizedBox(height: 6),
            ...available.map((m) {
              final name =
                  preferEnglish ? m.displayNameEn : m.displayNameAr;
              final value = m.categoricalValue ??
                  (m.normalizedValue != null
                      ? m.normalizedValue!.toStringAsFixed(0)
                      : '—');
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$name · $value',
                      style: AppTypography.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      preferEnglish
                          ? 'Confidence: ${m.confidence} · Source: ${m.source}'
                          : 'الثقة: ${m.confidence} · المصدر: ${m.source}',
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              );
            }),
            if (unavailable > 0)
              Text(
                preferEnglish
                    ? '$unavailable metrics unavailable (not estimated).'
                    : '$unavailable مؤشرات غير متاحة (دون تقدير بديل).',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
          ],
          if (recs.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              preferEnglish ? 'Styling recommendations' : 'توصيات تنسيق',
              style: AppTypography.titleSmall,
            ),
            const SizedBox(height: 6),
            ...recs.map((r) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      preferEnglish ? r.titleEn : r.titleAr,
                      style: AppTypography.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      preferEnglish ? r.bodyEn : r.bodyAr,
                      style: AppTypography.bodySmall.copyWith(height: 1.45),
                    ),
                  ],
                ),
              );
            }),
          ],
          const SizedBox(height: 10),
          Text(
            preferEnglish ? report.retakeGuidanceEn : report.retakeGuidanceAr,
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textSecondary,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}
