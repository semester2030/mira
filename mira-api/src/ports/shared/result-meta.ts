/**
 * Phase 1 — shared result metadata (provider-independent).
 * Extends Phase 0 provenance without weakening it.
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

export interface CostMetadata {
  estimatedUsd?: number;
  units?: number;
  unitLabel?: string;
}

export interface ResultMeta {
  source: ResultSource;
  provider: string;
  providerVersion?: string;
  calculationVersion?: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  generatedAt: string;
  limitations: string[];
  isMock: boolean;
  canDisplay: boolean;
  unavailableReason?: string;
  costMetadata?: CostMetadata;
  requestId?: string;
  traceId: string;
}

export function newTraceId(prefix = 'mira'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function confidenceLevelFromScore(confidence: number): ConfidenceLevel {
  if (!Number.isFinite(confidence) || confidence <= 0) return 'unavailable';
  if (confidence >= 80) return 'high';
  if (confidence >= 55) return 'medium';
  return 'low';
}

export function buildResultMeta(input: {
  source: ResultSource;
  provider: string;
  providerVersion?: string;
  calculationVersion?: string;
  confidence: number;
  limitations?: string[];
  isMock?: boolean;
  canDisplay?: boolean;
  unavailableReason?: string;
  costMetadata?: CostMetadata;
  requestId?: string;
  traceId?: string;
  isProduction?: boolean;
}): ResultMeta {
  const isMock = input.isMock === true;
  const production = input.isProduction === true;
  const canDisplay =
    input.canDisplay ?? !(isMock && production);
  return {
    source: isMock ? 'mock' : input.source,
    provider: input.provider,
    providerVersion: input.providerVersion,
    calculationVersion: input.calculationVersion,
    confidence: Math.round(Math.min(100, Math.max(0, input.confidence))),
    confidenceLevel: isMock
      ? 'unavailable'
      : confidenceLevelFromScore(input.confidence),
    generatedAt: new Date().toISOString(),
    limitations: input.limitations ?? [],
    isMock,
    canDisplay,
    unavailableReason:
      input.unavailableReason ??
      (canDisplay ? undefined : 'Mock results cannot be displayed in production'),
    costMetadata: input.costMetadata,
    requestId: input.requestId,
    traceId: input.traceId ?? newTraceId(),
  };
}
