import { MiraOccasion } from '../../ai/contracts/mira-occasion';
import { OutfitStyleMetrics } from '../../ai/contracts/outfit-style-metrics.interface';

export type OutfitSeverityLevel =
  | 'severe'
  | 'weak'
  | 'average'
  | 'good'
  | 'excellent'
  | 'premium'
  | 'rare';

export interface OutfitCaptureQuality {
  lightingQuality: number;
  framingQuality: number;
  blurAmount: number;
}

export interface OutfitScoreResult {
  finalScore: number;
  confidence: number;
  strongestIssueAr: string;
  strongestIssueId: string;
  weakestAreaAr: string;
  weakestAreaId: string;
  improvementPotential: number;
  severityLevel: OutfitSeverityLevel;
  occasionReady: boolean;
  rawScore: number;
  compoundPenalty: number;
  negativePenalty: number;
}

const POSITIVE_WEIGHTS: Record<string, number> = {
  colorHarmony: 0.28,
  occasionFit: 0.26,
  styleCoherence: 0.18,
  silhouetteBalance: 0.14,
  polish: 0.14,
};

const NEGATIVE_WEIGHTS: Record<string, number> = {
  colorClash: 0.18,
  occasionMismatch: 0.22,
  tonalImbalance: 0.14,
  accessoryOverload: 0.1,
  formalityGap: 0.12,
};

const ISSUE_LABELS_AR: Record<string, string> = {
  colorClash: 'تضارب الألوان',
  occasionMismatch: 'ملاءمة المناسبة',
  tonalImbalance: 'توازن الألوان',
  accessoryOverload: 'كثرة الإكسسوارات',
  formalityGap: 'فجوة الرسمية',
};

const POSITIVE_LABELS_AR: Record<string, string> = {
  colorHarmony: 'انسجام الألوان',
  occasionFit: 'ملاءمة المناسبة',
  styleCoherence: 'تماسك الأسلوب',
  silhouetteBalance: 'توازن القصّة',
  polish: 'اللمسة النهائية',
};

const DEFAULT_CAPTURE: OutfitCaptureQuality = {
  lightingQuality: 0.74,
  framingQuality: 0.72,
  blurAmount: 0.12,
};

export function computeOutfitScore(
  metrics: OutfitStyleMetrics,
  options?: {
    captureQuality?: OutfitCaptureQuality;
    previousScore?: number | null;
    occasion?: MiraOccasion;
    forceAllowLargeDelta?: boolean;
  },
): OutfitScoreResult {
  const capture = options?.captureQuality ?? DEFAULT_CAPTURE;
  const confidenceMultiplier = captureConfidenceMultiplier(capture);
  const confidence = Math.round(Math.min(100, Math.max(55, confidenceMultiplier * 100)));

  const positive = {
    colorHarmony: clamp(metrics.colorHarmony, 0, 100),
    occasionFit: clamp(metrics.occasionFit, 0, 100),
    styleCoherence: clamp(metrics.styleCoherence, 0, 100),
    silhouetteBalance: clamp(metrics.silhouetteBalance, 0, 100),
    polish: clamp(metrics.polish, 0, 100),
  };

  const negative = {
    colorClash: clamp(metrics.colorClashSeverity, 0, 100),
    occasionMismatch: clamp(metrics.occasionMismatchSeverity, 0, 100),
    tonalImbalance: clamp(metrics.tonalImbalanceSeverity, 0, 100),
    accessoryOverload: clamp(metrics.accessoryOverloadSeverity, 0, 100),
    formalityGap: clamp(metrics.formalityGapSeverity, 0, 100),
  };

  const positiveTotal = positiveWeightedTotal(positive);
  const negativePenalty = negativePenaltyTotal(negative);
  const compoundPenalty = compoundPenalties(negative, options?.occasion);
  const consistencyBonus = consistencyBonusFrom(positive);
  const improvementBonus = improvementBonusFrom(
    positiveTotal - negativePenalty - compoundPenalty,
    options?.previousScore,
  );

  const rawBeforeSmoothing = composeRawScore({
    positiveTotal,
    negativePenalty,
    compoundPenalty,
    consistencyBonus,
    improvementBonus,
    confidenceMultiplier,
  });

  const severeChange =
    options?.forceAllowLargeDelta === true ||
    detectSevereChange(negative, options?.previousScore, rawBeforeSmoothing);

  const finalScore = applyTemporalSmoothing(
    rawBeforeSmoothing,
    options?.previousScore,
    severeChange,
  );

  const strongest = strongestIssue(negative);
  const weakest = weakestPositive(positive);

  return {
    finalScore,
    confidence,
    strongestIssueAr: strongest.labelAr,
    strongestIssueId: strongest.id,
    weakestAreaAr: weakest.labelAr,
    weakestAreaId: weakest.id,
    improvementPotential: improvementPotential(finalScore, negative),
    severityLevel: severityLevelFromScore(finalScore),
    occasionReady:
      finalScore >= 72 &&
      confidence >= 70 &&
      negative.occasionMismatch <= 55 &&
      negative.colorClash <= 60,
    rawScore: rawBeforeSmoothing,
    compoundPenalty: Math.round(compoundPenalty),
    negativePenalty: Math.round(negativePenalty),
  };
}

