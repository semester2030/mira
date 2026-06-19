import { OutfitAnalysisResult } from '../../ai/contracts/outfit-analysis-result.interface';
import { OutfitStyleMetrics } from '../../ai/contracts/outfit-style-metrics.interface';
import { MiraStyleReport } from '../contracts/mira-style-report.interface';
import { computeOutfitScore, OutfitCaptureQuality, OutfitScoreResult } from './outfit-score-engine';
import {
  buildStyleHeadline,
  buildStyleSummary,
  buildStyleTips,
  colorCompatibilityLabel,
} from './style-narrative-engine';

export interface StyleIngestPayload {
  outfitScore: number;
  styleCategoryAr: string;
  styleCategoryEn: string;
  garmentTypeAr: string;
  garmentTypeEn: string;
  dominantColorsAr: string[];
  alternativeColorsAr: string[];
  occasionSuitabilityAr: string;
  occasion: string;
}

const DISCLAIMER_AR =
  'تقييم إرشادي للإطلالة بناءً على الصورة والمناسبة — وليس حكماً stylist نهائياً.';

/** Normalize provider output for Mira Style Intelligence. */
export function ingestOutfit(outfit: OutfitAnalysisResult): StyleIngestPayload {
  return {
    outfitScore: Math.round(outfit.compatibilityScore),
    styleCategoryAr: outfit.styleCategoryAr,
    styleCategoryEn: outfit.styleCategoryEn,
    garmentTypeAr: outfit.garmentTypeAr,
    garmentTypeEn: outfit.garmentTypeEn,
    dominantColorsAr: [...outfit.dominantColors],
    alternativeColorsAr: [...outfit.alternativeColorsAr],
    occasionSuitabilityAr: outfit.occasionSuitabilityAr,
    occasion: outfit.occasion,
  };
}

export function scoreOutfitAnalysis(
  outfit: OutfitAnalysisResult,
  options?: {
    captureQuality?: OutfitCaptureQuality;
    previousScore?: number | null;
  },
): { scored: OutfitAnalysisResult; scoreResult: OutfitScoreResult } {
  const metrics =
    outfit.styleMetrics ?? deriveMetricsFromLegacyScore(outfit.compatibilityScore);

  const scoreResult = computeOutfitScore(metrics, {
    captureQuality: options?.captureQuality,
    previousScore: options?.previousScore,
    occasion: outfit.occasion,
  });

  const scored: OutfitAnalysisResult = {
    ...outfit,
    compatibilityScore: scoreResult.finalScore,
    styleMetrics: metrics,
    occasionSuitabilityAr: suitabilityAr(outfit.occasion, scoreResult.finalScore),
    occasionSuitabilityEn: suitabilityEn(outfit.occasion, scoreResult.finalScore),
  };

  return { scored, scoreResult };
}

export function buildMiraStyleReport(
  outfit: OutfitAnalysisResult,
  scoreResult: OutfitScoreResult,
  fusionSummaryAr?: string,
): MiraStyleReport {
  const ingested = ingestOutfit(outfit);

  return {
    version: 1,
    outfitScore: scoreResult.finalScore,
    confidence: scoreResult.confidence,
    severityLevel: scoreResult.severityLevel,
    strongestIssueAr: scoreResult.strongestIssueAr,
    improvementPotential: scoreResult.improvementPotential,
    occasionReady: scoreResult.occasionReady,
    styleCategoryAr: ingested.styleCategoryAr,
    styleCategoryEn: ingested.styleCategoryEn,
    garmentTypeAr: ingested.garmentTypeAr,
    colorCompatibilityAr: colorCompatibilityLabel(scoreResult.finalScore),
    dominantColorsAr: ingested.dominantColorsAr,
    alternativeLooksAr: ingested.alternativeColorsAr.slice(0, 5),
    occasionSuitabilityAr: ingested.occasionSuitabilityAr,
    headlineAr: buildStyleHeadline(scoreResult.finalScore),
    summaryAr: fusionSummaryAr ?? buildStyleSummary(outfit, scoreResult),
    styleTipsAr: buildStyleTips(scoreResult, outfit.occasion),
    disclaimerAr: DISCLAIMER_AR,
  };
}

function deriveMetricsFromLegacyScore(score: number): OutfitStyleMetrics {
  const health = clamp(Math.round(score), 0, 100);
  const severity = clamp(100 - health, 0, 100);
  return {
    colorHarmony: health,
    occasionFit: health - 4,
    styleCoherence: health - 2,
    silhouetteBalance: health - 3,
    polish: health - 5,
    colorClashSeverity: severity,
    occasionMismatchSeverity: Math.max(0, severity - 8),
    tonalImbalanceSeverity: Math.max(0, severity - 12),
    accessoryOverloadSeverity: Math.max(0, severity - 18),
    formalityGapSeverity: Math.max(0, severity - 10),
  };
}

function suitabilityAr(occasion: OutfitAnalysisResult['occasion'], score: number): string {
  const level =
    score >= 86
      ? 'ممتاز'
      : score >= 74
        ? 'مناسب جداً'
        : score >= 62
          ? 'مناسب'
          : score >= 48
            ? 'يحتاج تحسين'
            : 'غير مناسب حالياً';
  return `${level} لمناسبة ${occasionLabel(occasion)}`;
}

function suitabilityEn(occasion: OutfitAnalysisResult['occasion'], score: number): string {
  const level =
    score >= 86
      ? 'Excellent'
      : score >= 74
        ? 'Very suitable'
        : score >= 62
          ? 'Suitable'
          : score >= 48
            ? 'Needs improvement'
            : 'Not suitable yet';
  return `${level} for ${occasion}`;
}

function occasionLabel(occasion: OutfitAnalysisResult['occasion']): string {
  const map: Record<string, string> = {
    wedding: 'الزفاف',
    work: 'العمل',
    casual: 'الكاجوال',
    university: 'الجامعة',
    evening: 'السهرة',
    eid: 'العيد',
    interview: 'المقابلة',
  };
  return map[occasion] ?? occasion;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
