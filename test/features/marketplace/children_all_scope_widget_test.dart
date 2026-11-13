import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_facets.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_gateway.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_favorite_client.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';
import 'package:mirra/features/marketplace/domain/catalog_offer_media.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

import 'discover_fonts.dart';

class _RecordingGateway implements DiscoverCatalogGateway {
  final queries = <DiscoverCatalogQuery>[];

  @override
  bool get serverEnabled => true;

  @override
  Future<DiscoverBrowseResponse> browse(
    DiscoverCatalogQuery query, {
    String? cursor,
    int limit = 4,
  }) async {
    queries.add(query);
    final clothes = DiscoverOffer.product(
      const CatalogProduct(
        id: 'p-kids-clothes',
        partnerId: 'brand-1',
        partnerNameAr: 'أطفال',
        nameAr: 'فستان أطفال',
        nameEn: 'Kids dress',
        priceHalalas: 8000,
        priceLabel: '80',
        priceKnown: true,
        externalUrl: 'https://example.test/c',
        matchScore: 0,
        matchKnown: false,
        category: 'children',
        traits: {'subcategory': 'children.clothes'},
        concernTags: [],
        media: [
          CatalogMediaLink(kind: 'image', url: 'assets/marketplace/discover/thumbs/product_clothes.jpg'),
        ],
      ),
      city: 'جدة',
    );
    final shoes = DiscoverOffer.product(
      const CatalogProduct(
        id: 'p-kids-shoes',
        partnerId: 'brand-1',
        partnerNameAr: 'أطفال',
        nameAr: 'حذاء أطفال',
        nameEn: 'Kids shoes',
        priceHalalas: 5000,
        priceLabel: '50',
        priceKnown: true,
        externalUrl: 'https://example.test/s',
        matchScore: 0,
        matchKnown: false,
        category: 'children',
        traits: {'subcategory': 'children.shoes'},
        concernTags: [],
        media: [
          CatalogMediaLink(kind: 'image', url: 'assets/marketplace/discover/thumbs/product_clothes.jpg'),
        ],
      ),
      city: 'جدة',
    );
    final makeup = DiscoverOffer.product(
      const CatalogProduct(
        id: 'p-makeup-kit',
        partnerId: 'brand-2',
        partnerNameAr: 'جمال',
        nameAr: 'طقم مكياج',
        nameEn: 'Makeup kit',
        priceHalalas: 40000,
        priceLabel: '400',
        priceKnown: true,
        externalUrl: 'https://example.test/m',
        matchScore: 0,
        matchKnown: false,
        category: 'face',
        concernTags: [],
        media: [
          CatalogMediaLink(kind: 'video', url: 'assets/marketplace/discover/thumbs/product_clothes.jpg'),
        ],
      ),
      city: 'جدة',
    );

    final items = <DiscoverOffer>[];
    for (final offer in [clothes, shoes, makeup]) {
      if (DiscoverCatalogQueryEngine.matches(offer, query)) items.add(offer);
    }
    // Mirror server lane membership for children without category (defense).
    final scoped = query.lane == DiscoverLane.children &&
            (query.categoryId == null || query.categoryId == 'all') &&
            (query.subcategoryId == null || query.subcategoryId!.isEmpty)
        ? items.where((o) => (o.category ?? '').startsWith('children')).toList()
        : items;

    return DiscoverBrowseResponse(
      failed: false,
      transport: CatalogTransport.server,
      contentMark: ContentMark.unmarked,
      items: scoped,
      cities: const ['جدة'],
      facets: const DiscoverCatalogFacets(),
      totalMatched: scoped.length,
    );
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

class _NoopFavorites extends DiscoverFavoriteClient {
  @override
  String? get accountKey => 'test';

  @override
  bool get readFailed => false;

  @override
  bool saved(String kind, String id) => false;

  @override
  bool saving(String kind, String id) => false;

  @override
  Future<void> refresh() async {}

  @override
  Future<void> set({required String kind, required String id, required bool saved}) async {}

  @override
  Future<bool> toggle({required String kind, required String id}) async => false;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(loadDiscoverFonts);

  setUp(() {
    EleganceTaxonomySource.replaceForTest(
      const [
        EleganceTaxonomyNode(
          id: 'children_lane.all',
          labelAr: 'الكل',
          sort: 0,
          active: true,
          browseOnly: true,
          writeEnabled: false,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'children',
          labelAr: 'الأطفال',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: ['children.all', 'children.clothes', 'children.shoes', 'children.newborn'],
        ),
        EleganceTaxonomyNode(
          id: 'children.all',
          parentId: 'children',
          labelAr: 'الكل',
          sort: 0,
          active: true,
          browseOnly: true,
          writeEnabled: false,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'children.clothes',
          parentId: 'children',
          labelAr: 'ملابس أطفال',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'children.shoes',
          parentId: 'children',
          labelAr: 'أحذية أطفال',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'children.newborn',
          parentId: 'children',
          labelAr: 'مستلزمات مواليد',
          sort: 30,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
      ],
      definitionsVersion: 'children-all-1',
      lane: 'children',
    );
  });

  tearDown(EleganceTaxonomySource.clearCache);

  testWidgets('children ← الكل scopes to children section; shoes leaf then الكل restores clothes', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final gateway = _RecordingGateway();
    final screenKey = GlobalKey<DiscoverPresentationScreenState>();

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        locale: const Locale('ar'),
        builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
        home: DiscoverPresentationScreen(
          key: screenKey,
          lane: DiscoverLane.children,
          gateway: gateway,
          favorites: _NoopFavorites(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('ملابس أطفال'), findsWidgets);
    expect(find.text('أحذية أطفال'), findsWidgets);

    // Initial / الكل — section scope, no makeup.
    await tester.tap(find.text('الكل').first);
    await tester.pumpAndSettle();
    final state = screenKey.currentState!;
    final allQ = gateway.queries.last;
    expect(allQ.lane, DiscoverLane.children);
    expect(allQ.categoryId, 'children');
    expect(allQ.subcategoryId, isNull);
    expect(state.debugQuery.categoryId, 'children');
    expect(state.debugRailIds[state.debugCategoryIndex], 'all');
    expect(find.text('فستان أطفال'), findsWidgets);
    expect(find.text('طقم مكياج'), findsNothing);
    expect(state.debugPlayingOfferId, isNot(equals('p-makeup-kit')));
    // Both children offers matched in the last browse (pager may show one slide).
    final allBrowse = await gateway.browse(allQ);
    expect(allBrowse.items.map((o) => o.id).toSet(), {'p-kids-clothes', 'p-kids-shoes'});

    // أحذية أطفال leaf — lit circle stays on shoes after load.
    await tester.tap(find.text('أحذية أطفال').last);
    await tester.pumpAndSettle();
    final shoesQ = gateway.queries.last;
    expect(shoesQ.categoryId, 'children');
    expect(shoesQ.subcategoryId, 'children.shoes');
    expect(state.debugQuery.subcategoryId, 'children.shoes');
    expect(state.debugRailIds[state.debugCategoryIndex], 'children.shoes');
    expect(find.text('حذاء أطفال'), findsWidgets);
    expect(find.text('فستان أطفال'), findsNothing);
    expect(find.text('طقم مكياج'), findsNothing);
    expect(state.debugPlayingOfferId, 'p-kids-shoes');

    // الكل again — lit «الكل», clothes return, makeup never
    await tester.tap(find.text('الكل').first);
    await tester.pumpAndSettle();
    final allAgain = gateway.queries.last;
    expect(allAgain.categoryId, 'children');
    expect(allAgain.subcategoryId, isNull);
    expect(state.debugRailIds[state.debugCategoryIndex], 'all');
    expect(find.text('فستان أطفال'), findsWidgets);
    expect(find.text('طقم مكياج'), findsNothing);
    final allAgainBrowse = await gateway.browse(allAgain);
    expect(allAgainBrowse.items.map((o) => o.id), containsAll(['p-kids-clothes', 'p-kids-shoes']));
    expect(allAgainBrowse.items.any((o) => o.id == 'p-makeup-kit'), isFalse);
  });

  testWidgets('الكل keeps في موقعك placeModes on beauty makeup section', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    EleganceTaxonomySource.replaceForTest(
      const [
        EleganceTaxonomyNode(
          id: 'beauty',
          labelAr: 'جمالك',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: ['beauty.home_visit', 'beauty.salons'],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.home_visit',
          parentId: 'beauty',
          labelAr: 'في موقعك',
          sort: 0,
          active: true,
          browseOnly: true,
          writeEnabled: false,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.salons',
          parentId: 'beauty',
          labelAr: 'صالونات ومختصّات',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: false,
          children: ['beauty.makeup', 'beauty.hair'],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.makeup',
          parentId: 'beauty.salons',
          labelAr: 'المكياج',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: ['beauty.makeup.all', 'beauty.makeup.bridal'],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.makeup.all',
          parentId: 'beauty.makeup',
          labelAr: 'الكل',
          sort: 0,
          active: true,
          browseOnly: true,
          writeEnabled: false,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.makeup.bridal',
          parentId: 'beauty.makeup',
          labelAr: 'مكياج عروس',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.hair',
          parentId: 'beauty.salons',
          labelAr: 'الشعر',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
      ],
      definitionsVersion: 'beauty-place-1',
      lane: 'beauty',
    );
    final gateway = _RecordingGateway();
    final screenKey = GlobalKey<DiscoverPresentationScreenState>();

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        locale: const Locale('ar'),
        builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
        home: DiscoverPresentationScreen(
          key: screenKey,
          lane: DiscoverLane.beauty,
          gateway: gateway,
          favorites: _NoopFavorites(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('في موقعك'), findsWidgets);
    await tester.tap(find.text('في موقعك').first);
    await tester.pumpAndSettle();
    expect(gateway.queries.last.placeModes, contains('home'));

    await tester.tap(find.text('صالونات ومختصّات').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('المكياج').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('الكل').first);
    await tester.pumpAndSettle();
    final q = gateway.queries.last;
    expect(q.placeModes, contains('home'), reason: '«الكل» must keep في موقعك in the request');
    expect(q.lane, DiscoverLane.beauty);
  });
}
