import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../../skin_analysis/domain/services/skin_report_matrix.dart';
import '../entities/mira_beauty_report.dart';
import '../entities/weekly_plan.dart';

/// Offline weekly plan — mirrors backend weekly-plan-engine.
abstract final class LocalWeeklyPlanBuilder {
  LocalWeeklyPlanBuilder._();

  static const _dayLabels = [
    'الأحد',
    'الاثنين',
    'الثلاثاء',
    'الأربعاء',
    'الخميس',
    'الجمعة',
    'السبت',
  ];

  static WeeklyPlan fromSkinReport(SkinReport report, DailyRoutinePlan routine) {
    final scores = {for (final c in SkinReportMatrix.matrixScores(report)) c.id: c.score};
    int ui(String id, int fallback) => scores[id] ?? fallback;

    final int? moisture = scores['moisture'] ?? report.hydration;
    final lowMoisture = moisture != null && moisture < 58;
    final pores = ui('pore', 100 - report.pores * 20);
    final acne = ui('acne', 100 - report.acne * 20);
    final redness = ui('redness', 100 - report.redness * 20);

    final focuses = [
      'أساس الترطيب',
      lowMoisture ? 'تركيز الترطيب العميق' : 'حماية SPF',
      pores < 58 ? 'تنظيف المسام بلطف' : 'توازن البشرة',
      'يوم راحة — بدون مقشرات',
      acne < 58 ? 'هدئة الحبوب' : 'تغذية البشرة',
      redness < 55 ? 'تخفيف الاحمرار' : 'إشراق نهاية الأسبوع',
      'مراجعة أسبوعية',
    ];

    final days = List<WeeklyPlanDay>.generate(7, (index) {
      final morning = routine.morning.take(2).map((s) => 'صباحاً: ${s.nameAr}').toList();
      final evening = routine.evening.take(1).map((s) => 'مساءً: ${s.nameAr}').toList();
      final extra = switch (index) {
        0 => ['اشربي 8 أكواب ماء'],
        1 when lowMoisture => ['قناع ترطيب 15 دقيقة مساءً'],
        2 when pores < 58 => ['تنظيف لطيف مساءً — دون مقشر جديد'],
        3 => ['مرطب فقط مساءً — لا actives'],
        4 when acne < 58 => ['لا تلمسي الحبوب؛ تقييم العلاج مع مختص'],
        5 when redness < 55 => ['مرطب مهدئ + تجنّبي الحرارة'],
        6 => ['لاحظي التحسّن — أجري تحليلاً ثانياً بعد أسبوعين'],
        _ => <String>[],
      };

      return WeeklyPlanDay(
        dayIndex: index + 1,
        labelAr: _dayLabels[index],
        focusAr: focuses[index],
        stepsAr: [...morning, ...evening, ...extra],
      );
    });

    return WeeklyPlan(
      enabled: true,
      headlineAr: 'خطة أسبوعية — 7 أيام للعناية المتدرجة',
      summaryAr: 'روتين يومي ثابت مع تركيز مختلف كل يوم — بدون إفراط.',
      days: days,
    );
  }

  /// Uses only measured scores. A missing key does not become a substitute number.
  static WeeklyPlan fromKnownScores(Map<String, int> scores, DailyRoutinePlan routine) {
    bool low(String id, int threshold) {
      final value = scores[id];
      return value != null && value < threshold;
    }

    final moistureLow = low('moisture', 58);
    final poresLow = low('pore', 58);
    final acneLow = low('acne', 58);
    final rednessLow = low('redness', 55);
    final focuses = [
      'أساس الترطيب',
      moistureLow ? 'تركيز الترطيب العميق' : 'حماية SPF',
      poresLow ? 'تنظيف المسام بلطف' : 'توازن البشرة',
      'يوم راحة — بدون مقشرات',
      acneLow ? 'هدئة الحبوب' : 'تغذية البشرة',
      rednessLow ? 'تخفيف الاحمرار' : 'إشراق نهاية الأسبوع',
      'مراجعة أسبوعية',
    ];
    final days = List<WeeklyPlanDay>.generate(7, (index) {
      final morning = routine.morning.take(2).map((s) => 'صباحاً: ${s.nameAr}').toList();
      final evening = routine.evening.take(1).map((s) => 'مساءً: ${s.nameAr}').toList();
      final extra = switch (index) {
        0 => ['اشربي 8 أكواب ماء'],
        1 when moistureLow => ['قناع ترطيب 15 دقيقة مساءً'],
        2 when poresLow => ['تنظيف لطيف مساءً — دون مقشر جديد'],
        3 => ['مرطب فقط مساءً — لا actives'],
        4 when acneLow => ['لا تلمسي الحبوب؛ تقييم العلاج مع مختص'],
        5 when rednessLow => ['مرطب مهدئ + تجنّبي الحرارة'],
        6 => ['لاحظي التحسّن — أجري تحليلاً ثانياً بعد أسبوعين'],
        _ => <String>[],
      };
      return WeeklyPlanDay(
        dayIndex: index + 1,
        labelAr: _dayLabels[index],
        focusAr: focuses[index],
        stepsAr: [...morning, ...evening, ...extra],
      );
    });
    return WeeklyPlan(
      enabled: true,
      headlineAr: 'خطة أسبوعية — 7 أيام للعناية المتدرجة',
      summaryAr: 'روتين يومي ثابت مع تركيز مختلف كل يوم — بدون إفراط.',
      days: days,
    );
  }
}
