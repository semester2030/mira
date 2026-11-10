import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';

void main() {
  tearDown(EleganceTaxonomySource.clearCache);

  test('eleganceRoots maps API nodes to DiscoverCategoryDef with E4 bags/shoes write', () {
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
          children: ['clothes.abaya'],
        ),
        EleganceTaxonomyNode(
          id: 'bags',
          labelAr: 'الشنط',
          sort: 20,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
        EleganceTaxonomyNode(
          id: 'shoes',
          labelAr: 'الأحذية',
          sort: 30,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          children: [],
        ),
      ],
      definitionsVersion: '1',
    );

    final roots = DiscoverCatalogQueryEngine.forFamily('elegance');
    expect(roots.map((e) => e.id).toList(), ['all', 'clothes', 'bags', 'shoes']);
    expect(roots.firstWhere((e) => e.id == 'bags').writeEnabled, isTrue);
    expect(roots.firstWhere((e) => e.id == 'shoes').writeEnabled, isTrue);
    expect(roots.firstWhere((e) => e.id == 'clothes').writeEnabled, isTrue);
    expect(roots.first.matchesAll, isTrue);
  });

  test('childrenOf returns subcategory circles for clothes', () {
    EleganceTaxonomySource.replaceForTest(const [
      EleganceTaxonomyNode(
        id: 'clothes',
        labelAr: 'الملابس',
        sort: 10,
        active: true,
        browseOnly: false,
        writeEnabled: true,
        children: ['clothes.all', 'clothes.abaya'],
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
    ]);
    final kids = EleganceTaxonomySource.childrenOf('clothes');
    expect(kids.map((e) => e.id).toList(), ['clothes.all', 'clothes.abaya']);
    expect(kids.first.browseOnly, isTrue);
  });
}
