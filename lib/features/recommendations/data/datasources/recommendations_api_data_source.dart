import 'package:dio/dio.dart';

import '../../../../core/ai/models/localized_summary.dart';
import '../../../../core/ai/models/makeup_recommendation.dart';
import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/ai/models/mira_recommendation.dart';
import '../../../../core/ai/models/outfit_analysis_result.dart';
import '../../../../core/ai/models/skin_analysis_result.dart';
import '../../../../core/ai/models/styling_recommendation.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/mira_api_endpoints.dart';

class RecommendationsApiDataSource {
  final Dio _dio;

  RecommendationsApiDataSource({Dio? dio}) : _dio = dio ?? ApiClient.instance;

  Future<MiraRecommendation> build({
    required SkinAnalysisResult skin,
    OutfitAnalysisResult? outfit,
    MiraOccasion? occasion,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      MiraApiEndpoints.recommendations,
      data: {
        'skin': _skinToJson(skin),
        if (outfit != null) 'outfit': _outfitToJson(outfit),
        if (occasion != null) 'occasion': occasion.id,
      },
    );

    final data = response.data;
    if (data == null) throw Exception('استجابة فارغة من الخادم');

    return _parseRecommendation(data);
  }

  Map<String, dynamic> _skinToJson(SkinAnalysisResult s) => {
        'beautyScore': s.beautyScore,
        'skinTypeAr': s.skinTypeAr,
        'skinTypeEn': s.skinTypeEn,
        'hydration': s.hydration,
        'oiliness': s.oiliness,
        'pores': s.pores,
        'wrinkles': s.wrinkles,
        'darkSpots': s.darkSpots,
        'acne': s.acne,
        'redness': s.redness,
        'undertoneAr': s.undertoneAr,
        'undertoneEn': s.undertoneEn,
        'skinToneAr': s.skinToneAr,
        'skinToneEn': s.skinToneEn,
        'recommendationsAr': s.recommendationsAr,
        'recommendationsEn': s.recommendationsEn,
      };

  Map<String, dynamic> _outfitToJson(OutfitAnalysisResult o) => {
        'compatibilityScore': o.compatibilityScore,
        'dominantColors': o.dominantColors,
        'garmentTypeAr': o.garmentTypeAr,
        'garmentTypeEn': o.garmentTypeEn,
        'styleCategoryAr': o.styleCategoryAr,
        'styleCategoryEn': o.styleCategoryEn,
        'occasionSuitabilityAr': o.occasionSuitabilityAr,
        'occasionSuitabilityEn': o.occasionSuitabilityEn,
        'alternativeColorsAr': o.alternativeColorsAr,
        'alternativeColorsEn': o.alternativeColorsEn,
        'occasion': o.occasion.id,
      };

  MiraRecommendation _parseRecommendation(Map<String, dynamic> json) {
    final skinJson = json['skin'] as Map<String, dynamic>;
    final skin = SkinAnalysisResult(
      beautyScore: (skinJson['beautyScore'] as num).toDouble(),
      skinTypeAr: skinJson['skinTypeAr'] as String,
      skinTypeEn: skinJson['skinTypeEn'] as String,
      hydration: (skinJson['hydration'] as num).toInt(),
      oiliness: (skinJson['oiliness'] as num).toInt(),
      pores: (skinJson['pores'] as num).toInt(),
      wrinkles: (skinJson['wrinkles'] as num).toInt(),
      darkSpots: (skinJson['darkSpots'] as num).toInt(),
      acne: (skinJson['acne'] as num).toInt(),
      redness: (skinJson['redness'] as num).toInt(),
      undertoneAr: skinJson['undertoneAr'] as String,
      undertoneEn: skinJson['undertoneEn'] as String,
      skinToneAr: skinJson['skinToneAr'] as String,
      skinToneEn: skinJson['skinToneEn'] as String,
      recommendationsAr: (skinJson['recommendationsAr'] as List<dynamic>)
          .map((e) => e.toString())
          .toList(),
      recommendationsEn: (skinJson['recommendationsEn'] as List<dynamic>)
          .map((e) => e.toString())
          .toList(),
    );

    OutfitAnalysisResult? outfit;
    final outfitJson = json['outfit'] as Map<String, dynamic>?;
    if (outfitJson != null) {
      final occasionId = outfitJson['occasion'] as String? ?? 'casual';
      final occasion = MiraOccasion.values.firstWhere(
        (o) => o.id == occasionId,
        orElse: () => MiraOccasion.casual,
      );
      outfit = OutfitAnalysisResult(
        compatibilityScore: (outfitJson['compatibilityScore'] as num).toDouble(),
        dominantColors: (outfitJson['dominantColors'] as List<dynamic>)
            .map((e) => e.toString())
            .toList(),
        garmentTypeAr: outfitJson['garmentTypeAr'] as String,
        garmentTypeEn: outfitJson['garmentTypeEn'] as String,
        styleCategoryAr: outfitJson['styleCategoryAr'] as String,
        styleCategoryEn: outfitJson['styleCategoryEn'] as String,
        occasionSuitabilityAr: outfitJson['occasionSuitabilityAr'] as String,
        occasionSuitabilityEn: outfitJson['occasionSuitabilityEn'] as String,
        alternativeColorsAr: (outfitJson['alternativeColorsAr'] as List<dynamic>)
            .map((e) => e.toString())
            .toList(),
        alternativeColorsEn: (outfitJson['alternativeColorsEn'] as List<dynamic>)
            .map((e) => e.toString())
            .toList(),
        occasion: occasion,
      );
    }

    final makeupJson = json['makeup'] as Map<String, dynamic>;
    final stylingJson = json['styling'] as Map<String, dynamic>;
    final summaryJson = json['summary'] as Map<String, dynamic>;

    final occasionRaw = json['occasion'] as String?;
    final occasion = MiraOccasion.fromId(occasionRaw);

    return MiraRecommendation(
      skin: skin,
      outfit: outfit,
      makeup: MakeupRecommendation(
        lipstickAr: makeupJson['lipstickAr'] as String,
        lipstickEn: makeupJson['lipstickEn'] as String,
        eyeshadowAr: makeupJson['eyeshadowAr'] as String,
        eyeshadowEn: makeupJson['eyeshadowEn'] as String,
        blushAr: makeupJson['blushAr'] as String,
        blushEn: makeupJson['blushEn'] as String,
      ),
      styling: StylingRecommendation(
        accessoriesAr: (stylingJson['accessoriesAr'] as List<dynamic>)
            .map((e) => e.toString())
            .toList(),
        accessoriesEn: (stylingJson['accessoriesEn'] as List<dynamic>)
            .map((e) => e.toString())
            .toList(),
      ),
      summary: LocalizedSummary(
        ar: summaryJson['ar'] as String,
        en: summaryJson['en'] as String,
      ),
      occasion: occasion,
    );
  }
}
