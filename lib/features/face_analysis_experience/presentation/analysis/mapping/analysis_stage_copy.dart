import '../contracts/analysis_motion_semantics.dart';

/// Arabic stage copy — calm, premium, non-technical.
/// Never claims the laser measures the face.
abstract final class AnalysisStageCopy {
  AnalysisStageCopy._();

  static (String title, String instruction, String a11y) forStage(
    AnalysisPresentationStage stage,
  ) {
    switch (stage) {
      case AnalysisPresentationStage.settlingImage:
        return (
          'صورتك',
          'نثبّت صورتك…',
          'جاري تثبيت الصورة للتحليل',
        );
      case AnalysisPresentationStage.confirmingQuality:
        return (
          'الجودة',
          'نتأكد من جودة الصورة',
          'جاري التأكد من جودة الصورة',
        );
      case AnalysisPresentationStage.reviewingFeatures:
        return (
          'ملامحك',
          'نراجع ملامح وجهك',
          'جاري مراجعة ملامح الوجه',
        );
      case AnalysisPresentationStage.buildingDetails:
        return (
          'التفاصيل',
          'نبني تفاصيل نتيجتك',
          'جاري بناء تفاصيل النتيجة',
        );
      case AnalysisPresentationStage.preparingMirror:
        return (
          'مرآتك',
          'نجهّز مرآتك',
          'جاري تجهيز مرآة النتيجة',
        );
      case AnalysisPresentationStage.ambientWaiting:
        return (
          'لحظات',
          'ما زلنا نجهّز تحليلَك…',
          'جاري تجهيز التحليل',
        );
      case AnalysisPresentationStage.completing:
        return (
          'جاهزة',
          'تم — ننتقل لنتيجتك',
          'اكتمل التحليل، جاري الانتقال للنتيجة',
        );
      case AnalysisPresentationStage.error:
        return (
          'تعذّر التحليل',
          'حدثت مشكلة — أعيدي المحاولة',
          'فشل التحليل، يمكنك إعادة المحاولة',
        );
    }
  }
}
