import { BeautyCapabilityId } from '../capability/capability-ids';
import { BeautyRuntimeState } from '../runtime/beauty-runtime-state';
import { newTraceId } from '../../ports/shared/result-meta';

/**
 * Comparison is NOT images only.
 * Internal model may retain providerId for Mira audit.
 * Public DTO strips provider ids (Engineering Law #5).
 */
export interface BeautyComparisonCandidate {
  lookId: string;
  capabilityId: BeautyCapabilityId;
  attemptId: string;
  timestamp: string;
  /** Server audit only */
  providerId?: string;
  metadata: Record<string, string | number | boolean | null>;
  metrics?: Record<string, number | string | boolean | null>;
  resultRef?: string;
  runtime: BeautyRuntimeState;
}

export interface BeautyComparison {
  comparisonId: string;
  sessionId: string;
  createdAt: string;
  candidates: BeautyComparisonCandidate[];
}

export function createComparison(
  sessionId: string,
  candidates: BeautyComparisonCandidate[],
): BeautyComparison {
  if (candidates.length < 2) {
    throw new Error('Comparison requires at least 2 candidates');
  }
  return {
    comparisonId: newTraceId('bcmp'),
    sessionId,
    createdAt: new Date().toISOString(),
    candidates: candidates.map((c) => ({
      ...c,
      metadata: { ...c.metadata },
      metrics: c.metrics ? { ...c.metrics } : undefined,
      runtime: { ...c.runtime },
    })),
  };
}
