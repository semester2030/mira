import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/entities/skin_routine_product.dart';

class RecommendedProductCard extends StatelessWidget {
  final SkinRoutineProduct product;
  final VoidCallback? onTap;
  final bool compact;

  const RecommendedProductCard({
    super.key,
    required this.product,
    this.onTap,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return SizedBox(
        width: 120,
        child: PressableCard(onTap: onTap, child: _compactBody()),
      );
    }
    return PressableCard(onTap: onTap, child: _fullBody());
  }

  Widget _compactBody() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 72,
          decoration: BoxDecoration(
            color: product.accent.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Icon(product.icon, color: product.accent, size: 32),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          product.nameAr,
          style: AppTypography.labelSmall,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _fullBody() {
    return Row(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: product.accent.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(product.icon, color: product.accent, size: 34),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(product.nameAr, style: AppTypography.titleMedium),
              const SizedBox(height: 4),
              Text(
                product.stepAr,
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        Icon(Icons.chevron_left_rounded, color: AppColors.textTertiary),
      ],
    );
  }
}

class PressableCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;

  const PressableCard({super.key, required this.child, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
          ),
          child: child,
        ),
      ),
    );
  }
}
