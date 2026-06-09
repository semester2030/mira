class ConfidenceItem {
  final String id;
  final String labelAr;
  final String level;
  final String reasonAr;

  const ConfidenceItem({
    required this.id,
    required this.labelAr,
    required this.level,
    required this.reasonAr,
  });
}

class ConfidenceLayer {
  final bool enabled;
  final String headlineAr;
  final String summaryAr;
  final List<ConfidenceItem> items;

  const ConfidenceLayer({
    required this.enabled,
    required this.headlineAr,
    required this.summaryAr,
    required this.items,
  });

  static const empty = ConfidenceLayer(
    enabled: false,
    headlineAr: '',
    summaryAr: '',
    items: [],
  );

  ConfidenceItem? itemFor(String id) {
    for (final item in items) {
      if (item.id == id) return item;
    }
    return null;
  }
}
