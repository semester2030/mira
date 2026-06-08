export interface MiraStyleReport {
  version: 1;
  outfitScore: number;
  styleCategoryAr: string;
  styleCategoryEn: string;
  garmentTypeAr: string;
  colorCompatibilityAr: string;
  dominantColorsAr: string[];
  alternativeLooksAr: string[];
  occasionSuitabilityAr: string;
  headlineAr: string;
  summaryAr: string;
}

export interface StyleFusionPayload {
  enabled: boolean;
  undertoneAr: string;
  undertoneEn: string;
  headlineAr: string;
  summaryAr: string;
  recommendedColorsAr: string[];
  avoidColorsAr: string[];
  makeupHintAr: string;
  accessoryHintAr: string;
}
