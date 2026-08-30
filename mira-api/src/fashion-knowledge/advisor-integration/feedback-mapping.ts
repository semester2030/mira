/**
 * FK-10 — Feedback entry mapping (Advisor-facing → FK-9 feedback types).
 * Law #39: feedback ≠ domain truth; no Registry / SI mutation.
 */
import {
  FashionAdviceFeedbackType,
  FeedbackExplicitness,
  type FashionAdviceFeedbackType as FeedbackType,
} from '../telemetry/feedback-contract';
import {
  FeedbackSignalClass,
  type FeedbackSignalClass as SignalClass,
} from '../telemetry/semantics';

export interface FashionAdvisorFeedbackInput {
  readonly adviceCandidateId: string;
  readonly alternativeId?: string;
  readonly sessionRef?: string;
  readonly action:
    | 'like'
    | 'dislike'
    | 'save'
    | 'not_my_style'
    | 'prefer_bolder'
    | 'prefer_calmer'
    | 'wrong_context'
    | 'need_more_options'
    | 'accept'
    | 'reject'
    | 'safety_flag';
  readonly occurredAt: string;
  readonly traceId?: string;
}

export interface FashionAdvisorFeedbackMapped {
  readonly feedbackType: FeedbackType;
  readonly explicitness: typeof FeedbackExplicitness.EXPLICIT | typeof FeedbackExplicitness.IMPLICIT;
  readonly signalClass: SignalClass;
  readonly activatesRule: false;
  readonly mutatesStylingProfile: false;
  readonly writesRegistry: false;
}

const MAP: Record<
  FashionAdvisorFeedbackInput['action'],
  {
    feedbackType: FeedbackType;
    explicitness: typeof FeedbackExplicitness.EXPLICIT | typeof FeedbackExplicitness.IMPLICIT;
    signalClass: SignalClass;
  }
> = {
  like: {
    feedbackType: FashionAdviceFeedbackType.LIKE,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.USER_PREFERENCE_SIGNAL,
  },
  dislike: {
    feedbackType: FashionAdviceFeedbackType.DISLIKE,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.USER_PREFERENCE_SIGNAL,
  },
  save: {
    feedbackType: FashionAdviceFeedbackType.SAVE,
    explicitness: FeedbackExplicitness.IMPLICIT,
    signalClass: FeedbackSignalClass.OUTCOME_SIGNAL,
  },
  not_my_style: {
    feedbackType: FashionAdviceFeedbackType.NOT_MY_STYLE,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.USER_PREFERENCE_SIGNAL,
  },
  prefer_bolder: {
    feedbackType: FashionAdviceFeedbackType.PREFER_BOLDER,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.USER_PREFERENCE_SIGNAL,
  },
  prefer_calmer: {
    feedbackType: FashionAdviceFeedbackType.PREFER_CALMER,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.USER_PREFERENCE_SIGNAL,
  },
  wrong_context: {
    feedbackType: FashionAdviceFeedbackType.WRONG_CONTEXT,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.CONTEXT_CORRECTION_SIGNAL,
  },
  need_more_options: {
    feedbackType: FashionAdviceFeedbackType.NEED_MORE_OPTIONS,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.ADVICE_RELEVANCE_SIGNAL,
  },
  accept: {
    feedbackType: FashionAdviceFeedbackType.ACCEPT,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.OUTCOME_SIGNAL,
  },
  reject: {
    feedbackType: FashionAdviceFeedbackType.REJECT,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.USER_PREFERENCE_SIGNAL,
  },
  safety_flag: {
    feedbackType: FashionAdviceFeedbackType.SAFETY_FLAG,
    explicitness: FeedbackExplicitness.EXPLICIT,
    signalClass: FeedbackSignalClass.SYSTEM_FAILURE_SIGNAL,
  },
};

export function mapAdvisorFeedback(
  input: FashionAdvisorFeedbackInput,
): FashionAdvisorFeedbackMapped {
  const mapped = MAP[input.action];
  return {
    ...mapped,
    activatesRule: false,
    mutatesStylingProfile: false,
    writesRegistry: false,
  };
}
