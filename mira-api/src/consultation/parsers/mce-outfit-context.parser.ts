import { MiraStyleReport } from '../../intelligence/contracts/mira-style-report.interface';
import { OutfitAnalysisResult } from '../../ai/contracts/outfit-analysis-result.interface';
import { OutfitContextSummaryV1 } from '../contracts/mce-context-snapshot.v1';

const OUTFIT_DISCLAIMER =
  'نصيحة أسلوب عامة — مبنية على تحليل الإطلالة المخزّن، وليست بديلاً عن ذوقكِ الشخصي.';

export interface OutfitIntelligenceSnapshot {
  occasionId?: string;
  compatibilityScore?: number;
  colorHarmonyScore?: number;
  occasionMatchScore?: number;
  styleBalanceScore?: number;
  skinCompatibilityScore?: number;
  analysisGate?: string;
  clothingTypeAr?: string;
  styleTypeAr?: string;
  dominantColorsAr?: string[];
  recommendedColorsAr?: string[];
  rejectedColorsAr?: string[];
  styleVerdictAr?: string;
  matchReasonsAr?: string[];
  mismatchReasonsAr?: string[];
  suggestedAccessoriesAr?: string[];
  suggestedMakeupAr?: string;
  analysisSource?: string;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

function legacyOutfitToSummary(
  analysisId: string,
  occasionId: string,
  outfit: OutfitAnalysisResult,
  styleReport?: MiraStyleReport,
): OutfitContextSummaryV1 {
  const compatibilityScore = Math.round(
    styleReport?.outfitScore ?? outfit.compatibilityScore ?? 0,
  );
  const metrics = outfit.styleMetrics;

  return {
    analysisId,
    occasionId: outfit.occasion ?? occasionId,
    compatibilityScore,
    colorHarmonyScore: Math.round(metrics?.colorHarmony ?? compatibilityScore),
    occasionMatchScore: Math.round(metrics?.occasionFit ?? compatibilityScore),
    analysisGate: 'proceed',
    clothingTypeAr: styleReport?.garmentTypeAr ?? outfit.garmentTypeAr,
    styleTypeAr: styleReport?.styleCategoryAr ?? outfit.styleCategoryAr,
    dominantColorsAr:
      styleReport?.dominantColorsAr?.length
        ? styleReport.dominantColorsAr
        : outfit.dominantColors,
    recommendedColorsAr: outfit.alternativeColorsAr ?? [],
    rejectedColorsAr: [],
    styleVerdictAr: styleReport?.headlineAr ?? outfit.occasionSuitabilityAr,
    matchReasonsAr: styleReport?.styleTipsAr?.slice(0, 4) ?? [],
    mismatchReasonsAr: styleReport?.strongestIssueAr
      ? [styleReport.strongestIssueAr]
      : [],
    suggestedAccessoriesAr: [],
    suggestedMakeupAr: undefined,
    disclaimerAr: styleReport?.disclaimerAr ?? OUTFIT_DISCLAIMER,
  };
}

function intelligenceToSummary(
  analysisId: string,
  rowOccasionId: string,
  intel: OutfitIntelligenceSnapshot,
): OutfitContextSummaryV1 {
  return {
    analysisId,
    occasionId: intel.occasionId ?? rowOccasionId,
    compatibilityScore: Math.round(intel.compatibilityScore ?? 0),
    colorHarmonyScore: Math.round(intel.colorHarmonyScore ?? intel.compatibilityScore ?? 0),
    occasionMatchScore: Math.round(intel.occasionMatchScore ?? intel.compatibilityScore ?? 0),
    analysisGate: intel.analysisGate ?? 'proceed',
    clothingTypeAr: intel.clothingTypeAr ?? 'إطلالة',
    styleTypeAr: intel.styleTypeAr ?? 'أسلوبكِ',
    dominantColorsAr: asStringList(intel.dominantColorsAr),
    recommendedColorsAr: asStringList(intel.recommendedColorsAr),
    rejectedColorsAr: asStringList(intel.rejectedColorsAr),
    styleVerdictAr: intel.styleVerdictAr ?? '',
    matchReasonsAr: asStringList(intel.matchReasonsAr),
    mismatchReasonsAr: asStringList(intel.mismatchReasonsAr),
    suggestedAccessoriesAr: asStringList(intel.suggestedAccessoriesAr),
    suggestedMakeupAr: intel.suggestedMakeupAr?.trim() || undefined,
    disclaimerAr: OUTFIT_DISCLAIMER,
  };
}

/** Parse stored OutfitAnalysis.resultJson — Vision intelligence or legacy API shape. */
export function parseOutfitContextFromStored(
  analysisId: string,
  rowOccasionId: string,
  resultJson: unknown,
): OutfitContextSummaryV1 | null {
  if (!resultJson || typeof resultJson !== 'object') return null;
  const stored = resultJson as Record<string, unknown>;

  const intelligence = stored.intelligence as OutfitIntelligenceSnapshot | undefined;
  if (intelligence) {
    return intelligenceToSummary(analysisId, rowOccasionId, intelligence);
  }

  const outfit = (stored.outfit ?? stored) as OutfitAnalysisResult;
  if (!outfit || typeof outfit !== 'object') return null;

  const styleReport = stored.miraStyleReport as MiraStyleReport | undefined;
  if (!outfit.garmentTypeAr && !styleReport?.garmentTypeAr) return null;

  return legacyOutfitToSummary(analysisId, rowOccasionId, outfit, styleReport);
}
