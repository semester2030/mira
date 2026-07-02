/**
 * MCE Context Snapshot v1 — single grounding contract.
 * Reference: docs/mira-vision-platform.html#mce-consultation
 */
export const MCE_CONTEXT_SCHEMA_VERSION = '1.0.0' as const;

export type MceConfidenceLevel = 'high' | 'medium' | 'low';

export interface MceFactEntry {
  id: string;
  labelAr: string;
  valueAr: string;
  confidence: MceConfidenceLevel;
}

export interface SkinContextSummaryV1 {
  analysisId: string;
  beautyScore: number;
  skinTypeAr: string;
  skinAgeEstimate?: number;
  headlineAr: string;
  summaryAdviceAr: string;
  mainConcerns: Array<{ id: string; titleAr: string; severity: string }>;
  tipsAr: string[];
  routineMorningAr: string[];
  routineEveningAr: string[];
  concernScores: Array<{ concernId: string; labelAr: string; score: number; severity: string }>;
  confidenceHeadlineAr?: string;
  disclaimerAr: string;
  isMinor: boolean;
}

export interface OutfitContextSummaryV1 {
  analysisId: string;
  occasionId: string;
  compatibilityScore: number;
  colorHarmonyScore: number;
  occasionMatchScore: number;
  analysisGate: string;
  clothingTypeAr: string;
  styleTypeAr: string;
  dominantColorsAr: string[];
  recommendedColorsAr: string[];
  rejectedColorsAr: string[];
  styleVerdictAr: string;
  matchReasonsAr: string[];
  mismatchReasonsAr: string[];
  suggestedAccessoriesAr?: string[];
  suggestedMakeupAr?: string;
  disclaimerAr: string;
}

export interface AtelierContextSummaryV1 {
  recolorAttemptId: string;
  garmentLabelAr: string;
  targetColorAr: string;
  regionRole?: string;
  qelGate: 'accept' | 'rejected';
  qelScores?: Record<string, number>;
  rejectReasonAr?: string;
  recolorScope: 'color_only';
}

export interface UserConsultationProfileV1 {
  locale: string;
  birthYear?: number;
  isMinor: boolean;
  subscriptionPlan: string;
  statedGoalAr?: string;
}

export interface MceContextSnapshotV1 {
  schemaVersion: typeof MCE_CONTEXT_SCHEMA_VERSION;
  skin?: SkinContextSummaryV1;
  outfit?: OutfitContextSummaryV1;
  atelier?: AtelierContextSummaryV1;
  user: UserConsultationProfileV1;
  occasionId?: string;
  builtAt: string;
}

export interface MceAssistantPayloadV1 {
  answerAr: string;
  confidence: MceConfidenceLevel;
  intent: string;
  citedFactIds: string[];
  suggestedQuestionsAr: string[];
  blocked: boolean;
  disclaimerAr: string;
}
