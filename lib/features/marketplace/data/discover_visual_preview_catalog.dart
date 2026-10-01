import '../domain/catalog_offer_media.dart';
import '../domain/catalog_product_options.dart';
import '../domain/catalog_service_template.dart';
import '../domain/entities/catalog_product.dart';
import '../domain/entities/catalog_service.dart';
import 'catalog_price.dart';
import 'catalog_provenance.dart';
import 'discover_catalog_gateway.dart';
import 'discover_catalog_query.dart';

/// Embedded visual samples for an explicit preview session.
/// Each media url belongs to its own offer; main vs detail stay separated.
abstract final class DiscoverVisualPreviewCatalog {
  static const houseId = 'preview-house';
  static const clinicId = 'preview-clinic';
  static const salonId = 'preview-salon';
  static const houseName = 'بيت المعاينة';
  static const clinicName = 'عيادة المعاينة';
  static const salonName = 'مشغل المعاينة';
  static const previewCity = 'موقع معاينة';
  static const clip = 'assets/marketplace/samples/sample_clip.mp4';

  static CatalogServiceAnswer _a(Object value) => CatalogServiceAnswer.value(value);

  static CatalogServiceProfile _profile({
    required String templateId,
    CatalogServicePriceMode priceMode = CatalogServicePriceMode.fixed,
    required Map<String, CatalogServiceAnswer> answers,
  }) {
    final template = CatalogServiceTemplates.byId(templateId)!;
    return CatalogServiceProfile(
      templateId: templateId,
      templateVersion: template.version,
      priceMode: priceMode,
      answers: answers,
    );
  }

  static CatalogMediaLink image(
    String path, {
    required String placement,
    bool primary = false,
    int sortOrder = 0,
  }) {
    return CatalogMediaLink(
      kind: 'image',
      url: path,
      isPrimary: primary,
      placement: placement,
      sortOrder: sortOrder,
    );
  }

  static CatalogMediaLink video(
    String path, {
    required String placement,
    int sortOrder = 0,
  }) {
    return CatalogMediaLink(
      kind: 'video',
      url: path,
      placement: placement,
      sortOrder: sortOrder,
    );
  }