function captureConfidenceMultiplier(capture: OutfitCaptureQuality): number {
  let confidence = 1;

  if (capture.lightingQuality < 0.42) confidence -= 0.16;
  else if (capture.lightingQuality < 0.58) confidence -= 0.1;
  else if (capture.lightingQuality < 0.7) confidence -= 0.05;

  if (capture.framingQuality < 0.45) confidence -= 0.14;
  else if (capture.framingQuality < 0.6) confidence -= 0.08;

  if (capture.blurAmount > 0.38) confidence -= 0.14;
  else if (capture.blurAmount > 0.22) confidence -= 0.08;

  return clamp(confidence, 0.55, 1);
}

function positiveWeightedTotal(positive: Record<string, number>): number {
  return Object.entries(POSITIVE_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + positive[key] * weight,
    0,
  );
}

function negativePenaltyTotal(negative: Record<string, number>): number {
  return Object.entries(NEGATIVE_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + negative[key] * weight,
    0,
  );
}

function compoundPenalties(
  negative: Record<string, number>,
  occasion?: MiraOccasion,
): number {
  let compound = 0;
  if (negative.colorClash > 65 && negative.tonalImbalance > 58) compound += 5.5;
  if (negative.occasionMismatch > 68 && negative.formalityGap > 58) compound += 6;
  if (negative.accessoryOverload > 62 && negative.colorClash > 55) compound += 3.5;
  if (
    occasion === MiraOccasion.Interview ||
    occasion === MiraOccasion.Work
  ) {
    if (negative.formalityGap > 62) compound += 2.5;
  }
  return compound;
}

function consistencyBonusFrom(positive: Record<string, number>): number {
  const values = Object.values(positive);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  if (variance <= 85 && mean >= 74) return 2.5;
  if (variance <= 130 && mean >= 66) return 1.5;
  return 0;
}

function improvementBonusFrom(rawBase: number, previousScore?: number | null): number {
  if (previousScore == null) return 0;
  const delta = rawBase - previousScore;
  if (delta <= 0) return 0;
  return clamp(delta, 0, 2);
}

function composeRawScore(input: {
  positiveTotal: number;
  negativePenalty: number;
  compoundPenalty: number;
  consistencyBonus: number;
  improvementBonus: number;
  confidenceMultiplier: number;
}): number {
  const anchored = input.positiveTotal * 0.6 + 28;
  const issueDrag = input.negativePenalty * 0.4 + input.compoundPenalty * 0.75;
  const raw = anchored - issueDrag + input.consistencyBonus + input.improvementBonus;
  return Math.round(compressToRealisticRange(raw * input.confidenceMultiplier));
}

function compressToRealisticRange(raw: number): number {
  if (raw >= 92) return 92 + clamp(raw - 92, 0, 8) * 0.35;
  return clamp(raw, 0, 100);
}

function detectSevereChange(
  negative: Record<string, number>,
  previousScore: number | null | undefined,
  rawScore: number,
): boolean {
  if (previousScore == null) return false;
  if (Math.abs(rawScore - previousScore) >= 12) return true;
  return Object.values(negative).some((s) => s >= 80);
}

function applyTemporalSmoothing(
  score: number,
  previousScore: number | null | undefined,
  severeChange: boolean,
): number {
  if (previousScore == null || severeChange) return clamp(score, 0, 100);
  const delta = score - previousScore;
  if (Math.abs(delta) <= 4) return clamp(score, 0, 100);
  return clamp(previousScore + Math.sign(delta) * 4, 0, 100);
}

function strongestIssue(negative: Record<string, number>) {
  let bestId = Object.keys(negative)[0];
  let bestSeverity = -1;
  for (const [id, severity] of Object.entries(negative)) {
    if (severity > bestSeverity) {
      bestSeverity = severity;
      bestId = id;
    }
  }
  return {
    id: bestId,
    labelAr: ISSUE_LABELS_AR[bestId] ?? bestId,
    severity: bestSeverity,
  };
}

function weakestPositive(positive: Record<string, number>) {
  let bestId = Object.keys(positive)[0];
  let lowest = 101;
  for (const [id, value] of Object.entries(positive)) {
    if (value < lowest) {
      lowest = value;
      bestId = id;
    }
  }
  return {
    id: bestId,
    labelAr: POSITIVE_LABELS_AR[bestId] ?? bestId,
  };
}

function improvementPotential(finalScore: number, negative: Record<string, number>): number {
  const topIssues = Object.values(negative).sort((a, b) => b - a).slice(0, 3);
  const issueLoad = topIssues.reduce((a, b) => a + b, 0) / topIssues.length;
  const headroom = clamp(100 - finalScore, 0, 100);
  return clamp(Math.round(headroom * 0.55 + issueLoad * 0.4), 8, 90);
}

function severityLevelFromScore(score: number): OutfitSeverityLevel {
  if (score <= 40) return 'severe';
  if (score <= 55) return 'weak';
  if (score <= 68) return 'average';
  if (score <= 78) return 'good';
  if (score <= 86) return 'excellent';
  if (score <= 93) return 'premium';
  return 'rare';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
