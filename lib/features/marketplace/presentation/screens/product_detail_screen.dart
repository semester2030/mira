import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/ask_mira_entry.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../data/catalog_price.dart';
import '../../data/commerce_api_client.dart';
import '../../domain/catalog_attribute_display.dart';
import '../../domain/catalog_detail_family.dart';
import '../../domain/commerce_models.dart' show CommerceLabels;
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
  bool _saved = false;

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

  List<CatalogMediaLink> get _galleryMedia {
    final mains = CatalogOfferMedia.mainSlides(product.media, kind: product.mainOfferKind);
    if (mains.isNotEmpty) return mains;
    return CatalogOfferMedia.detailMedia(product.media);
  }

  List<String> get _askSuggestions {
    switch (_family) {
      case CatalogDetailFamily.fashion:
        return const ['هل يناسب ذوقي؟', 'كيف أنسّقه؟', 'قارنيه بمنتج آخر', 'ابحثي بصورة'];
      case CatalogDetailFamily.jewelry:
        return const ['كيف أعرف مقاسي؟', 'كيف أنسّقه؟', 'قارنيه بقطعة أخرى', 'خيارات ضمن ميزانيتي'];
      case CatalogDetailFamily.generic:
        return const ['ما رأيك بهذا المنتج؟', 'هل يناسبني؟', 'قارنيه بمنتج آخر'];
    }
  }

  String get _askTitle {
    switch (_family) {
      case CatalogDetailFamily.fashion:
        return 'اسألي ميرا: مساعدتك الذكية';
      case CatalogDetailFamily.jewelry:
        return 'اسألي ميرا: مساعدتك الذكية';
      case CatalogDetailFamily.generic:
        return 'اسألي ميرا';
    }
  }

  String get _askSubtitle {
    switch (_family) {
      case CatalogDetailFamily.fashion:
        return 'أساعدك تختارين وتنسّقين هذه القطعة.';
      case CatalogDetailFamily.jewelry:
        return 'نختار القطعة المناسبة لك ونقارن الخيارات.';
      case CatalogDetailFamily.generic:
        return 'اسألي عن هذه القطعة.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final gallery = _galleryMedia;
    final family = _family;
    final familyKey = switch (family) {
      CatalogDetailFamily.fashion => 'fashion',
      CatalogDetailFamily.jewelry => 'jewelry',
      CatalogDetailFamily.generic => 'generic',
    };
    final categoryAr = CatalogAttributeDisplay.categoryLabelAr(
      product.category,
      subcategory: product.subcategory,
    );
    final priceText = CatalogPrice.text(known: _displayPriceKnown, halalas: _displayHalalas);

    return Scaffold(
      key: Key('product_detail_family_$familyKey'),
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        centerTitle: true,
        title: const MirraLogo.appBar(),
        actions: [
          IconButton(
            tooltip: 'حفظ',
            onPressed: () => setState(() => _saved = !_saved),
            icon: Icon(_saved ? Icons.favorite : Icons.favorite_border, color: AppColors.brandBurgundy),
          ),
          IconButton(
            tooltip: 'مشاركة',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('المشاركة ستتوفر قريبًا')),
              );
            },
            icon: Icon(Icons.ios_share_outlined, color: AppColors.brandBurgundy),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  if (kDebugMode && widget.provenance != null) ...[
                    widget.provenance!,
                    const SizedBox(height: 8),
                  ],
                  if (gallery.isNotEmpty) ...[
                    CatalogDetailMediaSection(
                      media: gallery,
                      videoCover: CatalogOfferMedia.videoCover(product.media),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (categoryAr.isNotEmpty)
                    Text(
                      categoryAr,
                      style: AppTypography.labelMedium.copyWith(color: AppColors.textTertiary),
                      textAlign: TextAlign.right,
                    ),
                  Text(
                    product.nameAr,
                    key: const Key('product_detail_title'),
                    style: AppTypography.headlineSmall.copyWith(
                      color: AppColors.brandBurgundy,
                      fontWeight: FontWeight.w700,
                    ),
                    textAlign: TextAlign.right,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    priceText,
                    style: AppTypography.titleLarge.copyWith(
                      color: AppColors.brandBurgundy,
                      fontWeight: FontWeight.w700,
                    ),
                    textAlign: TextAlign.right,
                  ),
                  if (product.descriptionAr != null && product.descriptionAr!.trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      product.descriptionAr!,
                      style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.right,
                    ),
                  ],
                  const SizedBox(height: 14),
                  _partnerRow(),
                  if (product.optionGroups.isNotEmpty) ...[
                    const SizedBox(height: 18),
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
                  const SizedBox(height: 12),
                  _deliveryTile(),
                  const SizedBox(height: 18),
                  AskMiraEntry(
                    key: const Key('product_detail_ask_mira'),
                    compact: false,
                    contextLine: _askTitle,
                    subtitle: _askSubtitle,
                    suggestions: _askSuggestions,
                    routeArgs: (question) => AdvisorRouteArgs.marketplaceOffer(
                      offerId: product.id,
                      offerKind: 'product',
                      partnerId: product.partnerId,
                      initialQuestion: question,
                      discussionFocus: 'منتج: ${product.nameAr} · المتجر: ${product.partnerNameAr}',
                    ),
                  ),
                  if (_isPreview) ...[
                    const SizedBox(height: 12),
                    Text(
                      'معاينة تجريبية. الشراء والمخزون غير منفّذين.',
                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 96),
                ],
              ),
            ),
            _stickyBar(context, priceText),
          ],
        ),
      ),
    );
  }

  Widget _partnerRow() {
    final partner = product.partnerNameAr.trim();
    final letter = partner.isEmpty ? 'م' : String.fromCharCode(partner.runes.first);
    return Material(
      color: AppColors.surface,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          // Partner navigation is optional; keep row tappable without crashing.
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              Icon(Icons.chevron_left, color: AppColors.textTertiary),
              const Spacer(),
              Text(
                product.partnerNameAr,
                style: AppTypography.titleSmall.copyWith(color: AppColors.textPrimary),
              ),
              const SizedBox(width: 10),
              CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.primaryLight,
                child: Text(
                  letter,
                  style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _familySections(CatalogDetailFamily family) {
    final rows = CatalogAttributeDisplay.rows(product.traits);
    switch (family) {
      case CatalogDetailFamily.fashion:
        return [
          const SizedBox(height: 8),
          _sectionTitle('الخامة والتفاصيل', Icons.checkroom_outlined),
          const SizedBox(height: 8),
          if (rows.isNotEmpty)
            _specTable(rows)
          else if ((product.descriptionAr ?? '').trim().isNotEmpty)
            Text(
              product.descriptionAr!,
              style: AppTypography.bodyMedium,
              textAlign: TextAlign.right,
            )
          else
            Text(
              'لم تُضف تفاصيل إضافية لهذه القطعة.',
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.right,
            ),
        ];
      case CatalogDetailFamily.jewelry:
        return [
          const SizedBox(height: 12),
          _sectionTitle('مواصفات القطعة', Icons.diamond_outlined),
          const SizedBox(height: 8),
          if (rows.isNotEmpty)
            _specTable(rows)
          else
            Text(
              'لم يُدخل البائع مواصفات المعدن أو الحجر لهذه القطعة.',
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.right,
            ),
          const SizedBox(height: 12),
          _certificateRow(),
        ];
      case CatalogDetailFamily.generic:
        if (rows.isEmpty) return const [];
        return [
          const SizedBox(height: 12),
          _sectionTitle('الخصائص', Icons.info_outline),
          const SizedBox(height: 8),
          _specTable(rows),
        ];
    }
  }

  Widget _specTable(List<({String labelAr, String valueAr})> rows) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++)
            Container(
              width: double.infinity,
              color: i.isOdd ? const Color(0xFFFAF6F8) : Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      rows[i].valueAr,
                      style: AppTypography.bodyMedium,
                      textAlign: TextAlign.left,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    rows[i].labelAr,
                    style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.right,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _certificateRow() {
    final has = CatalogDetailFamilyResolver.hasCertificate(product.traits, null);
    return Container(
      key: const Key('jewelry_certificate_row'),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Row(
        children: [
          Icon(has ? Icons.verified_outlined : Icons.description_outlined, color: AppColors.textSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              has ? 'شهادة القطعة: مرفقة' : 'شهادة القطعة: غير مرفقة',
              style: AppTypography.bodyMedium,
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _deliveryTile() {
    final fee = product.deliveryFeeHalalas;
    final feeLine = fee == null
        ? 'رسوم التوصيل غير محددة من البائع.'
        : 'رسوم التوصيل: ${CommerceLabels.money(fee)}';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      child: Row(
        children: [
          Icon(Icons.chevron_left, color: AppColors.textTertiary),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('التوصيل والاسترجاع', style: AppTypography.titleSmall, textAlign: TextAlign.right),
                Text(feeLine, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary), textAlign: TextAlign.right),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Icon(Icons.local_shipping_outlined, color: AppColors.brandBurgundy),
        ],
      ),
    );
  }

  Widget _stickyBar(BuildContext context, String priceText) {
    return Material(
      elevation: 10,
      color: AppColors.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Row(
            children: [
              Expanded(child: _primaryCta(context)),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'الإجمالي',
                    style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                  ),
                  Text(
                    priceText,
                    key: const Key('product_detail_sticky_price'),
                    style: AppTypography.titleMedium.copyWith(
                      color: AppColors.brandBurgundy,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _primaryCta(BuildContext context) {
    if (product.isDisplayOnly && !_isPreview) {
      return Container(
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFFF3E8EE),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          'للعرض فقط',
          style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy),
        ),
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
      return _burgundyButton(
        label: MarketplaceCopy.addToCart,
        icon: Icons.shopping_bag_outlined,
        loading: _adding,
        onPressed: () => _addToCart(context),
      );
    }
    if (product.isExternalPurchase && _hasPurchaseLink) {
      return _burgundyButton(
        label: 'أضيفي للسلة',
        icon: Icons.shopping_bag_outlined,
        onPressed: () => _openStore(context),
      );
    }
    if (product.isContactMode && (product.contactPhone ?? '').trim().isNotEmpty) {
      return _burgundyButton(
        label: 'تواصلي',
        icon: Icons.phone_outlined,
        onPressed: () => MiraUrlLauncher.openExternal(context, 'tel:${product.contactPhone!.trim()}'),
      );
    }
    return Text(
      'لا يوجد مسار شراء منشور',
      style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
      textAlign: TextAlign.center,
    );
  }

  Widget _burgundyButton({
    required String label,
    required IconData icon,
    required VoidCallback onPressed,
    bool loading = false,
  }) {
    return SizedBox(
      height: 52,
      child: FilledButton.icon(
        onPressed: loading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.brandBurgundy,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.brandBurgundy.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        icon: loading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : Icon(icon, size: 20),
        label: Text(label, style: AppTypography.titleSmall.copyWith(color: Colors.white)),
      ),
    );
  }

  Widget _sectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.brandBurgundy),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            style: AppTypography.titleSmall.copyWith(color: AppColors.brandBurgundy),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }
}
