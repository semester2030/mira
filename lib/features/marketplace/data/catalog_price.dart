/// Turns stored halalas into the riyal text shown in Discover.
abstract final class CatalogPrice {
  static String formatHalalas(int halalas) {
    final sign = halalas < 0 ? '-' : '';
    final abs = halalas.abs();
    final riyals = abs ~/ 100;
    final fraction = abs % 100;
    final body = fraction == 0 ? '$riyals' : '$riyals.${fraction.toString().padLeft(2, '0')}';
    return '$sign$body ر.س';
  }

  /// Missing key and null are unknown. A non-numeric value is unknown and is not turned into zero.
  static ({int halalas, bool known}) read(Map<String, dynamic> json, {String key = 'priceHalalas'}) {
    if (!json.containsKey(key) || json[key] == null) return (halalas: 0, known: false);
    final raw = json[key];
    if (raw is! num || raw.isNaN) return (halalas: 0, known: false);
    return (halalas: raw.toInt(), known: true);
  }

  /// A missing price stays missing. Zero is shown only when the value is known.
  static String text({required bool known, required int halalas}) {
    if (!known) return 'السعر غير متوفر';
    return formatHalalas(halalas);
  }
}
