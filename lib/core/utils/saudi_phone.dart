/// Saudi mobile numbers → E.164 (+9665xxxxxxxx) for Firebase Phone Auth.
abstract final class SaudiPhone {
  /// Accepts: 05xxxxxxxx, 5xxxxxxxx, 9665xxxxxxxx, +9665xxxxxxxx
  static String? toE164(String input) {
    var digits = input.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('966') && digits.length >= 12) {
      digits = digits.substring(3);
    } else if (digits.startsWith('0') && digits.length == 10) {
      digits = digits.substring(1);
    }
    if (digits.length != 9 || !digits.startsWith('5')) {
      return null;
    }
    if (!RegExp(r'^5\d{8}$').hasMatch(digits)) {
      return null;
    }
    return '+966$digits';
  }

  static String? validateMessage(String input) {
    if (input.trim().isEmpty) return 'أدخلي رقم الجوال';
    if (toE164(input) == null) {
      return 'رقم غير صحيح — مثال: 05xxxxxxxx';
    }
    return null;
  }

  /// +966501234567 → 0501234567
  static String display(String? e164) {
    if (e164 == null || e164.isEmpty) return '';
    var digits = e164.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('966') && digits.length >= 12) {
      digits = digits.substring(3);
    }
    if (digits.length == 9 && digits.startsWith('5')) {
      return '0$digits';
    }
    return e164;
  }
}
