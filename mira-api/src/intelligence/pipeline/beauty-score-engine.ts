import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';

export type BeautySeverityLevel =
  | 'severe'
  | 'weak'
  | 'average'
  | 'good'
  | 'excellent'
  | 'premium'
  | 'rare';

export interface CaptureQualitySignals {
  lightingQuality: number;
  faceAngleDegrees: number;
  blurAmount: number;
}

export interface BeautyScoreResult {
  finalScore: number;
  confidence: number;
  strongestIssue: string;
  strongestIssueId: string;
  weakestArea: string;
  weakestAreaId: string;
  improvementPotential: number;
  severityLevel: BeautySeverityLevel;
  premiumReadiness: boolean;
  rawScore: number;
  compoundPenalty: number;
  negativePenalty: number;
}

const POSITIVE_WEIGHTS: Record<string, number> = {
  hydration: 0.22,
  firmness: 0.18,
  smoothness: 0.16,
  elasticity: 0.14,
  radiance: 0.2,
};

const NEGATIVE_WEIGHTS: Record<string, number> = {
  oiliness: 0.12,
  pores: 0.1,
  acne: 0.14,
  pigmentation: 0.1,
  redness: 0.1,
  darkCircles: 0.08,
  wrinkles: 0.12,
  textureIrregularity: 0.08,
};

const ISSUE_LABELS_AR: Record<string, string> = {
  oiliness: 'إفراز الدهون',
  pores: 'المسام',
  acne: 'الحبوب',
  pigmentation: 'التصبغات',
  redness: 'الاحمرار',
  darkCircles: 'الهالات',
  wrinkles: 'التجاعيد',
  textureIrregularity: 'الملمس',
};

const POSITIVE_LABELS_AR: Record<string, string> = {
  hydration: 'الترطيب',
  firmness: 'المرونة',
  smoothness: 'النعومة',
  elasticity: 'المرونة',
  radiance: 'الإشراق',
};

const DEFAULT_CAPTURE: CaptureQualitySignals = {
  lightingQuality: 0.72,
  faceAngleDegrees: 10,
  blurAmount: 0.14,
};

export function computeBeautyScore(
  skin: SkinAnalysisResult,
  options?: {
    captureQuality?: CaptureQualitySignals;
    previousScore?: number | null;
    forceAllowLargeDelta?: boolean;
  },
): BeautyScoreResult {
  const capture = options?.captureQuality ?? DEFAULT_CAPTURE;
  const confidenceMultiplier = captureConfidenceMultiplier(capture);
  const confidence = Math.round(Math.min(100, Math.max(55, confidenceMultiplier * 100)));

  const metrics = extractMetrics(skin);
  const positiveTotal = positiveWeightedTotal(metrics.positive);
  const negativePenalty = negativePenaltyTotal(metrics.negative);
  const compoundPenalty = compoundPenalties(metrics.negative);
  const consistencyBonus = consistencyBonusFrom(metrics.positive);
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
    detectSevereChange(metrics.negative, options?.previousScore, rawBeforeSmoothing);

  const finalScore = applyTemporalSmoothing(
    rawBeforeSmoothing,
    options?.previousScore,
    severeChange,
  );

  const strongest = strongestIssue(metrics.negative);
  const weakest = weakestPositive(metrics.positive);

  return {
    finalScore,
    confidence,
    strongestIssue: strongest.labelAr,
    strongestIssueId: strongest.id,
    weakestArea: weakest.labelAr,
    weakestAreaId: weakest.id,
    improvementPotential: improvementPotential(finalScore, metrics.negative),
    severityLevel: severityLevelFromScore(finalScore),
    premiumReadiness:
      finalScore >= 79 &&
      confidence >= 72 &&
      strongest.severity <= 48 &&
      Object.values(metrics.negative).every((s) => s <= 72),
    rawScore: rawBeforeSmoothing,
    compoundPenalty: Math.round(compoundPenalty),
    negativePenalty: Math.round(negativePenalty),
  };
}

export function applyBeautyScoreToSkin(
  skin: SkinAnalysisResult,
  options?: Parameters<typeof computeBeautyScore>[1],
): SkinAnalysisResult {
  const scored = computeBeautyScore(skin, options);
  return {
    ...skin,
    beautyScore: scored.finalScore,
  };
}

