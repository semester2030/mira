import '../../../intelligence/domain/entities/mira_style_report.dart';

abstract final class MiraStyleReportMapper {
  static MiraStyleReport fromJson(Map<String, dynamic> json) {
    return MiraStyleReport(
      version: (json['version'] as num?)?.toInt() ?? 1,
      outfitScore: (json['outfitScore'] as num?)?.toInt() ?? 0,
      confidence: (json['confidence'] as num?)?.toInt() ?? 70,
      severityLevel: json['severityLevel'] as String? ?? '',
      strongestIssueAr: json['strongestIssueAr'] as String? ?? '',
      improvementPotential: (json['improvementPotential'] as num?)?.toInt() ?? 0,
      occasionReady: json['occasionReady'] as bool? ?? false,
      styleCategoryAr: json['styleCategoryAr'] as String? ?? '',
      styleCategoryEn: json['styleCategoryEn'] as String? ?? '',
      garmentTypeAr: json['garmentTypeAr'] as String? ?? '',
      colorCompatibilityAr: json['colorCompatibilityAr'] as String? ?? '',
      dominantColorsAr: (json['dominantColorsAr'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      alternativeLooksAr: (json['alternativeLooksAr'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      occasionSuitabilityAr: json['occasionSuitabilityAr'] as String? ?? '',
      headlineAr: json['headlineAr'] as String? ?? '',
      summaryAr: json['summaryAr'] as String? ?? '',
      styleTipsAr: (json['styleTipsAr'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      disclaimerAr: json['disclaimerAr'] as String? ?? '',
    );
  }
}
