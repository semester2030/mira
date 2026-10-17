import '../entities/outfit_analysis.dart';

/// Maps Vision Platform [OutfitAnalysis] to MCE intelligence snapshot payload.
abstract final class OutfitConsultationMapper {
  static Map<String, dynamic> toSnapshotPayload(
    OutfitAnalysis analysis, {
    String? imageFingerprint,
  }) {
    return {
      'occasionId': analysis.occasion.id,
      'intelligence': {
        'occasionId': analysis.occasion.id,
        if (analysis.scoreSupported) 'compatibilityScore': analysis.compatibilityScore,
        if (analysis.scoreSupported) 'colorHarmonyScore': analysis.colorHarmonyScore,
        if (analysis.scoreSupported) 'occasionMatchScore': analysis.occasionMatchScore,
        if (analysis.scoreSupported) 'styleBalanceScore': analysis.styleBalanceScore,
        if (analysis.scoreSupported) 'skinCompatibilityScore': analysis.skinCompatibilityScore,
        'analysisGate': analysis.analysisGate,
        'clothingTypeAr': analysis.clothingType,
        'styleTypeAr': analysis.styleType,
        'dominantColorsAr': analysis.dominantColors,
        'recommendedColorsAr': analysis.recommendedColors,
        'rejectedColorsAr': analysis.rejectedColors,
        'styleVerdictAr': analysis.styleVerdict.isNotEmpty
            ? analysis.styleVerdict
            : analysis.explanation,
        'matchReasonsAr': analysis.matchReasons,
        'mismatchReasonsAr': analysis.mismatchReasons,
        'suggestedAccessoriesAr': analysis.suggestedAccessories,
        if (analysis.suggestedMakeup.isNotEmpty)
          'suggestedMakeupAr': analysis.suggestedMakeup,
        'analysisSource': analysis.analysisSource,
        if (imageFingerprint != null && imageFingerprint.isNotEmpty)
          'imageFingerprint': imageFingerprint,
        'analysisVersion': 'outfit-intel-v2',
      },
    };
  }

  static const outfitStarterQuestions = [
    'هل تناسب إطلالتي هذه المناسبة؟',
    'ما اللون الأنسب للحذاء؟',
    'كيف أرفع تناسق الألوان؟',
    'ما الإكسسوار الذي يكمل الإطلالة؟',
  ];
}
