import 'package:dio/dio.dart';

import '../exceptions/vision_platform_exception.dart';
import '../face_gate/face_gate_exception.dart';
import 'firebase_error_message.dart';

String friendlyMiraError(Object error) {
  if (error is VisionPlatformException) {
    return error.userMessageAr ?? error.message;
  }
  if (error is FaceGateException) {
    return error.messageAr;
  }
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
    if (status == 400) {
      final msg = _localizeServerMessage(_extractMessage(data));
      if (msg != null && msg.isNotEmpty) return msg;
      return 'تعذر تحليل الصورة — تأكدي من وضوح الوجه وقرب الكاميرا.';
    }
    if (status == 422) {
      final code = _extractCode(data);
      if (code == 'QEL_REJECTED') {
        return 'لم نعرض النتيجة — التعديل غيّر الهوية أو خامة القماش. جرّبي لوناً آخر أو صورة أوضح.';
      }
      final msg = _localizeServerMessage(_extractMessage(data));
      if (msg != null && msg.isNotEmpty) return msg;
      return 'تعذّر قبول النتيجة — جرّبي لوناً آخر أو صورة أوضح.';
    }
    if (status == 429) {
      return 'طلبات كثيرة — انتظري قليلًا ثم أعيدي المحاولة.';
    }
    if (status == 503) {
      final msg = _localizeServerMessage(_extractMessage(data));
      if (msg != null && msg.isNotEmpty) return msg;
      return 'الخدمة غير متاحة حالياً — حاولي لاحقاً.';
    }
    if (status == 502) {
      final msg = _localizeServerMessage(_extractMessage(data));
      if (msg != null && msg.isNotEmpty) return msg;
      return 'تعذّر إكمال المعالجة — جرّبي مجدداً أو صورة أوضح.';
    }
    if (status != null && status >= 500) {
      final msg = _localizeServerMessage(_extractMessage(data));
      if (msg != null && msg.isNotEmpty) return msg;
      return 'خطأ في خادم ميرا ($status). تحققي من إعدادات Render (Perfect Corp و Firebase).';
    }
  }
  return friendlyFirebaseError(error);
}

String? _extractMessage(dynamic data) {
  if (data is! Map) return null;
  final message = data['message'];
  if (message is String) return message;
  if (message is Map) {
    final nested = message['message'];
    if (nested is String) return nested;
  }
  if (message is List && message.isNotEmpty) {
    return message.first.toString();
  }
  return null;
}

String? _extractCode(dynamic data) {
  if (data is! Map) return null;
  final code = data['code'];
  if (code is String) return code;
  if (code is Map) {
    final nested = code['code'];
    if (nested is String) return nested;
  }
  return null;
}

String? _localizeServerMessage(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  final lower = raw.toLowerCase();
  if (lower.contains('error_src_face_too_small') || lower.contains('face_too_small')) {
    return 'تعذر تحليل الصورة — أعيدي التقاط صورة أقرب مع إضاءة أمامية.';
  }
  if (lower.contains('no_face') ||
      lower.contains('face_not') ||
      lower.contains('error_src_no_face') ||
      lower.contains('face_detection')) {
    return 'لم نتعرف على وجه — التقطي selfie واضح وثبّتي وجهك في منتصف الإطار.';
  }
  if (lower.contains('face_gate')) {
    return raw;
  }
  if (lower.contains('error_lighting_dark') || lower.contains('lighting_dark')) {
    return 'الإضاءة ضعيفة — انتقلي لمكان أفضل ثم أعيدي المحاولة.';
  }
  if (lower.contains('youcam task timed out')) {
    return 'انتهت مهلة تحليل YouCam — أعيدي المحاولة بعد دقيقة.';
  }
  if (lower.contains('youcam skin analysis failed')) {
    return 'فشل تحليل البشرة عبر YouCam. تحققي من PERFECT_API_KEY على Render '
        'أو فعّلي PERFECT_CORP_FALLBACK_MOCK=true مؤقتاً.';
  }
  if (lower.contains('perfect corp api key is not configured')) {
    return 'مفتاح Perfect Corp غير مضبوط على السيرفر (PERFECT_API_KEY).';
  }
  if (lower.contains('qel_rejected') || lower.contains('لم نعرض النتيجة')) {
    return 'لم نعرض النتيجة — التعديل غيّر الهوية أو خامة القماش. جرّبي لوناً آخر أو صورة أوضح.';
  }
  if (lower.contains('openai semantic provider failed') ||
      lower.contains('openai semantics failed') ||
      lower.contains('invalid schema for response_format')) {
    return 'تعذّر تحليل الإطلالة — جاري تحديث السيرفر. أعيدي المحاولة بعد دقائق.';
  }
  if (lower.contains('fashn_not_configured') || lower.contains('غير متاحة حاليا')) {
    return 'خدمة إعادة التلوين غير مفعّلة على السيرفر — تواصلي مع الدعم.';
  }
  if (lower.contains('garment_recolor_failed') || lower.contains('إعادة تلوين')) {
    return raw;
  }
  if (lower.contains('internal server error')) {
    return 'خطأ داخلي في السيرفر — راجعي سجلات Render لمزيد من التفاصيل.';
  }
  return raw;
}
