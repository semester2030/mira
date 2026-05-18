import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../domain/entities/outfit_report.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../../../shared/widgets/premium/pressable_scale.dart';

class OutfitHistoryCard extends StatelessWidget {
  final OutfitReport report;
  final int index;

  const OutfitHistoryCard({super.key, required this.report, required this.index});

  String _date() {
    final d = report.createdAt;
    if (d == null) return '';
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () => Navigator.pushNamed(context, AppRoutes.outfitResult, arguments: report),
      child: PremiumCard(
        margin: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            Container(
              width: 4,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.secondary,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${report.occasionLabelAr} · ${report.garmentType}', style: AppTypography.titleMedium),
                  if (_date().isNotEmpty)
                    Text(_date(), style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
                  Text(
                    'توافق ${report.compatibilityScore.round()}%',
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
