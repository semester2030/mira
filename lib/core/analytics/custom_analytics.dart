/// واجهة تحليلات مخصصة (Custom Analytics)
abstract class CustomAnalyticsService {
  /// تسجيل حدث مخصص
  Future<void> logCustomEvent(String name, {Map<String, dynamic>? parameters});

  /// تسجيل خطأ مخصص
  Future<void> logError(String error, {StackTrace? stackTrace});
}
