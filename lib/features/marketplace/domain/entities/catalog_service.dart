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
  /// independent | facility — account owner identity; never inferred from placeMode.
  final String? providerKind;
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
  final String? placeMode;
  /// Pinned partner branch when placeMode is branch (from catalog).
  final String? branchId;
  /// Home-visit coverage city ids (sa-*).
  final List<String> coverageCityIds;
  /// Published home travel fee in halalas; null when unset.
  final int? travelFeeHalalas;
  final bool bookingEnabled;
  final List<String> concernTags;
  final List<CatalogMediaLink> media;
  final CatalogMainOfferKind? mainOfferKind;
  final CatalogServiceProfile profile;
  /// provider_intro | service_specific
  final String videoScope;
  final List<String> linkedServiceIds;
  /// Resolved Arabic labels for intro-video booking picker (never show bare ids).
  final List<CatalogLinkedService> linkedServices;

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
      providerKind: providerKind,
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
      placeMode: placeMode,
      branchId: branchId,
      coverageCityIds: coverageCityIds,
      travelFeeHalalas: travelFeeHalalas,
      bookingEnabled: bookingEnabled,
      concernTags: concernTags,
      media: media,
      mainOfferKind: mainOfferKind,
      profile: profile,
      videoScope: videoScope,
      linkedServiceIds: linkedServiceIds,
      linkedServices: linkedServices,
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
    this.providerKind,
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
    this.placeMode,
    this.branchId,
    this.coverageCityIds = const [],
    this.travelFeeHalalas,
    required this.bookingEnabled,
    this.concernTags = const [],
    this.media = const [],
    this.mainOfferKind,
    this.profile = const CatalogServiceProfile(),
    this.videoScope = 'service_specific',
    this.linkedServiceIds = const [],
    this.linkedServices = const [],
    this.payMode = 'pay_at_venue',
    this.availabilityPresent = false,
  });

  bool get isClinic => partnerType == 'clinic';
  bool get isIndependent => providerKind == 'independent';
  bool get isProviderIntroVideo => videoScope == 'provider_intro';

  CatalogServiceTemplateDef? get template => CatalogServiceTemplates.byId(profile.templateId);
}

class CatalogLinkedService {
  final String id;
  final String? nameAr;
  final bool bookingEnabled;
  final bool missing;

  const CatalogLinkedService({
    required this.id,
    this.nameAr,
    this.bookingEnabled = false,
    this.missing = false,
  });

  String get displayNameAr {
    final n = (nameAr ?? '').trim();
    return n.isNotEmpty ? n : 'خدمة غير متاحة';
  }
}
