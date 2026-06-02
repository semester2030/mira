/// مستوى المستخدمة — يُحسب تلقائياً من نقاط التميز (لا يُعدَّل يدوياً).
abstract final class UserLevel {
  UserLevel._();

  static const int advancedThreshold = 100;
  static const int expertThreshold = 200;
  static const int masterThreshold = 400;

  static String fromPoints(int points) {
    if (points >= masterThreshold) return 'خبيرة ميرا';
    if (points >= expertThreshold) return 'محترفة';
    if (points >= advancedThreshold) return 'متقدمة';
    return 'مبتدئة';
  }

  /// تقدّم المستوى الحالي نحو التالي (0–1).
  static double progressToNext(int points) {
    if (points >= masterThreshold) return 1;
    if (points >= expertThreshold) {
      return ((points - expertThreshold) / (masterThreshold - expertThreshold)).clamp(0.0, 1.0);
    }
    if (points >= advancedThreshold) {
      return ((points - advancedThreshold) / (expertThreshold - advancedThreshold)).clamp(0.0, 1.0);
    }
    return (points / advancedThreshold).clamp(0.0, 1.0);
  }
}