  static final offers = <DiscoverOffer>[
    // Serum: portrait hero first (owner reference fill), face close-up second — both serum.
    DiscoverOffer.product(
      _product(
        id: 'preview-face-serum',
        name: 'سيروم المعاينة',
        category: 'face',
        halalas: 8900,
        description: 'عينة تجميل للوجه. العرض الرئيسي صور فقط تخص السيروم، والتفاصيل محتوى مختلط.',
        mainOfferKind: CatalogMainOfferKind.images,
        traits: const {'الخامة': 'مائي خفيف', 'طريقة الاستخدام': 'صباحًا ومساءً على بشرة نظيفة'},
        media: [
          image('assets/marketplace/discover/hero_product.jpg', placement: CatalogMediaPlacement.main, primary: true, sortOrder: 0),
          image('assets/marketplace/discover/product_face.jpg', placement: CatalogMediaPlacement.main, sortOrder: 1),
          image('assets/marketplace/discover/hero_product.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 0),
          image('assets/marketplace/discover/product_face.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 1),
          video(clip, placement: CatalogMediaPlacement.detail, sortOrder: 2),
        ],
        optionGroups: const [
          CatalogOptionGroup(
            id: 'volume',
            labelAr: 'الحجم',
            kind: 'volume',
            values: [
              CatalogOptionValue(id: 'v50', labelAr: '50 مل', amount: 50, unit: 'مل'),
              CatalogOptionValue(id: 'v100', labelAr: '100 مل', amount: 100, unit: 'مل'),
            ],
          ),
        ],
        variants: const [
          CatalogProductVariant(id: 'serum-50', selections: {'volume': 'v50'}, priceHalalas: 8900),
          CatalogProductVariant(id: 'serum-100', selections: {'volume': 'v100'}, priceHalalas: 14500),
        ],
      ),
      city: previewCity,
    ),
    // Body cream: care volumes.
    DiscoverOffer.product(
      _product(
        id: 'preview-body-cream',
        name: 'كريم الجسم للمعاينة',
        category: 'body',
        halalas: 6400,
        description: 'عينة عناية للجسم بحجمين. الوسائط تخص الكريم فقط.',
        mainOfferKind: CatalogMainOfferKind.images,
        traits: const {'المكونات': 'زبدة الشيا', 'طريقة الاستخدام': 'بعد الاستحمام'},
        media: [
          image('assets/marketplace/discover/product_body.jpg', placement: CatalogMediaPlacement.main, primary: true),
          image('assets/marketplace/discover/product_body.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 0),
          video(clip, placement: CatalogMediaPlacement.detail, sortOrder: 1),
        ],
        optionGroups: const [
          CatalogOptionGroup(
            id: 'volume',
            labelAr: 'الحجم',
            kind: 'volume',
            values: [
              CatalogOptionValue(id: 'c50', labelAr: '50 مل', amount: 50, unit: 'مل'),
              CatalogOptionValue(id: 'c100', labelAr: '100 مل', amount: 100, unit: 'مل'),
            ],
          ),
        ],
        variants: const [
          CatalogProductVariant(id: 'cream-50', selections: {'volume': 'c50'}),
          CatalogProductVariant(id: 'cream-100', selections: {'volume': 'c100'}, priceHalalas: 9200),
        ],
      ),
      city: previewCity,
    ),
    // Hair oil: main video only.
    DiscoverOffer.product(
      _product(
        id: 'preview-hair-oil',
        name: 'زيت الشعر للمعاينة',
        category: 'hair',
        halalas: 5200,
        description: 'عينة عناية للشعر. العرض الرئيسي فيديو واحد.',
        mainOfferKind: CatalogMainOfferKind.video,
        media: [
          video(clip, placement: CatalogMediaPlacement.main),
          image('assets/marketplace/discover/product_hair.jpg', placement: CatalogMediaPlacement.cover, primary: true),
          image('assets/marketplace/discover/product_hair.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 0),
          video(clip, placement: CatalogMediaPlacement.detail, sortOrder: 1),
        ],
      ),
      city: previewCity,
    ),
    // Dress: clothes images only — never reuse serum/hero assets.
    DiscoverOffer.product(
      _product(
        id: 'preview-silk-dress',
        name: 'فستان المعاينة',
        category: 'clothes',
        halalas: 24000,
        description: 'عينة أزياء بألوان ومقاسات. بعض التركيبات غير متاحة.',
        mainOfferKind: CatalogMainOfferKind.images,
        traits: const {'الخامة': 'حرير صناعي', 'العناية': 'غسيل يدوي بارد'},
        media: [
          image('assets/marketplace/discover/product_clothes.jpg', placement: CatalogMediaPlacement.main, primary: true, sortOrder: 0),
          image('assets/marketplace/discover/thumbs/product_clothes.jpg', placement: CatalogMediaPlacement.main, sortOrder: 1),
          image('assets/marketplace/discover/product_clothes.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 0),
          image('assets/marketplace/discover/thumbs/product_clothes.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 1),
          video(clip, placement: CatalogMediaPlacement.detail, sortOrder: 2),
        ],
        optionGroups: const [
          CatalogOptionGroup(
            id: 'color',
            labelAr: 'اللون',
            kind: 'color',
            values: [
              CatalogOptionValue(id: 'pink', labelAr: 'وردي', swatchHex: '#E86FA9'),
              CatalogOptionValue(id: 'black', labelAr: 'أسود', swatchHex: '#2C2428'),
            ],
          ),
          CatalogOptionGroup(
            id: 'size',
            labelAr: 'المقاس',
            kind: 'size',
            values: [
              CatalogOptionValue(id: 's', labelAr: 'S'),
              CatalogOptionValue(id: 'm', labelAr: 'M'),
              CatalogOptionValue(id: 'l', labelAr: 'L'),
            ],
          ),
        ],
        variants: const [
          CatalogProductVariant(id: 'dress-pink-m', selections: {'color': 'pink', 'size': 'm'}),
          CatalogProductVariant(id: 'dress-black-s', selections: {'color': 'black', 'size': 's'}),
          CatalogProductVariant(id: 'dress-black-l', selections: {'color': 'black', 'size': 'l'}),
        ],
      ),
      city: previewCity,
    ),
    // Accessory finishes — no foreign product images.
    DiscoverOffer.product(
      _product(
        id: 'preview-earring',
        name: 'قرط المعاينة',
        category: 'accessories',
        halalas: 18000,
        description: 'عينة إكسسوار بتشطيبين.',
        mainOfferKind: CatalogMainOfferKind.images,
        traits: const {'الخامة': 'معدن مطلي'},
        media: [
          image('assets/marketplace/discover/thumbs/product_accessories.png', placement: CatalogMediaPlacement.main, primary: true),
          image('assets/marketplace/discover/thumbs/product_accessories.png', placement: CatalogMediaPlacement.detail),
        ],
        optionGroups: const [
          CatalogOptionGroup(
            id: 'finish',
            labelAr: 'التشطيب',
            kind: 'finish',
            values: [
              CatalogOptionValue(id: 'gold', labelAr: 'ذهبي', swatchHex: '#D4AF37'),
              CatalogOptionValue(id: 'silver', labelAr: 'فضي', swatchHex: '#C0C0C0'),
            ],
          ),
        ],
        variants: const [
          CatalogProductVariant(id: 'ear-gold', selections: {'finish': 'gold'}),
          CatalogProductVariant(id: 'ear-silver', selections: {'finish': 'silver'}),
        ],
      ),
      city: previewCity,
    ),
    DiscoverOffer.service(
      _service(
        id: 'preview-salon-makeup',
        partnerId: salonId,
        partnerName: salonName,
        partnerType: 'salon',
        name: 'مكياج المعاينة',
        category: 'makeup',
        halalas: 22000,
        durationMin: 60,
        description: 'مكياج مناسبة بمتطلبات تحضير خاصة.',
        mainOfferKind: CatalogMainOfferKind.images,
        media: [
          image('assets/marketplace/discover/salon_makeup.jpg', placement: CatalogMediaPlacement.main, primary: true, sortOrder: 0),
          image('assets/marketplace/discover/hero_salon.jpg', placement: CatalogMediaPlacement.main, sortOrder: 1),
          image('assets/marketplace/discover/salon_makeup.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 0),
          image('assets/marketplace/discover/hero_salon.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 1),
          video(clip, placement: CatalogMediaPlacement.detail, sortOrder: 2),
        ],
        profile: _profile(
          templateId: 'salon_makeup',
          answers: {
            'occasion': _a('event'),
            'place_mode': _a('either'),
            'home_coverage': _a('داخل المدينة المسجّلة للجهة فقط.'),
            'includes': _a(['base', 'eyes', 'brows']),
            'excludes': _a('رموش دائمة'),
            'addons': _a(['hair', 'trial']),
            'needs_assessment': _a(false),
            'prep_required': _a('إسقاطي البشرة جيدًا قبل الموعد بساعتين.'),
            'policies': _a('التأخر أكثر من 15 دقيقة قد يقصّر وقت الخدمة.'),
          },
        ),
      ),
    ),
    DiscoverOffer.service(
      _service(
        id: 'preview-clinic-skin',
        partnerId: clinicId,
        partnerName: clinicName,
        partnerType: 'clinic',
        name: 'جلسة بشرة للمعاينة',
        category: 'skin',
        halalas: 35000,
        durationMin: 45,
        description: 'جلسة عناية تحتاج تقييمًا مسبقًا. العرض الرئيسي فيديو واحد.',
        mainOfferKind: CatalogMainOfferKind.video,
        media: [
          video(clip, placement: CatalogMediaPlacement.main),
          image('assets/marketplace/discover/clinic_skin.jpg', placement: CatalogMediaPlacement.cover, primary: true),
          image('assets/marketplace/discover/clinic_skin.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 0),
          image('assets/marketplace/discover/hero_clinic.jpg', placement: CatalogMediaPlacement.detail, sortOrder: 1),
          video(clip, placement: CatalogMediaPlacement.detail, sortOrder: 2),
        ],
        profile: _profile(
          templateId: 'clinic_skin',
          answers: {
            'session_name': _a('تنظيف عميق'),
            'session_kind': _a('single'),
            'includes': _a(['cleanse', 'mask', 'serum']),
            'place_mode': _a('branch'),
            'needs_assessment': _a(true),
            'assessment_note': _a('تقييم حالة البشرة لدى الجهة دون تشخيص طبي من ميرا.'),
            'prep_required': _a('توقفي عن الأحماض القوية قبل 48 ساعة إن طلبت الجهة ذلك.'),
            'aftercare': _a('تجنبي الشمس المباشرة يوم الجلسة.'),
          },
        ),
      ),
    ),
    DiscoverOffer.service(
      _service(
        id: 'preview-salon-color',
        partnerId: salonId,
        partnerName: salonName,
        partnerType: 'salon',
        name: 'صبغة المعاينة',
        category: 'hair',
        halalas: 28000,
        durationMin: 90,
        description: 'صبغة يختلف سعرها حسب طول الشعر.',
        mainOfferKind: CatalogMainOfferKind.images,
        priceMode: CatalogServicePriceMode.from,
        media: [
          image('assets/marketplace/discover/clinic_hair.jpg', placement: CatalogMediaPlacement.main, primary: true),
          image('assets/marketplace/discover/clinic_hair.jpg', placement: CatalogMediaPlacement.detail),
          video(clip, placement: CatalogMediaPlacement.detail, sortOrder: 1),
        ],
        profile: _profile(
          templateId: 'salon_hair_color',
          priceMode: CatalogServicePriceMode.from,
          answers: {
            'session_kind': _a('single'),
            'color_kind': _a('balayage'),
            'price_by_length': _a(true),
            'length_tiers': _a(['short', 'medium', 'long']),
            'includes_bleach': _a(false),
            'includes': _a(['toner']),
            'addons': _a(['olaplex']),
            'place_mode': _a('branch'),
            'needs_assessment': _a(true),
            'assessment_note': _a('تقييم لون الشعر الحالي قبل تحديد الخطة.'),
            'prep_required': _a('تجنبي غسل الشعر صباح الموعد إن طلبت الجهة ذلك.'),
          },
        ),
      ),
    ),
    DiscoverOffer.service(
      _service(
        id: 'preview-salon-hair',
        partnerId: salonId,
        partnerName: salonName,
        partnerType: 'salon',
        name: 'قص وتصفيف المعاينة',
        category: 'hair',
       halalas: 15000,
        durationMin: 50,
        description: 'قص بسعر ثابت. الغسيل والتجفيف مشمولان.',
        mainOfferKind: CatalogMainOfferKind.images,
        media: [
          image('assets/marketplace/discover/salon_hair.jpg', placement: CatalogMediaPlacement.main, primary: true),
          image('assets/marketplace/discover/salon_hair.jpg', placement: CatalogMediaPlacement.detail),
        ],
        profile: _profile(
          templateId: 'salon_hair_cut',
          answers: {
            'session_kind': _a('single'),
            'cut_style': _a('cut_style'),
            'hair_length': _a('any'),
            'includes_wash_dry': _a(true),
            'includes': _a(['wash', 'dry', 'style']),
            'excludes': _a('صبغة أو علاجات كيميائية'),
            'addons': _a(['mask']),
            'place_mode': _a('branch'),
            'needs_assessment': _a(false),
            'prep_required': _a('لا يتطلب تحضيرًا'),
          },
        ),
      ),
    ),
    DiscoverOffer.service(
      _service(
        id: 'preview-salon-nails',
        partnerId: salonId,
        partnerName: salonName,
        partnerType: 'salon',
        name: 'أظافر المعاينة',
        category: 'nails',
       halalas: 9000,
        durationMin: 30,
        description: 'مانيكير مع إضافة اختيارية لرسم الأظافر.',
        mainOfferKind: CatalogMainOfferKind.images,
        media: [
          image('assets/marketplace/discover/salon_nails.jpg', placement: CatalogMediaPlacement.main, primary: true),
          image('assets/marketplace/discover/salon_nails.jpg', placement: CatalogMediaPlacement.detail),
          video(clip, placement: CatalogMediaPlacement.detail, sortOrder: 1),
        ],
        profile: _profile(
          templateId: 'salon_nails',
          answers: {
            'hands_feet': _a('hands'),
            'nail_kind': _a('gel'),
            'remove_old': _a(true),
            'addons': _a(['art']),
            'place_mode': _a('branch'),
            'prep_required': _a('لا يتطلب تحضيرًا'),
          },
        ),
      ),
    ),
    DiscoverOffer.service(
      _service(
        id: 'preview-clinic-laser',
        partnerId: clinicId,
        partnerName: clinicName,
        partnerType: 'clinic',
        name: 'باقة ليزر للمعاينة',
        category: 'laser',
       halalas: 120000,
        durationMin: 40,
        description: 'باقة جلسات بمناطق محددة.',
        mainOfferKind: CatalogMainOfferKind.images,
        media: [
          image('assets/marketplace/discover/clinic_laser.jpg', placement: CatalogMediaPlacement.main, primary: true),
          image('assets/marketplace/discover/clinic_laser.jpg', placement: CatalogMediaPlacement.detail),
          video(clip, placement: CatalogMediaPlacement.detail, sortOrder: 1),
        ],
        profile: _profile(
          templateId: 'clinic_laser',
          answers: {
            'laser_areas': _a(['underarms', 'legs']),
            'session_kind': _a('package'),
            'package_sessions': _a(6),
            'package_validity': _a('خلال 12 شهرًا من أول جلسة'),
            'device_info': _a('جهاز مسجّل لدى الجهة.'),
            'place_mode': _a('branch'),
            'needs_assessment': _a(true),
            'assessment_note': _a('تقييم أولي لدى الجهة قبل بدء الباقة.'),
            'prep_required': _a('اتباع تعليمات الجهة قبل الجلسة.'),
            'policies': _a('التعليمات من الجهة وليست نصيحة طبية من ميرا.'),
          },
        ),
      ),
    ),
    DiscoverOffer.service(
      _service(
        id: 'preview-clinic-consult',
        partnerId: clinicId,
        partnerName: clinicName,
        partnerType: 'clinic',
        name: 'استشارة المعاينة',
        category: 'skin',
       halalas: 15000,
        durationMin: 20,
        description: 'استشارة بسيطة بلا أغلب الحقول المتخصصة.',
        mainOfferKind: CatalogMainOfferKind.images,
        media: [
          image('assets/marketplace/discover/hero_clinic.jpg', placement: CatalogMediaPlacement.main, primary: true),
          image('assets/marketplace/discover/hero_clinic.jpg', placement: CatalogMediaPlacement.detail),
        ],
        profile: _profile(
          templateId: 'clinic_consult',
          answers: {
            'consult_kind': _a('skin'),
            'consult_mode': _a('in_person'),
            'includes': _a(['exam', 'qa']),
            'bring_docs': _a('لا يلزم إحضار مستندات'),
            'prep_required': _a('لا يتطلب تحضيرًا'),
          },
        ),
      ),
    ),
    DiscoverOffer.service(
      _service(
        id: 'preview-salon-care',
        partnerId: salonId,
        partnerName: salonName,
        partnerType: 'salon',
        name: 'عناية المشغل للمعاينة',
        category: 'care',
       halalas: 12000,
        durationMin: 35,
        description: 'خدمة عناية عامة بقالب مبسّط.',
        mainOfferKind: CatalogMainOfferKind.images,
        media: [
          image('assets/marketplace/discover/salon_care.jpg', placement: CatalogMediaPlacement.main, primary: true),
          image('assets/marketplace/discover/salon_care.jpg', placement: CatalogMediaPlacement.detail),
        ],
        profile: _profile(
          templateId: 'salon_care',
          answers: {
            'session_kind': _a('single'),
            'includes': _a('جلسة عناية أساسية حسب عرض الجهة'),
            'place_mode': _a('branch'),
            'prep_required': _a('لا يتطلب تحضيرًا'),
          },
        ),
      ),
    ),
  ];

  static bool owns(String id) => id.startsWith('preview-');

  static DiscoverBrowseResponse browse(DiscoverCatalogQuery query, {String? cursor, int limit = 8}) {
    final page = DiscoverCatalogQueryEngine.page(
      DiscoverCatalogQueryEngine.filter(offers, query),
      cursor: cursor,
      limit: limit,
    );
    if (page.invalidCursor) {
      return const DiscoverBrowseResponse(failed: true, invalidCursor: true);
    }
    return DiscoverBrowseResponse(
      failed: false,
      transport: CatalogTransport.visualPreview,
      contentMark: ContentMark.explicitDemo,
      items: page.items,
      nextCursor: page.nextCursor,
      cities: const [previewCity],
    );
  }

  static DiscoverOffer? find(String kind, String id) {
    for (final offer in offers) {
      if (offer.kind == kind && offer.id == id) return offer;
    }
    return null;
  }

  static CatalogProduct _product({
    required String id,
    required String name,
    required String category,
    required int halalas,
    required String description,
    required List<CatalogMediaLink> media,
    required CatalogMainOfferKind mainOfferKind,
    List<CatalogOptionGroup> optionGroups = const [],
    List<CatalogProductVariant> variants = const [],
    Map<String, String> traits = const {},
  }) {
    return CatalogProduct(
      id: id,
      partnerId: houseId,
      partnerNameAr: houseName,
      nameAr: name,
      nameEn: name,
      descriptionAr: description,
      priceHalalas: halalas,
      priceLabel: CatalogPrice.formatHalalas(halalas),
      externalUrl: '',
      category: category,
      matchScore: 0,
      media: media,
      mainOfferKind: mainOfferKind,
      optionGroups: optionGroups,
      variants: variants,
      traits: traits,
    );
  }

  static CatalogService _service({
    required String id,
    required String partnerId,
    required String partnerName,
    required String partnerType,
    required String name,
    required String category,
    required int halalas,
    required int durationMin,
    required String description,
    required List<CatalogMediaLink> media,
    required CatalogMainOfferKind mainOfferKind,
    CatalogServiceProfile profile = const CatalogServiceProfile(),
    CatalogServicePriceMode priceMode = CatalogServicePriceMode.fixed,
    bool priceKnown = true,
  }) {
    final resolved = CatalogServiceProfile(
      templateId: profile.templateId,
      templateVersion: profile.templateVersion,
      priceMode: priceMode,
      answers: profile.answers,
    );
    return CatalogService(
      id: id,
      partnerId: partnerId,
      partnerNameAr: partnerName,
      partnerType: partnerType,
      city: previewCity,
      nameAr: name,
      nameEn: name,
      descriptionAr: description,
      durationMin: durationMin,
      priceHalalas: halalas,
      priceLabel: CatalogPrice.formatHalalas(halalas),
      priceKnown: priceKnown,
      category: category,
      bookingEnabled: false,
      matchScore: 0,
      media: media,
      mainOfferKind: mainOfferKind,
      profile: resolved,
    );
  }
}
