const overallComparisonUnavailableAr =
    'لا تتوفر بيانات كافية لمقارنة المؤشر العام بين هذين التحليلين';

class ProgressTimelinePoint {
  final String analysisId;
  final DateTime createdAt;
  final int? overallScore;

  /// True only when this point's overall score was eligible. A missing value is not proof.
  final bool? overallScoreAvailable;

  const ProgressTimelinePoint({
    required this.analysisId,
    required this.createdAt,
    required this.overallScore,
    this.overallScoreAvailable,
  });
}

class ProgressMetricTrend {
  final String id;
  final String labelAr;
  final int previousScore;
  final int currentScore;
  final int deltaPoints;
  final String direction;
  final String messageAr;

  const ProgressMetricTrend({
    required this.id,
    required this.labelAr,
    required this.previousScore,
    required this.currentScore,
    required this.deltaPoints,
    required this.direction,
    required this.messageAr,
  });

  bool get isImproved => direction == 'improved';
  bool get isRegressed => direction == 'regressed';
}

class ProgressMilestone {
  final String id;
  final String titleAr;
  final String descriptionAr;

  const ProgressMilestone({
    required this.id,
    required this.titleAr,
    required this.descriptionAr,
  });
}

class ProgressForecast {
  final bool enabled;
  final int scanCount;
  final bool needsMoreScans;
  final String headlineAr;
  final String summaryAr;
  final List<ProgressTimelinePoint> timeline;
  final List<ProgressMetricTrend> trends;
  final List<ProgressMilestone> milestones;
  final int? projectedOverallScore30Days;

  const ProgressForecast({
    required this.enabled,
    required this.scanCount,
    required this.needsMoreScans,
    required this.headlineAr,
    required this.summaryAr,
    required this.timeline,
    required this.trends,
    required this.milestones,
    this.    projectedOverallScore30Days,
  });

  /// Display copy. The current report flag does not prove every history point.
  ProgressForecast forStoredDisplay({required bool? reportOverallAvailable}) {
    final pointsProven = timeline.length >= 2 &&
        timeline.every(
          (point) => point.overallScoreAvailable == true && point.overallScore != null,
        );
    if (reportOverallAvailable == true && pointsProven) return this;
    return ProgressForecast(
      enabled: enabled,
      scanCount: scanCount,
      needsMoreScans: needsMoreScans,
      headlineAr: overallComparisonUnavailableAr,
      summaryAr: overallComparisonUnavailableAr,
      timeline: [
        for (final point in timeline)
          ProgressTimelinePoint(
            analysisId: point.analysisId,
            createdAt: point.createdAt,
            overallScore: null,
            overallScoreAvailable: false,
          ),
      ],
      trends: [
        for (final trend in trends)
          if (trend.id != 'overall') trend,
      ],
      milestones: [
        for (final milestone in milestones)
          if (!_overallMilestone(milestone)) milestone,
      ],
      projectedOverallScore30Days: null,
    );
  }

  static bool _overallMilestone(ProgressMilestone milestone) {
    if (milestone.id == 'overall' || milestone.id.startsWith('milestone_overall')) {
      return true;
    }
    return milestone.titleAr.contains('مؤشر الجمال') ||
        milestone.descriptionAr.contains('مؤشر الجمال');
  }

  static const empty = ProgressForecast(
    enabled: false,
    scanCount: 0,
    needsMoreScans: true,
    headlineAr: 'تابعي تقدمك',
    summaryAr: 'بعد تحليل ثانٍ ستظهر Trends ومقارنة بين زيارتك.',
    timeline: [],
    trends: [],
    milestones: [],
  );
}
