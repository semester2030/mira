import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_taxonomy_filters.dart';
import 'package:mirra/features/marketplace/data/elegance_taxonomy_source.dart';

void main() {
  tearDown(EleganceTaxonomySource.clearCache);

  test('keepingOnlyFilterKeys drops jewelry metal when switching to beauty keys', () {
    const q = DiscoverCatalogQuery(
      lane: DiscoverLane.jewelry,
      metals: ['gold'],
      colors: ['black'],
      placeModes: ['home'],
    );
    final trimmed = DiscoverTaxonomyFilters.keepingOnlyFilterKeys(q, {'variant.color'});
    expect(trimmed.metals, isEmpty);
    expect(trimmed.colors, ['black']);
    expect(trimmed.placeModes, isEmpty);
  });

  test('scopedToTaxonomyBranch uses lane defaults for occasions', () {
    const q = DiscoverCatalogQuery(
      lane: DiscoverLane.occasions,
      occasionTypeIds: ['graduation'],
      metals: ['gold'],
    );
    final scoped = q.scopedToTaxonomyBranch();
    expect(scoped.occasionTypeIds, ['graduation']);
    expect(scoped.metals, isEmpty);
  });

  test('offerKind parsed from taxonomy node', () {
    EleganceTaxonomySource.replaceForTest(
      [
        const EleganceTaxonomyNode(
          id: 'occasions.styling',
          labelAr: 'تنسيق',
          sort: 0,
          active: true,
          browseOnly: false,
          writeEnabled: true,
          offerKind: 'service',
        ),
      ],
      lane: 'occasions',
      partnerAudience: true,
    );
    expect(DiscoverTaxonomyFilters.offerKindForSubcategory('occasions.styling'), 'service');
  });
}
