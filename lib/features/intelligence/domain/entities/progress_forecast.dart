class ProgressTimelinePoint {
  final String analysisId;
  final DateTime createdAt;
  final int overallScore;

  const ProgressTimelinePoint({
    required this.analysisId,
    required this.createdAt,
    required this.overallScore,
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
    this.projectedOverallScore30Days,
  });

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
