import '../catalog_offer_media.dart';
import '../catalog_product_options.dart';

export '../catalog_offer_media.dart' show CatalogMediaLink, CatalogMainOfferKind, CatalogMediaPlacement, CatalogOfferMedia, CatalogMainOfferKindCodec;
export '../catalog_product_options.dart';

/// How a product is bought. `external` opens the merchant URL (not a purchase inside Mira).
/// `internal_cod` uses the Mira cart and cash on delivery.
abstract final class CatalogPurchaseMode {
  static const external = 'external';
  static const internalCod = 'internal_cod';

  static String parse(Object? raw) => raw == internalCod ? internalCod : external;
}

class CatalogProduct {
  final String id;
  final String partnerId;
  final String partnerNameAr;
  final String? partnerEmoji;
  final String nameAr;
  final String nameEn;
  final String? descriptionAr;
  final int priceHalalas;
  final String priceLabel;
  final bool priceKnown;
  final String externalUrl;
  final String? stepAr;
  final String? contactPhone;
  final int matchScore;
  final bool matchKnown;
  final String? category;
  final List<String> concernTags;
  final List<CatalogMediaLink> media;
  final CatalogMainOfferKind? mainOfferKind;
  final List<CatalogOptionGroup> optionGroups;
  final List<CatalogProductVariant> variants;
  final Map<String, String> traits;

  /// `external` | `internal_cod`. Defaults to external when the server does not say.
  final String purchaseMode;

  /// Units a customer can still order. null = not tracked (unlimited).
  final int? stockQty;

  /// null = unknown fee (not free).
  final int? deliveryFeeHalalas;

  bool get isInternalCod => purchaseMode == CatalogPurchaseMode.internalCod;

  /// True only when the server enabled in-Mira ordering, the price is real, and stock is not known to be empty.
  bool get canOrderInMira =>
      isInternalCod && priceKnown && priceHalalas > 0 && (stockQty == null || stockQty! > 0);

  /// In-Mira product that cannot be ordered right now because stock is empty.
  bool get outOfStock => isInternalCod && stockQty != null && stockQty! <= 0;

  CatalogProduct withKnownMatch(int score) {
    return CatalogProduct(
      id: id,
      partnerId: partnerId,
      partnerNameAr: partnerNameAr,
      partnerEmoji: partnerEmoji,
      nameAr: nameAr,
      nameEn: nameEn,
      descriptionAr: descriptionAr,
      priceHalalas: priceHalalas,
      priceLabel: priceLabel,
      priceKnown: priceKnown,
      externalUrl: externalUrl,
      stepAr: stepAr,
      contactPhone: contactPhone,
      matchScore: score,
      matchKnown: true,
      category: category,
      concernTags: concernTags,
      media: media,
      mainOfferKind: mainOfferKind,
      optionGroups: optionGroups,
      variants: variants,
      traits: traits,
      purchaseMode: purchaseMode,
      stockQty: stockQty,
      deliveryFeeHalalas: deliveryFeeHalalas,
    );
  }

  const CatalogProduct({
    required this.id,
    required this.partnerId,
    required this.partnerNameAr,
    this.partnerEmoji,
    required this.nameAr,
    required this.nameEn,
    this.descriptionAr,
    required this.priceHalalas,
    required this.priceLabel,
    this.priceKnown = true,
    required this.externalUrl,
    this.stepAr,
    this.contactPhone,
    required this.matchScore,
    this.matchKnown = false,
    this.category,
    this.concernTags = const [],
    this.media = const [],
    this.mainOfferKind,
    this.optionGroups = const [],
    this.variants = const [],
    this.traits = const {},
    this.purchaseMode = CatalogPurchaseMode.external,
    this.stockQty,
    this.deliveryFeeHalalas,
  });
}
