import 'dart:math' as math;

import 'fashion_catalog_types.dart';
import 'fashion_color_library_data.dart';

/// Perceptual color matching via hex / LAB / HSV library.
abstract final class FashionColorLibrary {
  FashionColorLibrary._();

  static FashionColorEntry? byId(String id) => colorEntries[id];

  static FashionColorEntry? byName(String name) {
    final n = name.toLowerCase();
    for (final e in colorEntries.values) {
      if (e.name.toLowerCase() == n || e.nameAr == name) return e;
    }
    return null;
  }

  /// Delta-E (CIE76) between two LAB colors.
  static double deltaE(List<double> a, List<double> b) {
    if (a.length < 3 || b.length < 3) return 999;
    final dl = a[0] - b[0];
    final da = a[1] - b[1];
    final db = a[2] - b[2];
    return math.sqrt(dl * dl + da * da + db * db);
  }

  /// Score 0–18 for how well piece colors match detected palette.
  static double paletteMatchScore({
    required String? colorId,
    required String? secondaryColorId,
    required String fallbackHex,
    required List<String> palette,
  }) {
    if (palette.isEmpty) return 0;

    final primary = colorId != null ? byId(colorId) : null;
    final secondary = secondaryColorId != null ? byId(secondaryColorId) : null;
    var best = 0.0;

    for (final swatch in palette) {
      final detected = byName(swatch);
      if (detected == null) {
        if (_fuzzyNameMatch(swatch, primary) || _fuzzyNameMatch(swatch, secondary)) {
          best = best < 12 ? 12 : best;
        }
        continue;
      }
      if (primary != null) {
        final d = deltaE(detected.lab, primary.lab);
        if (d < 18) best = best < 18 ? 18 : best;
        else if (d < 35) best = best < 12 ? 12 : best;
        else if (d < 50) best = best < 6 ? 6 : best;
      }
      if (secondary != null) {
        final d = deltaE(detected.lab, secondary.lab);
        if (d < 25) best = best < 10 ? 10 : best;
      }
    }

    if (best == 0 && fallbackHex.isNotEmpty) {
      for (final swatch in palette) {
        if (swatch.toLowerCase().contains('بيج') && fallbackHex.contains('D4') ||
            fallbackHex.contains('E8')) {
          best = 8;
        }
      }
    }
    return best;
  }

  static bool _fuzzyNameMatch(String swatch, FashionColorEntry? entry) {
    if (entry == null) return false;
    final s = swatch.toLowerCase();
    return s.contains(entry.name) ||
        s.contains(entry.nameAr) ||
        entry.nameAr.contains(swatch);
  }
}
