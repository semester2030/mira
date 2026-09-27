/// Safe JSON → display/label string coercion for wire formats that may send
/// numbers where the public contract documents strings.
abstract final class JsonAsString {
  JsonAsString._();

  /// Coerce JSON scalar to a display string. Null stays null.
  /// Numbers become their decimal representation (canonical for cited values).
  static String? optional(dynamic value) {
    if (value == null) return null;
    if (value is String) return value;
    if (value is num || value is bool) return value.toString();
    return value.toString();
  }

  static String required(dynamic value, {String fallback = ''}) =>
      optional(value) ?? fallback;

  /// Map API confidence that may be `'high'|'medium'|'low'` **or** a 0–1 / 0–100
  /// numeric score into the Advisor/MCE confidence label vocabulary.
  static String confidenceLabel(
    dynamic value, {
    String fallback = 'medium',
  }) {
    if (value == null) return fallback;
    if (value is String) {
      final v = value.trim().toLowerCase();
      if (v == 'high' || v == 'medium' || v == 'low') return v;
      if (v.isEmpty) return fallback;
      return v;
    }
    if (value is num) {
      final n = value.toDouble();
      final score = n <= 1.0 ? n : (n / 100.0).clamp(0.0, 1.0);
      if (score >= 0.75) return 'high';
      if (score >= 0.45) return 'medium';
      return 'low';
    }
    return fallback;
  }
}
