/// واجهة خدمة الإشعارات (محلية أو Push)
abstract class NotificationService {
  /// تهيئة خدمة الإشعارات
  Future<void> initialize();

  /// إرسال إشعار فوري
  Future<void> showNotification({
    required String title,
    required String body,
    String? payload,
  });

  /// جدولة إشعار لوقت لاحق
  Future<void> scheduleNotification({
    required String title,
    required String body,
    required DateTime scheduledTime,
    String? payload,
  });

  /// إلغاء جميع الإشعارات
  Future<void> cancelAll();
}

/// يمكنك لاحقًا تنفيذ هذه الواجهة باستخدام مكتبة flutter_local_notifications أو Firebase Messaging
