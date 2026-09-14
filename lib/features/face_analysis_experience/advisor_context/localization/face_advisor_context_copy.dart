/// Public Arabic copy for Face Advisor context (9I).
abstract final class FaceAdvisorContextCopy {
  FaceAdvisorContextCopy._();

  static const aboutShape = 'عن شكل وجهك';
  static const aboutResult = 'عن هذه النتيجة';
  static const aboutInsight = 'عن هذه الملاحظة';
  static const aboutDetail = 'عن هذه التفاصيل';
  static const aboutRegion = 'عن هذه المنطقة';
  static const aboutGuidance = 'عن هذا الإرشاد';
  static const aboutGeneral = 'عن نتيجة تحليل ملامحك';
  static const askMiraAbout = 'اسألي ميرا';
  static const regionIllustrative =
      'المنطقة مرتبطة بملاحظات موجودة — وليست قياسًا موضعيًا مستقلًا.';
  static const unavailable =
      'لا يتوفر سياق كافٍ لهذه النتيجة حاليًا. يمكنكِ استكشاف التفاصيل أو إعادة الالتقاط.';

  static String askMiraSemantics(String contextLabelAr) =>
      'اسألي ميرا $contextLabelAr';

  static const qWhatShapeMeans = 'ماذا يعني شكل وجهي؟';
  static const qHowDetermined = 'كيف تم تحديد هذه النتيجة؟';
  static const qWhatRatioMeans = 'ماذا تعني هذه النسبة؟';
  static const qIsStable = 'هل هذه النتيجة ثابتة؟';
  static const qWhyGuidance = 'لماذا ظهرت لي هذه النصيحة؟';
  static const qWhyRetake = 'لماذا أحتاج إعادة الصورة؟';
  static const qHowSure = 'ما مدى ثقتكم بهذه النتيجة؟';
  static const qExplainMore = 'وضّحي أكثر من فضلك';

  /// Forbidden suggestion framings (must never appear).
  static const forbiddenSuggestions = <String>[
    'كيف أجعل وجهي أجمل؟',
    'كيف أصلح التماثل؟',
    'هل وجهي جميل؟',
    'درجة جمال',
  ];
}
