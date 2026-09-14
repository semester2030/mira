/**
 * FK-9 — Feedback semantic classes + preference signals.
 * No DOMAIN_TRUTH_SIGNAL class exists.
 */
import {
  FashionAdviceFeedbackType,
  FeedbackExplicitness,
  type FashionAdviceFeedback,
} from './feedback-contract';

export const FeedbackSignalClass = {
  USER_PREFERENCE_SIGNAL: 'USER_PREFERENCE_SIGNAL',
  ADVICE_RELEVANCE_SIGNAL: 'ADVICE_RELEVANCE_SIGNAL',
  CONTEXT_CORRECTION_SIGNAL: 'CONTEXT_CORRECTION_SIGNAL',
  UX_SIGNAL: 'UX_SIGNAL',
  SYSTEM_FAILURE_SIGNAL: 'SYSTEM_FAILURE_SIGNAL',
  SAFETY_SIGNAL: 'SAFETY_SIGNAL',
  OUTCOME_SIGNAL: 'OUTCOME_SIGNAL',
  UNKNOWN: 'UNKNOWN',
} as const;

export type FeedbackSignalClass =
  (typeof FeedbackSignalClass)[keyof typeof FeedbackSignalClass];

export const PreferenceSignalToken = {
  BOLD_PREFERENCE: 'BOLD_PREFERENCE',
  CALM_PREFERENCE: 'CALM_PREFERENCE',
  FORMAL_PREFERENCE: 'FORMAL_PREFERENCE',
  CASUAL_PREFERENCE: 'CASUAL_PREFERENCE',
  MINIMAL_PREFERENCE: 'MINIMAL_PREFERENCE',
  STATEMENT_PREFERENCE: 'STATEMENT_PREFERENCE',
  TRADITIONAL_DIRECTION: 'TRADITIONAL_DIRECTION',
  CONTEMPORARY_DIRECTION: 'CONTEMPORARY_DIRECTION',
  UNKNOWN: 'UNKNOWN',
} as const;

export type PreferenceSignalToken =
  (typeof PreferenceSignalToken)[keyof typeof PreferenceSignalToken];

export const SampleSizeState = {
  INSUFFICIENT_SAMPLE: 'INSUFFICIENT_SAMPLE',
  EARLY_SIGNAL: 'EARLY_SIGNAL',
  MEANINGFUL_USAGE: 'MEANINGFUL_USAGE',
  HIGH_VOLUME: 'HIGH_VOLUME',
} as const;

export type SampleSizeState =
  (typeof SampleSizeState)[keyof typeof SampleSizeState];

const PREFERENCE_TYPES = new Set<string>([
  FashionAdviceFeedbackType.LIKE,
  FashionAdviceFeedbackType.DISLIKE,
  FashionAdviceFeedbackType.PREFER_BOLDER,
  FashionAdviceFeedbackType.PREFER_CALMER,
  FashionAdviceFeedbackType.PREFER_MORE_FORMAL,
  FashionAdviceFeedbackType.PREFER_MORE_CASUAL,
  FashionAdviceFeedbackType.NOT_MY_STYLE,
  FashionAdviceFeedbackType.USE_THIS_DIRECTION,
]);

export function classifyFeedbackSignal(
  feedback: Pick<FashionAdviceFeedback, 'feedbackType' | 'explicitness' | 'reasonCode'>,
): FeedbackSignalClass {
  const t = feedback.feedbackType;
  if (t === FashionAdviceFeedbackType.WRONG_CONTEXT) {
    return FeedbackSignalClass.CONTEXT_CORRECTION_SIGNAL;
  }
  if (t === FashionAdviceFeedbackType.SAFETY_FLAG) {
    return FeedbackSignalClass.SAFETY_SIGNAL;
  }
  if (
    t === FashionAdviceFeedbackType.NOT_RELEVANT ||
    t === FashionAdviceFeedbackType.NEED_MORE_OPTIONS
  ) {
    return FeedbackSignalClass.ADVICE_RELEVANCE_SIGNAL;
  }
  if (
    t === FashionAdviceFeedbackType.SAVE ||
    t === FashionAdviceFeedbackType.ACCEPT ||
    t === FashionAdviceFeedbackType.USE_THIS_DIRECTION
  ) {
    return FeedbackSignalClass.OUTCOME_SIGNAL;
  }
  if (PREFERENCE_TYPES.has(t)) {
    return FeedbackSignalClass.USER_PREFERENCE_SIGNAL;
  }
  if (feedback.explicitness === FeedbackExplicitness.IMPLICIT) {
    return FeedbackSignalClass.UX_SIGNAL;
  }
  return FeedbackSignalClass.UNKNOWN;
}

export function mapPreferenceSignal(
  feedbackType: string,
): PreferenceSignalToken {
  switch (feedbackType) {
    case FashionAdviceFeedbackType.PREFER_BOLDER:
      return PreferenceSignalToken.BOLD_PREFERENCE;
    case FashionAdviceFeedbackType.PREFER_CALMER:
      return PreferenceSignalToken.CALM_PREFERENCE;
    case FashionAdviceFeedbackType.PREFER_MORE_FORMAL:
      return PreferenceSignalToken.FORMAL_PREFERENCE;
    case FashionAdviceFeedbackType.PREFER_MORE_CASUAL:
      return PreferenceSignalToken.CASUAL_PREFERENCE;
    default:
      return PreferenceSignalToken.UNKNOWN;
  }
}

/**
 * Sample-size classification — NOT statistical significance.
 */
export function classifySampleSize(n: number): SampleSizeState {
  if (n < 10) return SampleSizeState.INSUFFICIENT_SAMPLE;
  if (n < 50) return SampleSizeState.EARLY_SIGNAL;
  if (n < 500) return SampleSizeState.MEANINGFUL_USAGE;
  return SampleSizeState.HIGH_VOLUME;
}

/** NOT_MY_STYLE → preference, never RULE_INVALID. */
export function notMyStyleIsPreferenceNotRuleInvalid(): true {
  return true;
}
