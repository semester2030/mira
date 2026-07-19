/**
 * AI Beauty Advisor — frozen production pins (Phase 7B.2).
 * Does not redefine frozen Skin/Face/Fashion schema pins.
 */
export const BEAUTY_ADVISOR_RELEASE = '1.0.0-beauty-advisor';
export const BEAUTY_ADVISOR_STATUS =
  'AI Beauty Advisor (Frozen) · Conversation Orchestration' as const;

export const ADVISOR_ENVELOPE_VERSION = 'advisor-envelope-v1';
export const ADVISOR_RUNTIME_VERSION = 'advisor-runtime-v1';
export const ADVISOR_SESSION_VERSION = 'advisor-session-v1';
export const ADVISOR_MEMORY_VERSION = 'advisor-memory-v1';
export const ADVISOR_PLANNER_VERSION = 'advisor-planner-v1';
export const ADVISOR_CONVERSATION_VERSION = 'advisor-conversation-v1';
export const ADVISOR_COMPAT_VERSION = 'advisor-compat-v1';
export const ADVISOR_CAPABILITY_VERSION = 'advisor-capability-v1';

/** Engineering Law #34 — speech bound to sealed envelope only. */
export const ENGINEERING_LAW_34 =
  'The Advisor may only speak about evidence contained inside the Advisor Evidence Envelope.';

/** Engineering Law #33 — ownership. */
export const ENGINEERING_LAW_33 =
  'AI Beauty Advisor never replaces frozen intelligence.';
