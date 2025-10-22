/// إعدادات التطبيق العامة (بيئة العمل، مفاتيح API، ...)
class AppConfig {
  final String environment;
  final String apiKey;
  final String baseUrl;

  static AppConfig? _instance;

  AppConfig._({
    required this.environment,
    required this.apiKey,
    required this.baseUrl,
  });

  /// تهيئة الإعدادات (يجب استدعاؤها مرة واحدة فقط)
  static void initialize({
    required String environment,
    required String apiKey,
    required String baseUrl,
  }) {
    _instance = AppConfig._(
      environment: environment,
      apiKey: apiKey,
      baseUrl: baseUrl,
    );
  }

  /// الحصول على الإعدادات الحالية
  static AppConfig get instance {
    if (_instance == null) {
      throw Exception('AppConfig is not initialized!');
    }
    return _instance!;
  }
}
