/**
 * FK-9 — Telemetry validation / security / privacy minimization.
 */
import { assertSafeTelemetryProps } from '../../ports/telemetry/analysis-telemetry.port';
import {
  isFashionKnowledgeEventType,
  type AdviceSourceMode,
} from './event-taxonomy';
import type { FashionKnowledgeTelemetryEventInput } from './event-contract';
import {
  isFashionAdviceFeedbackType,
  type FashionAdviceFeedbackInput,
} from './feedback-contract';
import { FASHION_TELEMETRY_SCHEMA_VERSION } from '../versioning/release';

export interface TelemetryValidationIssue {
  readonly code: string;
  readonly message: string;
}

const BANNED_META_KEYS = [
  'image',
  'imagebytes',
  'canonical',
  'decisionledger',
  'evidencegraph',
  'rawprompt',
  'chainofthought',
  'apikey',
  'authorization',
  'secret',
  'openai',
  'fashn',
];

export function validateTelemetryEvent(
  input: FashionKnowledgeTelemetryEventInput,
): { ok: boolean; issues: readonly TelemetryValidationIssue[] } {
  const issues: TelemetryValidationIssue[] = [];
  if (!input.eventId || input.eventId.length > 128) {
    issues.push({ code: 'bad_event_id', message: 'eventId required ≤128' });
  }
  if (!isFashionKnowledgeEventType(input.eventType)) {
    issues.push({ code: 'bad_event_type', message: String(input.eventType) });
  }
  if (!input.occurredAt || Number.isNaN(Date.parse(input.occurredAt))) {
    issues.push({ code: 'bad_timestamp', message: 'occurredAt invalid' });
  }
  if (!input.sourceMode) {
    issues.push({ code: 'missing_source_mode', message: 'sourceMode required' });
  }
  if (
    input.sourceMode === 'MODE_A_CURATED' &&
    input.ruleIds &&
    input.ruleIds.length === 0
  ) {
    // allowed empty for tests of future Mode A with mismatch — warn as issue soft
  }
  if (!input.releaseVersion) {
    issues.push({ code: 'missing_release', message: 'releaseVersion required' });
  }
  try {
    assertSafeTelemetryProps(input.metadata as never);
  } catch (e) {
    issues.push({
      code: 'unsafe_metadata',
      message: e instanceof Error ? e.message : 'unsafe metadata',
    });
  }
  for (const key of Object.keys(input.metadata ?? {})) {
    const lower = key.toLowerCase().replace(/[_-]/g, '');
    if (BANNED_META_KEYS.some((b) => lower.includes(b))) {
      issues.push({ code: 'banned_metadata_key', message: key });
    }
  }
  if (input.userRefHash && input.userRefHash.length > 128) {
    issues.push({ code: 'user_ref_too_long', message: 'userRefHash ≤128' });
  }
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
}

export function validateFeedback(
  input: FashionAdviceFeedbackInput,
): { ok: boolean; issues: readonly TelemetryValidationIssue[] } {
  const issues: TelemetryValidationIssue[] = [];
  if (!input.feedbackId) {
    issues.push({ code: 'missing_feedback_id', message: 'feedbackId required' });
  }
  if (!input.adviceCandidateId) {
    issues.push({
      code: 'missing_candidate',
      message: 'adviceCandidateId required',
    });
  }
  if (!isFashionAdviceFeedbackType(input.feedbackType)) {
    issues.push({
      code: 'bad_feedback_type',
      message: String(input.feedbackType),
    });
  }
  if (!input.occurredAt || Number.isNaN(Date.parse(input.occurredAt))) {
    issues.push({ code: 'bad_timestamp', message: 'occurredAt invalid' });
  }
  if (input.freeTextMinimized && input.freeTextMinimized.length > 280) {
    issues.push({
      code: 'free_text_too_long',
      message: 'freeTextMinimized ≤280 after minimization',
    });
  }
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
}

/** Strip common PII-ish patterns from optional free text. */
export function minimizeFeedbackText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted_email]')
    .replace(/\+?\d[\d\s\-()]{7,}\d/g, '[redacted_phone]')
    .slice(0, 280);
}

export function assertNoImagePayload(payload: unknown): boolean {
  const s = JSON.stringify(payload ?? {});
  return !/imagebytes|imagebase64|"image":\s*"|data:image\//i.test(s);
}

export function defaultSchemaVersion(): string {
  return FASHION_TELEMETRY_SCHEMA_VERSION;
}

export function assertSourceModeNotCuratedWhenLlm(
  sourceMode: AdviceSourceMode | string,
  knowledgeType?: string,
): boolean {
  if (sourceMode === 'MODE_B_LLM' && knowledgeType === 'CULTURAL_CONVENTION') {
    return false;
  }
  if (sourceMode === 'MODE_B_LLM' && knowledgeType === 'ESTABLISHED_PRINCIPLE') {
    return false;
  }
  return true;
}
