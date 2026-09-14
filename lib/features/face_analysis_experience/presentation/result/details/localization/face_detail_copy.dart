/// Public Arabic copy for Face Detail Sheets (9G).
abstract final class FaceDetailCopy {
  FaceDetailCopy._();

  static const whatHeading = 'ما هذه؟';
  static const observationHeading = 'ماذا لاحظت ميرا؟';
  static const meaningHeading = 'ماذا يعني ذلك؟';
  static const confidenceHeading = 'الثقة والحدود';
  static const relatedHeading = 'مرتبط بهذه النتيجة';
  static const closeLabel = 'إغلاق';
  static const retakeLabel = 'أعيدي الالتقاط';
  static const askMiraAboutThis = 'اسألي ميرا عن هذه النتيجة';
  static const exploreRelatedLabel = 'عرض المرتبطة';
  static const detailsLabel = 'التفاصيل';
  static const availableDetailsLabel = 'التفاصيل المتاحة';
  static const regionEmpty =
      'لا توجد نتيجة مستقلة لهذه المنطقة في هذا التحليل';
  static const regionEmptySupport =
      'يمكنكِ استكشاف النتيجة الأساسية أو اسألي ميرا عن ملامح وجهك عمومًا.';
  static const unsupported =
      'هذه التفاصيل غير متاحة في النتيجة الحالية.';
  static const regionIllustrativeNote =
      'إبراز المنطقة توضيحي — ليس قياسًا على بكسل محدد.';
  static const truthDerivedHelpful =
      'هذه النتيجة مشتقة من قياسات شكل الوجه الظاهرة.';
  static const truthMeasuredHelpful =
      'هذه ملاحظة مبنية على قياسات هيكلية ظاهرة في الصورة.';
  static const retakePriority =
      'أعيدي الالتقاط بصورة أوضح وأمامية للحصول على نتيجة أوثق.';
  static const limitedResultTitle = 'نتيجة محدودة';
  static const primaryWhat = 'النتيجة الأولية لشكل الوجه الأقرب.';
  static const insightWhat = 'رؤية مختارة من تحليل ملامح وجهك.';
  static const regionWhat = 'منطقة وجه عالية المستوى مرتبطة بهذه النتيجة.';
  static const symmetryMeaning =
      'ملاحظة هيكلية حول التماثل الظاهر — ليست تقييمًا للجمال أو الجاذبية.';
  static const shapeMeaning =
      'وصف محايد لشكل الوجه الظاهر — ليس ترتيبًا أو تقييم جودة.';

  static String regionLabel(String regionKey) {
    switch (regionKey) {
      case 'forehead':
        return 'الجبهة';
      case 'eyes':
        return 'العينين';
      case 'nose':
        return 'الأنف';
      case 'cheeks':
        return 'الخدين';
      case 'mouth':
        return 'الفم';
      case 'jaw':
        return 'الفك';
      case 'chin':
        return 'الذقن';
      case 'faceGeneral':
      default:
        return 'الوجه';
    }
  }

  static String openRegionSemantics(String regionKey) =>
      'منطقة ${regionLabel(regionKey)} — افتحي التفاصيل';
}
