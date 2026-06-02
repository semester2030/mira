import 'package:equatable/equatable.dart';

/// Canonical skin analysis output (provider-agnostic contract).
/// Maps to Perfect Corp / Revieve / Haut.AI when API keys are configured.
class SkinAnalysisResult extends Equatable {
  final double beautyScore;
  final String skinTypeAr;
  final String skinTypeEn;
  final int hydration;
  final int oiliness;
  final int pores;
  final int wrinkles;
  final int darkSpots;
  final int acne;
  final int redness;
  final String undertoneAr;
  final String undertoneEn;
  final String skinToneAr;
  final String skinToneEn;
  final List<String> recommendationsAr;
  final List<String> recommendationsEn;
  final int? skinAge;
  final Map<String, int> concernScores;

  const SkinAnalysisResult({
    required this.beautyScore,
    required this.skinTypeAr,
    required this.skinTypeEn,
    required this.hydration,
    required this.oiliness,
    required this.pores,
    required this.wrinkles,
    required this.darkSpots,
    required this.acne,
    required this.redness,
    required this.undertoneAr,
    required this.undertoneEn,
    required this.skinToneAr,
    required this.skinToneEn,
    required this.recommendationsAr,
    required this.recommendationsEn,
    this.skinAge,
    this.concernScores = const {},
  });

  String get primaryRecommendationAr =>
      recommendationsAr.isNotEmpty ? recommendationsAr.first : '';

  String get primaryRecommendationEn =>
      recommendationsEn.isNotEmpty ? recommendationsEn.first : '';

  @override
  List<Object?> get props => [
        beautyScore,
        skinTypeAr,
        skinTypeEn,
        hydration,
        oiliness,
        pores,
        wrinkles,
        darkSpots,
        acne,
        redness,
        undertoneAr,
        undertoneEn,
        skinToneAr,
        skinToneEn,
        recommendationsAr,
        recommendationsEn,
        skinAge,
        concernScores,
      ];
}
