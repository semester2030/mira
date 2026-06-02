import 'package:dio/dio.dart';

import 'firebase_error_message.dart';

String friendlyMiraError(Object error) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'انتهت مهلة الاتصال بخادم ميرا. تأكدي أن السيرفر يعمل وأن الجوال على نفس الشبكة.';
      case DioExceptionType.connectionError:
        return 'تعذر الوصول لخادم ميرا. على الآيفون استخدمي IP الماك بدل localhost، وتأكدي أن npm run start:dev يعمل.';
      case DioExceptionType.badResponse:
        break;
      default:
        break;
    }

    final status = error.response?.statusCode;
    final data = error.response?.data;
    if (status == 401) {
      return 'انتهت جلسة الدخول. سجّلي خروجًا ثم دخولًا مرة أخرى.';
    }
    if (status == 403) {
      final msg = _extractMessage(data);
      if (msg != null && msg.isNotEmpty) return msg;
      return 'وصلتِ للحد المجاني. اشتركي في ميرا بريميوم للتحليل بدون حدود.';
    }
    if (status == 429) {
      return 'طلبات كثيرة — انتظري قليلًا ثم أعيدي المحاولة.';
    }
    if (status != null && status >= 500) {
      final msg = _extractMessage(data);
      if (msg != null && msg.isNotEmpty) {
        return 'خطأ في الخادم: $msg';
      }
      return 'خطأ في خادم ميرا ($status). تحققي من تشغيل PostgreSQL و mira-api.';
    }
  }
  return friendlyFirebaseError(error);
}

String? _extractMessage(dynamic data) {
  if (data is! Map) return null;
  final message = data['message'];
  if (message is String) return message;
  if (message is List && message.isNotEmpty) {
    return message.first.toString();
  }
  return null;
}
