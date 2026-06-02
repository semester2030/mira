import '../../skin_analysis/domain/entities/skin_report.dart';

abstract final class MarketplaceMatching {
  MarketplaceMatching._();

  static Map<String, int> concernsFromReport(SkinReport report) {
    if (report.concernScores.isNotEmpty) {
      return Map<String, int>.from(report.concernScores);
    }
    return {
      'moisture': report.hydration,
      'oiliness': (100 - report.oiliness.clamp(0, 100)).round(),
      'pore': _severityToUi(report.pores),
      'wrinkle': _severityToUi(report.wrinkles),
      'age_spot': _severityToUi(report.spots),
      'acne': _severityToUi(report.acne),
      'redness': _severityToUi(report.redness),
      'texture': ((report.hydration + _severityToUi(report.pores)) / 2).round(),
      'dark_circle':
          ((report.hydration + _severityToUi(report.wrinkles)) / 2).round(),
      'radiance':
          ((report.hydration + (100 - report.oiliness)) / 2).round(),
    };
  }

  static int scoreTags(
    List<String> tags,
    Map<String, int> concerns, {
    String skinTypeAr = '',
  }) {
    if (tags.isEmpty) return 50;
    var total = 0;
    var count = 0;
    for (final tag in tags) {
      final ui = concerns[tag];
      if (ui == null) continue;
      final need = 100 - ui;
      if (need < 15) continue;
      total += need;
      count++;
    }
    if (count == 0) return 40;
    return (total / tags.length).round().clamp(0, 100);
  }

  static int _severityToUi(int severity0to5) {
    return ((5 - severity0to5.clamp(0, 5)) / 5 * 100).round();
  }
}
