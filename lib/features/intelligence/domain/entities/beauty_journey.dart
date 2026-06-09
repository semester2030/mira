class JourneyPriority {
  final int rank;
  final String concernId;
  final String labelAr;
  final int currentScore;
  final int expectedGainPoints;
  final String rationaleAr;

  const JourneyPriority({
    required this.rank,
    required this.concernId,
    required this.labelAr,
    required this.currentScore,
    required this.expectedGainPoints,
    required this.rationaleAr,
  });
}

class JourneyGoal {
  final String metricId;
  final String labelAr;
  final int currentValue;
  final int targetValue;
  final int horizonDays;
  final String headlineAr;
  final String summaryAr;

  const JourneyGoal({
    required this.metricId,
    required this.labelAr,
    required this.currentValue,
    required this.targetValue,
    required this.horizonDays,
    required this.headlineAr,
    required this.summaryAr,
  });
}

class BeautyJourney {
  final bool enabled;
  final String headlineAr;
  final String summaryAr;
  final int currentOverallScore;
  final JourneyGoal nextGoal;
  final JourneyPriority? topOpportunity;
  final List<JourneyPriority> priorities;
  final String planSummaryAr;
  final String followUpAr;

  const BeautyJourney({
    required this.enabled,
    required this.headlineAr,
    required this.summaryAr,
    required this.currentOverallScore,
    required this.nextGoal,
    this.topOpportunity,
    required this.priorities,
    required this.planSummaryAr,
    required this.followUpAr,
  });

  static BeautyJourney empty(int score) => BeautyJourney(
        enabled: false,
        headlineAr: 'رحلة عنايتك',
        summaryAr: 'أجري تحليلاً لبدء رحلتك مع ميرا.',
        currentOverallScore: score,
        nextGoal: JourneyGoal(
          metricId: 'overall',
          labelAr: 'مؤشر جمال البشرة',
          currentValue: score,
          targetValue: score,
          horizonDays: 30,
          headlineAr: '',
          summaryAr: '',
        ),
        priorities: const [],
        planSummaryAr: '',
        followUpAr: '',
      );
}
