class PartnerSummary {
  final String id;
  final String type;
  final String nameAr;
  final String nameEn;
  final String? descriptionAr;
  final String city;
  final String? logoEmoji;
  final double rating;
  final String? storeUrl;

  const PartnerSummary({
    required this.id,
    required this.type,
    required this.nameAr,
    required this.nameEn,
    this.descriptionAr,
    required this.city,
    this.logoEmoji,
    required this.rating,
    this.storeUrl,
  });

  bool get isBrand => type == 'brand';
  bool get isClinic => type == 'clinic';
  bool get isSalon => type == 'salon';
}
