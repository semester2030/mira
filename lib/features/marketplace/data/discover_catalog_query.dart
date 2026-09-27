import '../domain/entities/catalog_product.dart';
import '../domain/entities/catalog_service.dart';
import 'marketplace_local_catalog.dart';

/// One published catalog row. It keeps the original product or service object.
class DiscoverOffer {
  DiscoverOffer.product(CatalogProduct product, {required this.city})
      : product = product,
        service = null,
        id = product.id,
        partnerId = product.partnerId,
        kind = 'product',
        partnerType = 'brand',
        nameAr = product.nameAr,
        nameEn = product.nameEn,
        partnerNameAr = product.partnerNameAr,
        descriptionAr = product.descriptionAr,
        concernTags = product.concernTags,
        category = product.category,
        media = product.media;

  DiscoverOffer.service(CatalogService service)
      : service = service,
        product = null,
        id = service.id,
        partnerId = service.partnerId,
        kind = 'service',
        partnerType = service.partnerType,
        city = service.city,
        nameAr = service.nameAr,
        nameEn = service.nameEn,
        partnerNameAr = service.partnerNameAr,
        descriptionAr = service.descriptionAr,
        concernTags = service.concernTags,
        category = service.category,
        media = service.media;

  final String id;
  final String partnerId;
  final String kind;
  final String partnerType;
  final String city;
  final String nameAr;
  final String nameEn;
  final String partnerNameAr;
  final String? descriptionAr;
  final List<String> concernTags;
  final String? category;
  final List<CatalogMediaLink> media;
  final CatalogProduct? product;
  final CatalogService? service;

  String get cursor => '$kind:$id';
}

/// أناقتك is products. جمالك is clinic and salon services.
enum DiscoverLane { elegance, beauty }

/// Visual labels stay. A category matches the stored category id, not a name guess.
class DiscoverCategoryDef {
  const DiscoverCategoryDef({
    required this.id,
    required this.label,
    required this.family,
    required this.storedKey,
    this.matchesAll = false,
    this.venueType,
  });

  final String id;
  final String label;
  final String family;
  final String storedKey;
  final bool matchesAll;
  final String? venueType;
}

class DiscoverCatalogQuery {
  const DiscoverCatalogQuery({
    this.text = '',
    this.partnerType,
    this.categoryId,
    this.city,
    this.partnerId,
    this.lane,
    this.requireVisual = false,
  });

  final String text;
  final String? partnerType;
  final String? categoryId;
  final String? city;
  final String? partnerId;
  final DiscoverLane? lane;
  final bool requireVisual;

  DiscoverCatalogQuery copyWith({
    String? text,
    String? partnerType,
    String? categoryId,
    String? city,
    String? partnerId,
    DiscoverLane? lane,
    bool? requireVisual,
    bool clearType = false,
    bool clearCategory = false,
    bool clearCity = false,
    bool clearPartner = false,
    bool clearLane = false,
  }) {
    return DiscoverCatalogQuery(
      text: text ?? this.text,
      partnerType: clearType ? null : partnerType ?? this.partnerType,
      categoryId: clearCategory ? null : categoryId ?? this.categoryId,
      city: clearCity ? null : city ?? this.city,
      partnerId: clearPartner ? null : partnerId ?? this.partnerId,
      lane: clearLane ? null : lane ?? this.lane,
      requireVisual: requireVisual ?? this.requireVisual,
    );
  }
}

class DiscoverCatalogPage {
  const DiscoverCatalogPage({required this.items, this.nextCursor, this.invalidCursor = false});

  final List<DiscoverOffer> items;
  final String? nextCursor;
  final bool invalidCursor;

  const DiscoverCatalogPage.emptyInvalid()
      : items = const [],
        nextCursor = null,
        invalidCursor = true;
}

/// Filters the full offer list, then pages. Search is not limited to one page.
abstract final class DiscoverCatalogQueryEngine {
  static final _cursorPattern = RegExp(r'^(product|service):[A-Za-z0-9_-]+$');

