import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/config/mira_api_config.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/catalog_product.dart';
import '../../data/datasources/marketplace_api_data_source.dart';

class ProductDetailScreen extends StatelessWidget {
  final CatalogProduct product;

  const ProductDetailScreen({super.key, required this.product});

  Future<void> _openStore(BuildContext context) async {
    if (MiraApiConfig.useBackend) {
      MarketplaceApiDataSource().trackClick(
        partnerId: product.partnerId,
        targetId: product.id,
        targetType: 'product',
      );
    }
    final uri = Uri.tryParse(product.externalUrl);
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!context.mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر فتح رابط المتجر')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'تفاصيل المنتج'),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
                    _info('السعر', product.priceLabel),
                    if (product.stepAr != null) _info('الخطوة', product.stepAr!),
                    _info('التطابق', '${product.matchScore}%'),
                  ],
                ),
              ),
              const Spacer(),
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
            ],
          ),
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
