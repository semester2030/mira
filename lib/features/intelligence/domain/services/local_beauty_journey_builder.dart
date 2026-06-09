import '../entities/beauty_journey.dart';
import '../entities/mira_beauty_report.dart';

/// Offline mirror of backend beauty-journey-engine.ts
abstract final class LocalBeautyJourneyBuilder {
  LocalBeautyJourneyBuilder._();

  static const _severityScore = {
    'none': 88,
    'mild': 74,
    'moderate': 58,
    'noticeable': 42,
  };

  static const _gainBySeverity = {
    'none': 0,
    'mild': 4,
    'moderate': 6,
    'noticeable': 8,
  };

  static BeautyJourney fromReport(MiraBeautyReport report) {
    final priorities = _priorities(report.mainConcerns);
    final top = priorities.isNotEmpty ? priorities.first : null;
    final nextGoal = _nextGoal(report);
    final planSummary = report.weeklyPlan.enabled
        ? '${report.weeklyPlan.summaryAr} — ${report.weeklyPlan.headlineAr}'
        : 'اتبعي روتينك اليومي مع واقي شمس يومياً.';

    final followUp = report.progressForecast.needsMoreScans
        ? 'أجري تحليلاً ثانياً بعد 7–14 يوماً — لتفعيل Trends ومتابعة الهدف.'
        : (report.progressForecast.summaryAr.isNotEmpty
            ? report.progressForecast.summaryAr
            : 'راجعي تقريرك أسبوعياً — ميرا تقارن تقدمك تلقائياً.');

    var headline = 'رحلة عنايتك مع ميرا';
    var summary =
        'نربط حالتك الحالية بهدف واضح — ثم خطة أسبوعية قابلة للمتابعة.';

    if (top != null) {
      headline = 'أكبر فرصة للتحسن: ${top.labelAr}';
      summary =
          'مؤشر ${top.labelAr} ${top.currentScore} — التحسن المتوقع +${top.expectedGainPoints} نقطة.';
      if (priorities.length >= 2) {
        summary += ' · الأولوية الثانية: ${priorities[1].labelAr}.';
      }
    }

    return BeautyJourney(
      enabled: true,
      headlineAr: headline,
      summaryAr: summary,
      currentOverallScore: report.overallBeautyScore,
      nextGoal: nextGoal,
      topOpportunity: top,
      priorities: priorities,
      planSummaryAr: planSummary,
      followUpAr: followUp,
    );
  }

  static List<JourneyPriority> _priorities(List<ConcernNarrative> concerns) {
    final actionable = concerns
        .where((c) => c.severity != 'none')
        .toList()
      ..sort(
        (a, b) =>
            (_severityScore[a.severity] ?? 70).compareTo(_severityScore[b.severity] ?? 70),
      );

    return [
      for (var i = 0; i < actionable.length && i < 3; i++)
        JourneyPriority(
          rank: i + 1,
          concernId: actionable[i].id,
          labelAr: actionable[i].titleAr,
          currentScore: _severityScore[actionable[i].severity] ?? 70,
          expectedGainPoints: _gainBySeverity[actionable[i].severity] ?? 4,
          rationaleAr: actionable[i].narrativeAr,
        ),
    ];
  }

  static JourneyGoal _nextGoal(MiraBeautyReport report) {
    final current = report.overallBeautyScore;
    final projected = report.progressForecast.projectedOverallScore30Days;
    final target = _targetScore(current, projected);
    const horizon = 30;

    return JourneyGoal(
      metricId: 'overall',
      labelAr: 'مؤشر جمال البشرة',
      currentValue: current,
      targetValue: target,
      horizonDays: horizon,
      headlineAr: 'هدفنا القادم: الوصول إلى $target خلال $horizon يوماً',
      summaryAr: target > current
          ? 'من $current إلى $target — خطة ميرا الأسبوعية وروتينك اليومي هما الطريق.'
          : 'حافظي على $current+ — روتينك الحالي يحافظ على توازن بشرتك.',
    );
  }

  static int _targetScore(int current, int? projected) {
    if (projected != null && projected > current) {
      return projected.clamp(0, 100);
    }
    final gap = 100 - current;
    final step = current >= 82
        ? 3
        : current >= 68
            ? 5
            : (gap * 0.15).round().clamp(5, 8);
    return (current + step).clamp(0, 100);
  }
}