  static const categories = <DiscoverCategoryDef>[
    DiscoverCategoryDef(id: 'all', label: 'الكل', family: 'product', storedKey: '', matchesAll: true),
    DiscoverCategoryDef(id: 'face', label: 'الوجه', family: 'product', storedKey: 'face'),
    DiscoverCategoryDef(id: 'body', label: 'الجسم', family: 'product', storedKey: 'body'),
    DiscoverCategoryDef(id: 'hair', label: 'الشعر', family: 'product', storedKey: 'hair'),
    DiscoverCategoryDef(id: 'clothes', label: 'الملابس', family: 'product', storedKey: 'clothes'),
    DiscoverCategoryDef(id: 'all', label: 'الكل', family: 'clinic', storedKey: '', matchesAll: true),
    DiscoverCategoryDef(id: 'skin', label: 'البشرة', family: 'clinic', storedKey: 'skin'),
    DiscoverCategoryDef(id: 'hair', label: 'الشعر', family: 'clinic', storedKey: 'hair'),
    DiscoverCategoryDef(id: 'laser', label: 'الليزر', family: 'clinic', storedKey: 'laser'),
    DiscoverCategoryDef(id: 'teeth', label: 'الأسنان', family: 'clinic', storedKey: 'teeth'),
    DiscoverCategoryDef(id: 'all', label: 'الكل', family: 'salon', storedKey: '', matchesAll: true),
    DiscoverCategoryDef(id: 'hair', label: 'الشعر', family: 'salon', storedKey: 'hair'),
    DiscoverCategoryDef(id: 'makeup', label: 'المكياج', family: 'salon', storedKey: 'makeup'),
    DiscoverCategoryDef(id: 'nails', label: 'الأظافر', family: 'salon', storedKey: 'nails'),
    DiscoverCategoryDef(id: 'care', label: 'العناية', family: 'salon', storedKey: 'care'),
    DiscoverCategoryDef(id: 'all', label: 'الكل', family: 'elegance', storedKey: '', matchesAll: true),
    DiscoverCategoryDef(id: 'face', label: 'الوجه', family: 'elegance', storedKey: 'face'),
    DiscoverCategoryDef(id: 'body', label: 'الجسم', family: 'elegance', storedKey: 'body'),
    DiscoverCategoryDef(id: 'hair', label: 'الشعر', family: 'elegance', storedKey: 'hair'),
    DiscoverCategoryDef(id: 'clothes', label: 'الملابس', family: 'elegance', storedKey: 'clothes'),
    DiscoverCategoryDef(id: 'accessories', label: 'الإكسسوارات', family: 'elegance', storedKey: 'accessories'),
    DiscoverCategoryDef(id: 'all', label: 'الكل', family: 'beauty', storedKey: '', matchesAll: true),
    DiscoverCategoryDef(id: 'venue-clinic', label: 'العيادات', family: 'beauty', storedKey: '', venueType: 'clinic'),
    DiscoverCategoryDef(id: 'venue-salon', label: 'المشاغل', family: 'beauty', storedKey: '', venueType: 'salon'),
    DiscoverCategoryDef(id: 'hair', label: 'الشعر', family: 'beauty', storedKey: 'hair'),
    DiscoverCategoryDef(id: 'skin', label: 'البشرة', family: 'beauty', storedKey: 'skin'),
    DiscoverCategoryDef(id: 'makeup', label: 'المكياج', family: 'beauty', storedKey: 'makeup'),
    DiscoverCategoryDef(id: 'nails', label: 'الأظافر', family: 'beauty', storedKey: 'nails'),
    DiscoverCategoryDef(id: 'care', label: 'العناية', family: 'beauty', storedKey: 'care'),
  ];

  static List<DiscoverCategoryDef> forFamily(String family) {
    return categories.where((item) => item.family == family).toList();
  }

