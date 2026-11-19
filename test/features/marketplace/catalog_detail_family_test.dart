import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/domain/catalog_detail_family.dart';

void main() {
  group('CatalogDetailFamilyResolver', () {
    test('old dress with category clothes and null profile uses fashion', () {
      expect(
        CatalogDetailFamilyResolver.resolve(category: 'clothes', subcategory: null, profileId: null),
        CatalogDetailFamily.fashion,
      );
    });

    test('ring taxonomy uses jewelry even without attributes', () {
      expect(
        CatalogDetailFamilyResolver.resolve(
          category: 'jewelry',
          subcategory: 'jewelry.rings',
          profileId: 'product.jewelry',
        ),
        CatalogDetailFamily.jewelry,
      );
    });

    test('unknown category stays generic', () {
      expect(
        CatalogDetailFamilyResolver.resolve(category: 'face', subcategory: 'face.moisturizer', profileId: 'product.face'),
        CatalogDetailFamily.generic,
      );
    });

    test('certificate absent is honest', () {
      expect(CatalogDetailFamilyResolver.hasCertificate(const {}, null), isFalse);
      expect(CatalogDetailFamilyResolver.hasCertificate(const {'certificate': 'https://x'}, null), isTrue);
    });
  });
}
