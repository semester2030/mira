import 'package:flutter/material.dart';
import '../../domain/entities/skin_report.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../../../shared/widgets/premium/pressable_scale.dart';

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
      onTap: () => Navigator.pushNamed(context, AppRoutes.skinResult, arguments: report),
      child: PremiumCard(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Row(
          children: [
            Container(
              width: 4,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('تحليل ${index + 1}', style: AppTypography.titleMedium),
                  if (_formatDate().isNotEmpty)
                    Text(
                      _formatDate(),
                      style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    'نوع البشرة: ${report.skinType} · ${report.score.round()}%',
                    style: AppTypography.bodySmall,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_left, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
