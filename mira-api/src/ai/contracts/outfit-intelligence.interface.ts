export interface OutfitVisualProfileDto {
  labels: string[];
  dominantColors: string[];
  clothingTypes: string[];
  accessoryTypes: string[];
  styleSignals: string[];
  textureHints: string[];
  confidence: number;
  source: string;
  garmentTypeAr: string;
  garmentTypeEn: string;
  styleTypeAr: string;
  styleTypeEn: string;
  contrastLevel: number;
  formalityLevel: number;
}

export interface OutfitIntelligenceAnalysisDto {
  clothingType: string;
  styleType: string;
  dominantColors: string[];
  compatibilityScore: number;
  recommendedColors: string[];
  rejectedColors: string[];
  suggestedAccessories: string[];
  suggestedMakeup: string;
  explanation: string;
  confidence: number;
  matchReasons: string[];
  mismatchReasons: string[];
  recommendations: string[];
  styleVerdict: string;
  detectedPieces: string[];
  visionLabels: string[];
  visualConfidence: number;
  contrastLevel: string;
  formalityLevel: string;
  analysisSource: string;
  visualSource: string;
  skinCompatibilityScore: number;
  occasionMatchScore: number;
  styleBalanceScore: number;
  colorHarmonyScore: number;
}

export interface OutfitIntelligenceResponseDto {
  visual: OutfitVisualProfileDto;
  analysis: OutfitIntelligenceAnalysisDto;
}

export interface SkinReportSnapshot {
  skinType: string;
  skinTypeEn?: string;
  score?: number;
  hydration?: number;
  oiliness?: number;
  pores?: number;
  wrinkles?: number;
  spots?: number;
  acne?: number;
  redness?: number;
  undertone?: string;
  undertoneEn?: string;
  skinTone?: string;
  skinToneEn?: string;
  concernScores?: Record<string, number>;
}
