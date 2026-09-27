import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../domain/entities/catalog_product.dart';
import '../../domain/entities/catalog_service.dart';
import '../../domain/entities/marketplace_match.dart';
import '../../domain/entities/partner_summary.dart';
import '../../domain/repositories/marketplace_repository.dart';
import '../../domain/entities/partner_detail.dart';
import '../ad_link_record.dart';
import '../catalog_provenance.dart';
import '../discover_catalog_gateway.dart';
import '../discover_catalog_query.dart';
import '../discover_published_ad.dart';
import '../datasources/marketplace_api_data_source.dart';
import '../marketplace_local_catalog.dart';
import '../marketplace_matching.dart';
import '../../../../core/config/mira_api_config.dart';

class MarketplaceRepositoryImpl implements MarketplaceRepository, DiscoverCatalogGateway {
  final MarketplaceApiDataSource? _api;

  MarketplaceRepositoryImpl({MarketplaceApiDataSource? api, bool? useServer})
      : _api = (useServer ?? MiraApiConfig.useBackend) ? (api ?? MarketplaceApiDataSource()) : null;

  @override
  bool get serverEnabled => _api != null;

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
            matchKnown: true,
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
            matchKnown: true,
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
    final load = await listPartnersLoad(type: type, city: city);
    return load.value;
  }

  Future<CatalogLoad<List<PartnerSummary>>> listPartnersLoad({
    String? type,
    String? city,
  }) async {
    if (_api != null) {
      try {
        final partners = await _api.listPartners(type: type, city: city);
        return CatalogLoad(
          value: partners,
          transport: CatalogTransport.server,
          contentMark: CatalogLoad.combine(
            partners.map((partner) => CatalogLoad.fromJsonFlag(partner.demoContent)),
          ),
        );
      } catch (_) {}
    }

    final partners = MarketplaceLocalCatalog.partners.where((p) {
      if (type != null && p.type != type) return false;
      if (city != null && p.city != city) return false;
      return true;
    }).toList();
    return CatalogLoad(
      value: partners,
      transport: CatalogTransport.localCatalog,
      contentMark: MarketplaceLocalCatalog.contentMark,
    );
  }

  /// Search runs on the full published set, then the result is paged.
  /// Local demo rows are used only when the server is disabled. A failed server
  /// call is a failure, not a cache of the local examples.
  @override
  Future<DiscoverBrowseResponse> browse(
    DiscoverCatalogQuery query, {
    String? cursor,
    int limit = 8,
  }) async {
    if (_api == null) return _localBrowse(query, cursor: cursor, limit: limit);
    try {
      final selected = query.lane == null
          ? null
          : DiscoverCatalogQueryEngine.find(
              query.lane == DiscoverLane.elegance ? 'elegance' : 'beauty',
              query.categoryId,
            );
      final remote = await _api.browseCatalog(
        text: query.text,
        partnerType: query.lane == null ? query.partnerType : null,
        city: query.city,
        partnerId: query.partnerId,
        category: query.lane == null
            ? (query.categoryId == null || query.categoryId == 'all' ? null : query.categoryId)
            : (selected == null || selected.matchesAll || selected.venueType != null ? null : selected.storedKey),
        lane: query.lane?.name,
        venue: selected?.venueType,
        requireVisual: query.requireVisual,
        cursor: cursor,
        limit: limit,
      );
      return DiscoverBrowseResponse(
        failed: false,
        transport: CatalogTransport.server,
        contentMark: ContentMark.unmarked,
        items: remote.items,
        nextCursor: remote.nextCursor,
        cities: remote.cities,
      );
    } on CatalogCursorException {
      return const DiscoverBrowseResponse(failed: true, invalidCursor: true);
    } on CatalogSourceException {
      return const DiscoverBrowseResponse(failed: true);
    } catch (_) {
      return const DiscoverBrowseResponse(failed: true);
    }
  }

  @override
  Future<DiscoverAdFeed> publishedAds() async {
    if (_api == null) return DiscoverAdFeed.empty;
    try {
      return await _api.publishedAds();
    } catch (_) {
      return const DiscoverAdFeed(failed: true);
    }
  }

  Future<AdLinkRecordOutcome> recordAdLinkOpen({
    required String adId,
    required String eventId,
    AdLinkAttemptControl? attempt,
  }) async {
    if (_api == null) return AdLinkRecordOutcome.rejected;
    return _api.recordAdLinkOpen(adId: adId, eventId: eventId, attempt: attempt);
  }

  Future<bool> confirmAdLink({required String adId, required String url}) async {
    if (_api == null) return false;
    return _api.confirmAdLink(adId: adId, url: url);
  }

  DiscoverBrowseResponse _localBrowse(
    DiscoverCatalogQuery query, {
    String? cursor,
    int limit = 8,
  }) {
    final offers = DiscoverCatalogQueryEngine.localOffers();
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
      transport: CatalogTransport.localCatalog,
      contentMark: MarketplaceLocalCatalog.contentMark,
      items: page.items,
      nextCursor: page.nextCursor,
      cities: DiscoverCatalogQueryEngine.citiesIn(offers),
    );
  }

  @override
  Future<CatalogRecordResult> loadRecord({
    required String kind,
    required String id,
    required CatalogTransport? transport,
  }) async {
    if (_api != null && transport != CatalogTransport.localCatalog) {
      try {
        final remote = await _api.loadPublished(kind: kind, id: id);
        if (remote == null) return const CatalogRecordResult(status: CatalogRecordStatus.missing);
        return CatalogRecordResult(
          status: CatalogRecordStatus.ready,
          product: remote.product,
          service: remote.service,
          transport: CatalogTransport.server,
          contentMark: ContentMark.unmarked,
        );
      } on CatalogSourceException {
        return const CatalogRecordResult(status: CatalogRecordStatus.network);
      } catch (_) {
        return const CatalogRecordResult(status: CatalogRecordStatus.network);
      }
    }
    for (final offer in DiscoverCatalogQueryEngine.localOffers()) {
      if (offer.kind == kind && offer.id == id) {
        return CatalogRecordResult(
          status: CatalogRecordStatus.ready,
          product: offer.product,
          service: offer.service,
          transport: CatalogTransport.localCatalog,
          contentMark: MarketplaceLocalCatalog.contentMark,
        );
      }
    }
    return const CatalogRecordResult(status: CatalogRecordStatus.missing);
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
    final load = await partnerDetailLoad(id);
    return load?.value;
  }

  /// Provenance belongs to this detail request. A later or nested partner list
  /// cannot relabel local products as server data.
  Future<CatalogLoad<PartnerDetail>?> partnerDetailLoad(String id) async {
    if (_api != null) {
      final detail = await _api.getPartnerDetail(id);
      if (detail == null) return null;
      return CatalogLoad(
        value: detail,
        transport: CatalogTransport.server,
        contentMark: CatalogLoad.fromJsonFlag(detail.summary.demoContent),
      );
    }

    PartnerSummary? summary;
    for (final partner in MarketplaceLocalCatalog.partners) {
      if (partner.id == id) {
        summary = partner;
        break;
      }
    }
    if (summary == null) return null;

    return CatalogLoad(
      value: PartnerDetail(
        summary: summary,
        products: MarketplaceLocalCatalog.products
            .where((product) => product.partnerId == id)
            .toList(),
        services: MarketplaceLocalCatalog.services
            .where((service) => service.partnerId == id)
            .toList(),
      ),
      transport: CatalogTransport.localCatalog,
      contentMark: MarketplaceLocalCatalog.contentMark,
    );
  }
}
