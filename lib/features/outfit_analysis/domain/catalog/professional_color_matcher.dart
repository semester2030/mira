import 'dart:math' as math;

import 'fashion_catalog_types.dart';
import 'fashion_color_library.dart';
import 'fashion_color_library_data.dart';

/// Perceptual garment color match — CIEDE2000 + illuminant correction.
class ProfessionalColorMatch {
  final String id;
  final String nameAr;
  final String displayNameAr;
  final String hex;
  final double deltaE;
  final double confidence;
  final String matchTierAr;
  final String shadeAr;

  const ProfessionalColorMatch({
    required this.id,
    required this.nameAr,
    required this.displayNameAr,
    required this.hex,
    required this.deltaE,
    required this.confidence,
    required this.matchTierAr,
    required this.shadeAr,
  });

  /// Backward-compatible short Arabic label.
  String get labelAr => displayNameAr;
}

abstract final class ProfessionalColorMatcher {
  ProfessionalColorMatcher._();

  static const _degToRad = math.pi / 180;

  /// Match sRGB pixel to nearest catalog swatch (professional path).
  static ProfessionalColorMatch matchRgb(
    int r,
    int g,
    int b, {
    double whiteBalanceStrength = 0.55,
    double? avgR,
    double? avgG,
    double? avgB,
  }) {
    final corrected = _applyGrayWorld(
      r,
      g,
      b,
      avgR: avgR,
      avgG: avgG,
      avgB: avgB,
      strength: whiteBalanceStrength,
    );
    final lab = rgbToLab(corrected[0], corrected[1], corrected[2]);

    FashionColorEntry? best;
    var bestDe = double.infinity;

    for (final entry in colorEntries.values) {
      if (entry.lab.length < 3) continue;
      final de = deltaE2000(lab, entry.lab);
      if (de < bestDe) {
        bestDe = de;
        best = entry;
      }
    }

    if (best == null) {
      return ProfessionalColorMatch(
        id: 'unknown',
        nameAr: 'مختلط',
        displayNameAr: 'مختلط',
        hex: '#888888',
        deltaE: 99,
        confidence: 0.35,
        matchTierAr: 'تقريبي',
        shadeAr: 'متوسط',
      );
    }

    final shade = _shadeFromLab(lab, best.lab);
    final tier = _tierFromDeltaE(bestDe);
    final confidence = _confidenceFromDeltaE(bestDe);

    return ProfessionalColorMatch(
      id: best.id,
      nameAr: best.nameAr,
      displayNameAr: '${best.nameAr} $shade',
      hex: best.hex,
      deltaE: bestDe,
      confidence: confidence,
      matchTierAr: tier,
      shadeAr: shade,
    );
  }

  /// Batch-correct samples using garment-region gray-world averages.
  static List<int> grayWorldCorrectPixel(
    int r,
    int g,
    int b, {
    required double avgR,
    required double avgG,
    required double avgB,
    double strength = 0.55,
  }) {
    return _applyGrayWorld(r, g, b, avgR: avgR, avgG: avgG, avgB: avgB, strength: strength);
  }

  static bool isSpecularHighlight(int r, int g, int b) {
    final lum = r * 0.299 + g * 0.587 + b * 0.114;
    final maxC = math.max(r, math.max(g, b));
    final minC = math.min(r, math.min(g, b));
    final spread = maxC - minC;
    if (lum > 225 && spread < 28) return true;
    if (lum > 200 && spread < 14) return true;
    return false;
  }

  static List<double> rgbToLab(int r, int g, int b) {
    double linearize(int c) {
      final v = c / 255.0;
      return v <= 0.04045 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
    }

    final rl = linearize(r);
    final gl = linearize(g);
    final bl = linearize(b);

    final x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
    final y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
    final z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

    double f(double t) => t > 0.008856 ? math.pow(t, 1 / 3).toDouble() : (7.787 * t) + (16 / 116);

    const xn = 0.95047;
    const yn = 1.0;
    const zn = 1.08883;

    final fx = f(x / xn);
    final fy = f(y / yn);
    final fz = f(z / zn);

    return [
      (116 * fy) - 16,
      500 * (fx - fy),
      200 * (fy - fz),
    ];
  }

