import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_category_assets.dart';

void main() {
  tearDown(EleganceTaxonomySource.clearCache);

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
          imageKey: 'elegance.clothes',
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
          imageKey: 'elegance.bags',
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'shoes',
          labelAr: 'الأحذية',
          sort: 30,
          active: true,
          browseOnly: false,
          writeEnabled: false,
          imageKey: 'elegance.shoes',
          children: [],
        ),
      ],
      definitionsVersion: 'drill-1',
    );
  });

  test('pressing clothes exposes subcategory circle ids from taxonomy (not labels alone)', () {
    final roots = DiscoverCatalogQueryEngine.forFamily('elegance');
    expect(roots.map((e) => e.id), containsAll(['all', 'clothes', 'bags', 'shoes']));
    final kids = EleganceTaxonomySource.childrenOf('clothes');
    expect(kids.map((e) => e.id).toList(), [
      'clothes.all',
      'clothes.abaya',
      'clothes.evening',
      'clothes.wedding_dress',
    ]);
    expect(kids.every((e) => e.parentId == 'clothes'), isTrue);
    expect(kids.firstWhere((e) => e.id == 'clothes.abaya').label, 'عبايات');
    expect(kids.firstWhere((e) => e.id == 'clothes.wedding_dress').label, 'فساتين زفاف');
  });

  test('bags/shoes browse assets resolve by id to dedicated thumbs', () {
    expect(
      DiscoverCategoryAssets.thumbFor(family: 'elegance', id: 'bags', label: 'الشنط'),
      'assets/marketplace/discover/thumbs/product_bags.png',
    );
    expect(
      DiscoverCategoryAssets.thumbFor(family: 'elegance', id: 'shoes', label: 'الأحذية'),
      'assets/marketplace/discover/thumbs/product_shoes.png',
    );
    expect(
      DiscoverCategoryAssets.thumbFor(family: 'elegance', id: 'clothes.abaya', label: 'عبايات'),
      'assets/marketplace/discover/thumbs/clothes_abaya.png',
    );
  });

  test('subcategory query field is distinct from root categoryId', () {
    const q = DiscoverCatalogQuery(
      lane: DiscoverLane.elegance,
      categoryId: 'clothes',
      subcategoryId: 'clothes.abaya',
    );
    expect(q.categoryId, 'clothes');
    expect(q.subcategoryId, 'clothes.abaya');
    expect(q.activeFilterCount >= 2, isTrue);
    final cleared = q.copyWith(clearSubcategory: true);
    expect(cleared.subcategoryId, isNull);
    expect(cleared.categoryId, 'clothes');
  });
}
