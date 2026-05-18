import { Injectable } from '@nestjs/common';
import {
  MIRA_OCCASION_LABELS,
  MiraOccasion,
} from '../contracts/mira-occasion';
import {
  LocalizedSummary,
  MakeupRecommendation,
  MiraRecommendation,
  StylingRecommendation,
} from '../contracts/mira-recommendation.interface';
import { OutfitAnalysisResult } from '../contracts/outfit-analysis-result.interface';
import { SkinAnalysisResult } from '../contracts/skin-analysis-result.interface';

@Injectable()
export class MiraRecommendationEngine {
  build(params: {
    skin: SkinAnalysisResult;
    outfit?: OutfitAnalysisResult;
    occasion?: MiraOccasion;
  }): MiraRecommendation {
    const occasion = params.occasion ?? params.outfit?.occasion;
    return {
      skin: params.skin,
      outfit: params.outfit,
      makeup: this.makeupFor(params.skin),
      styling: this.stylingFor(params.skin, params.outfit, occasion),
      summary: this.summary(params.skin, params.outfit, occasion),
      occasion,
    };
  }

  private makeupFor(skin: SkinAnalysisResult): MakeupRecommendation {
    const undertone = skin.undertoneEn.toLowerCase();
    if (undertone === 'warm') {
      return {
        lipstickAr: 'نود دافئ',
        lipstickEn: 'Warm Nude',
        eyeshadowAr: 'برونزي لامع',
        eyeshadowEn: 'Bronze Glow',
        blushAr: 'خوخي',
        blushEn: 'Peach Blush',
      };
    }
    if (undertone === 'cool') {
      return {
        lipstickAr: 'وردي بارد',
        lipstickEn: 'Cool Rose',
        eyeshadowAr: 'موف ناعم',
        eyeshadowEn: 'Soft Mauve',
        blushAr: 'وردي فاتح',
        blushEn: 'Pink Blush',
      };
    }
    return {
      lipstickAr: 'وردي محايد',
      lipstickEn: 'Neutral Pink',
      eyeshadowAr: 'بني ناعم',
      eyeshadowEn: 'Soft Brown',
      blushAr: 'طبيعي',
      blushEn: 'Natural Blush',
    };
  }

  private stylingFor(
    skin: SkinAnalysisResult,
    outfit: OutfitAnalysisResult | undefined,
    occasion: MiraOccasion | undefined,
  ): StylingRecommendation {
    const undertone = skin.undertoneEn.toLowerCase();
    const metal = undertone === 'cool' ? 'فضي' : 'ذهبي';
    const metalEn = undertone === 'cool' ? 'Silver' : 'Gold';

    const accessoriesAr: string[] = [`أقراط ${metal}`];
    const accessoriesEn: string[] = [`${metalEn} Earrings`];

    if (occasion === MiraOccasion.Wedding || occasion === MiraOccasion.Eid) {
      accessoriesAr.push('حقيبة clutch أنيقة');
      accessoriesEn.push('Elegant Clutch');
    } else if (
      occasion === MiraOccasion.Work ||
      occasion === MiraOccasion.Interview
    ) {
      accessoriesAr.push('حقيبة يد مهنية');
      accessoriesEn.push('Professional Handbag');
    } else {
      accessoriesAr.push('حقيبة يد يومية');
      accessoriesEn.push('Day Handbag');
    }

    if (outfit?.dominantColors.length) {
      accessoriesAr.push(`يتناسق مع ${outfit.dominantColors[0]}`);
      accessoriesEn.push(`Pairs with ${outfit.dominantColors[0]}`);
    }

    return { accessoriesAr, accessoriesEn };
  }

  private summary(
    skin: SkinAnalysisResult,
    outfit: OutfitAnalysisResult | undefined,
    occasion: MiraOccasion | undefined,
  ): LocalizedSummary {
    if (outfit && occasion) {
      const labels = MIRA_OCCASION_LABELS[occasion];
      const levelAr = outfit.occasionSuitabilityAr.split(' ')[0];
      return {
        ar: `إطلالتك ${levelAr} لمناسبة ${labels.ar} وتنسجم مع بشرتك ${skin.skinTypeAr} ذات اللون ${skin.undertoneAr}.`,
        en: `Your look is ${outfit.occasionSuitabilityEn.toLowerCase()} for ${labels.en} and complements your ${skin.skinTypeEn} skin with a ${skin.undertoneEn} undertone.`,
      };
    }

    return {
      ar: `بشرتك ${skin.skinTypeAr} مع لون ${skin.undertoneAr} — ركزي على الترطيب والحماية اليومية.`,
      en: `Your ${skin.skinTypeEn} skin with a ${skin.undertoneEn} undertone — focus on hydration and daily protection.`,
    };
  }
}
