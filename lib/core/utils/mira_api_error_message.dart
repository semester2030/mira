import 'package:dio/dio.dart';

import 'firebase_error_message.dart';

String friendlyMiraError(Object error) {
  if (error is DioException) {
    final status = error.response?.statusCode;
    final data = error.response?.data;
    if (status == 403) {
      final msg = _extractMessage(data);
      if (msg != null && msg.isNotEmpty) return msg;
      return 'وصلتِ للحد المجاني. اشتركي في ميرا بريميوم للتحليل بدون حدود.';
    }
    if (status == 429) {
      return 'طلبات كثيرة — انتظري قليلًا ثم أعيدي المحاولة.';
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
