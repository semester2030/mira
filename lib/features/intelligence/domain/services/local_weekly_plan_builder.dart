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

    final moisture = ui('moisture', report.hydration);
    final pores = ui('pore', 100 - report.pores * 20);
    final acne = ui('acne', 100 - report.acne * 20);
    final redness = ui('redness', 100 - report.redness * 20);

    final focuses = [
      'أساس الترطيب',
      moisture < 58 ? 'تركيز الترطيب العميق' : 'حماية SPF',
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
        1 when moisture < 58 => ['قناع ترطيب 15 دقيقة مساءً'],
        2 when pores < 58 => ['BHA خفيف — مساءً فقط'],
        3 => ['مرطب فقط مساءً — لا actives'],
        4 when acne < 58 => ['نياسيناميد على البثور فقط'],
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
}
