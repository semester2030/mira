/// Public Arabic copy — History + Comparison (not gamified "progress").
abstract final class FaceHistoryCopy {
  FaceHistoryCopy._();

  static const entryTitle = 'سجل التحليلات';
  static const entrySubtitle = 'مراجعة وتحليلات سابقة — بدون تقييم جمال';
  static const firstAnalysisHeadline = 'هذا أول تحليل لك';
  static const firstAnalysisSupport =
      'بعد تحليل إضافي متوافق يمكنكِ مقارنة النتائج بهدوء.';
  static const emptyHeadline = 'لا يوجد سجل تحليلات بعد';
  static const emptySupport = 'أكملي تحليلًا لحفظه في السجل.';
  static const comparisonTitle = 'مقارنة التحليلات';
  static const incompatibleHeadline = 'لا يمكن المقارنة بدقة';
  static const incompatibleSupport =
      'التحليلان غير متوافقين في الجودة أو الإصدار أو أهلية القياس.';
  static const qualifiedHeadline = 'مقارنة مع تحفظ';
  static const historicalOnlyHeading = 'للمراجعة فقط (غير للمقارنة)';
  static const comparableHeading = 'نتائج قابلة للمقارنة';
  static const openResult = 'عرض النتيجة';
  static const compareWithPrevious = 'قارن مع تحليل سابق';
  static const retakeLabel = 'أعيدي الالتقاط';
  static const closeLabel = 'إغلاق';
  static const qualityEligible = 'قابل للقياس';
  static const qualityLimited = 'محدود';
  static const qualityRetake = 'يُفضّل إعادة الالتقاط';
  static const qualityUnavailable = 'غير متاح';
  static const noFaceIntel = 'بدون بيانات ملامح محفوظة';
  static const similar = 'متقارب مع التحليل السابق';
  static const differs =
      'هناك اختلاف بسيط في القياس — قد يتأثر بطريقة الالتقاط';
  static const unavailable = 'غير متاح للمقارنة';
  static const shapeDiffNote =
      'اختلاف تصنيف الشكل لا يعني بالضرورة تغيّر الوجه — قد يؤثر الالتقاط أو الثقة.';
  static const symmetryDiffNote =
      'فروقات التماثل تُعرض بحذر — وليست تقييم جاذبية.';
  static const captureGuidance =
      'التقطي صورة أمامية واضحة بإضاءة متساوية ووجه ثابت.';

  static const forbiddenProgressPhrases = <String>[
    'تحسن',
    'تراجع',
    'أجمل',
    'أسوأ',
    'درجة جمال',
    'Beauty Score',
    'Attractiveness',
    'Golden Ratio',
  ];
}
