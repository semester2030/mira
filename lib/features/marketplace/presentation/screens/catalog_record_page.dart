import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/catalog_provenance.dart';
import '../../data/discover_catalog_gateway.dart';
import '../../domain/entities/catalog_product.dart';
import '../widgets/marketplace_data_banner.dart';
import 'product_detail_screen.dart';
import 'service_detail_screen.dart';

class CatalogRecordPage extends StatefulWidget {
  const CatalogRecordPage({
    super.key,
    required this.gateway,
    required this.kind,
    required this.id,
    required this.transport,
    this.matchKnown = false,
    this.matchScore = 0,
    this.initialSelections,
    this.matchedVariantIds,
    this.bookingDateKey,
    this.bookingBranchId,
  });

  final DiscoverCatalogGateway gateway;
  final String kind;
  final String id;
  final CatalogTransport? transport;
  final bool matchKnown;
  final int matchScore;
  final Map<String, String>? initialSelections;
  final List<String>? matchedVariantIds;
  final String? bookingDateKey;
  final String? bookingBranchId;

  @override
  State<CatalogRecordPage> createState() => _CatalogRecordPageState();
}

class _CatalogRecordPageState extends State<CatalogRecordPage> {
  late Future<CatalogRecordResult> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<CatalogRecordResult> _load() {
    return widget.gateway.loadRecord(kind: widget.kind, id: widget.id, transport: widget.transport);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CatalogRecordResult>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Scaffold(
            appBar: AppBar(backgroundColor: AppColors.background),
            body: const Center(child: Text('جاري تحميل التفاصيل')),
          );
        }
        final result = snapshot.data;
        if (result == null || result.status == CatalogRecordStatus.network) {
          return Scaffold(
            appBar: AppBar(backgroundColor: AppColors.background),
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('تعذر تحميل البيانات', style: AppTypography.bodyLarge),
                  TextButton(
                    onPressed: () => setState(() => _future = _load()),
                    child: const Text('إعادة المحاولة'),
                  ),
                ],
              ),
            ),
          );
        }
        if (result.status == CatalogRecordStatus.missing || (result.product == null && result.service == null)) {
          return Scaffold(
            appBar: AppBar(backgroundColor: AppColors.background),
            body: Center(child: Text('هذا العنصر غير متاح أو لم يعد منشورًا', style: AppTypography.bodyLarge, textAlign: TextAlign.center)),
          );
        }
        final banner = result.transport == null || result.contentMark == null
            ? null
            : MarketplaceDataBanner(transport: result.transport!, contentMark: result.contentMark!);
        final product = result.product;
        if (product != null) {
          final scoped = _scopeProduct(product);
          if (scoped == null) {
            return Scaffold(
              appBar: AppBar(backgroundColor: AppColors.background),
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'التركيبات المطابقة لبحثك لم تعد متاحة. حدّثي النتائج أو أعيدي اختيار الخيارات.',
                        style: AppTypography.bodyLarge,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: () => setState(() => _future = _load()),
                        child: const Text('تحديث'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }
          return ProductDetailScreen(
            product: scoped,
            provenance: banner,
            initialSelections: widget.initialSelections,
          );
        }
        final service = result.service!;
        return ServiceDetailScreen(
          service: widget.matchKnown ? service.withKnownMatch(widget.matchScore) : service,
          provenance: banner,
          bookingDateKey: widget.bookingDateKey,
          bookingBranchId: widget.bookingBranchId,
        );
      },
    );
  }

  /// When matchedVariantIds was provided from discover, never silently expand to all variants.
  CatalogProduct? _scopeProduct(CatalogProduct product) {
    final base = widget.matchKnown ? product.withKnownMatch(widget.matchScore) : product;
    final ids = widget.matchedVariantIds;
    if (ids == null) return base;
    if (ids.isEmpty) return null;
    if (ids.length <= 1) {
      if (ids.length == 1 && product.variants.isNotEmpty) {
        final still = product.variants.any((v) => v.id == ids.first);
        if (!still) return null;
      }
      return base;
    }
    final allowed = ids.toSet();
    final variants = product.variants.where((v) => allowed.contains(v.id)).toList();
    if (variants.isEmpty) return null;
    return CatalogProduct(
      id: base.id,
      partnerId: base.partnerId,
      partnerNameAr: base.partnerNameAr,
      partnerEmoji: base.partnerEmoji,
      nameAr: base.nameAr,
      nameEn: base.nameEn,
      descriptionAr: base.descriptionAr,
      priceHalalas: base.priceHalalas,
      priceLabel: base.priceLabel,
      priceKnown: base.priceKnown,
      externalUrl: base.externalUrl,
      stepAr: base.stepAr,
      contactPhone: base.contactPhone,
      matchScore: base.matchScore,
      matchKnown: base.matchKnown,
      category: base.category,
      concernTags: base.concernTags,
      media: base.media,
      mainOfferKind: base.mainOfferKind,
      optionGroups: base.optionGroups,
      variants: variants,
      traits: base.traits,
      purchaseMode: base.purchaseMode,
      stockQty: base.stockQty,
      deliveryFeeHalalas: base.deliveryFeeHalalas,
    );
  }
}
