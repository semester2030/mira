/// واجهة التعامل مع الروابط العميقة (Deep Links)
abstract class DeepLinkHandler {
  /// بدء الاستماع للروابط العميقة
  Future<void> startListening();

  /// إيقاف الاستماع
  Future<void> stopListening();

  /// معالجة الرابط العميق المستلم
  Future<void> handleDeepLink(String link);
}

/// يمكنك لاحقًا تنفيذ هذه الواجهة باستخدام مكتبة uni_links أو firebase_dynamic_links
