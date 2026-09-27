class CatalogMediaLink {
  const CatalogMediaLink({required this.kind, required this.url, this.sortOrder = 0, this.isPrimary = false});

  final String kind;
  final String url;
  final int sortOrder;
  final bool isPrimary;
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
  });
}
