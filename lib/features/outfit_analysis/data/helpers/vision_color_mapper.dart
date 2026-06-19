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
    if (lower.contains('blouse') || lower.contains('shirt')) return 'بلوزة';
    if (lower.contains('pants') || lower.contains('trouser') || lower.contains('jean')) {
      return 'بنطلون';
    }
    if (lower.contains('jacket') || lower.contains('coat')) return 'جاكيت';
    if (lower.contains('bag') || lower.contains('handbag')) return 'حقيبة';
    if (lower.contains('shoe') || lower.contains('heel')) return 'حذاء';
    if (lower.contains('scarf')) return 'وشاح';
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
}
