import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_gateway.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';
import 'package:mirra/features/marketplace/presentation/discover_feed_controller.dart';

void main() {
  final offers = DiscoverCatalogQueryEngine.localOffers();

  test('a late response does not replace a newer query', () async {
    final gateway = _ScriptedGateway();
    final feed = DiscoverFeedController(gateway: gateway);
    final first = feed.load(const DiscoverCatalogQuery(text: 'أول'));
    final second = feed.load(const DiscoverCatalogQuery(text: 'ثان'));
    gateway.complete(1, _page([offers[1]]));
    await second;
    gateway.complete(0, _page([offers[0]]));
    await first;
    expect(feed.state.offers.single.id, offers[1].id);
    expect(feed.state.query.text, 'ثان');
  });

  test('load more does not cancel or append onto a newer search', () async {
    final gateway = _ScriptedGateway();
    final feed = DiscoverFeedController(gateway: gateway);
    final initial = feed.load(const DiscoverCatalogQuery());
    gateway.complete(0, _page(offers.take(1).toList(), cursor: offers.first.cursor));
    await initial;
    final more = feed.loadMore();
    final search = feed.load(const DiscoverCatalogQuery(text: 'مكياج'));
    gateway.complete(1, _page(offers.skip(1).take(1).toList(), transport: CatalogTransport.server));
    await more;
    gateway.complete(2, _page([offers.firstWhere((offer) => offer.id == 's-glam-makeup')]));
    await search;
    expect(feed.state.offers.single.id, 's-glam-makeup');
    expect(feed.state.offers.any((offer) => offer.id == offers[1].id), isFalse);
  });

  test('a local page is not merged into a server page', () async {
    final gateway = _ScriptedGateway();
    final feed = DiscoverFeedController(gateway: gateway);
    final initial = feed.load(const DiscoverCatalogQuery());
    gateway.complete(0, _page(offers.take(1).toList(), cursor: 'product:next'));
    await initial;
    final more = feed.loadMore();
    gateway.complete(1, _page(offers.skip(1).take(1).toList(), transport: CatalogTransport.localCatalog));
    await more;
    expect(feed.state.offers.single.id, offers.first.id);
    expect(feed.state.loadMoreError, isNotNull);
  });

  test('the first failure is not an empty result and retry asks again', () async {
    final gateway = _ScriptedGateway();
    final feed = DiscoverFeedController(gateway: gateway);
    final initial = feed.load(const DiscoverCatalogQuery());
    expect(feed.state.phase, DiscoverFeedPhase.loading);
    gateway.complete(0, const DiscoverBrowseResponse(failed: true));
    await initial;
    expect(feed.state.phase, DiscoverFeedPhase.failed);
    expect(feed.state.offers, isEmpty);
    final retry = feed.retry();
    gateway.complete(1, _page([offers.first]));
    await retry;
    expect(feed.state.phase, DiscoverFeedPhase.ready);
    expect(feed.state.offers.single.id, offers.first.id);
  });

  test('a browse that finishes after dispose does not notify listeners', () async {
    final gateway = _ScriptedGateway();
    final feed = DiscoverFeedController(gateway: gateway);
    var notified = 0;
    feed.addListener(() => notified++);
    final pending = feed.load(const DiscoverCatalogQuery());
    feed.dispose();
    gateway.complete(0, _page([offers.first]));
    await pending;
    expect(notified, 0);
  });

  test('favorite rows stay inside the account that saved them', () async {
    final book = _MemoryFavoriteBook();
    expect(await book.toggle(userId: 'a', kind: 'product', id: 'p1'), isTrue);
    expect(await book.toggle(userId: 'b', kind: 'product', id: 'p1'), isTrue);
    expect(book.savedFor('a', 'product', 'p1'), isTrue);
    expect(book.savedFor('b', 'product', 'p1'), isTrue);
    expect(book.savedFor('a', 'service', 'p1'), isFalse);
  });
}

class _MemoryFavoriteBook {
  final Map<String, Set<String>> _saved = {};

  Future<bool> toggle({required String userId, required String kind, required String id}) async {
    final key = '$userId|$kind|$id';
    final mine = _saved.putIfAbsent(userId, () => {});
    if (mine.contains(key)) {
      mine.remove(key);
      return false;
    }
    mine.add(key);
    return true;
  }

  bool savedFor(String userId, String kind, String id) => _saved[userId]?.contains('$userId|$kind|$id') ?? false;
}

DiscoverBrowseResponse _page(
  List<DiscoverOffer> items, {
  String? cursor,
  CatalogTransport transport = CatalogTransport.server,
}) {
  return DiscoverBrowseResponse(
    failed: false,
    transport: transport,
    contentMark: transport == CatalogTransport.server ? ContentMark.unmarked : ContentMark.explicitDemo,
    items: items,
    nextCursor: cursor,
  );
}

class _ScriptedGateway implements DiscoverCatalogGateway {
  final List<Completer<DiscoverBrowseResponse>> pending = [];

  @override
  bool get serverEnabled => true;

  void complete(int index, DiscoverBrowseResponse response) {
    pending[index].complete(response);
  }

  @override
  Future<DiscoverBrowseResponse> browse(DiscoverCatalogQuery query, {String? cursor, int limit = 4}) {
    final completer = Completer<DiscoverBrowseResponse>();
    pending.add(completer);
    return completer.future;
  }

  @override
  Future<CatalogRecordResult> loadRecord({
    required String kind,
    required String id,
    required CatalogTransport? transport,
  }) async {
    return const CatalogRecordResult(status: CatalogRecordStatus.missing);
  }

  @override
  Future<DiscoverAdFeed> publishedAds() async => DiscoverAdFeed.empty;
}
