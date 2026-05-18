import '../models/localized_summary.dart';
import '../models/makeup_recommendation.dart';
import '../models/mira_occasion.dart';
import '../models/mira_recommendation.dart';
import '../models/outfit_analysis_result.dart';
import '../models/skin_analysis_result.dart';
import '../models/styling_recommendation.dart';

/// Proprietary Mira rules layer — combines skin + outfit + occasion.
/// Provider adapters supply raw AI; this engine produces user-facing guidance.
class MiraRecommendationEngine {
  MiraRecommendation build({
    required SkinAnalysisResult skin,
    OutfitAnalysisResult? outfit,
    MiraOccasion? occasion,
  }) {
    final resolvedOccasion = occasion ?? outfit?.occasion;
    final makeup = _makeupFor(skin);
    final styling = _stylingFor(skin, outfit, resolvedOccasion);
    final summary = _summary(skin, outfit, resolvedOccasion);

    return MiraRecommendation(
      skin: skin,
      outfit: outfit,
      makeup: makeup,
      styling: styling,
      summary: summary,
      occasion: resolvedOccasion,
    );
  }

  MakeupRecommendation _makeupFor(SkinAnalysisResult skin) {
    final undertone = skin.undertoneEn.toLowerCase();
    if (undertone == 'warm') {
      return const MakeupRecommendation(
        lipstickAr: 'نود دافئ',
        lipstickEn: 'Warm Nude',
        eyeshadowAr: 'برونزي لامع',
        eyeshadowEn: 'Bronze Glow',
        blushAr: 'خوخي',
        blushEn: 'Peach Blush',
      );
    }
    if (undertone == 'cool') {
      return const MakeupRecommendation(
        lipstickAr: 'وردي بارد',
        lipstickEn: 'Cool Rose',
        eyeshadowAr: 'موف ناعم',
        eyeshadowEn: 'Soft Mauve',
        blushAr: 'وردي فاتح',
        blushEn: 'Pink Blush',
      );
    }
    return const MakeupRecommendation(
      lipstickAr: 'وردي محايد',
      lipstickEn: 'Neutral Pink',
      eyeshadowAr: 'بني ناعم',
      eyeshadowEn: 'Soft Brown',
      blushAr: 'طبيعي',
      blushEn: 'Natural Blush',
    );
  }

  StylingRecommendation _stylingFor(
    SkinAnalysisResult skin,
    OutfitAnalysisResult? outfit,
    MiraOccasion? occasion,
  ) {
    final undertone = skin.undertoneEn.toLowerCase();
    final metal = undertone == 'cool' ? 'فضي' : 'ذهبي';
    final metalEn = undertone == 'cool' ? 'Silver' : 'Gold';

    final accessoriesAr = <String>[
      'أقراط $metal',
      if (occasion == MiraOccasion.wedding || occasion == MiraOccasion.eid)
        'حقيبة clutch أنيقة'
      else if (occasion == MiraOccasion.work || occasion == MiraOccasion.interview)
        'حقيبة يد مهنية'
      else
        'حقيبة يد يومية',
    ];

    final accessoriesEn = <String>[
      '$metalEn Earrings',
      if (occasion == MiraOccasion.wedding || occasion == MiraOccasion.eid)
        'Elegant Clutch'
      else if (occasion == MiraOccasion.work || occasion == MiraOccasion.interview)
        'Professional Handbag'
      else
        'Day Handbag',
    ];

    if (outfit != null && outfit.dominantColors.isNotEmpty) {
      accessoriesAr.add('يتناسق مع ${outfit.dominantColors.first}');
      accessoriesEn.add('Pairs with ${outfit.dominantColors.first}');
    }

    return StylingRecommendation(
      accessoriesAr: accessoriesAr,
      accessoriesEn: accessoriesEn,
    );
  }

  LocalizedSummary _summary(
    SkinAnalysisResult skin,
    OutfitAnalysisResult? outfit,
    MiraOccasion? occasion,
  ) {
    if (outfit != null && occasion != null) {
      return LocalizedSummary(
        ar:
            'إطلالتك ${outfit.occasionSuitabilityAr.split(' ').first} لمناسبة ${occasion.labelAr} '
            'وتنسجم مع بشرتك ${skin.skinTypeAr} ذات اللون ${skin.undertoneAr}.',
        en:
            'Your look is ${outfit.occasionSuitabilityEn.toLowerCase()} for ${occasion.labelEn} '
            'and complements your ${skin.skinTypeEn} skin with a ${skin.undertoneEn} undertone.',
      );
    }

    return LocalizedSummary(
      ar:
          'بشرتك ${skin.skinTypeAr} مع لون ${skin.undertoneAr} — ركزي على الترطيب والحماية اليومية.',
      en:
          'Your ${skin.skinTypeEn} skin with a ${skin.undertoneEn} undertone — focus on hydration and daily protection.',
    );
  }
}
