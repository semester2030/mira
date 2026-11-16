/// Server-authored catalog offer card from Consultant Discovery.
/// Never invents ids — only fields returned by `/consultant-discovery/turn`.
class ConsultantDiscoveryOffer {
  const ConsultantDiscoveryOffer({
    required this.kind,
    required this.id,
    required this.titleAr,
    required this.action,
    required this.openPath,
    this.actionLabelAr,
    this.priceSar,
    this.priceLabelAr,
    this.lane,
    this.category,
    this.subcategory,
    this.partnerId,
    this.branchId,
    this.inStock,
    this.liveStatus,
  });

  final String kind; // product | service
  final String id;
  final String titleAr;
  final String action; // buy | book | view
  final String? actionLabelAr;
  final String openPath;
  final double? priceSar;
  final String? priceLabelAr;
  final String? lane;
  /// published | withdrawn | unknown — from live catalog refresh.
  final String? liveStatus;

  /// Always from the published row — never invent or round away hallalas.
  String get catalogPriceLabelAr {
    final labeled = priceLabelAr?.trim();
    if (labeled != null && labeled.isNotEmpty) return labeled;
    final sar = priceSar;
    if (sar == null) return 'غير مذكور';
    final halalas = (sar * 100).round();
    final riyals = halalas ~/ 100;
    final frac = halalas.abs() % 100;
    final body = frac == 0 ? '$riyals' : '$riyals.${frac.toString().padLeft(2, '0')}';
    return '$body ريال';
  }
  final String? category;
  final String? subcategory;
  final String? partnerId;
  final String? branchId;
  final bool? inStock;

  factory ConsultantDiscoveryOffer.fromJson(Map<String, dynamic> json) {
    final action = json['action'] as String? ?? 'view';
    return ConsultantDiscoveryOffer(
      kind: json['kind'] as String? ?? 'product',
      id: json['id'] as String? ?? '',
      titleAr: json['titleAr'] as String? ?? 'عرض ميرا',
      action: action,
      actionLabelAr: json['actionLabelAr'] as String? ??
          (action == 'book'
              ? 'احجزي'
              : action == 'buy'
                  ? 'اطلبي'
                  : 'عرض التفاصيل'),
      openPath: json['openPath'] as String? ?? '',
      priceSar: (json['priceSar'] as num?)?.toDouble(),
      priceLabelAr: json['priceLabelAr'] as String?,
      lane: json['lane'] as String?,
      category: json['category'] as String?,
      subcategory: json['subcategory'] as String?,
      partnerId: json['partnerId'] as String?,
      branchId: json['branchId'] as String?,
      inStock: json['inStock'] as bool?,
      liveStatus: json['liveStatus'] as String?,
    );
  }
}

class ConsultantDiscoveryTurn {
  const ConsultantDiscoveryTurn({
    required this.enabled,
    required this.version,
    required this.replyAr,
    required this.intentKind,
    required this.offers,
    required this.searchFailed,
    this.askAr,
    this.sideOffer,
    this.searchErrorAr,
    this.ruleIds = const [],
    this.blockers = const [],
    this.saveAsPersonalPreference = false,
    this.catalogFingerprint,
  });

  final bool enabled;
  final String version;
  final String replyAr;
  final String intentKind;
  final String? askAr;
  final List<ConsultantDiscoveryOffer> offers;
  final ConsultantDiscoveryOffer? sideOffer;
  final bool searchFailed;
  final String? searchErrorAr;
  final List<String> ruleIds;
  final List<String> blockers;
  final bool saveAsPersonalPreference;
  final String? catalogFingerprint;

  bool get isCommerceTurn =>
      intentKind == 'direct_product_search' ||
      intentKind == 'direct_service_search' ||
      intentKind == 'clarify' ||
      intentKind == 'refuse_path' ||
      intentKind == 'search_unavailable_note' ||
      (intentKind == 'advice_only' &&
          (blockers.contains('face_image_not_diagnosis') ||
              blockers.contains('explicit_refuse')));

  factory ConsultantDiscoveryTurn.fromJson(Map<String, dynamic> json) {
    final intent = json['intent'];
    final intentMap = intent is Map<String, dynamic> ? intent : const <String, dynamic>{};
    final offersRaw = json['offers'];
    final offers = offersRaw is List
        ? offersRaw
            .whereType<Map>()
            .map((e) => ConsultantDiscoveryOffer.fromJson(Map<String, dynamic>.from(e)))
            .where((o) => o.id.isNotEmpty)
            .toList()
        : const <ConsultantDiscoveryOffer>[];
    final sideRaw = json['sideOffer'];
    return ConsultantDiscoveryTurn(
      enabled: json['enabled'] == true,
      version: json['version'] as String? ?? '',
      replyAr: intentMap['replyAr'] as String? ?? '',
      intentKind: intentMap['kind'] as String? ?? 'advice_only',
      askAr: intentMap['askAr'] as String?,
      offers: offers,
      sideOffer: sideRaw is Map
          ? ConsultantDiscoveryOffer.fromJson(Map<String, dynamic>.from(sideRaw))
          : null,
      searchFailed: json['searchFailed'] == true,
      searchErrorAr: json['searchErrorAr'] as String?,
      ruleIds: (intentMap['ruleIds'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      blockers: (intentMap['blockers'] as List?)?.map((e) => e.toString()).toList() ?? const [],
      saveAsPersonalPreference: intentMap['saveAsPersonalPreference'] == true,
      catalogFingerprint: json['catalogFingerprint'] as String?,
    );
  }
}
