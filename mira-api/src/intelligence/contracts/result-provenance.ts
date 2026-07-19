/**
 * Phase 0 — Result provenance & confidence (machine-readable truth labels).
 */

export type ResultSource =
  | 'provider_measured'
  | 'local_measured'
  | 'locally_calculated'
  | 'inferred'
  | 'heuristic'
  | 'user_supplied'
  | 'mock'
  | 'unavailable';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unavailable';

export interface ResultProvenance {
  resultSource: ResultSource;
  provider: string;
  providerVersion?: string;
  calculationVersion: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  captureQuality?: string;
  generatedAt: string;
  limitations: string[];
  isMock: boolean;
  canDisplay: boolean;
  unavailableReason?: string;
}

/** Phase 3 — Skin Vitality Index formula family. */
export const SKIN_VITALITY_CALCULATION_VERSION = 'svi-v2';
export const SCORE_SCHEMA_VERSION = 2;

export const DISCLAIMER_AR =
  'هذا التحليل تجميلي وإرشادي، وليس تشخيصاً طبياً. قد تختلف النتائج باختلاف الإضاءة والكاميرا وجودة الصورة.';

export const DISCLAIMER_EN =
  'This analysis is cosmetic and informational, not a medical diagnosis. Results may vary based on lighting, camera and image quality.';

export const SKIN_VITALITY_LABEL_AR = 'مؤشر حيوية البشرة';
export const SKIN_VITALITY_LABEL_EN = 'Skin Vitality Index';

export const SKIN_VITALITY_SUPPORTING_AR =
  'تقدير تجميلي مبني على مؤشرات البشرة الظاهرة في الصورة، وقد تتأثر النتيجة بالإضاءة وجودة الكاميرا.';

export function confidenceLevelFromScore(confidence: number): ConfidenceLevel {
  if (!Number.isFinite(confidence) || confidence <= 0) return 'unavailable';
  if (confidence >= 80) return 'high';
  if (confidence >= 55) return 'medium';
  return 'low';
}

export function buildSkinVitalityProvenance(input: {
  isMock: boolean;
  provider: string;
  providerVersion?: string;
  confidence: number;
  captureQuality?: string;
  limitations?: string[];
  isProduction: boolean;
}): ResultProvenance {
  const isMock = input.isMock === true;
  const canDisplay = !(isMock && input.isProduction);
  return {
    resultSource: isMock ? 'mock' : 'locally_calculated',
    provider: input.provider,
    providerVersion: input.providerVersion,
    calculationVersion: SKIN_VITALITY_CALCULATION_VERSION,
    confidence: Math.round(Math.min(100, Math.max(0, input.confidence))),
    confidenceLevel: isMock
      ? 'unavailable'
      : confidenceLevelFromScore(input.confidence),
    captureQuality: input.captureQuality,
    generatedAt: new Date().toISOString(),
    limitations: [
      ...(input.limitations ?? []),
      SKIN_VITALITY_SUPPORTING_AR,
      DISCLAIMER_AR,
    ],
    isMock,
    canDisplay,
    unavailableReason: canDisplay
      ? undefined
      : 'Mock results cannot be displayed in production',
  };
}

/** UI / API gate: never show mock as genuine in production. */
export function assertDisplayableInProduction(
  provenance: ResultProvenance,
  isProduction: boolean,
): void {
  if (isProduction && (provenance.isMock || !provenance.canDisplay)) {
    throw new Error(
      provenance.unavailableReason ??
        'Result marked mock/unavailable and cannot be displayed in production',
    );
  }
}
