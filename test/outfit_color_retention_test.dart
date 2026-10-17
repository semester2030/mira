import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/data/mappers/outfit_history_reader.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/fashion_color_names.dart';

void main() {
  test('ontology color ids stay visible instead of being dropped', () {
    expect(FashionColorNames.arabic('blue_light'), 'أزرق فاتح');
    expect(FashionColorNames.arabic('navy_deep'), 'كحلي غامق');
    expect(FashionColorNames.arabic('blue_light'), isNot('أسود'));
  });

  test('catalog name replaces the token label when loaded', () {
    FashionColorNames.useCatalog({'blue_light': 'أزرق فاتح'});
    expect(FashionColorNames.arabic('blue_light'), 'أزرق فاتح');
    FashionColorNames.useCatalog(const {});
  });

  test('history reads a vision snapshot and a legacy row', () {
    final snapshot = OutfitHistoryReader.read({
      'id': '11111111-1111-1111-1111-111111111111',
      'createdAt': '2026-10-16T10:00:00.000Z',
      'occasionId': 'eid',
      'outfit': {
        'source': 'vision_platform',
        'intelligence': {
          'clothingTypeAr': 'فستان',
          'dominantColorsAr': ['أزرق فاتح'],
          'occasionId': 'eid',
        },
      },
    });
    expect(snapshot?.garmentType, 'فستان');
    expect(snapshot?.dominantColors, ['أزرق فاتح']);
    expect(snapshot?.createdAt?.year, 2026);

    final legacy = OutfitHistoryReader.read({
      'id': '22222222-2222-2222-2222-222222222222',
      'occasionId': 'eid',
      'outfit': {
        'garmentTypeAr': 'فستان',
        'dominantColors': ['كحلي'],
        'compatibilityScore': 80,
      },
    });
    expect(legacy?.dominantColors, ['كحلي']);
    expect(legacy?.compatibilityScore, 80);
  });

  test('a history row without garment or color is skipped', () {
    expect(OutfitHistoryReader.read({'outfit': {'source': 'vision_platform'}}), isNull);
  });
}
