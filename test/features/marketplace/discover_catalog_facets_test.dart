import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_facets.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_gateway.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/presentation/discover_feed_controller.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';

class _FakeGateway implements DiscoverCatalogGateway {
  _FakeGateway(this.response);

  DiscoverBrowseResponse response;

  @override
  bool get serverEnabled => true;

  @override
  Future<DiscoverBrowseResponse> browse(
    DiscoverCatalogQuery query, {
    String? cursor,
    int limit = 4,
  }) async {
    return response;
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

void main() {
  test('facets and totalMatched reach DiscoverFeedState', () async {
    final facets = DiscoverCatalogFacets.fromJson({
      'variant.color': [
        {'id': 'black', 'count': 2, 'labelAr': 'أسود', 'swatchHex': '#111111'},
      ],
      'variant.size': [
        {'id': 'm', 'count': 1, 'labelAr': 'M'},
      ],
      'staleSelections': [
        {'field': 'variant.color', 'value': 'neon'},
      ],
    });
    final gateway = _FakeGateway(
      DiscoverBrowseResponse(
        failed: false,
        transport: CatalogTransport.server,
        contentMark: ContentMark.unmarked,
        items: const [],
        cities: const ['الرياض'],
        facets: facets,
        totalMatched: 2,
        queryFingerprint: 'abc12345',
      ),
    );
    final feed = DiscoverFeedController(gateway: gateway);
    await feed.load(const DiscoverCatalogQuery(colors: ['black'], requestFacets: true));
    expect(feed.state.totalMatched, 2);
    expect(feed.state.facets.colors.single.id, 'black');
    expect(feed.state.facets.colors.single.swatchHex, '#111111');
    expect(feed.state.facets.staleSelections.single.value, 'neon');
    expect(feed.state.queryFingerprint, 'abc12345');
    feed.dispose();
  });

  test('DiscoverCatalogQuery drops product filters on beauty lane', () {
    final q = const DiscoverCatalogQuery(
      lane: DiscoverLane.beauty,
      colors: ['black'],
      sizes: ['m'],
      placeModes: ['branch'],
      inStock: true,
    ).withoutInapplicableFilters();
    expect(q.colors, isEmpty);
    expect(q.sizes, isEmpty);
    expect(q.inStock, isNull);
    expect(q.placeModes, ['branch']);
  });
}
