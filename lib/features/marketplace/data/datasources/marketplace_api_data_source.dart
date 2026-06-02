import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';
import '../../domain/entities/catalog_product.dart';
import '../../domain/entities/catalog_service.dart';
import '../../domain/entities/marketplace_match.dart';
import '../../domain/entities/partner_detail.dart';
import '../../domain/entities/partner_summary.dart';

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
    } catch (_) {
      return null;
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
      priceHalalas: (json['priceHalalas'] as num).toInt(),
      priceLabel: json['priceLabel'] as String? ?? '',
      externalUrl: json['externalUrl'] as String,
      stepAr: json['stepAr'] as String?,
      matchScore: (json['matchScore'] as num?)?.toInt() ?? 0,
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
      priceHalalas: (json['priceHalalas'] as num).toInt(),
      priceLabel: json['priceLabel'] as String? ?? '',
      matchScore: (json['matchScore'] as num?)?.toInt() ?? 0,
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
    );
  }
}
