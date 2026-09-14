/// Public-safe Arabic labels for Face Result Projection (9E).
abstract final class FaceResultCopy {
  FaceResultCopy._();

  static const primaryTitle = 'شكل وجهك الأقرب';
  static const primarySubtitleFallback = 'من تحليل الملامح التجميلي';
  static const emptyHeadline = 'تعذر عرض نتيجة الملامح';
  static const emptySupport = 'جرّبي التقاط صورة أوضح ثم أعيدي التحليل.';
  static const partialSupport = 'بعض التفاصيل غير متاحة — نعرض ما يمكن بثقة.';
  static const retakeLabel = 'أعيدي الالتقاط';
  static const exploreDetailsLabel = 'استكشفي التفاصيل';
  static const askMiraLabel = 'اسألي ميرا';
  static const openGuidanceLabel = 'عرض إرشادات التنسيق';
  static const fullReportLabel = 'عرض التقرير الكامل (قديم)';
  static const symmetryInsightTitle = 'ملاحظة هيكلية حول التماثل';
  static const symmetryInsightBody =
      'ملاحظة هيكلية حول التماثل الظاهر — ليست تقييماً للجمال أو الجاذبية.';
  static const cosmeticLimitationTitle = 'حدود العرض';
  static const cosmeticLimitationBody =
      'تحليل ملامح تجميلي — ليس تشخيصاً طبياً ولا تقييماً للجاذبية.';

  static String shapeTitle(String displayNameAr) => 'شكل وجهك الأقرب: $displayNameAr';

  static String eligibilityLimitationAr(List<String> codes) {
    if (codes.isEmpty) return 'جودة القياس محدودة لهذه الصورة.';
    if (codes.contains('head_turned') || codes.contains('head_pitch')) {
      return 'زاوية الوجه أثّرت على القياس — انظري مباشرة للكاميرا.';
    }
    if (codes.contains('capture_quality_blocked')) {
      return 'جودة الصورة غير كافية للقياس.';
    }
    if (codes.contains('face_too_small') || codes.contains('face_too_far')) {
      return 'الوجه بعيد أو صغير في الإطار.';
    }
    if (codes.contains('face_too_large') || codes.contains('face_too_close')) {
      return 'الوجه قريب جداً من الكاميرا.';
    }
    if (codes.contains('face_off_center')) {
      return 'الوجه خارج منتصف الإطار.';
    }
    if (codes.contains('no_face') || codes.contains('multiple_faces')) {
      return 'لم نتعرّف على وجه واحد بوضوح.';
    }
    return 'ظروف الالتقاط حدّت من اكتمال التحليل.';
  }
}
