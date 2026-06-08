import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/mira_beauty_report.dart';

/// Section 3 — Main concerns in human Arabic (no raw metrics).
class ConcernNarrativeSection extends StatelessWidget {
  final List<ConcernNarrative> concerns;

  const ConcernNarrativeSection({super.key, required this.concerns});

  @override
  Widget build(BuildContext context) {
    if (concerns.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primaryLight.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.favorite_outline, color: AppColors.primary, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('ملاحظات ميرا على بشرتك', style: AppTypography.titleMedium),
                  Text(
                    'لغة بشرية — بدون أرقام تقنية',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...concerns.map((c) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: PremiumCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.titleAr,
                      style: AppTypography.labelLarge.copyWith(
                        color: AppColors.primaryDark,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      c.narrativeAr,
                      style: AppTypography.bodyMedium.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.6,
                      ),
                    ),
                  ],
                ),
              ),
            )),
      ],
    );
  }
}
