import '../../../intelligence/domain/entities/mira_style_report.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';

class OutfitReport {
  final String? id;
  final double compatibilityScore;
  final List<String> dominantColors;
  final String garmentType;
  final String garmentTypeEn;
  final String styleCategory;
  final String styleCategoryEn;
  final String occasionSuitability;
  final String occasionSuitabilityEn;
  final List<String> alternativeColors;
  final List<String> alternativeColorsEn;
  final String occasionId;
  final String occasionLabelAr;
  final DateTime? createdAt;
  final MiraStyleReport? miraStyleReport;
  final StyleFusion? styleFusion;
  final SkinReport? linkedSkin;

  const OutfitReport({
    this.id,
    required this.compatibilityScore,
    required this.dominantColors,
    required this.garmentType,
    this.garmentTypeEn = '',
    required this.styleCategory,
    this.styleCategoryEn = '',
    required this.occasionSuitability,
    this.occasionSuitabilityEn = '',
    required this.alternativeColors,
    this.alternativeColorsEn = const [],
    required this.occasionId,
    required this.occasionLabelAr,
    this.createdAt,
    this.miraStyleReport,
    this.styleFusion,
    this.linkedSkin,
  });

  OutfitReport copyWith({
    String? id,
    double? compatibilityScore,
    List<String>? dominantColors,
    String? garmentType,
    String? garmentTypeEn,
    String? styleCategory,
    String? styleCategoryEn,
    String? occasionSuitability,
    String? occasionSuitabilityEn,
    List<String>? alternativeColors,
    List<String>? alternativeColorsEn,
    String? occasionId,
    String? occasionLabelAr,
    DateTime? createdAt,
    MiraStyleReport? miraStyleReport,
    StyleFusion? styleFusion,
    SkinReport? linkedSkin,
  }) {
    return OutfitReport(
      id: id ?? this.id,
      compatibilityScore: compatibilityScore ?? this.compatibilityScore,
      dominantColors: dominantColors ?? this.dominantColors,
      garmentType: garmentType ?? this.garmentType,
      garmentTypeEn: garmentTypeEn ?? this.garmentTypeEn,
      styleCategory: styleCategory ?? this.styleCategory,
      styleCategoryEn: styleCategoryEn ?? this.styleCategoryEn,
      occasionSuitability: occasionSuitability ?? this.occasionSuitability,
      occasionSuitabilityEn: occasionSuitabilityEn ?? this.occasionSuitabilityEn,
      alternativeColors: alternativeColors ?? this.alternativeColors,
      alternativeColorsEn: alternativeColorsEn ?? this.alternativeColorsEn,
      occasionId: occasionId ?? this.occasionId,
      occasionLabelAr: occasionLabelAr ?? this.occasionLabelAr,
      createdAt: createdAt ?? this.createdAt,
      miraStyleReport: miraStyleReport ?? this.miraStyleReport,
      styleFusion: styleFusion ?? this.styleFusion,
      linkedSkin: linkedSkin ?? this.linkedSkin,
    );
  }
}
