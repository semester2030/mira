/**
 * FK-9 — Research candidate export (NOT a FashionKnowledgeRule).
 * Recurring Mode B patterns → NEEDS_RESEARCH queue only.
 */
import { FASHION_RESEARCH_CANDIDATE_VERSION } from '../versioning/release';
import type { FashionKnowledgeTelemetryEvent } from './event-contract';
import type { FashionAdviceFeedback } from './feedback-contract';
import { FashionKnowledgeEventType } from './event-taxonomy';
import { classifySampleSize } from './semantics';

export interface FashionKnowledgeResearchCandidate {
  readonly researchCandidateId: string;
  readonly schemaVersion: typeof FASHION_RESEARCH_CANDIDATE_VERSION | string;
  readonly normalizedAdviceDirection: string;
  readonly domains: readonly string[];
  readonly occurrenceCount: number;
  readonly presentationCount: number;
  readonly acceptanceCount: number;
  readonly rejectionCount: number;
  readonly acceptanceRate: number | null;
  readonly rejectionRate: number | null;
  readonly preferenceSegments: readonly string[];
  readonly occasions: readonly string[];
  readonly subjectivity?: string;
  readonly sourceMode: string;
  readonly exampleRefs: readonly string[];
  readonly sampleSizeState: string;
  readonly status: 'NEEDS_RESEARCH';
  /** Explicit non-rule marker for Law #39 tests. */
  readonly isFashionKnowledgeRule: false;
  readonly canActivateRule: false;
}

function keyOf(e: FashionKnowledgeTelemetryEvent): string {
  return [
    e.adviceType ?? 'UNKNOWN',
    e.sourceMode,
    [...e.domains].sort().join('+') || 'NO_DOMAIN',
    e.occasionClass ?? 'NO_OCCASION',
    String(e.metadata.alternativeDirection ?? e.alternativeId ?? 'NO_ALT'),
  ].join('|');
}

export function buildResearchCandidates(input: {
  readonly events: readonly FashionKnowledgeTelemetryEvent[];
  readonly feedback: readonly FashionAdviceFeedback[];
  readonly clockNowIso: string;
}): readonly FashionKnowledgeResearchCandidate[] {
  const byKey = new Map<
    string,
    {
      events: FashionKnowledgeTelemetryEvent[];
      accepts: number;
      rejects: number;
      presentations: number;
    }
  >();

  for (const e of input.events) {
    if (
      e.eventType !== FashionKnowledgeEventType.ADVICE_GENERATED &&
      e.eventType !== FashionKnowledgeEventType.MODE_B_LLM_USED &&
      e.eventType !== FashionKnowledgeEventType.ADVICE_PRESENTED &&
      e.eventType !== FashionKnowledgeEventType.ADVICE_ACCEPTED &&
      e.eventType !== FashionKnowledgeEventType.ADVICE_REJECTED &&
      e.eventType !== FashionKnowledgeEventType.CANDIDATE_QUALIFIED
    ) {
      continue;
    }
    const k = keyOf(e);
    const bucket = byKey.get(k) ?? {
      events: [],
      accepts: 0,
      rejects: 0,
      presentations: 0,
    };
    bucket.events.push(e);
    if (e.eventType === FashionKnowledgeEventType.ADVICE_PRESENTED) {
      bucket.presentations += 1;
    }
    if (e.eventType === FashionKnowledgeEventType.ADVICE_ACCEPTED) {
      bucket.accepts += 1;
    }
    if (e.eventType === FashionKnowledgeEventType.ADVICE_REJECTED) {
      bucket.rejects += 1;
    }
    byKey.set(k, bucket);
  }

  for (const f of input.feedback) {
    // Attribute to candidate via matching event adviceCandidateId when possible
    for (const [k, bucket] of byKey) {
      if (
        bucket.events.some((e) => e.adviceCandidateId === f.adviceCandidateId)
      ) {
        if (f.feedbackType === 'ACCEPT' || f.feedbackType === 'LIKE') {
          bucket.accepts += 1;
        }
        if (f.feedbackType === 'REJECT' || f.feedbackType === 'DISLIKE') {
          bucket.rejects += 1;
        }
        byKey.set(k, bucket);
      }
    }
  }

  const out: FashionKnowledgeResearchCandidate[] = [];
  const sortedKeys = [...byKey.keys()].sort();
  for (const k of sortedKeys) {
    const bucket = byKey.get(k)!;
    const sample = bucket.events[0]!;
    const occurrenceCount = bucket.events.length;
    const presentationCount = Math.max(bucket.presentations, 0);
    const acceptanceRate =
      presentationCount > 0 ? bucket.accepts / presentationCount : null;
    const rejectionRate =
      presentationCount > 0 ? bucket.rejects / presentationCount : null;
    const preferenceSegments = [
      ...new Set(
        bucket.events
          .map((e) => String(e.metadata.preferenceSegment ?? ''))
          .filter(Boolean),
      ),
    ].sort();
    const occasions = [
      ...new Set(
        bucket.events.map((e) => e.occasionClass).filter(Boolean) as string[],
      ),
    ].sort();
    const exampleRefs = [
      ...new Set(
        bucket.events
          .map((e) => e.adviceCandidateId)
          .filter(Boolean) as string[],
      ),
    ]
      .sort()
      .slice(0, 5);

    out.push(
      Object.freeze({
        researchCandidateId: `research:${k}`,
        schemaVersion: FASHION_RESEARCH_CANDIDATE_VERSION,
        normalizedAdviceDirection: k,
        domains: Object.freeze([...(sample.domains ?? [])]),
        occurrenceCount,
        presentationCount,
        acceptanceCount: bucket.accepts,
        rejectionCount: bucket.rejects,
        acceptanceRate,
        rejectionRate,
        preferenceSegments: Object.freeze(preferenceSegments),
        occasions: Object.freeze(occasions),
        subjectivity: sample.subjectivity,
        sourceMode: sample.sourceMode,
        exampleRefs: Object.freeze(exampleRefs),
        sampleSizeState: classifySampleSize(occurrenceCount),
        status: 'NEEDS_RESEARCH',
        isFashionKnowledgeRule: false,
        canActivateRule: false,
      }),
    );
  }

  return Object.freeze(out);
}
