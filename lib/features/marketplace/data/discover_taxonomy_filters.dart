import 'discover_catalog_query.dart';
import 'elegance_taxonomy_source.dart';

/// Maps central-registry [filter] ids (taxonomy `filterKeys`) to catalog query fields.
abstract final class DiscoverTaxonomyFilters {
  /// Fallback when bundled preview taxonomy omits enriched filterKeys.
  static const laneDefaults = <String, List<String>>{
    'elegance': ['variant.color', 'variant.size', 'variant.volume', 'shoeUsage', 'inStock', 'price'],
    'beauty': ['placeMode', 'branch', 'availableOn', 'duration', 'price'],
    'jewelry': [
      'metal',
      'metalColor',
      'purity',
      'stoneTypes',
      'diamondOrigin',
      'diamondCenterCarat',
      'sellUnit',
      'discoveryTraits',
      'variant.ringSize',
      'braceletInnerDiameterMm',
      'weightG',
      'inStock',
      'price',
    ],
    'children': ['variant.size', 'variant.color', 'ageMonths', 'inStock', 'price'],
    'gifts': ['giftEligible', 'sameDayDelivery', 'variant.color', 'inStock', 'price'],
    'occasions': [
      'occasionType',
      'occasionServiceOffer',
      'hostessCount',
      'guestsCount',
      'placeMode',
      'availableOn',
      'branch',
      'price',
    ],
  };

  static const sectionTitlesAr = <String, String>{
    'variant.color': 'اللون',
    'variant.size': 'المقاس',
    'variant.volume': 'الحجم',
    'shoeUsage': 'استخدام الحذاء',
    'metal': 'المعدن',
    'purity': 'العيار',
    'inStock': 'المتاح بالمخزون فقط',
    'price': 'نطاق السعر',
    'placeMode': 'مكان تقديم الخدمة',
    'branch': 'الفرع',
    'availableOn': 'تاريخ الإتاحة',
    'duration': 'مدة الخدمة',
    'occasionType': 'نوع المناسبة',
    'occasionServiceOffer': 'عرض الخدمة',
    'hostessCount': 'عدد المضيفات',
    'guestsCount': 'عدد الضيوف',
    'sameDayDelivery': 'توصيل اليوم',
    'giftEligible': 'قابلة للإهداء',
    'ageMonths': 'عمر الطفل (بالأشهر)',
  };

  /// Effective filter keys for the active taxonomy branch (subcategory → category → lane union).
  static Set<String> keysForQuery({
    DiscoverLane? lane,
    String? categoryId,
    String? subcategoryId,
  }) {
    final laneId = lane?.apiId;
    final fromNode = _keysFromTaxonomyNode(subcategoryId) ?? _keysFromTaxonomyNode(categoryId);
    if (fromNode != null && fromNode.isNotEmpty) return fromNode;

    if (laneId != null) {
      final sectionKeys = _unionSectionFilterKeys(laneId, categoryId);
      if (sectionKeys.isNotEmpty) return sectionKeys;
      final defaults = laneDefaults[laneId];
      if (defaults != null) return defaults.toSet();
    }
    return const {};
  }

  static Set<String>? _keysFromTaxonomyNode(String? nodeId) {
    if (nodeId == null || nodeId.isEmpty || nodeId == 'all') return null;
    for (final n in EleganceTaxonomySource.nodes) {
      if (n.id == nodeId && n.filterKeys.isNotEmpty) {
        return n.filterKeys.toSet();
      }
    }
    return null;
  }

  static Set<String> _unionSectionFilterKeys(String laneId, String? categoryId) {
    final roots = EleganceTaxonomySource.nodes
        .where((n) => n.parentId == null && n.active && !n.browseOnly)
        .toList();
    final keys = <String>{};
    for (final root in roots) {
      if (root.filterKeys.isNotEmpty) keys.addAll(root.filterKeys);
      final children = categoryId != null && categoryId.isNotEmpty
          ? EleganceTaxonomySource.childrenOf(categoryId, family: laneId)
          : EleganceTaxonomySource.childrenOf(root.id, family: laneId);
      for (final child in children) {
        final node = EleganceTaxonomySource.nodes.where((n) => n.id == child.id).toList();
        if (node.isNotEmpty && node.first.filterKeys.isNotEmpty) {
          keys.addAll(node.first.filterKeys);
        }
      }
    }
    return keys;
  }

