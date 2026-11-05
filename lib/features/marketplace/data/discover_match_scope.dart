/// Discover match-scope for product variants.
///
/// - [matchedVariantIds] == null → unrestricted (browse / no filter match context).
/// - non-null (including empty) → match scope from filters; never silently expand to all variants.
class DiscoverMatchScope {
  const DiscoverMatchScope._();

  /// Whether the match scope is active (filters produced a match context).
  static bool isActive(List<String>? matchedVariantIds) => matchedVariantIds != null;

  /// True when a match scope was required but no listed variants remain on the product.
  static bool matchesGone({
    required List<String>? matchedVariantIds,
    required Iterable<String> variantIds,
  }) {
    if (matchedVariantIds == null) return false;
    if (matchedVariantIds.isEmpty) return true;
    final allowed = matchedVariantIds.toSet();
    return !variantIds.any(allowed.contains);
  }

  /// Variants visible under the match scope. Empty when matches are gone.
  static List<T> filterVariants<T>({
    required List<String>? matchedVariantIds,
    required List<T> variants,
    required String Function(T) idOf,
  }) {
    if (matchedVariantIds == null) return variants;
    if (matchedVariantIds.isEmpty) return const [];
    final allowed = matchedVariantIds.toSet();
    return variants.where((v) => allowed.contains(idOf(v))).toList();
  }
}
