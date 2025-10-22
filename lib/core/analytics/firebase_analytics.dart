/// واجهة تحليلات Firebase Analytics
abstract class FirebaseAnalyticsService {
  /// تسجيل حدث (Event)
  Future<void> logEvent(String name, {Map<String, dynamic>? parameters});

  /// تسجيل دخول مستخدم
  Future<void> logLogin({String? method});

  /// تسجيل خروج مستخدم
  Future<void> logLogout();
}

/// يمكنك لاحقًا تنفيذ هذه الواجهة باستخدام مكتبة firebase_analytics
