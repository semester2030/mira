/// واجهة التخزين الآمن للبيانات الحساسة (مثل التوكن، بيانات المستخدم)
abstract class SecureStorageService {
  /// حفظ قيمة مع مفتاح
  Future<void> write({required String key, required String value});

  /// قراءة قيمة بناءً على المفتاح
  Future<String?> read({required String key});

  /// حذف قيمة بناءً على المفتاح
  Future<void> delete({required String key});

  /// حذف جميع القيم
  Future<void> clear();
}

/// يمكنك لاحقًا تنفيذ هذه الواجهة باستخدام مكتبة flutter_secure_storage
