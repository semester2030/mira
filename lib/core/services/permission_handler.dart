/// واجهة إدارة الصلاحيات (الكاميرا، الموقع، التخزين...)
abstract class PermissionHandlerService {
  /// طلب صلاحية معينة
  Future<bool> requestPermission(String permission);

  /// التحقق من حالة الصلاحية
  Future<bool> isPermissionGranted(String permission);
}

/// يمكنك لاحقًا تنفيذ هذه الواجهة باستخدام مكتبة permission_handler
