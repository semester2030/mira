import 'dart:async';

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
    final product = CatalogProduct(
      id: 'p-evening',
      partnerId: 'brand-1',
      partnerNameAr: 'علامة',
      nameAr: 'فستان سهرة تجريبي',
      nameEn: 'Evening',
      priceHalalas: 10000,
      priceLabel: '100',
      priceKnown: true,
      externalUrl: 'https://example.test/e',
      matchScore: 0,
      matchKnown: false,
      category: 'clothes',
      concernTags: const [],
      media: const [
        CatalogMediaLink(kind: 'image', url: 'assets/marketplace/discover/thumbs/product_clothes.jpg'),
      ],
    );
    final matchSub = query.subcategoryId == null || query.subcategoryId == 'clothes.evening';
    final matchCat = query.categoryId == null || query.categoryId == 'all' || query.categoryId == 'clothes';
    final items = (matchCat && matchSub)
        ? [DiscoverOffer.product(product, city: 'الرياض')]
        : <DiscoverOffer>[];
    return DiscoverBrowseResponse(
      failed: false,
      transport: CatalogTransport.server,
      contentMark: ContentMark.unmarked,
      items: items,
      cities: const ['الرياض'],
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
          id: 'elegance.all',
          labelAr: 'الكل',
          sort: 0,
          active: true,
          browseOnly: true,
          writeEnabled: false,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'clothes',
          labelAr: 'الملابس',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: ['clothes.all', 'clothes.abaya', 'clothes.evening', 'clothes.wedding_dress'],
        ),
        EleganceTaxonomyNode(
          id: 'clothes.all',
          parentId: 'clothes',
          labelAr: 'الكل',
          sort: 0,
          active: true,
          browseOnly: true,
          writeEnabled: false,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'clothes.abaya',
          parentId: 'clothes',
          labelAr: 'عبايات',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'clothes.evening',
          parentId: 'clothes',
          labelAr: 'فساتين سهرة',
          sort: 30,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'clothes.wedding_dress',
          parentId: 'clothes',
          labelAr: 'فساتين زفاف',
          sort: 10,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'bags',
          labelAr: 'الشنط',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: false,
          children: [],
        ),
      ],
      definitionsVersion: 'widget-1',
    );
  });

  tearDown(EleganceTaxonomySource.clearCache);

  testWidgets('tap clothes → subcategory → results → back → clear keeps rail/query synced', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final gateway = _RecordingGateway();

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        locale: const Locale('ar'),
        builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
        home: DiscoverPresentationScreen(
          lane: DiscoverLane.elegance,
          gateway: gateway,
          favorites: _NoopFavorites(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('الملابس'), findsWidgets);
    await tester.tap(find.text('الملابس').last);
    await tester.pumpAndSettle();

    // Rail replaced with subtypes + رجوع.
    expect(find.text('رجوع'), findsOneWidget);
    expect(find.text('عبايات'), findsOneWidget);
    expect(find.text('فساتين سهرة'), findsOneWidget);
    expect(find.text('فساتين زفاف'), findsOneWidget);

    await tester.tap(find.text('فساتين سهرة'));
    await tester.pumpAndSettle();
    expect(find.text('فستان سهرة تجريبي'), findsOneWidget);
    expect(
      gateway.queries.any((q) => q.categoryId == 'clothes' && q.subcategoryId == 'clothes.evening'),
      isTrue,
    );

    await tester.tap(find.text('رجوع'));
    await tester.pumpAndSettle();
    expect(find.text('رجوع'), findsNothing);
    expect(find.text('الملابس'), findsWidgets);
    expect(find.text('الشنط'), findsWidgets);

    // Drill again → empty subcategory → empty-state clear must reset rail + query.
    await tester.tap(find.text('الملابس').last);
    await tester.pumpAndSettle();
    expect(find.text('رجوع'), findsOneWidget);
    await tester.tap(find.text('عبايات'));
    await tester.pumpAndSettle();
    expect(find.text('فستان سهرة تجريبي'), findsNothing);
    expect(find.text('مسح البحث والفلاتر'), findsOneWidget);
    await tester.tap(find.text('مسح البحث والفلاتر'));
    await tester.pumpAndSettle();
    expect(find.text('رجوع'), findsNothing);
    expect(find.text('الملابس'), findsWidgets);
    expect(
      gateway.queries.last.categoryId == null || gateway.queries.last.categoryId == 'all',
      isTrue,
    );
    expect(gateway.queries.last.subcategoryId, isNull);
  });
}
