import 'package:firebase_auth/firebase_auth.dart';

String friendlyFirebaseError(Object error) {
  if (error is FirebaseAuthException) {
    switch (error.code) {
      case 'user-not-found':
        return 'البريد الإلكتروني غير مسجل';
      case 'wrong-password':
      case 'invalid-credential':
        return 'البريد أو كلمة المرور غير صحيحة';
      case 'email-already-in-use':
        return 'هذا البريد مسجّل مسبقًا — جرّبي تسجيل الدخول';
      case 'weak-password':
        return 'كلمة المرور ضعيفة (6 أحرف على الأقل)';
      case 'invalid-email':
        return 'البريد الإلكتروني غير صحيح';
      case 'user-disabled':
        return 'هذا الحساب معطّل';
      case 'too-many-requests':
        return 'محاولات كثيرة — انتظري قليلًا ثم أعيدي المحاولة';
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
