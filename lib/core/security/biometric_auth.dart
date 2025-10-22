/// واجهة المصادقة البيومترية (بصمة/وجه)
abstract class BiometricAuth {
  /// التحقق من دعم الجهاز للمصادقة البيومترية
  Future<bool> isBiometricSupported();

  /// تنفيذ المصادقة البيومترية
  Future<bool> authenticate({String reason = 'الرجاء المصادقة'});
}

/// يمكنك لاحقًا تنفيذ هذه الواجهة باستخدام مكتبة مثل local_auth
