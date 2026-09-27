/// Outfit–occasion fit labels — never framed as beauty / body judgment (Law #37).
abstract final class FashionCompatibilityLabel {
  FashionCompatibilityLabel._();

  static String fromScore(num score) {
    final s = score.round();
    if (s >= 85) return 'توافق مرتفع مع هذه الإطلالة';
    if (s >= 70) return 'توافق جيد مع هذه الإطلالة';
    if (s >= 55) return 'توافق مقبول — يمكن تحسينه';
    return 'يحتاج تنسيقاً أفضل لهذه المناسبة';
  }

  /// Compact sticky-bar form.
  static String compact(num score) {
    final s = score.round();
    if (s >= 85) return 'توافق مرتفع';
    if (s >= 70) return 'توافق جيد';
    if (s >= 55) return 'توافق مقبول';
    return 'يحتاج تنسيقاً';
  }
}
