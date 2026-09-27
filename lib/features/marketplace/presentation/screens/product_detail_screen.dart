import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/catalog_price.dart';
import '../../domain/entities/catalog_product.dart';
class ProductDetailScreen extends StatelessWidget {
  final CatalogProduct product;
  final Widget? provenance;

  const ProductDetailScreen({super.key, required this.product, this.provenance});

  Future<void> _openStore(BuildContext context) async {
    final url = product.externalUrl.trim();
    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('لا يوجد رابط شراء صالح')));
      return;
    }
    final opened = await MiraUrlLauncher.openExternal(context, url);
    if (!context.mounted || !opened) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('فُتح رابط خارجي. هذا ليس شراءً مكتملًا')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'تفاصيل المنتج'),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (provenance != null) provenance!,
              Center(
                child: Text(
                  product.partnerEmoji ?? '🛍️',
                  style: const TextStyle(fontSize: 64),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                product.partnerNameAr,
                style: AppTypography.labelLarge.copyWith(
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              Text(
                product.nameAr,
                style: AppTypography.headlineSmall,
                textAlign: TextAlign.center,
              ),
              if (product.descriptionAr != null) ...[
                const SizedBox(height: 8),
                Text(
                  product.descriptionAr!,
                  style: AppTypography.bodyMedium,
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 16),
              PremiumCard(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _info('السعر', CatalogPrice.text(known: product.priceKnown, halalas: product.priceHalalas)),
                    if (product.stepAr != null) _info('الخطوة', product.stepAr!),
                    if (product.matchKnown) _info('التطابق', '${product.matchScore}%'),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              PremiumButton(
                label: 'الشراء من متجر ${product.partnerNameAr}',
                icon: Icons.shopping_bag_outlined,
                variant: PremiumButtonVariant.gold,
                onPressed: () => _openStore(context),
              ),
              const SizedBox(height: 8),
              Text(
                'الدفع والشحن عبر متجر الشريك — ميرا لا تحفظ بيانات بطاقتك.',
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textTertiary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                MarketplaceCopy.externalLinkNotPurchase,
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textTertiary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
    );
  }

  Widget _info(String label, String value) {
    return Column(
      children: [
        Text(label, style: AppTypography.labelSmall),
        Text(value, style: AppTypography.titleMedium),
      ],
    );
  }
}
