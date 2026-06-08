class AgeComparisonInsight {
  final String id;
  final String titleAr;
  final String bodyAr;

  const AgeComparisonInsight({
    required this.id,
    required this.titleAr,
    required this.bodyAr,
  });
}

class AgeComparison {
  final bool enabled;
  final int? userAge;
  final int? skinAge;
  final int? deltaYears;
  final String headlineAr;
  final String summaryAr;
  final List<String> causesAr;
  final List<String> opportunitiesAr;
  final List<AgeComparisonInsight> insights;
  final String? suppressedReason;

  const AgeComparison({
    required this.enabled,
    this.userAge,
    this.skinAge,
    this.deltaYears,
    required this.headlineAr,
    required this.summaryAr,
    required this.causesAr,
    required this.opportunitiesAr,
    required this.insights,
    this.suppressedReason,
  });

  bool get needsBirthYear => suppressedReason == 'missing_birth_year';
  bool get isMinorRestricted => suppressedReason == 'minor_user';
}

class ChildSafety {
  final bool isMinor;
  final int ageThreshold;
  final List<String> restrictionsApplied;
  final String? messageAr;

  const ChildSafety({
    required this.isMinor,
    required this.ageThreshold,
    required this.restrictionsApplied,
    this.messageAr,
  });

  static const none = ChildSafety(
    isMinor: false,
    ageThreshold: 16,
    restrictionsApplied: [],
  );
}
