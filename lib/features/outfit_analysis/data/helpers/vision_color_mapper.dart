import 'package:flutter/material.dart';

/// Maps Google Vision color channels to Arabic fashion color names.
abstract final class VisionColorMapper {
  VisionColorMapper._();

  static String fromRgb(double r, double g, double b) {
    final ri = (r * 255).round();
    final gi = (g * 255).round();
    final bi = (b * 255).round();

    const candidates = <(String, int, int, int)>[
      ('أسود', 20, 20, 20),
      ('أبيض', 245, 245, 245),
      ('بيج', 210, 190, 160),
      ('كريمي', 235, 225, 200),
      ('رمادي', 128, 128, 128),
      ('كحلي', 25, 40, 80),
      ('أزرق', 40, 80, 180),
      ('زيتوني', 100, 110, 60),
      ('ذهبي', 200, 170, 80),
      ('وردي', 230, 150, 170),
      ('أحمر', 180, 40, 50),
      ('نبيتي', 120, 20, 40),
      ('بني', 120, 80, 50),
      ('فضي', 190, 190, 200),
      ('تركواز', 60, 170, 170),
      ('مرجاني', 240, 120, 100),
    ];

    var best = 'مختلط';
    var bestDist = 1 << 30;
    for (final c in candidates) {
      final d = (ri - c.$2) * (ri - c.$2) +
          (gi - c.$3) * (gi - c.$3) +
          (bi - c.$4) * (bi - c.$4);
      if (d < bestDist) {
        bestDist = d;
        best = c.$1;
      }
    }
    return best;
  }

  static String labelToArabic(String enLabel) {
    final lower = enLabel.toLowerCase();
    if (lower.contains('dress')) return 'فستان';
    if (lower.contains('abaya')) return 'عباءة';
    if (lower.contains('suit')) return 'بدلة';
    if (lower.contains('skirt')) return 'تنورة';
    if (lower.contains('t-shirt') || lower.contains('tee')) return 'تيشيرت';
    if (lower.contains('blouse')) return 'بلوزة';
    if (lower == 'top' || lower.endsWith(' top')) return 'قطعة علوية';
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
    return switch (arabicName.trim()) {
      'أسود' => const Color(0xFF1A1A1A),
      'أبيض' => const Color(0xFFF5F5F5),
      'بيج' => const Color(0xFFD2BEA0),
      'كريمي' => const Color(0xFFEBE0C8),
      'رمادي' => const Color(0xFF9E9E9E),
      'كحلي' => const Color(0xFF1A2848),
      'أزرق' => const Color(0xFF3F51B5),
      'زيتوني' => const Color(0xFF6B7040),
      'ذهبي' => const Color(0xFFC8A850),
      'وردي' => const Color(0xFFE699B0),
      'أحمر' => const Color(0xFFB42832),
      'نبيتي' => const Color(0xFF781828),
      'بني' => const Color(0xFF785032),
      'فضي' => const Color(0xFFBEBEC8),
      'تركواز' => const Color(0xFF3CAAA0),
      'مرجاني' => const Color(0xFFF07864),
      'دنيم' => const Color(0xFF5B7FA8),
      _ => const Color(0xFFC19EE0),
    };
  }
}
