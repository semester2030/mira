import '../../../skin_analysis/data/models/skin_report_model.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../entities/mira_beauty_report.dart';
import '../entities/progress_forecast.dart';
import 'local_mira_report_builder.dart';

/// Offline progress trends from saved reports (guest won't persist history).
abstract final class LocalProgressBuilder {
  LocalProgressBuilder._();

  static ProgressForecast fromReports(List<SkinReport> reports) {
    if (reports.isEmpty) return ProgressForecast.empty;

    final sorted = [...reports]
      ..sort((a, b) {
        final ad = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bd = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return ad.compareTo(bd);
      });

    final timeline = sorted
        .map(
          (r) => ProgressTimelinePoint(
            analysisId: r.id ?? '',
            createdAt: r.createdAt ?? DateTime.now(),
            overallScore: _score(r),
          ),
        )
        .toList();

    if (sorted.length < 2) {
      return ProgressForecast(
        enabled: false,
        scanCount: sorted.length,
        needsMoreScans: true,
        headlineAr: 'تابعي تقدمك',
        summaryAr:
            'بعد تحليل ثانٍ ستظهر Trends ومقارنة بين زيارتك — استمري على الروتين.',
        timeline: timeline,
        trends: const [],
        milestones: [
          const ProgressMilestone(
            id: 'first_scan',
            titleAr: 'أول تحليل ✨',
            descriptionAr: 'بدأتِ رحلة متابعة بشرتك مع ميرا.',
          ),
        ],
      );
    }

    final previous = _resolve(sorted[sorted.length - 2]);
    final current = _resolve(sorted.last);

    final trends = [
      _trend(
        'overall',
        'مؤشر الجمال',
        previous.overallBeautyScore,
        current.overallBeautyScore,
      ),
      _trendFromConcerns('moisture', 'الترطيب', previous, current),
      _trendFromConcerns('pore', 'المسام', previous, current),
      _trendFromConcerns('redness', 'الاحمرار', previous, current),
    ];

    final improved = trends.where((t) => t.isImproved).toList();
    final headline = improved.isNotEmpty
        ? improved.first.messageAr
        : 'مقارنة بين آخر تحليلين';

    return ProgressForecast(
      enabled: true,
      scanCount: sorted.length,
      needsMoreScans: false,
      headlineAr: headline,
      summaryAr: _forecastSummary(timeline),
      timeline: timeline,
      trends: trends,
      milestones: _milestones(sorted.length, trends),
      projectedOverallScore30Days: _project30Days(timeline),
    );
  }

  static MiraBeautyReport _resolve(SkinReport report) {
    if (report is SkinReportModel && report.miraReport != null) {
      return report.miraReport!;
    }
    return LocalMiraReportBuilder.fromSkinReport(report);
  }

  static int _score(SkinReport report) => _resolve(report).overallBeautyScore;

  static ProgressMetricTrend _trendFromConcerns(
    String id,
    String labelAr,
    MiraBeautyReport previous,
    MiraBeautyReport current,
  ) {
    return _trend(
      id,
      labelAr,
      _concernScore(previous.mainConcerns, id),
      _concernScore(current.mainConcerns, id),
    );
  }

  static int _concernScore(List<ConcernNarrative> concerns, String id) {
    final match = concerns.where((c) => c.id == id);
    if (match.isEmpty) return 70;
    switch (match.first.severity) {
      case 'none':
        return 88;
      case 'mild':
        return 74;
      case 'moderate':
        return 58;
      case 'noticeable':
        return 42;
      default:
        return 70;
    }
  }

  static ProgressMetricTrend _trend(
    String id,
    String labelAr,
    int previousScore,
    int currentScore,
  ) {
    final delta = currentScore - previousScore;
    final direction =
        delta >= 3 ? 'improved' : (delta <= -3 ? 'regressed' : 'stable');
    final message = direction == 'improved'
        ? 'تحسّن $labelAr +${delta.abs()} نقطة'
        : direction == 'regressed'
            ? 'تراجع $labelAr ${delta.abs()} نقطة — راجعي روتينك'
            : '$labelAr مستقر تقريباً';
    return ProgressMetricTrend(
      id: id,
      labelAr: labelAr,
      previousScore: previousScore,
      currentScore: currentScore,
      deltaPoints: delta,
      direction: direction,
      messageAr: message,
    );
  }

  static String _forecastSummary(List<ProgressTimelinePoint> timeline) {
    final projected = _project30Days(timeline);
    if (projected == null) {
      return 'قارنا آخر تحليلين — راجعي Trends أدناه.';
    }
    return 'إذا استمررتِ على روتينك، قد يصل مؤشرك إلى $projected خلال 30 يوماً (تقدير خطي).';
  }

  static int? _project30Days(List<ProgressTimelinePoint> timeline) {
    if (timeline.length < 2) return null;
    final first = timeline.first;
    final last = timeline.last;
    final daySpan = last.createdAt.difference(first.createdAt).inDays.clamp(1, 3650);
    final slope = (last.overallScore - first.overallScore) / daySpan;
    return (last.overallScore + slope * 30).round().clamp(0, 100);
  }

  static List<ProgressMilestone> _milestones(
    int scanCount,
    List<ProgressMetricTrend> trends,
  ) {
    final items = <ProgressMilestone>[
      const ProgressMilestone(
        id: 'first_scan',
        titleAr: 'أول تحليل ✨',
        descriptionAr: 'بدأتِ رحلة متابعة بشرتك مع ميرا.',
      ),
    ];
    if (scanCount >= 2) {
      items.add(
        const ProgressMilestone(
          id: 'second_scan',
          titleAr: 'متابعة منتظمة',
          descriptionAr: 'تحليلان أو أكثر — Trends أصبحت متاحة.',
        ),
      );
    }
    for (final trend in trends) {
      if (trend.isImproved && trend.deltaPoints >= 8) {
        items.add(
          ProgressMilestone(
            id: 'milestone_${trend.id}',
            titleAr: trend.messageAr,
            descriptionAr:
                'من ${trend.previousScore} إلى ${trend.currentScore} — استمري على هذا الروتين.',
          ),
        );
      }
    }
    return items.take(5).toList();
  }
}
