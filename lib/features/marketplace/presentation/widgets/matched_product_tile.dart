import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../domain/entities/catalog_product.dart';

class MatchedProductTile extends StatelessWidget {
  final CatalogProduct product;
  final VoidCallback? onTap;
  final bool compact;

  const MatchedProductTile({
    super.key,
    required this.product,
    this.onTap,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return SizedBox(
        width: 140,
        child: _CardBody(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _emojiBox(),
              const SizedBox(height: 8),
              Text(
                product.nameAr,
                style: AppTypography.labelSmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                product.priceLabel,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.primaryDark,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return _CardBody(
      onTap: onTap,
      child: Row(
        children: [
          _emojiBox(size: 56),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.partnerNameAr,
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(product.nameAr, style: AppTypography.titleMedium),
                if (product.stepAr != null)
                  Text(
                    product.stepAr!,
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textTertiary,
                    ),
                  ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(
                      product.priceLabel,
                      style: AppTypography.titleSmall.copyWith(
                        color: AppColors.primaryDark,
                      ),
                    ),
                    const Spacer(),
                    _matchBadge(),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _emojiBox({double size = 48}) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: Alignment.center,
      child: Text(
        product.partnerEmoji ?? '🛍️',
        style: TextStyle(fontSize: size * 0.45),
      ),
    );
  }

  Widget _matchBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        '${product.matchScore}%',
        style: AppTypography.labelSmall.copyWith(
          color: AppColors.success,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _CardBody extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;

  const _CardBody({required this.child, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
          ),
          child: child,
        ),
      ),
    );
  }
}
