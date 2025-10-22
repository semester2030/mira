/// أدوات التحقق من صحة البيانات (البريد، كلمة المرور، ...إلخ)
class Validators {
  static bool isEmail(String email) {
    final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}\$');
    return emailRegex.hasMatch(email);
  }

  static bool isStrongPassword(String password) {
    // كلمة مرور قوية: 8 أحرف على الأقل، حرف كبير، حرف صغير، رقم، رمز خاص
    final passwordRegex = RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#\$&*~]).{8,}\$');
    return passwordRegex.hasMatch(password);
  }

  static bool isPhoneNumber(String phone) {
    final phoneRegex = RegExp(r'^\+?[0-9]{7,15}\$');
    return phoneRegex.hasMatch(phone);
  }

  static bool isNotEmpty(String? value) => value != null && value.trim().isNotEmpty;
}
