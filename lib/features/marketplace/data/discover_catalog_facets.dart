/// Server facet buckets for discover filters (ids are stable; labels are display-only).
class DiscoverFacetBucket {
  const DiscoverFacetBucket({
    required this.id,
    required this.count,
    this.labelAr,
    this.swatchHex,
  });

  final String id;
  final int count;
  final String? labelAr;
  final String? swatchHex;

  String get displayLabel => (labelAr != null && labelAr!.trim().isNotEmpty) ? labelAr! : id;

  factory DiscoverFacetBucket.fromJson(Map<String, dynamic> json) {
    return DiscoverFacetBucket(
      id: json['id']?.toString() ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
      labelAr: json['labelAr'] as String?,
      swatchHex: json['swatchHex'] as String?,
    );
  }
}

class DiscoverStaleSelection {
  const DiscoverStaleSelection({required this.field, required this.value});

  final String field;
  final String value;

  factory DiscoverStaleSelection.fromJson(Map<String, dynamic> json) {
    return DiscoverStaleSelection(
      field: json['field']?.toString() ?? '',
      value: json['value']?.toString() ?? '',
    );
  }
}

class DiscoverCatalogFacets {
  const DiscoverCatalogFacets({
    this.concern = const [],
    this.category = const [],
    this.city = const [],
    this.colors = const [],
    this.sizes = const [],
    this.placeMode = const [],
    this.branch = const [],
    this.staleSelections = const [],
  });

  final List<DiscoverFacetBucket> concern;
  final List<DiscoverFacetBucket> category;
  final List<DiscoverFacetBucket> city;
  final List<DiscoverFacetBucket> colors;
  final List<DiscoverFacetBucket> sizes;
  final List<DiscoverFacetBucket> placeMode;
  final List<DiscoverFacetBucket> branch;
  final List<DiscoverStaleSelection> staleSelections;

  static const empty = DiscoverCatalogFacets();

  factory DiscoverCatalogFacets.fromJson(Map<String, dynamic>? json) {
    if (json == null) return empty;
    List<DiscoverFacetBucket> list(String key) {
      final raw = json[key];
      if (raw is! List) return const [];
      return [
        for (final item in raw)
          if (item is Map) DiscoverFacetBucket.fromJson(Map<String, dynamic>.from(item)),
      ].where((b) => b.id.isNotEmpty).toList();
    }

    final staleRaw = json['staleSelections'];
    final stale = <DiscoverStaleSelection>[];
    if (staleRaw is List) {
      for (final item in staleRaw) {
        if (item is Map) stale.add(DiscoverStaleSelection.fromJson(Map<String, dynamic>.from(item)));
      }
    }

    return DiscoverCatalogFacets(
      concern: list('concern'),
      category: list('category'),
      city: list('city'),
      colors: list('variant.color'),
      sizes: list('variant.size'),
      placeMode: list('placeMode'),
      branch: list('branch'),
      staleSelections: stale,
    );
  }
}
