import 'package:flutter/foundation.dart';

import '../data/catalog_provenance.dart';
import '../data/discover_catalog_gateway.dart';
import '../data/discover_catalog_query.dart';
import '../data/discover_published_ad.dart';

enum DiscoverFeedPhase { loading, ready, empty, failed }

class DiscoverFeedState {
  const DiscoverFeedState({
    this.phase = DiscoverFeedPhase.loading,
    this.offers = const [],
    this.query = const DiscoverCatalogQuery(),
    this.nextCursor,
    this.transport,
    this.contentMark,
    this.cities = const [],
    this.ads = const [],
    this.adsFailed = false,
    this.loadingMore = false,
    this.loadMoreError,
    this.loadError,
    this.replacement = 0,
  });

  final DiscoverFeedPhase phase;
  final List<DiscoverOffer> offers;
  final DiscoverCatalogQuery query;
  final String? nextCursor;
  final CatalogTransport? transport;
  final ContentMark? contentMark;
  final List<String> cities;
  final List<DiscoverPublishedAd> ads;
  final bool adsFailed;
  final bool loadingMore;
  final String? loadMoreError;
  final String? loadError;
  final int replacement;

  DiscoverFeedState copyWith({
    DiscoverFeedPhase? phase,
    List<DiscoverOffer>? offers,
    DiscoverCatalogQuery? query,
    String? nextCursor,
    CatalogTransport? transport,
    ContentMark? contentMark,
    List<String>? cities,
    List<DiscoverPublishedAd>? ads,
    bool? adsFailed,
    bool? loadingMore,
    String? loadMoreError,
    String? loadError,
    int? replacement,
    bool clearCursor = false,
    bool clearLoadMoreError = false,
    bool clearLoadError = false,
  }) {
    return DiscoverFeedState(
      phase: phase ?? this.phase,
      offers: offers ?? this.offers,
      query: query ?? this.query,
      nextCursor: clearCursor ? null : nextCursor ?? this.nextCursor,
      transport: transport ?? this.transport,
      contentMark: contentMark ?? this.contentMark,
      cities: cities ?? this.cities,
      ads: ads ?? this.ads,
      adsFailed: adsFailed ?? this.adsFailed,
      loadingMore: loadingMore ?? this.loadingMore,
      loadMoreError: clearLoadMoreError ? null : loadMoreError ?? this.loadMoreError,
      loadError: clearLoadError ? null : loadError ?? this.loadError,
      replacement: replacement ?? this.replacement,
    );
  }
}

class DiscoverFeedController extends ChangeNotifier {
  DiscoverFeedController({required DiscoverCatalogGateway gateway}) : _gateway = gateway;

  final DiscoverCatalogGateway _gateway;
  DiscoverFeedState state = const DiscoverFeedState();
  int _queryGeneration = 0;
  int _moreGeneration = 0;
  bool _loadingMore = false;
  bool _disposed = false;

  bool get serverEnabled => _gateway.serverEnabled;

  @override
  void dispose() {
    _disposed = true;
    _queryGeneration += 1;
    _moreGeneration += 1;
    super.dispose();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> load(DiscoverCatalogQuery query) async {
    final generation = ++_queryGeneration;
    _moreGeneration += 1;
    _loadingMore = false;
    state = DiscoverFeedState(
      phase: DiscoverFeedPhase.loading,
      query: query,
      replacement: state.replacement + 1,
    );
    Future<void>.microtask(() {
      if (!_disposed && generation == _queryGeneration) _notify();
    });
    DiscoverBrowseResponse response;
    try {
      response = await _gateway.browse(query);
    } catch (_) {
      if (_disposed || generation != _queryGeneration) return;
      state = DiscoverFeedState(
        phase: DiscoverFeedPhase.failed,
        query: query,
        loadError: 'تعذر تحميل الكتالوج',
        replacement: state.replacement,
      );
      _notify();
      return;
    }
    if (_disposed || generation != _queryGeneration) return;
    DiscoverAdFeed ads = DiscoverAdFeed.empty;
    if (response.succeeded) {
      try {
        ads = await _gateway.publishedAds();
      } catch (_) {
        ads = const DiscoverAdFeed(failed: true);
      }
    }
    if (_disposed || generation != _queryGeneration) return;
    _applyFirstPage(query, response, ads);
    _notify();
  }

  Future<void> retry() => load(state.query);

  Future<void> loadMore() async {
    if (state.phase == DiscoverFeedPhase.loading || _loadingMore) return;
    final cursor = state.nextCursor;
    final transport = state.transport;
    if (cursor == null || transport == null) return;
    final generation = _queryGeneration;
    final more = ++_moreGeneration;
    final query = state.query;
    _loadingMore = true;
    state = state.copyWith(loadingMore: true, clearLoadMoreError: true);
    _notify();
    DiscoverBrowseResponse response;
    try {
      response = await _gateway.browse(query, cursor: cursor);
    } catch (_) {
      if (_disposed || more != _moreGeneration || generation != _queryGeneration) return;
      _loadingMore = false;
      state = state.copyWith(
        loadingMore: false,
        loadMoreError: 'تعذر تحميل المزيد. النتائج المحملة ما زالت ظاهرة.',
      );
      _notify();
      return;
    }
    if (_disposed || more != _moreGeneration || generation != _queryGeneration) return;
    _loadingMore = false;
    if (!response.succeeded || response.transport != transport) {
      state = state.copyWith(
        loadingMore: false,
        loadMoreError: 'تعذر تحميل المزيد. النتائج المحملة ما زالت ظاهرة.',
      );
      _notify();
      return;
    }
    final seen = state.offers.map((offer) => offer.cursor).toSet();
    state = state.copyWith(
      offers: [
        ...state.offers,
        for (final offer in response.items)
          if (seen.add(offer.cursor)) offer,
      ],
      nextCursor: response.nextCursor,
      clearCursor: response.nextCursor == null,
      loadingMore: false,
      clearLoadMoreError: true,
    );
    _notify();
  }

  Future<void> retryMore() => loadMore();

  List<DiscoverPublishedAd> _matching(List<DiscoverPublishedAd> items, DiscoverCatalogQuery query) {
    return [
      for (final ad in items)
        if (ad.toOffer() case final offer?)
          if (DiscoverCatalogQueryEngine.matches(offer, query)) ad,
    ];
  }

  void _applyFirstPage(DiscoverCatalogQuery query, DiscoverBrowseResponse response, DiscoverAdFeed ads) {
    if (!response.succeeded || response.transport == null || response.contentMark == null) {
      state = DiscoverFeedState(
        phase: DiscoverFeedPhase.failed,
        query: query,
        loadError: response.invalidCursor ? 'مؤشر الصفحة غير صالح' : 'تعذر تحميل الكتالوج',
        replacement: state.replacement,
      );
      return;
    }
    final visibleAds = ads.failed ? const <DiscoverPublishedAd>[] : _matching(ads.items, query);
    state = DiscoverFeedState(
      phase: response.items.isEmpty && visibleAds.isEmpty ? DiscoverFeedPhase.empty : DiscoverFeedPhase.ready,
      offers: response.items,
      ads: visibleAds,
      adsFailed: ads.failed,
      query: query,
      nextCursor: response.nextCursor,
      transport: response.transport,
      contentMark: response.contentMark,
      cities: response.cities,
      replacement: state.replacement,
    );
  }
}
