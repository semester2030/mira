/**
 * FK-3 — Retry policy for malformed/transient failures.
 * Safety-blocked claims must NOT be retried to circumvent Claim Lock.
 */
export interface RetryDecision {
  readonly shouldRetry: boolean;
  readonly reason: string;
}

export const FK3_MAX_PROVIDER_ATTEMPTS = 2;

const RETRYABLE = new Set([
  'malformed_json',
  'schema_mismatch',
  'missing_required_field',
  'timeout',
  'transient_provider_error',
]);

const NEVER_RETRY = new Set([
  'false_provenance',
  'attractiveness',
  'body_shaming',
  'medical',
  'forbidden_claim',
  'claim_lock_block',
  'safety_block',
  'invented_occasion',
  'provider_leakage',
  'fake_citation',
]);

export function decideLlmRetry(input: {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly errorCode: string;
}): RetryDecision {
  if (input.attempt >= input.maxAttempts) {
    return { shouldRetry: false, reason: 'max_attempts' };
  }
  if (NEVER_RETRY.has(input.errorCode)) {
    return { shouldRetry: false, reason: 'safety_no_retry' };
  }
  if (RETRYABLE.has(input.errorCode)) {
    return { shouldRetry: true, reason: 'retryable_error' };
  }
  return { shouldRetry: false, reason: 'non_retryable' };
}
