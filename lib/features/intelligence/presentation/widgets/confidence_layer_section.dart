import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/confidence_badge.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/confidence_layer.dart';

/// Phase 7d — Confidence scores for report claims.
class ConfidenceLayerSection extends StatelessWidget {
  final ConfidenceLayer layer;

  const ConfidenceLayerSection({super.key, required this.layer});

  @override
  Widget build(BuildContext context) {
    if (!layer.enabled || layer.items.isEmpty) return const SizedBox.shrink();

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.shield_outlined, color: AppColors.secondary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(layer.headlineAr, style: AppTypography.titleMedium),
                    Text(
                      layer.summaryAr,
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...layer.items.map(_ConfidenceRow.new),
        ],
      ),
    );
  }
}

class _ConfidenceRow extends StatelessWidget {
  final ConfidenceItem item;

  const _ConfidenceRow(this.item);

  @override
  Widget build(BuildContext context) {
    final badgeLabel = switch (item.level) {
      'high' => 'ثقة عالية',
      'medium' => 'ثقة متوسطة',
      _ => 'ثقة منخفضة',
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.labelAr, style: AppTypography.labelLarge),
                const SizedBox(height: 2),
                Text(
                  item.reasonAr,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ConfidenceBadge(level: item.level, label: badgeLabel),
        ],
      ),
    );
  }
}
