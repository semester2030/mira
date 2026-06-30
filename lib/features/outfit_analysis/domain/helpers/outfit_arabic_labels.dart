/// Arabic labels for fashion UI — no English leakage in user-facing copy.
abstract final class OutfitArabicLabels {
  OutfitArabicLabels._();

  static String styleTag(String raw) {
    final key = raw.trim().toLowerCase().replaceAll(' ', '_');
    return switch (key) {
      'classic' || 'كلاسيك' => 'كلاسيكي',
      'formal' || 'رسمي' => 'رسمي',
      'casual' || 'كاجوال' => 'كاجوال',
      'wedding' || 'زفاف' => 'زفاف',
      'evening' || 'سهرة' => 'سهرة',
      'business' || 'مهني' => 'مهني',
      'quiet_luxury' || 'old_money' => 'رفاهية هادئة',
      'minimal' || 'مينimal' => 'بسيط',
      'resort' => 'منتجع',
      'travel' => 'سفر',
      _ => raw.contains(RegExp(r'[ء-ي]')) ? raw : 'أنيق',
    };
  }

  static String undertonePhrase(String undertoneAr) => 'تدرج البشرة $undertoneAr';

  static String skinHarmonyLine(String undertoneAr, int score) =>
      '${undertonePhrase(undertoneAr)} · توافق $score%';

  static String pieceCompatibilityLine(int compatibility, int confidence) =>
      'توافق القطعة $compatibility% · ثقة $confidence%';

  static String luxuryScoreLine(int score) => 'درجة فخامة $score';

  static String colorHarmonyEvidence(int percent) => 'تناغم لوني: $percent%';

  static String knowledgeGraphMatch() => 'مطابقة دليل الأناقة';

  static String trend2026() => 'ترند 2026';

  static String humanizeEngineCopy(String raw) {
    var text = raw;
    text = text.replaceAll(RegExp(r'\bundertone\b', caseSensitive: false), 'تدرج البشرة');
    text = text.replaceAll('Undertone', 'تدرج البشرة');
    text = text.replaceAll('lookك', 'إطلالتك');
    text = text.replaceAll('Quiet Luxury', 'رفاهية هادئة');
    text = text.replaceAll('Knowledge Graph', 'دليل الأناقة');
    text = text.replaceAll('Luxury Score', 'درجة فخامة');
    return text;
  }

  static String garmentLabel(String raw) {
    final lower = raw.trim().toLowerCase();
    if (lower == 'top') return 'القطعة العلوية';
    if (lower.contains('top') && !lower.contains('stop')) return 'القطعة العلوية';
    return raw;
  }
}
