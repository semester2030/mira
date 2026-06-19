import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

/// Shown while partner catalog (brands · salons · clinics) stays offline.
class MarketplaceComingSoonView extends StatelessWidget {
  const MarketplaceComingSoonView({
    super.key,
    this.compact = false,
  });

  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return PremiumCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.storefront_outlined, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(MarketplaceCopy.sectionTeaser, style: AppTypography.titleSmall),
                  const SizedBox(height: 4),
                  Text(
                    MarketplaceCopy.comingSoonLead,
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        Icon(Icons.auto_awesome_rounded, size: 52, color: AppColors.secondary),
        const SizedBox(height: 16),
        Text(
          MarketplaceCopy.comingSoonHeadline,
          style: AppTypography.headlineMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 10),
        Text(
          MarketplaceCopy.comingSoonLead,
          style: AppTypography.bodyMedium.copyWith(
            color: AppColors.textSecondary,
            height: 1.6,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        ...MarketplaceCopy.categories.map(
          (c) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: PremiumCard(
              child: Row(
                children: [
                  Text(c.emoji, style: const TextStyle(fontSize: 28)),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(c.title, style: AppTypography.titleMedium),
                  ),
                  Icon(
                    Icons.schedule_rounded,
                    size: 18,
                    color: AppColors.textTertiary,
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          MarketplaceCopy.comingSoonFocus,
          style: AppTypography.bodySmall.copyWith(
            color: AppColors.textSecondary,
            height: 1.5,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
