import 'dart:math' as math;

import '../catalog/fashion_catalog_types.dart';
import '../catalog/fashion_color_library.dart';

/// Phase 18 — color theory beyond Delta-E.
enum ColorHarmonyType {
  complementary,
  analogous,
  splitComplementary,
  monochromatic,
  triadic,
  tetradic,
}

abstract final class FashionColorHarmonyEngine {
  FashionColorHarmonyEngine._();

  static double scorePaletteHarmony(List<FashionColorEntry> colors) {
    if (colors.length < 2) return colors.isEmpty ? 0 : 70;
    var best = 0.0;
    for (var i = 0; i < colors.length; i++) {
      for (var j = i + 1; j < colors.length; j++) {
        best = math.max(best, scorePair(colors[i], colors[j]));
      }
    }
    return best;
  }

  static double scorePair(FashionColorEntry a, FashionColorEntry b) {
    final ha = _hue(a);
    final hb = _hue(b);
    final diff = _hueDiff(ha, hb);

    final scores = <ColorHarmonyType, double>{
      ColorHarmonyType.complementary: _bell(diff, 180, 25),
      ColorHarmonyType.analogous: _bell(diff, 30, 20),
      ColorHarmonyType.splitComplementary: math.max(_bell(diff, 150, 20), _bell(diff, 210, 20)),
      ColorHarmonyType.monochromatic: _monochromeScore(a, b),
      ColorHarmonyType.triadic: math.max(_bell(diff, 120, 18), _bell(diff, 240, 18)),
      ColorHarmonyType.tetradic: math.max(_bell(diff, 90, 15), _bell(diff, 270, 15)),
    };

    return scores.values.reduce(math.max).clamp(0, 100);
  }

  static ColorHarmonyType bestHarmonyType(FashionColorEntry a, FashionColorEntry b) {
    final ha = _hue(a);
    final hb = _hue(b);
    final diff = _hueDiff(ha, hb);

    final scores = {
      ColorHarmonyType.complementary: _bell(diff, 180, 25),
      ColorHarmonyType.analogous: _bell(diff, 30, 20),
      ColorHarmonyType.splitComplementary: math.max(_bell(diff, 150, 20), _bell(diff, 210, 20)),
      ColorHarmonyType.monochromatic: _monochromeScore(a, b),
      ColorHarmonyType.triadic: math.max(_bell(diff, 120, 18), _bell(diff, 240, 18)),
      ColorHarmonyType.tetradic: math.max(_bell(diff, 90, 15), _bell(diff, 270, 15)),
    };

    return scores.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
  }

  static String harmonyLabelAr(ColorHarmonyType type) => switch (type) {
        ColorHarmonyType.complementary => 'ألوان متكاملة',
        ColorHarmonyType.analogous => 'ألوان متجاورة',
        ColorHarmonyType.splitComplementary => 'متكاملة منقسمة',
        ColorHarmonyType.monochromatic => 'أحادية اللون',
        ColorHarmonyType.triadic => 'ثلاثية',
        ColorHarmonyType.tetradic => 'رباعية',
      };

  static double scorePieceAgainstPalette({
    required String? colorId,
    required String? secondaryColorId,
    required List<String> palette,
  }) {
    final primary = colorId != null ? FashionColorLibrary.byId(colorId) : null;
    if (primary == null || palette.isEmpty) return 0;

    var best = 0.0;
    for (final swatch in palette) {
      final detected = FashionColorLibrary.byName(swatch);
      if (detected == null) continue;
      best = math.max(best, scorePair(primary, detected));
    }

    final secondary = secondaryColorId != null ? FashionColorLibrary.byId(secondaryColorId) : null;
    if (secondary != null) {
      for (final swatch in palette) {
        final detected = FashionColorLibrary.byName(swatch);
        if (detected == null) continue;
        best = math.max(best, scorePair(secondary, detected) * 0.85);
      }
    }
    return best;
  }

  static double _hue(FashionColorEntry c) => c.hsv.isNotEmpty ? c.hsv[0] : 0;

  static double _hueDiff(double a, double b) {
    final d = (a - b).abs();
    return d > 180 ? 360 - d : d;
  }

  static double _bell(double value, double center, double width) {
    final d = (value - center).abs();
    if (d > width) return 0;
    return (100 * (1 - d / width)).clamp(0, 100);
  }

  static double _monochromeScore(FashionColorEntry a, FashionColorEntry b) {
    if (a.hsv.length < 3 || b.hsv.length < 3) {
      return FashionColorLibrary.deltaE(a.lab, b.lab) < 25 ? 88 : 0;
    }
    final hueDiff = _hueDiff(a.hsv[0], b.hsv[0]);
    if (hueDiff > 15) return 0;
    final satDiff = (a.hsv[1] - b.hsv[1]).abs();
    final valDiff = (a.hsv[2] - b.hsv[2]).abs();
    return (90 - satDiff * 0.3 - valDiff * 0.2).clamp(0, 100);
  }
}
