import '../../../../core/ai/models/mira_occasion.dart';
import '../entities/outfit_analysis.dart';
import '../entities/outfit_report.dart';

/// Lightweight outfit record for side-by-side comparison.
class OutfitCompareSnapshot {
  final String id;
  final String labelAr;
  final MiraOccasion occasion;
  final int compatibilityScore;
  final int occasionMatchScore;
  final int colorHarmonyScore;
  final int skinCompatibilityScore;
  final List<String> dominantColors;
  final String styleType;
  final String clothingType;
  final DateTime? createdAt;
  final bool hasSkinLink;

  const OutfitCompareSnapshot({
    required this.id,
    required this.labelAr,
    required this.occasion,
    required this.compatibilityScore,
    required this.occasionMatchScore,
    required this.colorHarmonyScore,
    this.skinCompatibilityScore = 0,
    this.dominantColors = const [],
    this.styleType = '',
    this.clothingType = '',
    this.createdAt,
    this.hasSkinLink = false,
  });

  factory OutfitCompareSnapshot.fromAnalysis(OutfitAnalysis analysis) {
    return OutfitCompareSnapshot(
      id: 'current_${analysis.occasion.id}_${analysis.compatibilityScore}',
      labelAr: '${analysis.occasion.labelAr} · ${analysis.clothingType.isNotEmpty ? analysis.clothingType : analysis.styleType}',
      occasion: analysis.occasion,
      compatibilityScore: analysis.compatibilityScore,
      occasionMatchScore: analysis.occasionMatchScore,
      colorHarmonyScore: analysis.colorHarmonyScore,
      skinCompatibilityScore: analysis.skinCompatibilityScore,
      dominantColors: analysis.dominantColors,
      styleType: analysis.styleType,
      clothingType: analysis.clothingType,
      createdAt: DateTime.now(),
      hasSkinLink: analysis.isSmartMode && analysis.skinCompatibilityScore > 0,
    );
  }

  factory OutfitCompareSnapshot.fromReport(OutfitReport report) {
    final main = report.miraStyleReport?.outfitScore ?? report.compatibilityScore.round();
    final fusion = report.styleFusion;
    final linked = report.linkedSkin;
    final skinScore = fusion?.enabled == true
        ? (main + 4).clamp(0, 100)
        : (linked != null ? (main + 2).clamp(0, 100) : 0);

    return OutfitCompareSnapshot(
      id: report.id ?? 'history_${report.createdAt?.millisecondsSinceEpoch ?? 0}',
      labelAr: '${report.occasionLabelAr} · ${report.garmentType}',
      occasion: MiraOccasion.fromId(report.occasionId) ?? MiraOccasion.casual,
      compatibilityScore: main,
      occasionMatchScore: (main - 2).clamp(0, 100),
      colorHarmonyScore: (main + 1).clamp(0, 100),
      skinCompatibilityScore: skinScore,
      dominantColors: report.dominantColors,
      styleType: report.styleCategory,
      clothingType: report.garmentType,
      createdAt: report.createdAt,
      hasSkinLink: fusion?.enabled == true || linked != null,
    );
  }
}

class OutfitCompareDimension {
  final String labelAr;
  final int leftScore;
  final int rightScore;

  const OutfitCompareDimension({
    required this.labelAr,
    required this.leftScore,
    required this.rightScore,
  });

  bool get leftWins => leftScore > rightScore;
  bool get rightWins => rightScore > leftScore;
  bool get isTie => leftScore == rightScore;
}

class OutfitCompareVerdict {
  final OutfitCompareSnapshot left;
  final OutfitCompareSnapshot right;
  final List<OutfitCompareDimension> dimensions;
  final String headlineAr;
  final String summaryAr;
  final String? winnerSide;

  const OutfitCompareVerdict({
    required this.left,
    required this.right,
    required this.dimensions,
    required this.headlineAr,
    required this.summaryAr,
    this.winnerSide,
  });
}
