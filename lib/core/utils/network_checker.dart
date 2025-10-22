import 'dart:io';

/// أداة لفحص الاتصال بالإنترنت
class NetworkChecker {
  /// التحقق من وجود اتصال بالإنترنت (ping إلى google)
  static Future<bool> hasConnection() async {
    try {
      final result = await InternetAddress.lookup('google.com');
      return result.isNotEmpty && result[0].rawAddress.isNotEmpty;
    } catch (_) {
      return false;
    }
  }
}
