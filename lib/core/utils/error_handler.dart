import 'package:logger/logger.dart';

/// أداة مركزية لمعالجة الأخطاء في التطبيق
class ErrorHandler {
  static final Logger _logger = Logger();

  static void handleError(dynamic error, {StackTrace? stackTrace}) {
    // تسجيل الخطأ باستخدام Logger
    _logger.e('Error: $error', error: error, stackTrace: stackTrace);
    // يمكنك هنا ربط Crashlytics أو أي خدمة أخرى لتسجيل الأخطاء في الإنتاج
    // مثال:
    // FirebaseCrashlytics.instance.recordError(error, stackTrace);
  }
}