  /// Drops query fields whose registry filter key is not allowed for this branch.
  static DiscoverCatalogQuery keepingOnlyFilterKeys(
    DiscoverCatalogQuery query,
    Set<String> allowedKeys,
  ) {
    if (allowedKeys.isEmpty) return query;
    return query.copyWith(
      colors: allowedKeys.contains('variant.color') ? query.colors : const [],
      clearColors: !allowedKeys.contains('variant.color'),
      sizes: allowedKeys.contains('variant.size') ? query.sizes : const [],
      clearSizes: !allowedKeys.contains('variant.size'),
      volumes: allowedKeys.contains('variant.volume') ? query.volumes : const [],
      clearVolumes: !allowedKeys.contains('variant.volume'),
      shoeUsage: allowedKeys.contains('shoeUsage') ? query.shoeUsage : const [],
      clearShoeUsage: !allowedKeys.contains('shoeUsage'),
      metals: allowedKeys.contains('metal') ? query.metals : const [],
      clearMetals: !allowedKeys.contains('metal'),
      purityKarats: allowedKeys.contains('purity') ? query.purityKarats : const [],
      clearPurityKarats: !allowedKeys.contains('purity'),
      placeModes: allowedKeys.contains('placeMode') ? query.placeModes : const [],
      clearPlaceModes: !allowedKeys.contains('placeMode'),
      branchIds: allowedKeys.contains('branch') ? query.branchIds : const [],
      clearBranchIds: !allowedKeys.contains('branch'),
      availableOn: allowedKeys.contains('availableOn') ? query.availableOn : null,
      clearAvailableOn: !allowedKeys.contains('availableOn'),
      durationMin: allowedKeys.contains('duration') ? query.durationMin : null,
      durationMax: allowedKeys.contains('duration') ? query.durationMax : null,
      clearDuration: !allowedKeys.contains('duration'),
      priceMinHalalas: allowedKeys.contains('price') ? query.priceMinHalalas : null,
      priceMaxHalalas: allowedKeys.contains('price') ? query.priceMaxHalalas : null,
      clearPrice: !allowedKeys.contains('price'),
      inStock: allowedKeys.contains('inStock') ? query.inStock : null,
      clearInStock: !allowedKeys.contains('inStock'),
      occasionTypeIds: allowedKeys.contains('occasionType') ? query.occasionTypeIds : const [],
      clearOccasionTypeIds: !allowedKeys.contains('occasionType'),
      occasionServiceOffers:
          allowedKeys.contains('occasionServiceOffer') ? query.occasionServiceOffers : const [],
      clearOccasionServiceOffers: !allowedKeys.contains('occasionServiceOffer'),
      giftEligible: allowedKeys.contains('giftEligible') ? query.giftEligible : null,
      clearGiftEligible: !allowedKeys.contains('giftEligible'),
      sameDayDelivery: allowedKeys.contains('sameDayDelivery') ? query.sameDayDelivery : null,
      clearSameDayDelivery: !allowedKeys.contains('sameDayDelivery'),
      hostessCountMin: allowedKeys.contains('hostessCount') ? query.hostessCountMin : null,
      clearHostessCountMin: !allowedKeys.contains('hostessCount'),
      guestsCount: allowedKeys.contains('guestsCount') ? query.guestsCount : null,
      clearGuestsCount: !allowedKeys.contains('guestsCount'),
      ageMonths: allowedKeys.contains('ageMonths') ? query.ageMonths : null,
      clearAgeMonths: !allowedKeys.contains('ageMonths'),
    );
  }

  static String? offerKindForSubcategory(String? subcategoryId) {
    if (subcategoryId == null || subcategoryId.isEmpty) return null;
    for (final n in EleganceTaxonomySource.nodes) {
      if (n.id == subcategoryId) return n.offerKind;
    }
    return null;
  }
}
