import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/ask_mira_entry.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/catalog_price.dart';
import '../../data/commerce_api_client.dart';
import '../../domain/catalog_detail_family.dart';
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

  /// Pre-select variant choices from a catalog filter match (same-variant context).
  final Map<String, String>? initialSelections;

  const ProductDetailScreen({
    super.key,
    required this.product,
    this.provenance,
    this.commerce,
    this.initialSelections,
  });

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  CatalogProductVariant? _variant;
  late Map<String, String> _selected = Map<String, String>.from(widget.initialSelections ?? const {});
  late final CommerceClient _commerce = widget.commerce ?? ApiCommerceClient();
  bool _adding = false;

  @override
  void initState() {
    super.initState();
    if (_selected.isNotEmpty) {
      _variant = CatalogOptionMatrix.match(variants: product.variants, selected: _selected);
    }
  }

  CatalogProduct get product => widget.product;

  CatalogDetailFamily get _family => CatalogDetailFamilyResolver.resolve(
        category: product.category,
        subcategory: product.subcategory,
        profileId: product.profileId,
      );

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

  String get _selectionSummary {
    if (_selected.isEmpty) return '';
    final parts = <String>[];
    for (final group in product.optionGroups) {
      final id = _selected[group.id];
      if (id == null) continue;
      final match = group.values.where((v) => v.id == id);
      if (match.isNotEmpty) parts.add(match.first.labelAr);
    }
    return parts.join(' • ');
  }

  List<String> get _askSuggestions {
    switch (_family) {
      case CatalogDetailFamily.fashion:
        return const ['هل يناسب ذوقي؟', 'كيف أنسّقه؟', 'قارنيه بمنتج آخر'];
      case CatalogDetailFamily.jewelry:
        return const ['كيف أعرف مقاسي؟', 'كيف أنسّقه؟', 'خيارات ضمن ميزانيتي'];
      case CatalogDetailFamily.generic:
        return const ['ما رأيك بهذا المنتج؟', 'هل يناسبني؟'];
    }
  }

  @override
  Widget build(BuildContext context) {
    final details = CatalogOfferMedia.detailMedia(product.media);
    final family = _family;
    final familyKey = switch (family) {
      CatalogDetailFamily.fashion => 'fashion',
      CatalogDetailFamily.jewelry => 'jewelry',
      CatalogDetailFamily.generic => 'generic',
    };

    return Scaffold(
      key: Key('product_detail_family_$familyKey'),
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'ميرا'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                children: [
                  if (widget.provenance != null) widget.provenance!,
                  if (details.isNotEmpty) ...[
                    CatalogDetailMediaSection(media: details),
                    const SizedBox(height: 16),
                  ],
                  Text(
                    product.nameAr,
                    key: const Key('product_detail_title'),
                    style: AppTypography.headlineSmall,
                    textAlign: TextAlign.right,
                  ),
                  if (_selectionSummary.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      _selectionSummary,
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.right,
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    product.partnerNameAr,
                    style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.right,
                  ),
                  if (product.descriptionAr != null && product.descriptionAr!.trim().isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      product.descriptionAr!,
                      style: AppTypography.bodyMedium,
                      textAlign: TextAlign.right,
                    ),
                  ],
                  if (product.optionGroups.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    ProductOptionSelector(
                      key: ValueKey(
                        '${product.id}:${widget.initialSelections?.entries.map((e) => '${e.key}=${e.value}').join('|') ?? ''}',
                      ),
                      product: product,
                      initialSelected: widget.initialSelections,
                      onChanged: (selected, variant) {
                        setState(() {
                          _selected = selected;
                          _variant = variant;
                        });
                      },
                    ),
                  ],
                  ..._familySections(family),
                  const SizedBox(height: 16),
                  _storeShippingCard(),
                  const SizedBox(height: 20),
                  AskMiraEntry(
                    key: const Key('product_detail_ask_mira'),
                    contextLine: family == CatalogDetailFamily.jewelry
                        ? 'اسألي ميرا — نختار القطعة المناسبة لك'
                        : 'اسألي ميرا — أساعدك تختارين وتنسّقين',
                    suggestions: _askSuggestions,
                    routeArgs: (question) => AdvisorRouteArgs.marketplaceOffer(
                      offerId: product.id,
                      offerKind: 'product',
                      partnerId: product.partnerId,
                      initialQuestion: question,
                      discussionFocus: 'منتج: ${product.nameAr} · المتجر: ${product.partnerNameAr}',
                    ),
                  ),
                  if (product.id.startsWith('preview-')) ...[
                    const SizedBox(height: 12),
                    Text(
                      'معاينة تجريبية. الشراء والمخزون غير منفّذين.',
                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 88),
                ],
              ),
            ),
            _stickyBar(context),
          ],
        ),
      ),
    );
  }

  List<Widget> _familySections(CatalogDetailFamily family) {
    switch (family) {
      case CatalogDetailFamily.fashion:
        return [
          if (product.traits.isNotEmpty) ...[
            const SizedBox(height: 20),
            _sectionTitle('الخامة والتفاصيل', Icons.checkroom_outlined),
            const SizedBox(height: 8),
            _traitsCard(product.traits),
          ],
        ];
      case CatalogDetailFamily.jewelry:
        return [
          const SizedBox(height: 20),
          _sectionTitle('مواصفات القطعة', Icons.diamond_outlined),
          const SizedBox(height: 8),
          if (product.traits.isNotEmpty)
            _traitsCard(product.traits)
          else
            PremiumCard(
              child: Text(
                'لم يُدخل البائع مواصفات المعدن أو الحجر لهذه القطعة.',
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.right,
              ),
            ),
          const SizedBox(height: 12),
          PremiumCard(
            key: const Key('jewelry_certificate_row'),
            child: Row(
              children: [
                Icon(
                  CatalogDetailFamilyResolver.hasCertificate(product.traits, null)
                      ? Icons.verified_outlined
                      : Icons.description_outlined,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    CatalogDetailFamilyResolver.hasCertificate(product.traits, null)
                        ? 'شهادة القطعة: مرفقة'
                        : 'شهادة القطعة: غير مرفقة',
                    style: AppTypography.bodyMedium,
                    textAlign: TextAlign.right,
                  ),
                ),
              ],
            ),
          ),
        ];
      case CatalogDetailFamily.generic:
        return [
          if (product.traits.isNotEmpty) ...[
            const SizedBox(height: 20),
            _sectionTitle('الخصائص', Icons.info_outline),
            const SizedBox(height: 8),
            _traitsCard(product.traits),
          ],
        ];
    }
  }

  Widget _traitsCard(Map<String, String> traits) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final entry in traits.entries) ...[
            Text(
              CatalogDetailFamilyResolver.attributeLabelAr(entry.key),
              style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.right,
            ),
            Text(entry.value, style: AppTypography.bodyMedium, textAlign: TextAlign.right),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }

  Widget _storeShippingCard() {
    final fee = product.deliveryFeeHalalas;
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('معلومات المتجر والتوصيل', style: AppTypography.titleSmall, textAlign: TextAlign.right),
          const SizedBox(height: 8),
          Text('المتجر: ${product.partnerNameAr}', style: AppTypography.bodyMedium, textAlign: TextAlign.right),
          Text(
            fee == null
                ? 'رسوم التوصيل غير محددة من البائع.'
                : 'رسوم التوصيل: ${CommerceLabels.money(fee)}',
            style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
            textAlign: TextAlign.right,
          ),
        ],
      ),
    );
  }

  Widget _stickyBar(BuildContext context) {
    return Material(
      elevation: 8,
      color: AppColors.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Row(
            children: [
              Expanded(child: _primaryCta(context)),
              const SizedBox(width: 12),
              Text(
                CatalogPrice.text(known: _displayPriceKnown, halalas: _displayHalalas),
                key: const Key('product_detail_sticky_price'),
                style: AppTypography.titleMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _primaryCta(BuildContext context) {
    if (product.isDisplayOnly && !_isPreview) {
      return Text(
        'للعرض فقط',
        style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        textAlign: TextAlign.center,
      );
    }
    if (product.isInternalCod && !_isPreview) {
      if (product.outOfStock) {
        return Text(MarketplaceCopy.outOfStock, style: AppTypography.bodyMedium, textAlign: TextAlign.center);
      }
      if (!product.canOrderInMira) {
        return Text(
          'الطلب داخل ميرا غير متاح لهذا المنتج الآن.',
          style: AppTypography.bodyMedium,
          textAlign: TextAlign.center,
        );
      }
      return PremiumButton(
        label: MarketplaceCopy.addToCart,
        icon: Icons.add_shopping_cart_outlined,
        variant: PremiumButtonVariant.gold,
        loading: _adding,
        onPressed: () => _addToCart(context),
      );
    }
    if (product.isExternalPurchase && _hasPurchaseLink) {
      return PremiumButton(
        label: 'الشراء من متجر ${product.partnerNameAr}',
        icon: Icons.shopping_bag_outlined,
        variant: PremiumButtonVariant.gold,
        onPressed: () => _openStore(context),
      );
    }
    if (product.isContactMode && (product.contactPhone ?? '').trim().isNotEmpty) {
      return PremiumButton(
        label: 'تواصلي',
        icon: Icons.phone_outlined,
        variant: PremiumButtonVariant.gold,
        onPressed: () => MiraUrlLauncher.openExternal(context, 'tel:${product.contactPhone!.trim()}'),
      );
    }
    return Text(
      'لا يوجد مسار شراء منشور',
      style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
      textAlign: TextAlign.center,
    );
  }

  Widget _sectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.primary),
        const SizedBox(width: 8),
        Expanded(child: Text(title, style: AppTypography.titleSmall, textAlign: TextAlign.right)),
      ],
    );
  }
}
