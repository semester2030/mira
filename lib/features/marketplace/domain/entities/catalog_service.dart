import '../catalog_offer_media.dart';
import '../catalog_service_template.dart';

export '../catalog_offer_media.dart' show CatalogMediaLink, CatalogMainOfferKind, CatalogMediaPlacement, CatalogOfferMedia, CatalogMainOfferKindCodec;
export '../catalog_service_template.dart';

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
  final CatalogMainOfferKind? mainOfferKind;
  final CatalogServiceProfile profile;

  /// `pay_at_venue` today. Mira does not take payment for bookings.
  final String payMode;

  /// True when the partner published weekly hours. Slots still come from the availability endpoint.
  final bool availabilityPresent;

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
      mainOfferKind: mainOfferKind,
      profile: profile,
      payMode: payMode,
      availabilityPresent: availabilityPresent,
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
    this.mainOfferKind,
    this.profile = const CatalogServiceProfile(),
    this.payMode = 'pay_at_venue',
    this.availabilityPresent = false,
  });

  bool get isClinic => partnerType == 'clinic';

  CatalogServiceTemplateDef? get template => CatalogServiceTemplates.byId(profile.templateId);
}