function captureConfidenceMultiplier(capture: CaptureQualitySignals): number {
  let confidence = 1;

  if (capture.lightingQuality < 0.4) confidence -= 0.18;
  else if (capture.lightingQuality < 0.55) confidence -= 0.12;
  else if (capture.lightingQuality < 0.68) confidence -= 0.06;

  if (capture.faceAngleDegrees > 28) confidence -= 0.16;
  else if (capture.faceAngleDegrees > 18) confidence -= 0.1;
  else if (capture.faceAngleDegrees > 12) confidence -= 0.05;

  if (capture.blurAmount > 0.4) confidence -= 0.16;
  else if (capture.blurAmount > 0.25) confidence -= 0.1;
  else if (capture.blurAmount > 0.16) confidence -= 0.05;

  return clamp(confidence, 0.55, 1);
}

function extractMetrics(skin: SkinAnalysisResult): {
  positive: Record<string, number>;
  negative: Record<string, number>;
} {
  const scores = skin.concernScores ?? {};
  const health = (id: string, fallback: number) =>
    clamp(scores[id] ?? fallback, 0, 100);
  const severityFromHealth = (value: number) => clamp(100 - value, 0, 100);
  const legacyHealth = (severity0to5: number) =>
    clamp(((5 - clamp(severity0to5, 0, 5)) / 5) * 100, 0, 100);
  const blend = (a: number, b: number) => clamp(Math.round((a + b) / 2), 0, 100);

  const hydration = health('moisture', skin.hydration);
  const wrinkleHealth = health('wrinkle', legacyHealth(skin.wrinkles));
  const poreHealth = health('pore', legacyHealth(skin.pores));
  const textureHealth = health('texture', blend(hydration, poreHealth));
  const firmness = health('firmness', blend(wrinkleHealth, hydration));
  const radiance = health('radiance', blend(hydration, 100 - clamp(skin.oiliness, 0, 100)));
  const smoothness = blend(textureHealth, wrinkleHealth);
  const elasticity = blend(firmness, wrinkleHealth);

  const oilinessSeverity =
    Object.keys(scores).length > 0
      ? severityFromHealth(health('oiliness', 100 - skin.oiliness))
      : clamp(skin.oiliness, 0, 100);

  return {
    positive: {
      hydration,
      firmness,
      smoothness,
      elasticity,
      radiance,
    },
    negative: {
      oiliness: oilinessSeverity,
      pores: severityFromHealth(poreHealth),
      acne: severityFromHealth(health('acne', legacyHealth(skin.acne))),
      pigmentation: severityFromHealth(health('age_spot', legacyHealth(skin.darkSpots))),
      redness: severityFromHealth(health('redness', legacyHealth(skin.redness))),
      darkCircles: severityFromHealth(health('dark_circle', blend(hydration, wrinkleHealth))),
      wrinkles: severityFromHealth(wrinkleHealth),
      textureIrregularity: severityFromHealth(textureHealth),
    },
  };
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

function compoundPenalties(negative: Record<string, number>): number {
  let compound = 0;
  if (negative.oiliness > 70 && negative.pores > 70) compound += 6.5;
  if (negative.acne > 60 && negative.redness > 60) compound += 5.5;
  if (negative.pigmentation > 75 && negative.darkCircles > 70) compound += 4.5;
  if (negative.wrinkles > 65 && negative.textureIrregularity > 60) compound += 3.5;
  return compound;
}

function consistencyBonusFrom(positive: Record<string, number>): number {
  const values = Object.values(positive);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  if (variance <= 90 && mean >= 72) return 2.5;
  if (variance <= 140 && mean >= 65) return 1.5;
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
  const anchored = input.positiveTotal * 0.62 + 30;
  const issueDrag = input.negativePenalty * 0.38 + input.compoundPenalty * 0.72;
  const raw = anchored - issueDrag + input.consistencyBonus + input.improvementBonus;
  return Math.round(compressToRealisticRange(raw * input.confidenceMultiplier));
}

function compressToRealisticRange(raw: number): number {
  if (raw >= 93) return 93 + clamp(raw - 93, 0, 7) * 0.35;
  return clamp(raw, 0, 100);
}

function detectSevereChange(
  negative: Record<string, number>,
  previousScore: number | null | undefined,
  rawScore: number,
): boolean {
  if (previousScore == null) return false;
  if (Math.abs(rawScore - previousScore) >= 12) return true;
  return Object.values(negative).some((s) => s >= 82);
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
    severity: 100 - lowest,
  };
}

function improvementPotential(finalScore: number, negative: Record<string, number>): number {
  const topIssues = Object.values(negative).sort((a, b) => b - a).slice(0, 3);
  const issueLoad = topIssues.reduce((a, b) => a + b, 0) / topIssues.length;
  const headroom = clamp(100 - finalScore, 0, 100);
  return clamp(Math.round(headroom * 0.55 + issueLoad * 0.45), 8, 92);
}

function severityLevelFromScore(score: number): BeautySeverityLevel {
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
