class CatalogService {
  final String id;
  final String partnerId;
  final String partnerNameAr;
  final String? partnerEmoji;
  final String partnerType;
  final String city;
  final String nameAr;
  final String nameEn;
  final String? descriptionAr;
  final int durationMin;
  final int priceHalalas;
  final String priceLabel;
  final int matchScore;
  final bool bookingEnabled;
  final List<String> concernTags;

  const CatalogService({
    required this.id,
    required this.partnerId,
    required this.partnerNameAr,
    this.partnerEmoji,
    required this.partnerType,
    required this.city,
    required this.nameAr,
    required this.nameEn,
    this.descriptionAr,
    required this.durationMin,
    required this.priceHalalas,
    required this.priceLabel,
    required this.matchScore,
    required this.bookingEnabled,
    this.concernTags = const [],
  });

  bool get isClinic => partnerType == 'clinic';
}
