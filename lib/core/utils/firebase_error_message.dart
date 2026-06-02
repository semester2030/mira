import 'package:firebase_auth/firebase_auth.dart';

String friendlyFirebaseError(Object error) {
  if (error is FirebaseException && error is! FirebaseAuthException) {
    switch (error.code) {
      case 'permission-denied':
        return 'صلاحيات قاعدة البيانات غير مفعّلة. تأكدي من تسجيل الدخول ثم أعيدي المحاولة.';
      case 'unavailable':
      case 'deadline-exceeded':
        return 'تعذر الاتصال بقاعدة البيانات. تحققي من الإنترنت وأعيدي المحاولة.';
      case 'failed-precondition':
        return 'إعداد قاعدة البيانات غير مكتمل (فهرس أو قواعد). تواصلي مع الدعم.';
      default:
        final msg = error.message?.trim();
        if (msg != null && msg.isNotEmpty) {
          return msg;
        }
        return 'خطأ في حفظ النتيجة (${error.code}). حاولي مرة أخرى.';
    }
  }

  if (error is FirebaseAuthException) {
    switch (error.code) {
      case 'invalid-verification-code':
        return 'رمز التحقق غير صحيح';
      case 'session-expired':
        return 'انتهت صلاحية الرمز — أعيدي الإرسال';
      case 'invalid-phone-number':
        return 'رقم الجوال غير صحيح';
      case 'too-many-requests':
        return 'محاولات كثيرة — انتظري قليلًا ثم أعيدي المحاولة';
      case 'quota-exceeded':
        return 'تم تجاوز حد الرسائل — حاولي لاحقًا';
      case 'captcha-check-failed':
        return 'فشل التحقق الأمني — أعيدي المحاولة';
      case 'user-disabled':
        return 'هذا الحساب معطّل';
      default:
        return error.message ?? 'حدث خطأ في المصادقة';
    }
  }

  final text = error.toString();
  if (text.contains('permission-denied')) {
    return 'صلاحيات قاعدة البيانات غير مفعّلة. تم تسجيل دخولك — جرّبي مرة أخرى بعد دقائق.';
  }

  if (error is Exception) {
    final msg = error.toString();
    if (msg.startsWith('Exception: ')) {
      return msg.replaceFirst('Exception: ', '');
    }
  }

  return 'حدث خطأ غير متوقع. حاولي مرة أخرى.';
}
