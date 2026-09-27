import 'catalog_product.dart';

class CatalogService {
  final String id;
  final String partnerId;
  final String partnerNameAr;
  final String? partnerEmoji;
  final String partnerType;
  final String city;
  final String? contactPhone;
  final String nameAr;
  final String nameEn;
  final String? descriptionAr;
  final int durationMin;
  final int priceHalalas;
  final String priceLabel;
  final bool priceKnown;
  final int matchScore;
  final bool matchKnown;
  final String? category;
  final bool bookingEnabled;
  final List<String> concernTags;
  final List<CatalogMediaLink> media;

  CatalogService withKnownMatch(int score) {
    return CatalogService(
      id: id,
      partnerId: partnerId,
      partnerNameAr: partnerNameAr,
      partnerEmoji: partnerEmoji,
      partnerType: partnerType,
      city: city,
      contactPhone: contactPhone,
      nameAr: nameAr,
      nameEn: nameEn,
      descriptionAr: descriptionAr,
      durationMin: durationMin,
      priceHalalas: priceHalalas,
      priceLabel: priceLabel,
      priceKnown: priceKnown,
      matchScore: score,
      matchKnown: true,
      category: category,
      bookingEnabled: bookingEnabled,
      concernTags: concernTags,
      media: media,
    );
  }

  const CatalogService({
    required this.id,
    required this.partnerId,
    required this.partnerNameAr,
    this.partnerEmoji,
    required this.partnerType,
    required this.city,
    this.contactPhone,
    required this.nameAr,
    required this.nameEn,
    this.descriptionAr,
    required this.durationMin,
    required this.priceHalalas,
    required this.priceLabel,
    this.priceKnown = true,
    required this.matchScore,
    this.matchKnown = false,
    this.category,
    required this.bookingEnabled,
    this.concernTags = const [],
    this.media = const [],
  });

  bool get isClinic => partnerType == 'clinic';
}
