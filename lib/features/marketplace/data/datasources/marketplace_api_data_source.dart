import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../ad_link_record.dart';
import '../catalog_media_url.dart';
import '../catalog_price.dart';
import '../../domain/entities/catalog_product.dart';
import '../../domain/entities/catalog_service.dart';
import '../../domain/entities/marketplace_match.dart';
import '../../domain/entities/partner_detail.dart';
import '../../domain/entities/partner_summary.dart';
import '../discover_catalog_gateway.dart';
import '../discover_published_ad.dart';
import '../discover_favorite_client.dart';
import '../discover_catalog_query.dart';

class MarketplaceApiDataSource {
  final Dio _dio;

  MarketplaceApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<MarketplaceMatch> match({
    required String skinTypeAr,
    required Map<String, int> concernScores,
    int? hydration,
    int? oiliness,
    String? city,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      MiraApiEndpoints.marketplaceMatch,
      data: {
        'skinTypeAr': skinTypeAr,
        'concernScores': concernScores,
        if (hydration != null) 'hydration': hydration,
        if (oiliness != null) 'oiliness': oiliness,
        if (city != null) 'city': city,
      },
    );

    final data = response.data;
    if (data == null) return MarketplaceMatch.empty;

    final productsRaw = data['products'] as List<dynamic>? ?? [];
    final servicesRaw = data['services'] as List<dynamic>? ?? [];

    return MarketplaceMatch(
      products: productsRaw
          .map((e) => _parseProduct(e as Map<String, dynamic>))
          .toList(),
      services: servicesRaw
          .map((e) => _parseService(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Future<PartnerDetail?> getPartnerDetail(String id) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '${MiraApiEndpoints.marketplacePartners}/$id',
      );
      final data = response.data;
      if (data == null) return null;
      return PartnerDetail.fromJson(data);
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      throw const CatalogSourceException();
    }
  }

  Future<({CatalogProduct? product, CatalogService? service})?> loadPublished({
    required String kind,
    required String id,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('${MiraApiEndpoints.marketplaceCatalog}/$kind/$id');
      final data = response.data;
      if (data == null) return null;
      final offer = _offer(data);
      return (product: offer.product, service: offer.service);
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      throw const CatalogSourceException();
    }
  }

  Future<Set<String>> listFavoriteKeys() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(MiraApiEndpoints.marketplaceFavorites);
      final items = response.data?['items'] as List<dynamic>? ?? const [];
      return {
        for (final item in items)
          if (item is Map) '${item['kind']}:${item['id']}',
      };
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) throw const FavoriteAuthException();
      throw const CatalogSourceException();
    }
  }

  Future<void> setFavorite({required String kind, required String id, required bool saved}) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        MiraApiEndpoints.marketplaceFavorites,
        data: {'kind': kind, 'id': id, 'saved': saved},
      );
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      if (status == 401) throw const FavoriteAuthException();
      if (status == 404) throw const FavoriteMissingException();
      throw const CatalogSourceException();
    }
  }

  Future<List<PartnerSummary>> listPartners({String? type, String? city}) async {
    final response = await _dio.get<List<dynamic>>(
      MiraApiEndpoints.marketplacePartners,
      queryParameters: {
        if (type != null) 'type': type,
        if (city != null) 'city': city,
      },
    );

    return (response.data ?? [])
        .map((e) => _parsePartner(e as Map<String, dynamic>))
        .toList();
  }

  CatalogProduct _parseProduct(Map<String, dynamic> json) {
    return CatalogProduct(
      id: json['id'] as String,
      partnerId: json['partnerId'] as String,
      partnerNameAr: json['partnerNameAr'] as String,
      partnerEmoji: json['partnerEmoji'] as String?,
      nameAr: json['nameAr'] as String,
      nameEn: json['nameEn'] as String? ?? '',
      descriptionAr: json['descriptionAr'] as String?,
      priceHalalas: CatalogPrice.read(json).halalas,
      priceLabel: json['priceLabel'] as String? ?? '',
      priceKnown: CatalogPrice.read(json).known,
      externalUrl: json['externalUrl'] as String,
      stepAr: json['stepAr'] as String?,
      matchScore: (json['matchScore'] as num?)?.toInt() ?? 0,
      matchKnown: json.containsKey('matchScore'),
      concernTags: (json['concernTags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }

  CatalogService _parseService(Map<String, dynamic> json) {
    return CatalogService(
      id: json['id'] as String,
      partnerId: json['partnerId'] as String,
      partnerNameAr: json['partnerNameAr'] as String,
      partnerEmoji: json['partnerEmoji'] as String?,
      partnerType: json['partnerType'] as String? ?? 'salon',
      city: json['city'] as String? ?? 'الرياض',
      nameAr: json['nameAr'] as String,
      nameEn: json['nameEn'] as String? ?? '',
      descriptionAr: json['descriptionAr'] as String?,
      durationMin: (json['durationMin'] as num).toInt(),
      priceHalalas: CatalogPrice.read(json).halalas,
      priceLabel: json['priceLabel'] as String? ?? '',
      priceKnown: CatalogPrice.read(json).known,
      matchScore: (json['matchScore'] as num?)?.toInt() ?? 0,
      matchKnown: json.containsKey('matchScore'),
      bookingEnabled: json['bookingEnabled'] as bool? ?? false,
      concernTags: (json['concernTags'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }

  PartnerSummary _parsePartner(Map<String, dynamic> json) {
    return PartnerSummary(
      id: json['id'] as String,
      type: json['type'] as String,
      nameAr: json['nameAr'] as String,
      nameEn: json['nameEn'] as String? ?? '',
      descriptionAr: json['descriptionAr'] as String?,
      city: json['city'] as String? ?? 'الرياض',
      logoEmoji: json['logoEmoji'] as String?,
      rating: (json['rating'] as num?)?.toDouble() ?? 4.5,
      storeUrl: json['storeUrl'] as String?,
      demoContent: json['demoContent'] as bool?,
    );
  }

  Future<({List<DiscoverOffer> items, String? nextCursor, List<String> cities})> browseCatalog({
    required String text,
    String? partnerType,
    String? city,
    String? partnerId,
    String? category,
    String? lane,
    String? venue,
    bool requireVisual = false,
    List<String> tags = const [],
    String? hint,
    String? cursor,
    int limit = 8,
  }) async {
    late final Response<Map<String, dynamic>> response;
    try {
      response = await _dio.get<Map<String, dynamic>>(
      MiraApiEndpoints.marketplaceCatalog,
      queryParameters: {
        if (text.trim().isNotEmpty) 'q': text.trim(),
        if (partnerType != null) 'type': partnerType,
        if (city != null && city.isNotEmpty) 'city': city,
        if (partnerId != null) 'partnerId': partnerId,
        if (category != null && category.isNotEmpty && category != 'all') 'category': category,
        if (lane != null) 'lane': lane,
        if (venue != null) 'venue': venue,
        if (requireVisual) 'visual': '1',
        if (tags.isNotEmpty) 'tag': tags.join(','),
        if (hint != null && hint.isNotEmpty) 'hint': hint,
        if (cursor != null) 'cursor': cursor,
        'limit': limit,
      },
    );
    } on DioException catch (error) {
      if (error.response?.statusCode == 400) throw const CatalogCursorException();
      throw const CatalogSourceException();
    }
    final data = response.data ?? const <String, dynamic>{};
    final raw = data['items'] as List<dynamic>? ?? const [];
    return (
      items: raw.map((item) => _offer(item as Map<String, dynamic>)).toList(),
      nextCursor: data['nextCursor'] as String?,
      cities: (data['availableCities'] as List<dynamic>? ?? const []).map((item) => item.toString()).toList(),
    );
  }

  DiscoverOffer _offer(Map<String, dynamic> json) {
    final kind = json['kind'] as String? ?? 'product';
    if (kind == 'service') {
      return DiscoverOffer.service(
        CatalogService(
          id: json['id'] as String,
          partnerId: json['partnerId'] as String,
          partnerNameAr: json['partnerNameAr'] as String? ?? '',
          partnerEmoji: json['partnerEmoji'] as String?,
          partnerType: json['partnerType'] as String? ?? 'salon',
          city: json['city'] as String? ?? '',
          contactPhone: json['contactPhone'] as String?,
          nameAr: json['nameAr'] as String? ?? '',
          nameEn: json['nameEn'] as String? ?? '',
          descriptionAr: json['descriptionAr'] as String?,
          durationMin: (json['durationMin'] as num?)?.toInt() ?? 0,
          priceHalalas: CatalogPrice.read(json).halalas,
          priceLabel: json['priceLabel'] as String? ?? '',
          priceKnown: CatalogPrice.read(json).known,
          matchScore: 0,
          category: json['category'] as String?,
          bookingEnabled: json['bookingEnabled'] as bool? ?? false,
          media: _media(json),
          concernTags: (json['concernTags'] as List<dynamic>? ?? const []).map((item) => item.toString()).toList(),
        ),
      );
    }
    return DiscoverOffer.product(
      CatalogProduct(
        id: json['id'] as String,
        partnerId: json['partnerId'] as String,
        partnerNameAr: json['partnerNameAr'] as String? ?? '',
        partnerEmoji: json['partnerEmoji'] as String?,
        nameAr: json['nameAr'] as String? ?? '',
        nameEn: json['nameEn'] as String? ?? '',
        descriptionAr: json['descriptionAr'] as String?,
        priceHalalas: CatalogPrice.read(json).halalas,
        priceLabel: json['priceLabel'] as String? ?? '',
        priceKnown: CatalogPrice.read(json).known,
        externalUrl: json['externalUrl'] as String? ?? '',
        category: json['category'] as String?,
        media: _media(json),
        stepAr: json['stepAr'] as String?,
        matchScore: 0,
        concernTags: (json['concernTags'] as List<dynamic>? ?? const []).map((item) => item.toString()).toList(),
      ),
      city: json['city'] as String? ?? '',
    );
  }

  DiscoverOffer parseCatalogItem(Map<String, dynamic> json) => _offer(json);

  Future<DiscoverAdFeed> publishedAds() async {
    late final Response<Map<String, dynamic>> response;
    try {
      response = await _dio.get<Map<String, dynamic>>(MiraApiEndpoints.marketplaceAds);
    } on DioException {
      throw const CatalogSourceException();
    }
    return parsePublishedAds(response.data);
  }

  /// Resolves relative media URLs with the catalog rule, then parses the ad.
  DiscoverAdFeed parsePublishedAds(Map<String, dynamic>? data) {
    final raw = data?['items'] as List<dynamic>? ?? const [];
    return DiscoverAdFeed(
      failed: false,
      items: [
        for (final item in raw)
          if (item is Map)
            if (DiscoverPublishedAd.tryParse(_withResolvedMedia(Map<String, dynamic>.from(item))) case final ad?) ad,
      ],
    );
  }

  Future<bool> confirmAdLink({required String adId, required String url}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('${MiraApiEndpoints.marketplaceAds}/$adId');
      final parsed = DiscoverPublishedAd.tryParse(_withResolvedMedia(Map<String, dynamic>.from(response.data ?? {})));
      final current = parsed?.product?.externalUrl ?? '';
      return parsed != null && parsed.link.openLink && current.isNotEmpty && current == url;
    } on DioException {
      return false;
    }
  }

  Map<String, dynamic> _withResolvedMedia(Map<String, dynamic> json) {
    final media = json['media'];
    if (media is! List) return json;
    return {
      ...json,
      'media': [
        for (final item in media)
          if (item is Map && item['url'] is String)
            {
              ...Map<String, dynamic>.from(item),
              'url': resolveCatalogMediaUrl(item['url'] as String, _dio.options.baseUrl),
            }
          else
            item,
      ],
    };
  }

  Future<AdLinkRecordOutcome> recordAdLinkOpen({
    required String adId,
    required String eventId,
    AdLinkAttemptControl? attempt,
  }) async {
    final token = CancelToken();
    attempt?.onCancel(() {
      if (!token.isCancelled) token.cancel();
    });
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '${MiraApiEndpoints.marketplaceAds}/$adId/link-open',
        data: {'eventId': eventId},
        cancelToken: token,
      );
      final body = response.data;
      if (body != null && body['purchaseCompleted'] != true && body['action'] == 'link_open') {
        return AdLinkRecordOutcome.recorded;
      }
      return AdLinkRecordOutcome.rejected;
    } on DioException catch (error) {
      if (CancelToken.isCancel(error)) return AdLinkRecordOutcome.retryable;
      final code = error.response?.statusCode;
      if (code == 400 || code == 404 || code == 409) return AdLinkRecordOutcome.rejected;
      return AdLinkRecordOutcome.retryable;
    }
  }

  List<CatalogMediaLink> _media(Map<String, dynamic> json) {
    final raw = json['media'] as List<dynamic>? ?? const [];
    return [
      for (final item in raw)
        if (item is Map<String, dynamic> && (item['url'] as String?)?.isNotEmpty == true)
          CatalogMediaLink(
            kind: item['kind'] as String? ?? 'image',
            url: resolveCatalogMediaUrl(item['url'] as String, _dio.options.baseUrl),
            sortOrder: (item['sortOrder'] as num?)?.toInt() ?? 0,
            isPrimary: item['isPrimary'] == true,
          ),
    ];
  }

  /// Fire-and-forget click analytics for partner catalog (no PII).
  Future<void> trackClick({
    required String partnerId,
    required String targetId,
    required String targetType,
  }) async {
    await recordEvent(partnerId: partnerId, targetId: targetId, targetType: targetType, eventType: 'click');
  }

  /// Returns whether the portal accepted the event. A false result is not success.
  Future<bool> recordEvent({
    required String partnerId,
    required String targetId,
    required String targetType,
    required String eventType,
  }) async {
    try {
      await _dio.post<void>(
        MiraApiEndpoints.partnersPortalTrack,
        data: {
          'partnerId': partnerId,
          'eventType': eventType,
          'targetId': targetId,
          'targetType': targetType,
        },
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}
