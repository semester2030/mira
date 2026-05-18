import { MiraOccasion } from './mira-occasion';
import { OutfitAnalysisResult } from './outfit-analysis-result.interface';
import { SkinAnalysisResult } from './skin-analysis-result.interface';

export interface MakeupRecommendation {
  lipstickAr: string;
  lipstickEn: string;
  eyeshadowAr: string;
  eyeshadowEn: string;
  blushAr: string;
  blushEn: string;
}

export interface StylingRecommendation {
  accessoriesAr: string[];
  accessoriesEn: string[];
}

export interface LocalizedSummary {
  ar: string;
  en: string;
}

export interface MiraRecommendation {
  skin: SkinAnalysisResult;
  outfit?: OutfitAnalysisResult;
  makeup: MakeupRecommendation;
  styling: StylingRecommendation;
  summary: LocalizedSummary;
  occasion?: MiraOccasion;
}
