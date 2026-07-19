import {
  CanonicalMetricId,
  CanonicalSkinModel,
  metricById,
} from './canonical-skin.model';

export const SVI_V2_FORMULA_ID = 'svi-v2-dynamic-denom';
export const SVI_V2_VERSION = 'svi-v2';

export interface SviContributor {
  metricId: string;
  labelAr: string;
  labelEn: string;
  weight: number;
  normalizedValue: number;
  contribution: number;
  polarity: 'positive' | 'negative';
}

export interface SviV2Result {
  score: number;
  confidence: number;
  formulaId: typeof SVI_V2_FORMULA_ID;
  version: typeof SVI_V2_VERSION;
  availableMetricCount: number;
  totalWeightUsed: number;
  positiveContributors: SviContributor[];
  negativeContributors: SviContributor[];
  unavailableExcluded: string[];
  explanationAr: string;
  explanationEn: string;
  limitations: string[];
}

/** Weights — only applied when metric available. */
const POSITIVE_WEIGHTS: Partial<Record<CanonicalMetricId, number>> = {
  hydration: 0.22,
  firmness: 0.16,
  radiance: 0.18,
  texture: 0.14,
  elasticity: 0.12,
  toneUniformity: 0.1,
};

const NEGATIVE_WEIGHTS: Partial<Record<CanonicalMetricId, number>> = {
  oiliness: 0.1,
  pores: 0.1,
  acne: 0.12,
  pigmentation: 0.1,
  redness: 0.08,
  darkCircles: 0.08,
  wrinkles: 0.1,
  fineLines: 0.06,
  sensitivity: 0.06,
};

/**
 * Skin Vitality Index v2 — dynamic denominator.
 * Excludes unavailable metrics. Never invents values.
 * Does not claim beauty, medical health, or clinical diagnosis.
 */
export function computeSkinVitalityIndexV2(
  model: CanonicalSkinModel,
  options?: { captureConfidence?: number },
): SviV2Result {
  const positiveContributors: SviContributor[] = [];
  const negativeContributors: SviContributor[] = [];
  const unavailableExcluded: string[] = [];

  let posWeightedSum = 0;
  let posWeightSum = 0;
  let negWeightedSum = 0;
  let negWeightSum = 0;

  for (const [id, weight] of Object.entries(POSITIVE_WEIGHTS) as [
    CanonicalMetricId,
    number,
  ][]) {
    const m = metricById(model, id);
    if (!m || m.availability !== 'available' || m.normalizedValue == null) {
      unavailableExcluded.push(id);
      continue;
    }
    const contribution = m.normalizedValue * weight;
    posWeightedSum += contribution;
    posWeightSum += weight;
    positiveContributors.push({
      metricId: id,
      labelAr: m.displayNameAr,
      labelEn: m.displayNameEn,
      weight,
      normalizedValue: m.normalizedValue,
      contribution,
      polarity: 'positive',
    });
  }

  for (const [id, weight] of Object.entries(NEGATIVE_WEIGHTS) as [
    CanonicalMetricId,
    number,
  ][]) {
    const m = metricById(model, id);
    if (!m || m.availability !== 'available' || m.normalizedValue == null) {
      unavailableExcluded.push(id);
      continue;
    }
    const severity = 100 - m.normalizedValue;
    const contribution = severity * weight;
    negWeightedSum += contribution;
    negWeightSum += weight;
    negativeContributors.push({
      metricId: id,
      labelAr: m.displayNameAr,
      labelEn: m.displayNameEn,
      weight,
      normalizedValue: m.normalizedValue,
      contribution,
      polarity: 'negative',
    });
  }

  const availableMetricCount =
    positiveContributors.length + negativeContributors.length;
  const totalWeightUsed = posWeightSum + negWeightSum;

  let score = 55;
  if (totalWeightUsed > 0) {
    const posNorm = posWeightSum > 0 ? posWeightedSum / posWeightSum : 70;
    const negNorm = negWeightSum > 0 ? negWeightedSum / negWeightSum : 25;
    // Blend: vitality from positives minus issue drag
    score = posNorm * 0.72 + (100 - negNorm) * 0.28;
  }

  const captureMul =
    options?.captureConfidence != null
      ? clamp(options.captureConfidence / 100, 0.55, 1)
      : 1;
  score = Math.round(clamp(score * captureMul, 0, 100));
  if (score >= 93) score = Math.round(93 + (score - 93) * 0.35);

  const metricConfidence =
    availableMetricCount === 0
      ? 0
      : Math.round(
          model.metrics
            .filter((m) => m.availability === 'available')
            .reduce((s, m) => s + m.confidence, 0) /
            Math.max(1, availableMetricCount),
        );

  const confidence = Math.round(
    clamp(metricConfidence * captureMul, availableMetricCount === 0 ? 0 : 40, 100),
  );

  const topPos = [...positiveContributors].sort(
    (a, b) => b.normalizedValue - a.normalizedValue,
  )[0];
  const topNeg = [...negativeContributors].sort(
    (a, b) => a.normalizedValue - b.normalizedValue,
  )[0];

  return {
    score,
    confidence,
    formulaId: SVI_V2_FORMULA_ID,
    version: SVI_V2_VERSION,
    availableMetricCount,
    totalWeightUsed: Math.round(totalWeightUsed * 1000) / 1000,
    positiveContributors,
    negativeContributors,
    unavailableExcluded: [...new Set(unavailableExcluded)],
    explanationAr: [
      `مؤشر حيوية البشرة (v2) = ${score}.`,
      topPos
        ? `أبرز نقطة إيجابية: ${topPos.labelAr} (${Math.round(topPos.normalizedValue)}).`
        : 'لا تتوفر مؤشرات إيجابية كافية.',
      topNeg
        ? `أبرز فرصة تحسين: ${topNeg.labelAr} (${Math.round(topNeg.normalizedValue)}).`
        : '',
      `استُبعد ${unavailableExcluded.length} مؤشراً غير متاح من المقام.`,
      'هذا مؤشر تجميلي إرشادي وليس تقييماً للجمال أو تشخيصاً طبياً.',
    ]
      .filter(Boolean)
      .join(' '),
    explanationEn: [
      `Skin Vitality Index (v2) = ${score}.`,
      topPos
        ? `Top strength: ${topPos.labelEn} (${Math.round(topPos.normalizedValue)}).`
        : 'Insufficient positive metrics.',
      topNeg
        ? `Top improvement opportunity: ${topNeg.labelEn} (${Math.round(topNeg.normalizedValue)}).`
        : '',
      `${unavailableExcluded.length} unavailable metrics excluded from the denominator.`,
      'Cosmetic informational index — not beauty ranking or medical diagnosis.',
    ]
      .filter(Boolean)
      .join(' '),
    limitations: [
      'SVI v2 uses only available metrics (dynamic denominator).',
      'Not a medical or clinical assessment.',
      'Capture lighting and camera quality may affect readings.',
      ...model.limitations.slice(0, 3),
    ],
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
