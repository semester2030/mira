import '../entities/confidence_layer.dart';
import '../entities/mira_beauty_report.dart';

/// Offline mirror of backend confidence-layer.ts
abstract final class LocalConfidenceLayerBuilder {
  LocalConfidenceLayerBuilder._();

  static ConfidenceLayer fromReport(MiraBeautyReport report) {
    final items = [
      _ageComparison(report),
      _journeyGoal(report),
      _progressForecast(report),
      _recommendations(report),
      _faceMap(report),
    ];

    final highCount = items.where((i) => i.level == 'high').length;

    return ConfidenceLayer(
      enabled: true,
      headlineAr: 'درجة ثقة ميرا في تقريرك',
      summaryAr: highCount >= 3
          ? 'معظم ادّعاءات التقرير مدعومة ببيانات قوية — استمري على المتابعة.'
          : 'بعض الأقسام تقديرية — المتابعة الدورية ترفع دقة التقرير.',
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
            ? 'أضيفي سنة الميلاد في الملف الشخصي لتفعيل مقارنة دقيقة.'
            : 'مقارنة العمر غير متاحة — بيانات غير كافية.',
      );
    }

    if (age.userAge != null && age.skinAge != null && age.deltaYears != null) {
      final level = (age.deltaYears!.abs() >= 5) ? 'medium' : 'high';
      return ConfidenceItem(
        id: 'age_comparison',
        labelAr: 'مقارنة عمر البشرة',
        level: level,
        reasonAr: level == 'high'
            ? 'ثقة عالية — عمرك وعمر بشرتك من تحليل موثّق.'
            : 'ثقة متوسطة — فرق ملحوظ؛ استمري على الروتين للتأكيد.',
      );
    }

    return const ConfidenceItem(
      id: 'age_comparison',
      labelAr: 'مقارنة عمر البشرة',
      level: 'medium',
      reasonAr: 'ثقة متوسطة — تقدير من تحليل واحد.',
    );
  }

  static ConfidenceItem _journeyGoal(MiraBeautyReport report) {
    final scans = report.progressForecast.scanCount;
    final level = scans >= 3
        ? 'high'
        : scans >= 2
            ? 'medium'
            : 'low';
    return ConfidenceItem(
      id: 'journey_goal',
      labelAr: 'هدف الرحلة (30 يوماً)',
      level: level,
      reasonAr: scans >= 3
          ? 'ثقة عالية — الهدف مبني على $scans تحليلات وTrends.'
          : scans >= 2
              ? 'ثقة متوسطة — تقدير من تحليلين.'
              : 'ثقة منخفضة — تقدير أولي من تحليل واحد.',
    );
  }

  static ConfidenceItem _progressForecast(MiraBeautyReport report) {
    final pf = report.progressForecast;
    if (!pf.enabled || pf.needsMoreScans) {
      return const ConfidenceItem(
        id: 'progress_forecast',
        labelAr: 'توقعات التقدم',
        level: 'low',
        reasonAr: 'ثقة منخفضة — تحتاجين تحليلاً ثانياً.',
      );
    }
    final level = pf.scanCount >= 3 ? 'high' : 'medium';
    return ConfidenceItem(
      id: 'progress_forecast',
      labelAr: 'توقعات التقدم',
      level: level,
      reasonAr: level == 'high'
          ? 'ثقة عالية — projection من ${pf.scanCount} تحليلات.'
          : 'ثقة متوسطة — مقارنة بين آخر تحليلين.',
    );
  }

  static ConfidenceItem _recommendations(MiraBeautyReport report) {
    if (report.recommendedProducts.isEmpty) {
      return const ConfidenceItem(
        id: 'recommendations',
        labelAr: 'توصيات المنتجات',
        level: 'low',
        reasonAr: 'ثقة منخفضة — لا منتجات مطابقة بعد.',
      );
    }
    final avg = report.recommendedProducts
            .map((p) => p.matchScore)
            .reduce((a, b) => a + b) /
        report.recommendedProducts.length;
    final level = avg >= 75 ? 'high' : avg >= 55 ? 'medium' : 'low';
    return ConfidenceItem(
      id: 'recommendations',
      labelAr: 'توصيات المنتجات',
      level: level,
      reasonAr: 'ثقة ${level == 'high' ? 'عالية' : level == 'medium' ? 'متوسطة' : 'منخفضة'} — متوسط تطابق ${avg.round()}%.',
    );
  }

  static ConfidenceItem _faceMap(MiraBeautyReport report) {
    final map = report.faceHealthMap;
    if (!map.enabled) {
      return const ConfidenceItem(
        id: 'face_map',
        labelAr: 'خريطة الوجه',
        level: 'low',
        reasonAr: 'ثقة منخفضة — خريطة غير مفعّلة.',
      );
    }
    return ConfidenceItem(
      id: 'face_map',
      labelAr: 'خريطة الوجه',
      level: map.confidence,
      reasonAr: map.confidenceLabelAr.isNotEmpty
          ? map.confidenceLabelAr
          : 'ثقة ${map.confidence}',
    );
  }
}