  /// CIEDE2000 color difference (Sharma et al.).
  static double deltaE2000(List<double> lab1, List<double> lab2) {
    if (lab1.length < 3 || lab2.length < 3) return 999;

    final l1 = lab1[0];
    final a1 = lab1[1];
    final b1 = lab1[2];
    final l2 = lab2[0];
    final a2 = lab2[1];
    final b2 = lab2[2];

    final avgL = (l1 + l2) * 0.5;
    final c1 = math.sqrt(a1 * a1 + b1 * b1);
    final c2 = math.sqrt(a2 * a2 + b2 * b2);
    final avgC = (c1 + c2) * 0.5;

    final g = 0.5 * (1 - math.sqrt(math.pow(avgC, 7) / (math.pow(avgC, 7) + math.pow(25, 7))));

    final a1p = (1 + g) * a1;
    final a2p = (1 + g) * a2;

    final c1p = math.sqrt(a1p * a1p + b1 * b1);
    final c2p = math.sqrt(a2p * a2p + b2 * b2);
    final avgCp = (c1p + c2p) * 0.5;

    var h1p = math.atan2(b1, a1p) * 180 / math.pi;
    if (h1p < 0) h1p += 360;
    var h2p = math.atan2(b2, a2p) * 180 / math.pi;
    if (h2p < 0) h2p += 360;

    var deltahp = h2p - h1p;
    if (deltahp > 180) deltahp -= 360;
    if (deltahp < -180) deltahp += 360;

    final deltaLp = l2 - l1;
    final deltaCp = c2p - c1p;
  final deltaHp = 2 * math.sqrt(c1p * c2p) * math.sin((deltahp * _degToRad) / 2);

    var avgHp = (h1p + h2p) * 0.5;
    if ((h1p - h2p).abs() > 180) {
      avgHp += h1p + h2p < 360 ? 180 : -180;
    }

    final t = 1 -
        0.17 * math.cos((avgHp - 30) * _degToRad) +
        0.24 * math.cos((2 * avgHp) * _degToRad) +
        0.32 * math.cos((3 * avgHp + 6) * _degToRad) -
        0.20 * math.cos((4 * avgHp - 63) * _degToRad);

    final sl = 1 + (0.015 * math.pow(avgL - 50, 2)) / math.sqrt(20 + math.pow(avgL - 50, 2));
    final sc = 1 + 0.045 * avgCp;
    final sh = 1 + 0.015 * avgCp * t;

    final deltaTheta = 30 * math.exp(-math.pow((avgHp - 275) / 25, 2));
    final rc = 2 * math.sqrt(math.pow(avgCp, 7) / (math.pow(avgCp, 7) + math.pow(25, 7)));
    final rt = -rc * math.sin(2 * deltaTheta * _degToRad);

    final kl = 1.0;
    final kc = 1.0;
    final kh = 1.0;

    final termL = deltaLp / (kl * sl);
    final termC = deltaCp / (kc * sc);
    final termH = deltaHp / (kh * sh);

    return math.sqrt(termL * termL + termC * termC + termH * termH + rt * termC * termH);
  }

  static List<int> _applyGrayWorld(
    int r,
    int g,
    int b, {
    double? avgR,
    double? avgG,
    double? avgB,
    double strength = 0.55,
  }) {
    if (avgR == null || avgG == null || avgB == null) {
      return [r, g, b];
    }
    final gray = (avgR + avgG + avgB) / 3;
    if (avgR < 8 || avgG < 8 || avgB < 8) return [r, g, b];

    final sr = 1 + (gray / avgR - 1) * strength;
    final sg = 1 + (gray / avgG - 1) * strength;
    final sb = 1 + (gray / avgB - 1) * strength;

    int clamp(int v) => v.clamp(0, 255);
    return [
      clamp((r * sr).round()),
      clamp((g * sg).round()),
      clamp((b * sb).round()),
    ];
  }

  static String _shadeFromLab(List<double> detected, List<double> reference) {
    final dl = detected[0] - reference[0];
    if (dl > 14) return 'أفتح من المرجع';
    if (dl > 6) return 'فاتح';
    if (dl < -14) return 'أغمق من المرجع';
    if (dl < -6) return 'غامق';
    return 'متوسط';
  }

  static String _tierFromDeltaE(double de) {
    if (de < 2.5) return 'تطابق دقيق';
    if (de < 5) return 'تطابق عالٍ';
    if (de < 10) return 'تطابق جيد';
    if (de < 18) return 'قريب';
    return 'تقريبي';
  }

  static double _confidenceFromDeltaE(double de) {
    if (de < 2.5) return 0.98;
    if (de < 5) return 0.93;
    if (de < 10) return 0.86;
    if (de < 18) return 0.72;
    if (de < 28) return 0.58;
    return 0.42;
  }

  /// Display color from catalog id or Arabic name.
  static String hexForName(String nameAr) {
    final entry = FashionColorLibrary.byName(nameAr);
    return entry?.hex ?? '#9E9E9E';
  }
}
