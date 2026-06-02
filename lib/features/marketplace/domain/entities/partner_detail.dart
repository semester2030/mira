import 'catalog_product.dart';
import 'catalog_service.dart';
import 'partner_summary.dart';

class PartnerDetail {
  final PartnerSummary summary;
  final List<CatalogProduct> products;
  final List<CatalogService> services;

  const PartnerDetail({
    required this.summary,
    required this.products,
    required this.services,
  });

  factory PartnerDetail.fromJson(Map<String, dynamic> json) {
    final summary = PartnerSummary(
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

    final productsRaw = json['products'] as List<dynamic>? ?? [];
    final servicesRaw = json['services'] as List<dynamic>? ?? [];

    return PartnerDetail(
      summary: summary,
      products: productsRaw.map((e) {
        final m = e as Map<String, dynamic>;
        return CatalogProduct(
          id: m['id'] as String,
          partnerId: summary.id,
          partnerNameAr: summary.nameAr,
          partnerEmoji: summary.logoEmoji,
          nameAr: m['nameAr'] as String,
          nameEn: m['nameEn'] as String? ?? '',
          descriptionAr: m['descriptionAr'] as String?,
          priceHalalas: (m['priceHalalas'] as num).toInt(),
          priceLabel: m['priceLabel'] as String? ?? '',
          externalUrl: m['externalUrl'] as String? ?? '',
          stepAr: m['stepAr'] as String?,
          matchScore: 0,
          concernTags: (m['concernTags'] as List<dynamic>?)
                  ?.map((t) => t.toString())
                  .toList() ??
              const [],
        );
      }).toList(),
      services: servicesRaw.map((e) {
        final m = e as Map<String, dynamic>;
        return CatalogService(
          id: m['id'] as String,
          partnerId: summary.id,
          partnerNameAr: summary.nameAr,
          partnerEmoji: summary.logoEmoji,
          partnerType: summary.type,
          city: summary.city,
          nameAr: m['nameAr'] as String,
          nameEn: m['nameEn'] as String? ?? '',
          descriptionAr: m['descriptionAr'] as String?,
          durationMin: (m['durationMin'] as num).toInt(),
          priceHalalas: (m['priceHalalas'] as num).toInt(),
          priceLabel: m['priceLabel'] as String? ?? '',
          matchScore: 0,
          bookingEnabled: m['bookingEnabled'] as bool? ?? false,
          concernTags: (m['concernTags'] as List<dynamic>?)
                  ?.map((t) => t.toString())
                  .toList() ??
              const [],
        );
      }).toList(),
    );
  }
}
