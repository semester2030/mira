export interface SkinAnalysisResult {
  beautyScore: number;
  skinTypeAr: string;
  skinTypeEn: string;
  hydration: number;
  oiliness: number;
  pores: number;
  wrinkles: number;
  darkSpots: number;
  acne: number;
  redness: number;
  undertoneAr: string;
  undertoneEn: string;
  skinToneAr: string;
  skinToneEn: string;
  recommendationsAr: string[];
  recommendationsEn: string[];
}
