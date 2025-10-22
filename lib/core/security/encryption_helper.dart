import 'dart:convert';

/// مساعد التشفير الأساسي في التطبيق
class EncryptionHelper {
  /// تشفير نص باستخدام base64 (مثال بسيط)
  static String encrypt(String plainText) {
    final bytes = utf8.encode(plainText);
    return base64.encode(bytes);
  }

  /// فك تشفير نص مشفر بـ base64
  static String decrypt(String encryptedText) {
    final bytes = base64.decode(encryptedText);
    return utf8.decode(bytes);
  }
}
