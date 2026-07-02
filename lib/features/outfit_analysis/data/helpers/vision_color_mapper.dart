import 'package:flutter/material.dart';

import '../../domain/catalog/fashion_color_library.dart';
import '../../domain/catalog/professional_color_matcher.dart';

/// Maps garment pixels to professional catalog colors (CIEDE2000).
abstract final class VisionColorMapper {
  VisionColorMapper._();

  static String fromRgb(double r, double g, double b) {
    return fromRgbInt(
      (r * 255).round(),
      (g * 255).round(),
      (b * 255).round(),
    );
  }

  static String fromRgbInt(int r, int g, int b) {
    return matchRgbInt(r, g, b).displayNameAr;
  }

  static ProfessionalColorMatch matchRgbInt(
    int r,
    int g,
    int b, {
    double? avgR,
    double? avgG,
    double? avgB,
  }) {
    return ProfessionalColorMatcher.matchRgb(
      r,
      g,
      b,
      avgR: avgR,
      avgG: avgG,
      avgB: avgB,
    );
  }

  static String labelToArabic(String enLabel) {
    final lower = enLabel.toLowerCase();
    if (lower.contains('dress')) return 'فستان';
    if (lower.contains('abaya')) return 'عباءة';
    if (lower.contains('suit')) return 'بدلة';
    if (lower.contains('skirt')) return 'تنورة';
    if (lower.contains('t-shirt') || lower.contains('tee')) return 'تيشيرت';
    if (lower.contains('blouse')) return 'بلوزة';
    if (lower.contains('top') && !lower.contains('stop')) return 'قطعة علوية';
    if (lower.contains('blazer')) return 'بلوزر';
    if (lower.contains('corset')) return 'كورسيه';
    if (lower.contains('cape')) return 'كاب';
    if (lower.contains('gown')) return 'فستان';
    if (lower.contains('shirt')) return 'قميص';
    if (lower.contains('sweater') || lower.contains('hoodie')) return 'كنزة';
    if (lower.contains('pants') || lower.contains('trouser') || lower.contains('jean')) {
      return 'بنطلون';
    }
    if (lower.contains('jacket') || lower.contains('coat')) return 'جاكيت';
    if (lower.contains('bag') || lower.contains('handbag')) return 'حقيبة';
    if (lower.contains('shoe') || lower.contains('heel') || lower.contains('boot')) {
      return 'حذاء';
    }
    if (lower.contains('watch')) return 'ساعة';
    if (lower.contains('sunglass') || lower.contains('glasses')) return 'نظارة';
    if (lower.contains('scarf')) return 'وشاح';
    if (lower.contains('belt')) return 'حزام';
    if (lower.contains('necklace')) return 'عقد';
    if (lower.contains('jewelry') || lower.contains('earring')) return 'إكسسوار';
    if (lower.contains('formal')) return 'رسمي';
    if (lower.contains('casual')) return 'كاجوال';
    if (lower.contains('elegant')) return 'أنيق';
    if (lower.contains('classic')) return 'كلاسيكي';
    if (lower.contains('silk')) return 'حرير';
    if (lower.contains('denim')) return 'دنيم';
    if (lower.contains('leather')) return 'جلد';
    return enLabel;
  }

  /// Arabic fashion color name → display swatch color.
  static Color toDisplayColor(String arabicName) {
    final entry = FashionColorLibrary.byName(arabicName);
    if (entry != null) return entry.color;

    final hex = ProfessionalColorMatcher.hexForName(arabicName);
    final h = hex.replaceFirst('#', '');
    if (h.length == 6) {
      return Color(int.parse('FF$h', radix: 16));
    }
    return const Color(0xFFC19EE0);
  }

  static Color hexToColor(String hex) {
    final h = hex.replaceFirst('#', '');
    return Color(int.parse('FF$h', radix: 16));
  }
}
