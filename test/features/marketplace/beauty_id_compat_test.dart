import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/beauty_id_compat.dart';

void main() {
  test('legacyBeautyCategoryFor maps taxonomy mids and leaves', () {
    expect(legacyBeautyCategoryFor('beauty.hair'), 'hair');
    expect(legacyBeautyCategoryFor('beauty.hair.color'), 'hair');
    expect(legacyBeautyCategoryFor('beauty.clinic.laser'), 'laser');
    expect(legacyBeautyCategoryFor('beauty.clinic.laser.hair'), 'laser');
    expect(legacyBeautyCategoryFor('hair'), 'hair');
    expect(legacyBeautyCategoryFor('spa'), 'spa');
  });

  test('beautyCategoriesEquivalent bridges legacy and mid', () {
    expect(beautyCategoriesEquivalent('hair', 'beauty.hair'), isTrue);
    expect(beautyCategoriesEquivalent('beauty.hair.color', 'hair'), isTrue);
    expect(beautyCategoriesEquivalent('beauty.makeup', 'nails'), isFalse);
  });

  test('isBeautyTaxonomyLeafId rejects venue roots', () {
    expect(isBeautyTaxonomyLeafId('beauty.hair.color'), isTrue);
    expect(isBeautyTaxonomyLeafId('beauty.hair'), isFalse);
    expect(isBeautyTaxonomyLeafId('beauty.salons'), isFalse);
  });
}
