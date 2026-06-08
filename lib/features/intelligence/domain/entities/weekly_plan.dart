class WeeklyPlanDay {
  final int dayIndex;
  final String labelAr;
  final String focusAr;
  final List<String> stepsAr;

  const WeeklyPlanDay({
    required this.dayIndex,
    required this.labelAr,
    required this.focusAr,
    required this.stepsAr,
  });
}

class WeeklyPlan {
  final bool enabled;
  final String headlineAr;
  final String summaryAr;
  final List<WeeklyPlanDay> days;

  const WeeklyPlan({
    required this.enabled,
    required this.headlineAr,
    required this.summaryAr,
    required this.days,
  });

  static const empty = WeeklyPlan(
    enabled: false,
    headlineAr: '',
    summaryAr: '',
    days: [],
  );
}
