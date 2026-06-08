import { OutfitAnalysisResult } from '../../ai/contracts/outfit-analysis-result.interface';
import { MiraStyleReport } from '../contracts/mira-style-report.interface';

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

/** Normalize FASHN / mock outfit output for Mira Style Intelligence. */
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

export function buildMiraStyleReport(
  outfit: OutfitAnalysisResult,
  fusionSummaryAr?: string,
): MiraStyleReport {
  const ingested = ingestOutfit(outfit);
  const score = ingested.outfitScore;

  const headlineAr =
    score >= 88
      ? 'إطلالتك متناسقة وجاهزة للمناسبة'
      : score >= 75
        ? 'إطلالة جيدة — مع فرصة لتحسين الألوان'
        : 'إطلالتك تحتاج ضبطاً لونياً بسيطاً';

  return {
    version: 1,
    outfitScore: score,
    styleCategoryAr: ingested.styleCategoryAr,
    styleCategoryEn: ingested.styleCategoryEn,
    garmentTypeAr: ingested.garmentTypeAr,
    colorCompatibilityAr: colorCompatibilityLabel(score),
    dominantColorsAr: ingested.dominantColorsAr,
    alternativeLooksAr: ingested.alternativeColorsAr.slice(0, 4),
    occasionSuitabilityAr: ingested.occasionSuitabilityAr,
    headlineAr,
    summaryAr:
      fusionSummaryAr ??
      `تقييم الإطلالة ${score}/100 — ${ingested.styleCategoryAr} مع ألوان ${ingested.dominantColorsAr.join(' · ')}.`,
  };
}

function colorCompatibilityLabel(score: number): string {
  if (score >= 85) return 'توافق لوني ممتاز';
  if (score >= 72) return 'توافق لوني جيد';
  return 'توافق لوني يحتاج تحسين';
}
