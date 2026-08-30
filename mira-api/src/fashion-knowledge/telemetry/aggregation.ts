/**
 * FK-9 — Deterministic aggregation (denominators preserved).
 */
import { FASHION_AGGREGATION_VERSION } from '../versioning/release';
import type { FashionKnowledgeTelemetryEvent } from './event-contract';
import type { FashionAdviceFeedback } from './feedback-contract';
import { FashionKnowledgeEventType } from './event-taxonomy';
import { classifySampleSize, type SampleSizeState } from './semantics';

export interface FashionKnowledgeAggregationReport {
  readonly schemaVersion: typeof FASHION_AGGREGATION_VERSION | string;
  readonly generatedAt: string;
  readonly totalEvents: number;
  readonly generationCount: number;
  readonly presentationCount: number;
  readonly acceptCount: number;
  readonly rejectCount: number;
  readonly saveCount: number;
  readonly clarificationCount: number;
  readonly blockedCount: number;
  readonly qualifiedCount: number;
  readonly alternativeSelectionCount: number;
  readonly preferenceConflictCount: number;
  readonly sourceModeSplit: Readonly<Record<string, number>>;
  readonly claimLockSplit: Readonly<Record<string, number>>;
  readonly adviceTypeSplit: Readonly<Record<string, number>>;
  readonly domainSplit: Readonly<Record<string, number>>;
  readonly blockedReasonSplit: Readonly<Record<string, number>>;
  readonly preferenceSegmentSplit: Readonly<Record<string, number>>;
  readonly acceptRate: number | null;
  readonly rejectRate: number | null;
  readonly saveRate: number | null;
  readonly sampleSizeState: SampleSizeState;
  readonly denominators: {
    readonly presentations: number;
    readonly generations: number;
  };
}

function rate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function aggregateFashionKnowledgeTelemetry(input: {
  readonly events: readonly FashionKnowledgeTelemetryEvent[];
  readonly feedback: readonly FashionAdviceFeedback[];
  readonly clockNowIso: string;
  readonly preferenceSegment?: string;
}): FashionKnowledgeAggregationReport {
  const events = [...input.events].sort((a, b) => {
    const t = a.occurredAt.localeCompare(b.occurredAt);
    if (t !== 0) return t;
    return a.eventId.localeCompare(b.eventId);
  });

  const sourceModeSplit: Record<string, number> = {};
  const claimLockSplit: Record<string, number> = {};
  const adviceTypeSplit: Record<string, number> = {};
  const domainSplit: Record<string, number> = {};
  const blockedReasonSplit: Record<string, number> = {};
  const preferenceSegmentSplit: Record<string, number> = {};

  let generationCount = 0;
  let presentationCount = 0;
  let acceptCount = 0;
  let rejectCount = 0;
  let saveCount = 0;
  let clarificationCount = 0;
  let blockedCount = 0;
  let qualifiedCount = 0;
  let alternativeSelectionCount = 0;
  let preferenceConflictCount = 0;

  for (const e of events) {
    bump(sourceModeSplit, e.sourceMode);
    if (e.claimLockDecision) bump(claimLockSplit, e.claimLockDecision);
    if (e.adviceType) bump(adviceTypeSplit, e.adviceType);
    for (const d of e.domains) bump(domainSplit, d);
    if (e.preferenceConflict && e.preferenceConflict !== 'NO_CONFLICT') {
      preferenceConflictCount += 1;
    }
    if (input.preferenceSegment) {
      const seg = String(e.metadata.preferenceSegment ?? 'UNKNOWN');
      if (seg === input.preferenceSegment) {
        bump(preferenceSegmentSplit, seg);
      }
    } else if (e.metadata.preferenceSegment) {
      bump(preferenceSegmentSplit, String(e.metadata.preferenceSegment));
    }

    switch (e.eventType) {
      case FashionKnowledgeEventType.ADVICE_GENERATED:
      case FashionKnowledgeEventType.MODE_B_LLM_USED:
      case FashionKnowledgeEventType.MODE_A_RULE_USED:
        generationCount += 1;
        break;
      case FashionKnowledgeEventType.ADVICE_PRESENTED:
        presentationCount += 1;
        break;
      case FashionKnowledgeEventType.ADVICE_ACCEPTED:
        acceptCount += 1;
        break;
      case FashionKnowledgeEventType.ADVICE_REJECTED:
        rejectCount += 1;
        break;
      case FashionKnowledgeEventType.ADVICE_SAVED:
        saveCount += 1;
        break;
      case FashionKnowledgeEventType.CLARIFICATION_REQUESTED:
        clarificationCount += 1;
        break;
      case FashionKnowledgeEventType.CANDIDATE_BLOCKED:
        blockedCount += 1;
        for (const r of e.reasonCodes) bump(blockedReasonSplit, r);
        break;
      case FashionKnowledgeEventType.CANDIDATE_QUALIFIED:
        qualifiedCount += 1;
        break;
      case FashionKnowledgeEventType.ALTERNATIVE_SELECTED:
        alternativeSelectionCount += 1;
        break;
      default:
        break;
    }
  }

  // Feedback may arrive without matching event type — count explicit ACCEPT/REJECT/SAVE
  for (const f of input.feedback) {
    if (f.feedbackType === 'ACCEPT') acceptCount += 1;
    if (f.feedbackType === 'REJECT') rejectCount += 1;
    if (f.feedbackType === 'SAVE') saveCount += 1;
  }

  const sampleN = Math.max(presentationCount, generationCount, events.length);

  return Object.freeze({
    schemaVersion: FASHION_AGGREGATION_VERSION,
    generatedAt: input.clockNowIso,
    totalEvents: events.length,
    generationCount,
    presentationCount,
    acceptCount,
    rejectCount,
    saveCount,
    clarificationCount,
    blockedCount,
    qualifiedCount,
    alternativeSelectionCount,
    preferenceConflictCount,
    sourceModeSplit: Object.freeze({ ...sourceModeSplit }),
    claimLockSplit: Object.freeze({ ...claimLockSplit }),
    adviceTypeSplit: Object.freeze({ ...adviceTypeSplit }),
    domainSplit: Object.freeze({ ...domainSplit }),
    blockedReasonSplit: Object.freeze({ ...blockedReasonSplit }),
    preferenceSegmentSplit: Object.freeze({ ...preferenceSegmentSplit }),
    acceptRate: rate(acceptCount, presentationCount),
    rejectRate: rate(rejectCount, presentationCount),
    saveRate: rate(saveCount, presentationCount),
    sampleSizeState: classifySampleSize(sampleN),
    denominators: Object.freeze({
      presentations: presentationCount,
      generations: generationCount,
    }),
  });
}
