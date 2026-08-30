/**
 * FK-9 — User feedback contract (preference/system evidence — not domain truth).
 */
import { FASHION_FEEDBACK_SCHEMA_VERSION } from '../versioning/release';

export const FashionAdviceFeedbackType = {
  LIKE: 'LIKE',
  DISLIKE: 'DISLIKE',
  ACCEPT: 'ACCEPT',
  REJECT: 'REJECT',
  SAVE: 'SAVE',
  USE_THIS_DIRECTION: 'USE_THIS_DIRECTION',
  PREFER_BOLDER: 'PREFER_BOLDER',
  PREFER_CALMER: 'PREFER_CALMER',
  PREFER_MORE_FORMAL: 'PREFER_MORE_FORMAL',
  PREFER_MORE_CASUAL: 'PREFER_MORE_CASUAL',
  NOT_MY_STYLE: 'NOT_MY_STYLE',
  NOT_RELEVANT: 'NOT_RELEVANT',
  NEED_MORE_OPTIONS: 'NEED_MORE_OPTIONS',
  WRONG_CONTEXT: 'WRONG_CONTEXT',
  SAFETY_FLAG: 'SAFETY_FLAG',
  OTHER: 'OTHER',
} as const;

export type FashionAdviceFeedbackType =
  (typeof FashionAdviceFeedbackType)[keyof typeof FashionAdviceFeedbackType];

export const ALL_FEEDBACK_TYPES: readonly FashionAdviceFeedbackType[] =
  Object.freeze(Object.values(FashionAdviceFeedbackType));

export const FeedbackExplicitness = {
  EXPLICIT: 'EXPLICIT',
  IMPLICIT: 'IMPLICIT',
} as const;

export type FeedbackExplicitness =
  (typeof FeedbackExplicitness)[keyof typeof FeedbackExplicitness];

export interface FashionAdviceFeedback {
  readonly feedbackId: string;
  readonly adviceCandidateId: string;
  readonly alternativeId?: string;
  readonly sessionRef?: string;
  readonly feedbackType: FashionAdviceFeedbackType | string;
  readonly explicitness: FeedbackExplicitness | string;
  readonly reasonCode?: string;
  readonly preferenceSignal?: string;
  readonly occurredAt: string;
  readonly schemaVersion: typeof FASHION_FEEDBACK_SCHEMA_VERSION | string;
  readonly traceId?: string;
  readonly idempotencyKey?: string;
  /** Optional free text — must be redacted/minimized before storage. */
  readonly freeTextMinimized?: string;
}

export interface FashionAdviceFeedbackInput
  extends Omit<FashionAdviceFeedback, 'schemaVersion'> {
  readonly schemaVersion?: string;
}

export function isFashionAdviceFeedbackType(
  value: unknown,
): value is FashionAdviceFeedbackType {
  return (
    typeof value === 'string' &&
    (ALL_FEEDBACK_TYPES as readonly string[]).includes(value)
  );
}
