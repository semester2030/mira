/// Public Arabic copy for Personal Guidance (9H).
abstract final class FaceGuidanceCopy {
  FaceGuidanceCopy._();

  static const entryTitle = 'إرشادك الشخصي';
  static const entrySubtitle = 'مرتبط بنتيجة تحليل ملامحك';
  static const whyLabel = 'لماذا؟';
  static const emptyHeadline = 'لا يوجد إرشاد شخصي إضافي لهذا التحليل';
  static const emptySupport =
      'يمكنكِ استكشاف التفاصيل أو اسألي ميرا عن نتيجتك الحالية.';
  static const retakeHeadline = 'أعيدي الالتقاط أولاً';
  static const retakeBody =
      'جودة الصورة الحالية لا تدعم إرشادًا شخصيًا موثوقًا — أعيدي الالتقاط بصورة أوضح وأمامية.';
  static const retakeAction = 'أعيدي الالتقاط';
  static const askMiraAction = 'اسألي ميرا عن هذا الإرشاد';
  static const exploreResultAction = 'عرض النتيجة المرتبطة';
  static const closeAction = 'إغلاق';
  static const personalizedBadge = 'شخصي';
  static const educationalBadge = 'توضيحي';
  static const contextualBadge = 'سياقي';
  static const generalBadge = 'عام';
  static const secondaryHeading = 'إرشادات إضافية';
  static const cosmeticLimitation =
      'إرشاد تنسيقي تجميلي — ليس تشخيصًا طبيًا ولا تقييم جاذبية.';

  static String reasonForShape(String shapeLabelAr) =>
      'لأن شكل وجهك الأقرب هو $shapeLabelAr.';

  static String reasonForCategory(String categoryAr) =>
      'مرتبط بتوصية تنسيق ($categoryAr) من تحليل ملامحك.';

  static String categoryLabelAr(String category) {
    switch (category) {
      case 'hairstyle':
        return 'تسريحة';
      case 'makeup_contour':
        return 'تحديد المكياج';
      case 'eyewear':
        return 'إطارات النظارة';
      case 'accessories':
        return 'إكسسوارات';
      case 'educational':
        return 'توضيحي';
      default:
        return 'تنسيق';
    }
  }

  static String personalizationLabelAr(String level) {
    switch (level) {
      case 'personalized':
        return personalizedBadge;
      case 'educational':
        return educationalBadge;
      case 'contextual':
        return contextualBadge;
      default:
        return generalBadge;
    }
  }
}
