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
  final String externalUrl;
  final String? stepAr;
  final int matchScore;
  final List<String> concernTags;

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
    required this.externalUrl,
    this.stepAr,
    required this.matchScore,
    this.concernTags = const [],
  });
}
