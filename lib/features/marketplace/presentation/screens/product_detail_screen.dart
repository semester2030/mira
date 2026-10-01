import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/catalog_price.dart';
import '../../data/commerce_api_client.dart';
import '../../domain/catalog_offer_media.dart';
import '../../domain/commerce_models.dart' show CommerceLabels;
import '../../domain/catalog_product_options.dart';
import '../../domain/entities/catalog_product.dart';
import '../commerce_cart_actions.dart';
import '../widgets/catalog_detail_media_section.dart';
import '../widgets/product_option_selector.dart';

class ProductDetailScreen extends StatefulWidget {
  final CatalogProduct product;
  final Widget? provenance;

  /// Cart client. Defaults to the signed-in account's API client.
  final CommerceClient? commerce;

  const ProductDetailScreen({super.key, required this.product, this.provenance, this.commerce});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  CatalogProductVariant? _variant;
  Map<String, String> _selected = const {};
  late final CommerceClient _commerce = widget.commerce ?? ApiCommerceClient();
  bool _adding = false;

  CatalogProduct get product => widget.product;

  bool get _hasPurchaseLink {
    final url = product.externalUrl.trim();
    final uri = Uri.tryParse(url);
    return uri != null && uri.hasScheme && uri.host.isNotEmpty;
  }

  int get _displayHalalas => _variant?.priceHalalas ?? product.priceHalalas;

  bool get _displayPriceKnown {
    if (_variant?.priceHalalas != null) return true;
    return product.priceKnown;
  }

  Future<void> _openStore(BuildContext context) async {
    final url = product.externalUrl.trim();
    final opened = await MiraUrlLauncher.openExternal(context, url);
    if (!context.mounted || !opened) return;
    final note = _selected.isEmpty
        ? 'فُتح رابط خارجي. هذا ليس شراءً مكتملًا'
        : 'فُتح رابط المنتج العام. الاختيار داخل ميرا لا يُرسل تلقائيًا للمتجر الخارجي.';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(note)));
  }

  Future<void> _addToCart(BuildContext context) async {
    if (_adding) return;
    setState(() => _adding = true);
    try {
      await CommerceCartActions.addToCart(context, client: _commerce, product: product, selected: _selected);
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  bool get _isPreview => product.id.startsWith('preview-');

  List<Widget> _inAppPurchase(BuildContext context) {
    if (product.outOfStock) {
      return [
        Text(MarketplaceCopy.outOfStock, style: AppTypography.bodyMedium, textAlign: TextAlign.center),
      ];
    }
    if (!product.canOrderInMira) {
      return [
        Text(
          'الطلب داخل ميرا غير متاح لهذا المنتج الآن.',
          style: AppTypography.bodyMedium,
          textAlign: TextAlign.center,
        ),
      ];
    }
    final missing = CatalogOptionJson.firstMissing(groups: product.optionGroups, selected: _selected);
    return [
      PremiumButton(
        label: MarketplaceCopy.addToCart,
        icon: Icons.add_shopping_cart_outlined,
        variant: PremiumButtonVariant.gold,
        loading: _adding,
        onPressed: () => _addToCart(context),
      ),
      const SizedBox(height: 8),
      if (missing != null)
        Text(
          MarketplaceCopy.chooseOptionsFirst,
          style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
          textAlign: TextAlign.center,
        ),
      Text(
        product.deliveryFeeHalalas == null
            ? 'رسوم التوصيل غير محددة. ${MarketplaceCopy.codOnly}'
            : 'رسوم التوصيل ${CommerceLabels.money(product.deliveryFeeHalalas!)}. ${MarketplaceCopy.codOnly}',
        style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
        textAlign: TextAlign.center,
      ),
      TextButton(
        onPressed: () => Navigator.of(context).pushNamed(AppRoutes.cart),
        child: const Text(MarketplaceCopy.viewCart),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final details = CatalogOfferMedia.detailMedia(product.media);
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'تفاصيل المنتج'),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (widget.provenance != null) widget.provenance!,
            Text(
              product.partnerNameAr,
              style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            Text(
              product.nameAr,
              style: AppTypography.headlineSmall,
              textAlign: TextAlign.center,
            ),
            if (product.descriptionAr != null && product.descriptionAr!.trim().isNotEmpty) ...[
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
                  _info('السعر', CatalogPrice.text(known: _displayPriceKnown, halalas: _displayHalalas)),
                  if (product.stepAr != null) _info('الخطوة', product.stepAr!),
                  if (product.category != null) _info('التصنيف', product.category!),
                  if (product.matchKnown) _info('التطابق', '${product.matchScore}%'),
                ],
              ),
            ),
            if (product.optionGroups.isNotEmpty) ...[
              const SizedBox(height: 20),
              ProductOptionSelector(
                key: ValueKey(product.id),
                product: product,
                onChanged: (selected, variant) {
                  setState(() {
                    _selected = selected;
                    _variant = variant;
                  });
                },
              ),
            ],
            if (product.traits.isNotEmpty) ...[
              const SizedBox(height: 12),
              PremiumCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('الخصائص', style: AppTypography.titleSmall, textAlign: TextAlign.center),
                    const SizedBox(height: 8),
                    for (final entry in product.traits.entries) ...[
                      Text(entry.key, style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
                      Text(entry.value, style: AppTypography.bodyMedium),
                      const SizedBox(height: 8),
                    ],
                  ],
                ),
              ),
            ],
            if (details.isNotEmpty) ...[
              const SizedBox(height: 20),
              CatalogDetailMediaSection(media: details),
            ],
            if (product.id.startsWith('preview-')) ...[
              const SizedBox(height: 12),
              Text(
                'معاينة تجريبية. الشراء والمخزون غير منفّذين.',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 24),
            if (product.isInternalCod && !_isPreview) ...[
              ..._inAppPurchase(context),
            ] else if (_hasPurchaseLink) ...[
              PremiumButton(
                label: 'الشراء من متجر ${product.partnerNameAr}',
                icon: Icons.shopping_bag_outlined,
                variant: PremiumButtonVariant.gold,
                onPressed: () => _openStore(context),
              ),
              const SizedBox(height: 8),
              Text(
                MarketplaceCopy.externalLinkNotPurchase,
                style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
                textAlign: TextAlign.center,
              ),
            ] else ...[
              Text(
                (product.contactPhone ?? '').trim().isEmpty
                    ? 'لا يوجد مسار شراء أو وسيلة تواصل منشورة لهذا المنتج.'
                    : 'للتواصل: ${product.contactPhone}',
                style: AppTypography.bodyMedium,
                textAlign: TextAlign.center,
              ),
              if ((product.contactPhone ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                PremiumButton(
                  label: 'تواصلي',
                  icon: Icons.phone_outlined,
                  variant: PremiumButtonVariant.gold,
                  onPressed: () => MiraUrlLauncher.openExternal(context, 'tel:${product.contactPhone!.trim()}'),
                ),
              ],
            ],
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
