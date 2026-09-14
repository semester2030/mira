import 'package:flutter/material.dart';
import '../../domain/entities/skin_report.dart';
import '../../../../core/navigation/mira_report_navigation.dart';
import '../../../intelligence/presentation/widgets/mira_report_helpers.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../../../shared/widgets/premium/pressable_scale.dart';
import '../../../results_experience/presentation/icons/mira_skin_glyphs.dart';

/// History row — metrics/summary only. Never shows a user face image.
class ResultCard extends StatelessWidget {
  final SkinReport report;
  final int index;

  const ResultCard({super.key, required this.report, this.index = 0});

  String _formatDate() {
    final d = report.createdAt;
    if (d == null) return '';
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () => MiraReportNavigation.openFromHistory(context, report),
      child: PremiumCard(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primaryLight.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: MiraSkinGlyphs.of(MiraSkinGlyphId.history, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('تحليل ${index + 1}', style: AppTypography.titleMedium),
                  if (_formatDate().isNotEmpty)
                    Text(
                      _formatDate(),
                      style: AppTypography.labelSmall
                          .copyWith(color: AppColors.textSecondary),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    report.skinType.isNotEmpty
                        ? 'نوع البشرة: ${report.skinType}'
                        : resolveMiraReport(report).headlineAr,
                    style: AppTypography.bodySmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'بدون صورة وجه محفوظة',
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
            MiraSkinGlyphs.of(MiraSkinGlyphId.chevron, size: 18),
          ],
        ),
      ),
    );
  }
}
