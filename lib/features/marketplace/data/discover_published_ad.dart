import '../domain/entities/catalog_product.dart';
import '../domain/entities/catalog_service.dart';
import '../presentation/presentation/discover_ad.dart';
import 'catalog_price.dart';
import 'discover_catalog_query.dart';

/// A published celebrity ad read from the catalog contract. A mismatched target is rejected.
class DiscoverPublishedAd {
  const DiscoverPublishedAd({
    required this.link,
    required this.media,
    this.city = '',
    this.product,
    this.service,
  });

  final DiscoverAdLink link;
  final List<CatalogMediaLink> media;
  final String city;
  final CatalogProduct? product;
  final CatalogService? service;

  DiscoverOffer? toOffer() {
    if (product != null) return DiscoverOffer.product(product!, city: city);
    if (service != null) return DiscoverOffer.service(service!);
    return null;
  }

  static DiscoverPublishedAd? tryParse(Map<String, dynamic> json) {
    final target = json['target'];
    if (target is! Map) return null;
    final targetMap = Map<String, dynamic>.from(target);
    if (json['targetKind'] != targetMap['kind'] || json['targetId'] != targetMap['id']) return null;
    final link = DiscoverAdLink.fromPublic(json);
    if (link.targetKind != targetMap['kind'] || link.targetId != targetMap['id']) return null;
    final media = <CatalogMediaLink>[
      for (final item in (json['media'] as List<dynamic>? ?? const []))
        if (item is Map && (item['url'] as String?)?.isNotEmpty == true)
          CatalogMediaLink(
            kind: item['kind'] as String? ?? 'image',
            url: item['url'] as String,
            sortOrder: (item['sortOrder'] as num?)?.toInt() ?? 0,
            isPrimary: item['isPrimary'] == true,
          ),
    ];
    if (link.targetKind == 'service') {
      final seller = Map<String, dynamic>.from(json['seller'] as Map);
      final partnerType = seller['type'];
      final city = seller['city'];
      final duration = targetMap['durationMin'];
      if (partnerType != 'clinic' && partnerType != 'salon') return null;
      if (city is! String || city.trim().isEmpty) return null;
      if (duration is! num || duration <= 0) return null;
      return DiscoverPublishedAd(
        link: link,
        media: media,
        city: city,
        service: CatalogService(
          id: link.targetId,
          partnerId: seller['id'] as String? ?? '',
          partnerNameAr: seller['nameAr'] as String? ?? link.sellerName,
          partnerType: partnerType as String,
          city: city,
          nameAr: targetMap['nameAr'] as String? ?? link.caption,
          nameEn: targetMap['nameEn'] as String? ?? '',
          descriptionAr: targetMap['descriptionAr'] as String?,
          durationMin: duration.toInt(),
          priceHalalas: link.priceHalalas,
          priceLabel: CatalogPrice.text(known: true, halalas: link.priceHalalas),
          matchScore: 0,
          category: targetMap['category'] as String?,
          bookingEnabled: false,
          concernTags: _tags(targetMap),
          media: media,
        ),
      );
    }
    final seller = Map<String, dynamic>.from(json['seller'] as Map);
    return DiscoverPublishedAd(
      link: link,
      media: media,
      city: seller['city'] as String? ?? '',
      product: CatalogProduct(
        id: link.targetId,
        partnerId: seller['id'] as String? ?? '',
        partnerNameAr: seller['nameAr'] as String? ?? link.sellerName,
        nameAr: targetMap['nameAr'] as String? ?? link.caption,
        nameEn: targetMap['nameEn'] as String? ?? '',
        priceHalalas: link.priceHalalas,
        priceLabel: CatalogPrice.text(known: true, halalas: link.priceHalalas),
        externalUrl: targetMap['externalUrl'] as String? ?? '',
        matchScore: 0,
        descriptionAr: _description(targetMap['descriptionAr']),
        category: targetMap['category'] as String?,
        concernTags: _tags(targetMap),
        media: media,
      ),
    );
  }

  /// Published product copy only. A missing or blank value stays as sent.
  static String? _description(Object? value) {
    if (value is! String) return null;
    return value;
  }

  static List<String> _tags(Map<String, dynamic> target) {
    final raw = target['concernTags'];
    if (raw is! List) return const [];
    return [for (final item in raw) item.toString()];
  }
}

class DiscoverAdFeed {
  const DiscoverAdFeed({required this.failed, this.items = const []});

  final bool failed;
  final List<DiscoverPublishedAd> items;

  static const empty = DiscoverAdFeed(failed: false);
}
