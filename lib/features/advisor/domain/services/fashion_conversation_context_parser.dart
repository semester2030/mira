/// AT-3 — Extract ONLY explicit conversational preference / culture tokens.
/// Never infers Saudi from Arabic locale or location.
abstract final class FashionConversationContextParser {
  static const _boldPatterns = [
    'جريء',
    'جريئة',
    'الجريء',
    'الجريئة',
    'bold',
    'statement',
  ];

  static const _minimalPatterns = [
    'هادئ',
    'هادئة',
    'minimal',
    'بسيط',
    'هادئة',
  ];

  static const _formalPatterns = [
    'رسمي',
    'رسمية',
    'formal',
  ];

  /// Explicit cultural phrases only.
  static const _culturalExplicit = {
    'زواج سعودي': 'saudi_wedding',
    'عرس سعودي': 'saudi_wedding',
    'مناسبة سعودية': 'saudi_event',
    'خليجي': 'gulf',
    'سعودي صريح': 'saudi_explicit',
  };

  static List<String> preferenceTokensFromMessage(String message) {
    final lower = message.toLowerCase();
    final out = <String>{};
    for (final p in _boldPatterns) {
      if (lower.contains(p.toLowerCase())) out.add('bold');
    }
    for (final p in _minimalPatterns) {
      if (lower.contains(p.toLowerCase())) out.add('minimal');
    }
    for (final p in _formalPatterns) {
      if (lower.contains(p.toLowerCase())) out.add('formal');
    }
    return out.toList(growable: false);
  }

  static String? styleGoalFromMessage(String message) {
    final prefs = preferenceTokensFromMessage(message);
    if (prefs.contains('bold')) return 'statement look';
    if (prefs.contains('minimal')) return 'calmer look';
    if (prefs.contains('formal')) return 'more formal';
    return null;
  }

  /// Returns cultural token only for explicit phrases — never from locale alone.
  static String? explicitCulturalContext(String message) {
    final trimmed = message.trim();
    for (final entry in _culturalExplicit.entries) {
      if (trimmed.contains(entry.key)) return entry.value;
    }
    return null;
  }

  /// Arabic locale alone must never populate cultural context.
  static String? culturalFromLocaleAlone(String locale) {
    // Intentionally always null — Law #38.
    return null;
  }

  static String? occasionFromMessage(String message) {
    final m = message.toLowerCase();
    if (m.contains('زفاف') || m.contains('زواج') || m.contains('wedding')) {
      // Only if not already handled as cultural — occasion may still be wedding
      return 'wedding';
    }
    if (m.contains('عمل') || m.contains('work')) return 'work';
    if (m.contains('سهرة') || m.contains('evening')) return 'evening';
    if (m.contains('كاجوال') || m.contains('casual')) return 'casual';
    return null;
  }

  static String? dressCodeFromMessage(String message) {
    final m = message.toLowerCase();
    if (m.contains('مساء ورسمي') ||
        (m.contains('رسمي') && m.contains('مساء'))) {
      return 'evening_formal';
    }
    if (m.contains('رسمي') || m.contains('formal')) return 'formal';
    if (m.contains('كاجوال') || m.contains('casual')) return 'casual';
    return null;
  }
}
