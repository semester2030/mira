import '../constants/report_face_map_spec.dart';
import '../entities/confidence_layer.dart';
import '../entities/mira_beauty_report.dart';

/// Offline mirror of backend confidence-layer.ts — simplified trust labels.
abstract final class LocalConfidenceLayerBuilder {
  LocalConfidenceLayerBuilder._();

  static ConfidenceLayer fromReport(MiraBeautyReport report) {
    final items = [
      _journeyGoal(report),
      _ageComparison(report),
      _faceMap(report),
      _progressForecast(report),
      _recommendations(report),
    ];

    final highCount = items.where((i) => i.level == 'high').length;

    return ConfidenceLayer(
      enabled: true,
      headlineAr: 'ثقة ميرا في تقريرك',
      summaryAr: highCount >= 2
          ? 'معظم أقسام التقرير مدعومة ببيانات تحليلك — بعض الأقسام استرشادية.'
          : 'أقسام التقرير مزيج من تحليلك وبيانات تعليمية — المتابعة ترفع الدقة.',
      items: items,
    );
  }

  static ConfidenceItem _ageComparison(MiraBeautyReport report) {
    final age = report.ageComparison;
    if (!age.enabled) {
      return ConfidenceItem(
        id: 'age_comparison',
        labelAr: 'مقارنة عمر البشرة',
        level: 'low',
        reasonAr: age.suppressedReason == 'missing_birth_year'
            ? 'أضيفي سنة الميلاد في الملف الشخصي لتفعيل المقارنة.'
            : 'مقارنة العمر غير متاحة — بيانات غير كافية.',
      );
    }

    final level = (age.deltaYears != null && age.deltaYears!.abs() >= 5) ? 'medium' : 'high';
    return ConfidenceItem(
      id: 'age_comparison',
      labelAr: 'مقارنة عمر البشرة — ${_levelLabel(level)}',
      level: level,
      reasonAr: 'تقدير من تحليلك — وليس تشخيصاً طبياً للعمر.',
    );
  }

  static ConfidenceItem _journeyGoal(MiraBeautyReport report) {
    final scans = report.progressForecast.scanCount;
    final level = scans >= 3 ? 'high' : scans >= 2 ? 'medium' : 'low';
    return ConfidenceItem(
      id: 'journey_goal',
      labelAr: 'هدف الرحلة — ${_levelLabel(level)}',
      level: level,
      reasonAr: scans >= 3
          ? 'مبني على $scans تحليلات واتجاهات تقدمك.'
          : scans >= 2
              ? 'تقدير من تحليلين — يتحسّن مع المتابعة.'
              : 'تقدير أولي من تحليل واحد.',
    );
  }

  static ConfidenceItem _progressForecast(MiraBeautyReport report) {
    final pf = report.progressForecast;
    if (!pf.enabled || pf.needsMoreScans) {
      return const ConfidenceItem(
        id: 'progress_forecast',
        labelAr: 'توقعات التقدم — استرشادي',
        level: 'low',
        reasonAr: 'تحتاجين تحليلاً ثانياً لتفعيل Trends.',
      );
    }
    final level = pf.scanCount >= 3 ? 'high' : 'medium';
    return ConfidenceItem(
      id: 'progress_forecast',
      labelAr: 'توقعات التقدم — ${_levelLabel(level)}',
      level: level,
      reasonAr: 'تقدير تقريبي بناءً على بيانات المتابعة.',
    );
  }

  static ConfidenceItem _recommendations(MiraBeautyReport report) {
    if (report.recommendedProducts.isEmpty) {
      return const ConfidenceItem(
        id: 'recommendations',
        labelAr: 'توصيات المنتجات — استرشادي',
        level: 'low',
        reasonAr: 'سيتم عرض منتجات مناسبة عند توفر شركاء في هذا التصنيف.',
      );
    }
    final avg = report.recommendedProducts
            .map((p) => p.matchScore)
            .reduce((a, b) => a + b) /
        report.recommendedProducts.length;
    final level = avg >= 75 ? 'high' : avg >= 55 ? 'medium' : 'low';
    return ConfidenceItem(
      id: 'recommendations',
      labelAr: 'توصيات المنتجات — ${_levelLabel(level)}',
      level: level,
      reasonAr: 'متوسط تطابق ${avg.round()}% مع احتياجات تقريرك.',
    );
  }

  static ConfidenceItem _faceMap(MiraBeautyReport report) {
    final map = report.faceHealthMap;
    if (!map.enabled) {
      return const ConfidenceItem(
        id: 'face_map',
        labelAr: 'خريطة الوجه — استرشادي',
        level: 'low',
        reasonAr: 'الخريطة غير مفعّلة في هذا التقرير.',
      );
    }
    return const ConfidenceItem(
      id: 'face_map',
      labelAr: 'خريطة مؤشرات البشرة — إرشادية',
      level: 'medium',
      reasonAr: ReportFaceMapSpec.confidenceBadgeAr,
    );
  }

  static String _levelLabel(String level) => switch (level) {
        'high' => 'ثقة مرتفعة',
        'medium' => 'ثقة متوسطة',
        _ => 'استرشادي',
      };
}
