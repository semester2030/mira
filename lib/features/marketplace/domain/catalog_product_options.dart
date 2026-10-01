/// Product choice groups (size / color / volume) and available combinations.
class CatalogOptionValue {
  const CatalogOptionValue({
    required this.id,
    required this.labelAr,
    this.swatchHex,
    this.imageUrl,
    this.amount,
    this.unit,
  });

  final String id;
  final String labelAr;
  final String? swatchHex;
  final String? imageUrl;
  final int? amount;
  final String? unit;

  String get displayLabel {
    if (amount != null && unit != null && unit!.isNotEmpty) return '$amount $unit';
    return labelAr;
  }
}

class CatalogOptionGroup {
  const CatalogOptionGroup({
    required this.id,
    required this.labelAr,
    required this.kind,
    required this.values,
  });

  final String id;
  final String labelAr;

  /// size | color | volume | finish
  final String kind;
  final List<CatalogOptionValue> values;
}

/// One sellable combination. Missing keys mean the group is not part of this row.
class CatalogProductVariant {
  const CatalogProductVariant({
    required this.id,
    required this.selections,
    this.priceHalalas,
    this.available = true,
    this.imageUrl,
  });

  final String id;

  /// optionGroupId → optionValueId
  final Map<String, String> selections;
  final int? priceHalalas;
  final bool available;
  final String? imageUrl;
}

/// Resolves which values stay available after partial selections.
abstract final class CatalogOptionMatrix {
  static Set<String> availableValueIds({
    required CatalogOptionGroup group,
    required List<CatalogProductVariant> variants,
    required Map<String, String> selected,
  }) {
    if (variants.isEmpty) {
      return group.values.map((value) => value.id).toSet();
    }
    final ids = <String>{};
    for (final variant in variants) {
      if (!variant.available) continue;
      var matches = true;
      for (final entry in selected.entries) {
        if (entry.key == group.id) continue;
        final wanted = variant.selections[entry.key];
        if (wanted != null && wanted != entry.value) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
      final valueId = variant.selections[group.id];
      if (valueId != null) ids.add(valueId);
    }
    return ids;
  }

  static CatalogProductVariant? match({
    required List<CatalogProductVariant> variants,
    required Map<String, String> selected,
  }) {
    for (final variant in variants) {
      if (variant.selections.length != selected.length) continue;
      var ok = true;
      for (final entry in selected.entries) {
        if (variant.selections[entry.key] != entry.value) {
          ok = false;
          break;
        }
      }
      if (ok) return variant;
    }
    return null;
  }

  /// Drops selections that are no longer available after a change.
  /// When [preferGroupId] is set, that group's value is kept and conflicting
  /// other groups are cleared (e.g. color change invalidates size).
  static Map<String, String> sanitize({
    required List<CatalogOptionGroup> groups,
    required List<CatalogProductVariant> variants,
    required Map<String, String> selected,
    String? preferGroupId,
  }) {
    final next = Map<String, String>.from(selected);
    if (preferGroupId != null && next.containsKey(preferGroupId)) {
      final preferred = {preferGroupId: next[preferGroupId]!};
      for (final group in groups) {
        if (group.id == preferGroupId) continue;
        final current = next[group.id];
        if (current == null) continue;
        final allowed = availableValueIds(group: group, variants: variants, selected: preferred);
        if (!allowed.contains(current)) next.remove(group.id);
      }
      return next;
    }
    var changed = true;
    while (changed) {
      changed = false;
      for (final group in groups) {
        final current = next[group.id];
        if (current == null) continue;
        final allowed = availableValueIds(group: group, variants: variants, selected: next);
        if (!allowed.contains(current)) {
          next.remove(group.id);
          changed = true;
        }
      }
    }
    return next;
  }
}

/// Reads the server `optionsJson` / `variantsJson` columns. Bad rows are dropped, never guessed.
abstract final class CatalogOptionJson {
  static const _kinds = {'size', 'color', 'volume', 'finish'};

  static List<CatalogOptionGroup> groups(Object? raw) {
    if (raw is! List) return const [];
    final out = <CatalogOptionGroup>[];
    for (final item in raw) {
      if (item is! Map) continue;
      final id = item['id'];
      if (id is! String || id.isEmpty) continue;
      final values = <CatalogOptionValue>[];
      final rawValues = item['values'];
      if (rawValues is List) {
        for (final value in rawValues) {
          if (value is! Map) continue;
          final valueId = value['id'];
          if (valueId is! String || valueId.isEmpty) continue;
          values.add(
            CatalogOptionValue(
              id: valueId,
              labelAr: value['labelAr'] is String ? value['labelAr'] as String : valueId,
              swatchHex: value['swatchHex'] as String?,
              imageUrl: value['imageUrl'] as String?,
              amount: (value['amount'] as num?)?.toInt(),
              unit: value['unit'] as String?,
            ),
          );
        }
      }
      if (values.isEmpty) continue;
      final kind = item['kind'];
      out.add(
        CatalogOptionGroup(
          id: id,
          labelAr: item['labelAr'] is String ? item['labelAr'] as String : id,
          kind: kind is String && _kinds.contains(kind) ? kind : (_kinds.contains(id) ? id : 'size'),
          values: values,
        ),
      );
    }
    return out;
  }

  static List<CatalogProductVariant> variants(Object? raw) {
    if (raw is! List) return const [];
    final out = <CatalogProductVariant>[];
    for (final item in raw) {
      if (item is! Map) continue;
      final id = item['id'];
      final selections = item['selections'];
      if (id is! String || id.isEmpty || selections is! Map) continue;
      final price = item['priceHalalas'];
      out.add(
        CatalogProductVariant(
          id: id,
          selections: {
            for (final entry in selections.entries)
              if (entry.key is String && entry.value is String) entry.key as String: entry.value as String,
          },
          priceHalalas: price is int ? price : null,
          available: item['available'] != false,
          imageUrl: item['imageUrl'] as String?,
        ),
      );
    }
    return out;
  }

  /// First group the customer has not chosen yet, or null when every group has a value.
  static CatalogOptionGroup? firstMissing({
    required List<CatalogOptionGroup> groups,
    required Map<String, String> selected,
  }) {
    for (final group in groups) {
      final value = selected[group.id];
      if (value == null || !group.values.any((item) => item.id == value)) return group;
    }
    return null;
  }
}
