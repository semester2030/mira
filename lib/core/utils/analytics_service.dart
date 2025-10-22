/// واجهة خدمة التحليلات العامة في التطبيق
abstract class AnalyticsService {
  /// تسجيل حدث عام
  Future<void> logEvent(String name, {Map<String, dynamic>? parameters});

  /// تسجيل خطأ
  Future<void> logError(String error, {StackTrace? stackTrace});
}
