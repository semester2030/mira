import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../domain/entities/catalog_product.dart';
import '../../domain/entities/catalog_service.dart';
import '../../domain/entities/marketplace_match.dart';
import '../../domain/entities/partner_summary.dart';
import '../../domain/repositories/marketplace_repository.dart';
import '../../domain/entities/partner_detail.dart';
import '../datasources/marketplace_api_data_source.dart';
import '../marketplace_local_catalog.dart';
import '../marketplace_matching.dart';
import '../../../../core/config/mira_api_config.dart';

class MarketplaceRepositoryImpl implements MarketplaceRepository {
  final MarketplaceApiDataSource? _api;

  MarketplaceRepositoryImpl({MarketplaceApiDataSource? api})
      : _api = MiraApiConfig.useBackend ? (api ?? MarketplaceApiDataSource()) : null;

  @override
  Future<MarketplaceMatch> matchForReport(
    SkinReport report, {
    String? city,
  }) async {
    final concerns = MarketplaceMatching.concernsFromReport(report);
    final skinTypeAr = report.skinType;

    if (_api != null) {
      try {
        return await _api.match(
          skinTypeAr: skinTypeAr,
          concernScores: concerns,
          hydration: report.hydration,
          oiliness: report.oiliness,
          city: city ?? 'الرياض',
        );
      } catch (_) {
        // Fallback to local catalog when API unreachable.
      }
    }

    return _matchLocal(concerns, skinTypeAr, city ?? 'الرياض');
  }

  MarketplaceMatch _matchLocal(
    Map<String, int> concerns,
    String skinTypeAr,
    String city,
  ) {
    final products = MarketplaceLocalCatalog.products
        .map((p) {
          final score = MarketplaceMatching.scoreTags(
            p.concernTags,
            concerns,
            skinTypeAr: skinTypeAr,
          );
          return CatalogProduct(
            id: p.id,
            partnerId: p.partnerId,
            partnerNameAr: p.partnerNameAr,
            partnerEmoji: p.partnerEmoji,
            nameAr: p.nameAr,
            nameEn: p.nameEn,
            descriptionAr: p.descriptionAr,
            priceHalalas: p.priceHalalas,
            priceLabel: p.priceLabel,
            externalUrl: p.externalUrl,
            stepAr: p.stepAr,
            matchScore: score,
            concernTags: p.concernTags,
          );
        })
        .where((p) => p.matchScore >= 35)
        .toList()
      ..sort((a, b) => b.matchScore.compareTo(a.matchScore));

    final services = MarketplaceLocalCatalog.services
        .where((s) => city.isEmpty || s.city == city)
        .map((s) {
          final score = MarketplaceMatching.scoreTags(s.concernTags, concerns);
          return CatalogService(
            id: s.id,
            partnerId: s.partnerId,
            partnerNameAr: s.partnerNameAr,
            partnerEmoji: s.partnerEmoji,
            partnerType: s.partnerType,
            city: s.city,
            nameAr: s.nameAr,
            nameEn: s.nameEn,
            descriptionAr: s.descriptionAr,
            durationMin: s.durationMin,
            priceHalalas: s.priceHalalas,
            priceLabel: s.priceLabel,
            matchScore: score,
            bookingEnabled: s.bookingEnabled,
            concernTags: s.concernTags,
          );
        })
        .where((s) => s.matchScore >= 30)
        .toList()
      ..sort((a, b) => b.matchScore.compareTo(a.matchScore));

    return MarketplaceMatch(
      products: products.take(12).toList(),
      services: services.take(8).toList(),
    );
  }

  @override
  Future<List<PartnerSummary>> listPartners({String? type, String? city}) async {
    if (_api != null) {
      try {
        return await _api.listPartners(type: type, city: city);
      } catch (_) {}
    }

    return MarketplaceLocalCatalog.partners.where((p) {
      if (type != null && p.type != type) return false;
      if (city != null && p.city != city) return false;
      return true;
    }).toList();
  }

  @override
  Future<PartnerSummary?> getPartner(String id) async {
    final list = await listPartners();
    for (final p in list) {
      if (p.id == id) return p;
    }
    return null;
  }

  Future<PartnerDetail?> getPartnerDetail(String id) async {
    if (_api != null) {
      final detail = await _api.getPartnerDetail(id);
      if (detail != null) return detail;
    }

    final summary = await getPartner(id);
    if (summary == null) return null;

    final products = MarketplaceLocalCatalog.products
        .where((p) => p.partnerId == id)
        .toList();
    final services = MarketplaceLocalCatalog.services
        .where((s) => s.partnerId == id)
        .toList();

    return PartnerDetail(
      summary: summary,
      products: products,
      services: services,
    );
  }
}
