import { MiraOccasion } from './mira-occasion';
import { OutfitStyleMetrics } from './outfit-style-metrics.interface';

export interface OutfitAnalysisResult {
  compatibilityScore: number;
  dominantColors: string[];
  garmentTypeAr: string;
  garmentTypeEn: string;
  styleCategoryAr: string;
  styleCategoryEn: string;
  occasionSuitabilityAr: string;
  occasionSuitabilityEn: string;
  alternativeColorsAr: string[];
  alternativeColorsEn: string[];
  occasion: MiraOccasion;
  styleMetrics?: OutfitStyleMetrics;
}
