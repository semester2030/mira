import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_match_scope.dart';

void main() {
  test('null matched ids means unrestricted browse', () {
    expect(DiscoverMatchScope.isActive(null), isFalse);
    expect(DiscoverMatchScope.matchesGone(matchedVariantIds: null, variantIds: ['a']), isFalse);
    expect(
      DiscoverMatchScope.filterVariants(
        matchedVariantIds: null,
        variants: ['a', 'b'],
        idOf: (s) => s,
      ),
      ['a', 'b'],
    );
  });

  test('empty matched ids means matches gone — never expand to all', () {
    expect(DiscoverMatchScope.isActive(const []), isTrue);
    expect(DiscoverMatchScope.matchesGone(matchedVariantIds: const [], variantIds: ['a', 'b']), isTrue);
    expect(
      DiscoverMatchScope.filterVariants(
        matchedVariantIds: const [],
        variants: ['a', 'b'],
        idOf: (s) => s,
      ),
      isEmpty,
    );
  });

  test('stale matched ids with no overlap means matches gone', () {
    expect(
      DiscoverMatchScope.matchesGone(matchedVariantIds: const ['gone'], variantIds: ['a', 'b']),
      isTrue,
    );
    expect(
      DiscoverMatchScope.filterVariants(
        matchedVariantIds: const ['gone'],
        variants: ['a', 'b'],
        idOf: (s) => s,
      ),
      isEmpty,
    );
  });

  test('multi-match keeps only listed variants', () {
    expect(
      DiscoverMatchScope.filterVariants(
        matchedVariantIds: const ['b', 'c'],
        variants: ['a', 'b', 'c', 'd'],
        idOf: (s) => s,
      ),
      ['b', 'c'],
    );
    expect(
      DiscoverMatchScope.matchesGone(matchedVariantIds: const ['b'], variantIds: ['a', 'b']),
      isFalse,
    );
  });
}
