import 'dart:io';

/// أداة لمعالجة الصور (تصغير، ضغط، ...إلخ)
class ImageProcessor {
  /// مثال: التحقق من حجم الصورة (بالبايت)
  static bool isImageSizeValid(File image, {int maxSizeInMB = 5}) {
    final sizeInBytes = image.lengthSync();
    final sizeInMB = sizeInBytes / (1024 * 1024);
    return sizeInMB <= maxSizeInMB;
  }

  // يمكنك إضافة طرق لضغط الصور أو تغيير الأبعاد لاحقًا
}
