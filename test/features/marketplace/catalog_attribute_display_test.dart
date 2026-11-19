import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/domain/catalog_attribute_display.dart';

void main() {
  test('maps jewelry wire enums to Arabic customer rows', () {
    final rows = CatalogAttributeDisplay.rows({
      'metal': 'gold',
      'metalColor': 'white',
      'sellUnit': 'set',
      'purityKarat': '21',
      'fulfillmentReady': 'ready',
      'discoveryTraits': 'x',
    });
    final byLabel = {for (final r in rows) r.labelAr: r.valueAr};
    expect(byLabel['المعدن'], 'ذهب');
    expect(byLabel['لون المعدن'], 'أبيض');
    expect(byLabel['وحدة البيع'], 'طقم');
    expect(byLabel['العيار'], '٢١ قيراط');
    expect(byLabel.containsKey('fulfillmentReady'), isFalse);
    expect(rows.any((r) => r.labelAr.contains('fulfillment') || r.valueAr.contains('ready')), isFalse);
  });

  test('category clothes becomes Arabic fashion label', () {
    expect(CatalogAttributeDisplay.categoryLabelAr('clothes'), 'أزياء');
    expect(CatalogAttributeDisplay.categoryLabelAr('clothes', subcategory: 'clothes.wedding'), 'فساتين زفاف');
    expect(CatalogAttributeDisplay.categoryLabelAr('jewelry', subcategory: 'jewelry.rings'), 'خواتم');
  });
}
