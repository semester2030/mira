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
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
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
    final makeup = DiscoverOffer.service(
      const CatalogService(
        id: 'svc-makeup',
        partnerId: 'salon-1',
        partnerNameAr: 'صالون',
        partnerType: 'salon',
        city: 'جدة',
        nameAr: 'مكياج زيارة',
        nameEn: 'Makeup',
        durationMin: 60,
        priceHalalas: 25000,
        priceLabel: '250',
        priceKnown: true,
        matchScore: 0,
        matchKnown: false,
        category: 'makeup',
        bookingEnabled: true,
        concernTags: [],
        media: [
          CatalogMediaLink(kind: 'video', url: 'assets/marketplace/discover/thumbs/product_clothes.jpg'),
        ],
      ),
    );
    final items = <DiscoverOffer>[];
    if (query.partnerType == 'salon' || query.categoryId == 'makeup') {
      items.add(makeup);
    }
    return DiscoverBrowseResponse(
      failed: false,
      transport: CatalogTransport.server,
      contentMark: ContentMark.unmarked,
      items: items,
      cities: const ['جدة'],
      facets: const DiscoverCatalogFacets(),
      totalMatched: items.length,
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
          id: 'beauty',
          labelAr: 'جمالك',
          sort: 0,
          active: true,
          browseOnly: false,
          writeEnabled: false,
          children: ['beauty.home_visit', 'beauty.salons', 'beauty.clinics'],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.home_visit',
          parentId: 'beauty',
          labelAr: 'في موقعك',
          sort: 5,
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
          children: ['beauty.hair', 'beauty.makeup'],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.clinics',
          parentId: 'beauty',
          labelAr: 'عيادات',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: false,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.hair',
          parentId: 'beauty.salons',
          labelAr: 'الشعر',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: ['beauty.hair.color', 'beauty.hair.blowdry'],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.hair.color',
          parentId: 'beauty.hair',
          labelAr: 'صبغة',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.hair.blowdry',
          parentId: 'beauty.hair',
          labelAr: 'استشوار',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.makeup',
          parentId: 'beauty.salons',
          labelAr: 'المكياج',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: ['beauty.makeup.soft', 'beauty.makeup.evening'],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.makeup.soft',
          parentId: 'beauty.makeup',
          labelAr: 'ناعم',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'beauty.makeup.evening',
          parentId: 'beauty.makeup',
          labelAr: 'سهرة',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
      ],
      definitionsVersion: 'beauty-back-1',
      lane: 'beauty',
    );
  });

  tearDown(EleganceTaxonomySource.clearCache);

  testWidgets('رجوع from المكياج climbs one level to صالونات — not جمالك root', (tester) async {
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
          lane: DiscoverLane.beauty,
          gateway: gateway,
          favorites: _NoopFavorites(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('صالونات ومختصّات'), findsWidgets);
    await tester.tap(find.text('صالونات ومختصّات').last);
    await tester.pumpAndSettle();
    expect(screenKey.currentState!.debugEleganceDrillParentId, 'beauty.salons');
    expect(find.text('رجوع'), findsOneWidget);
    expect(screenKey.currentState!.debugRailIds, contains('beauty.makeup'));

    await tester.tap(find.text('المكياج').last);
    await tester.pumpAndSettle();
    expect(
      screenKey.currentState!.debugEleganceDrillParentId,
      'beauty.makeup',
      reason: 'mid beauty node must drill; rail=${screenKey.currentState!.debugRailIds}',
    );
    expect(screenKey.currentState!.debugRailIds, contains('beauty.makeup.soft'));

    await tester.tap(find.text('رجوع'));
    await tester.pumpAndSettle();

    expect(screenKey.currentState!.debugEleganceDrillParentId, 'beauty.salons');
    expect(find.text('رجوع'), findsOneWidget);
    expect(screenKey.currentState!.debugRailIds, containsAll(['beauty.makeup', 'beauty.hair']));
    // Must NOT eject to lane root (في موقعك / عيادات).
    expect(screenKey.currentState!.debugRailIds, isNot(contains('beauty.home_visit')));
    expect(screenKey.currentState!.debugRailIds, isNot(contains('beauty.clinics')));
    expect(gateway.queries.last.partnerType, 'salon');
  });
}