  static DiscoverCategoryDef? find(String family, String? id) {
    if (id == null || id == 'all') {
      return forFamily(family).firstWhere((item) => item.matchesAll);
    }
    for (final item in forFamily(family)) {
      if (item.id == id) return item;
    }
    return null;
  }

  static List<DiscoverOffer> localOffers() {
    String cityOf(String partnerId) {
      for (final partner in MarketplaceLocalCatalog.partners) {
        if (partner.id == partnerId) return partner.city;
      }
      return '';
    }

    return [
      for (final product in MarketplaceLocalCatalog.products)
        DiscoverOffer.product(product, city: cityOf(product.partnerId)),
      for (final service in MarketplaceLocalCatalog.services) DiscoverOffer.service(service),
    ];
  }

  static List<String> citiesIn(List<DiscoverOffer> offers) {
    final cities = offers.map((offer) => offer.city).where((city) => city.isNotEmpty).toSet().toList()..sort();
    return cities;
  }

  static bool matches(DiscoverOffer offer, DiscoverCatalogQuery query, {String family = 'product'}) {
    if (query.lane == DiscoverLane.elegance && offer.kind != 'product') return false;
    if (query.lane == DiscoverLane.beauty && offer.kind != 'service') return false;
    if (query.requireVisual && !offer.media.any((item) => (item.kind == 'image' || item.kind == 'video') && item.url.isNotEmpty)) {
      return false;
    }
    if (query.partnerId != null && offer.partnerId != query.partnerId) return false;
    if (query.lane == null && query.partnerType != null && offer.partnerType != query.partnerType) return false;
    if (query.city != null && query.city!.isNotEmpty && offer.city != query.city) return false;
    final category = find(familyFor(query, offer), query.categoryId);
    if (query.categoryId != null && query.categoryId != 'all') {
      final selected = category;
      if (selected == null || selected.matchesAll) {
        if (selected == null) return false;
      } else if (selected.venueType != null) {
        if (offer.partnerType != selected.venueType) return false;
      } else if (offer.category != selected.storedKey) {
        return false;
      }
    }
    final text = query.text.trim().toLowerCase();
    if (text.isEmpty) return true;
    final haystack = '${offer.nameAr} ${offer.nameEn} ${offer.partnerNameAr} ${offer.descriptionAr ?? ''} ${offer.city}'.toLowerCase();
    return haystack.contains(text);
  }

  static String familyFor(DiscoverCatalogQuery query, DiscoverOffer offer) {
    if (query.lane == DiscoverLane.elegance) return 'elegance';
    if (query.lane == DiscoverLane.beauty) return 'beauty';
    return switch (query.partnerType ?? offer.partnerType) {
      'clinic' => 'clinic',
      'salon' => 'salon',
      _ => 'product',
    };
  }

  static List<DiscoverOffer> filter(List<DiscoverOffer> source, DiscoverCatalogQuery query) {
    return source.where((offer) => matches(offer, query)).toList();
  }

  static DiscoverCatalogPage page(List<DiscoverOffer> filtered, {String? cursor, int limit = 4}) {
    if (cursor != null && !_cursorPattern.hasMatch(cursor)) {
      return const DiscoverCatalogPage.emptyInvalid();
    }
    final sorted = [...filtered]..sort((a, b) => a.cursor.compareTo(b.cursor));
    var start = 0;
    if (cursor != null) {
      final index = sorted.indexWhere((offer) => offer.cursor.compareTo(cursor) > 0);
      start = index < 0 ? sorted.length : index;
    }
    final slice = sorted.skip(start).take(limit).toList();
    final next = start + slice.length < sorted.length ? slice.last.cursor : null;
    return DiscoverCatalogPage(items: slice, nextCursor: next);
  }
}

/// Drops a response that belongs to an older search or filter.
class DiscoverRequestGate {
  int _generation = 0;

  int next() => ++_generation;

  bool isCurrent(int generation) => generation == _generation;
}
