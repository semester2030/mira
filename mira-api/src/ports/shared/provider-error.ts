/**
 * Phase 1 — typed provider error taxonomy (safe for clients).
 */

export type ProviderErrorCode =
  | 'invalid_input'
  | 'image_quality_failure'
  | 'no_face'
  | 'multiple_faces'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_quota_exceeded'
  | 'provider_auth_failure'
  | 'malformed_provider_response'
  | 'unsupported_capability'
  | 'unsafe_mock_blocked'
  | 'internal_error';

export interface ProviderError {
  code: ProviderErrorCode;
  retryable: boolean;
  /** i18n / client message key — never secrets */
  safeUserMessageKey: string;
  provider: string;
  traceId: string;
  /** Server-only — never serialize to Flutter */
  internalDetails?: string;
}

export class ProviderPortError extends Error {
  readonly providerError: ProviderError;

  constructor(error: ProviderError) {
    super(`[${error.code}] ${error.safeUserMessageKey}`);
    this.name = 'ProviderPortError';
    this.providerError = error;
  }
}

/** Public payload for Nest HTTP mapping — excludes internalDetails. */
export function toClientProviderError(error: ProviderError): Omit<
  ProviderError,
  'internalDetails'
> {
  return {
    code: error.code,
    retryable: error.retryable,
    safeUserMessageKey: error.safeUserMessageKey,
    provider: error.provider,
    traceId: error.traceId,
  };
}

export function createProviderError(
  partial: Omit<ProviderError, 'retryable'> & { retryable?: boolean },
): ProviderError {
  const retryableDefaults: Partial<Record<ProviderErrorCode, boolean>> = {
    provider_timeout: true,
    provider_unavailable: true,
    provider_quota_exceeded: true,
    image_quality_failure: false,
    no_face: false,
    invalid_input: false,
    unsafe_mock_blocked: false,
    unsupported_capability: false,
    provider_auth_failure: false,
    malformed_provider_response: false,
    multiple_faces: false,
    internal_error: false,
  };
  return {
    ...partial,
    retryable: partial.retryable ?? retryableDefaults[partial.code] ?? false,
  };
}

/** Map Nest / YouCam-ish messages into taxonomy without leaking secrets. */
export function classifyProviderFailure(input: {
  message: string;
  provider: string;
  traceId: string;
}): ProviderError {
  const m = input.message.toLowerCase();
  if (m.includes('timeout') || m.includes('timed out')) {
    return createProviderError({
      code: 'provider_timeout',
      safeUserMessageKey: 'errors.provider_timeout',
      provider: input.provider,
      traceId: input.traceId,
      internalDetails: input.message.slice(0, 200),
    });
  }
  if (m.includes('quota') || m.includes('rate limit') || m.includes('429')) {
    return createProviderError({
      code: 'provider_quota_exceeded',
      safeUserMessageKey: 'errors.provider_quota_exceeded',
      provider: input.provider,
      traceId: input.traceId,
      internalDetails: input.message.slice(0, 200),
    });
  }
  if (m.includes('401') || m.includes('403') || m.includes('api key') || m.includes('unauthorized')) {
    return createProviderError({
      code: 'provider_auth_failure',
      safeUserMessageKey: 'errors.provider_auth_failure',
      provider: input.provider,
      traceId: input.traceId,
      internalDetails: input.message.slice(0, 200),
    });
  }
  if (m.includes('no_face') || m.includes('face_not') || m.includes('no face')) {
    return createProviderError({
      code: 'no_face',
      safeUserMessageKey: 'errors.no_face',
      provider: input.provider,
      traceId: input.traceId,
      internalDetails: input.message.slice(0, 200),
    });
  }
  if (m.includes('face_too_small') || m.includes('lighting') || m.includes('quality')) {
    return createProviderError({
      code: 'image_quality_failure',
      safeUserMessageKey: 'errors.image_quality_failure',
      provider: input.provider,
      traceId: input.traceId,
      internalDetails: input.message.slice(0, 200),
    });
  }
  if (m.includes('mock') && m.includes('block')) {
    return createProviderError({
      code: 'unsafe_mock_blocked',
      safeUserMessageKey: 'errors.unsafe_mock_blocked',
      provider: input.provider,
      traceId: input.traceId,
    });
  }
  if (m.includes('garment_mapping') || m.includes('garment validation') || m.includes('empty_garments_on_proceed')) {
    return createProviderError({
      code: 'malformed_provider_response',
      safeUserMessageKey: 'errors.malformed_provider_response',
      provider: input.provider,
      traceId: input.traceId,
      internalDetails: input.message.slice(0, 200),
    });
  }
  if (m.includes('unavailable') || m.includes('not configured') || m.includes('503')) {
    return createProviderError({
      code: 'provider_unavailable',
      safeUserMessageKey: 'errors.provider_unavailable',
      provider: input.provider,
      traceId: input.traceId,
      internalDetails: input.message.slice(0, 200),
    });
  }
  return createProviderError({
    code: 'internal_error',
    safeUserMessageKey: 'errors.internal_error',
    provider: input.provider,
    traceId: input.traceId,
    internalDetails: input.message.slice(0, 200),
  });
}
