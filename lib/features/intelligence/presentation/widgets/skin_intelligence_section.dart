import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/skin_intelligence_report.dart';

/// Phase 3 — explainable skin intelligence presentation (cosmetic, bilingual).
class SkinIntelligenceSection extends StatelessWidget {
  final SkinIntelligenceReport report;
  final bool preferEnglish;

  const SkinIntelligenceSection({
    super.key,
    required this.report,
    this.preferEnglish = false,
  });

  @override
  Widget build(BuildContext context) {
    final summary =
        preferEnglish ? report.executiveSummaryEn : report.executiveSummaryAr;
    final available = report.metrics.where((m) => m.isAvailable).take(8).toList();
    final unavailable = report.metrics.where((m) => !m.isAvailable).length;
    final recs = report.recommendations
        .where((r) => r.category != 'educational')
        .take(4)
        .toList();

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            preferEnglish ? 'Skin intelligence' : 'ذكاء البشرة',
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
                ? 'SVI ${report.svi.score} · confidence ${report.svi.confidence} · ${report.svi.version}'
                : 'مؤشر الحيوية ${report.svi.score} · ثقة ${report.svi.confidence} · ${report.svi.version}',
            style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
          ),
          if (report.priorityFindings.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              preferEnglish ? 'Care opportunities' : 'فرص العناية',
              style: AppTypography.titleSmall,
            ),
            const SizedBox(height: 6),
            ...report.priorityFindings.take(3).map((f) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      preferEnglish ? f.titleEn : f.titleAr,
                      style: AppTypography.bodyMedium.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      preferEnglish ? f.evidenceEn : f.evidenceAr,
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
              preferEnglish ? 'Metrics (with provenance)' : 'المؤشرات (مع المصدر)',
              style: AppTypography.titleSmall,
            ),
            const SizedBox(height: 6),
            ...available.map((m) {
              final level = preferEnglish ? m.levelEn : m.levelAr;
              final reason = preferEnglish ? m.reasonEn : m.reasonAr;
              final limits = preferEnglish ? m.limitationsEn : m.limitationsAr;
              final name = preferEnglish ? m.displayNameEn : m.displayNameAr;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$name · $level',
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
                    if (reason.isNotEmpty)
                      Text(
                        reason,
                        style: AppTypography.bodySmall.copyWith(height: 1.4),
                      ),
                    if (limits.isNotEmpty)
                      Text(
                        preferEnglish ? 'Limitations: $limits' : 'الحدود: $limits',
                        style: AppTypography.labelSmall.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.35,
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
              preferEnglish ? 'Recommendations' : 'توصيات تجميلية',
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
            report.progress.comparable
                ? (preferEnglish
                    ? 'Progress: ${report.progress.overallTrend}'
                        '${report.progress.sviDelta != null ? ' (${report.progress.sviDelta!.toStringAsFixed(0)} pts)' : ''}'
                    : 'التقدّم: ${_trendAr(report.progress.overallTrend)}'
                        '${report.progress.sviDelta != null ? ' (${report.progress.sviDelta!.toStringAsFixed(0)} نقطة)' : ''}')
                : (preferEnglish
                    ? (report.progress.unavailableReasonEn ??
                        'Comparison unavailable.')
                    : (report.progress.unavailableReasonAr ??
                        'المقارنة غير متاحة.')),
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 6),
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

  String _trendAr(String t) {
    switch (t) {
      case 'improved':
        return 'تحسّن';
      case 'declined':
        return 'تراجع طفيف';
      case 'stable':
        return 'مستقر';
      default:
        return 'غير معروف';
    }
  }
}
