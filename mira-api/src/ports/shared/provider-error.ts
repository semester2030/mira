/**
 * Phase 1 — typed provider error taxonomy (safe for clients).
 * Phase 5 surgical: always expose Arabic `message` + capture vs service semantics.
 */
import { classifyYouCamCaptureError } from '../../ai/face-gate/youcam-face-errors';

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

export type ProviderErrorCategory =
  | 'capture_quality'
  | 'provider'
  | 'timeout'
  | 'internal'
  | 'auth'
  | 'input';

export type ProviderUserAction = 'recapture' | 'retry' | 'none';

export interface ProviderError {
  code: ProviderErrorCode;
  retryable: boolean;
  /** i18n / client message key — never secrets */
  safeUserMessageKey: string;
  /** Product Arabic — required for client display */
  message: string;
  category: ProviderErrorCategory;
  requiresRecapture: boolean;
  userAction: ProviderUserAction;
  /** Stable Face capture code when applicable */
  captureCode?: string;
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

const DEFAULT_MESSAGES: Record<ProviderErrorCode, string> = {
  invalid_input: 'تعذر قراءة الصورة — أعيدي الالتقاط.',
  image_quality_failure:
    'تعذر تحليل الصورة — تأكدي من وضوح الوجه وقرب الكاميرا.',
  no_face:
    'لم نتعرف على وجه — التقطي selfie واضح وثبّتي وجهك في منتصف الإطار.',
  multiple_faces: 'وجدنا أكثر من وجه — التقطي صورة لوجه واحد فقط.',
  provider_unavailable:
    'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.',
  provider_timeout: 'استغرق التحليل وقتًا أطول من المتوقع. حاول مرة أخرى.',
  provider_quota_exceeded: 'طلبات كثيرة — انتظري قليلًا ثم أعيدي المحاولة.',
  provider_auth_failure:
    'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.',
  malformed_provider_response:
    'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.',
  unsupported_capability: 'هذه القدرة غير متاحة حالياً.',
  unsafe_mock_blocked:
    'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.',
  internal_error:
    'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.',
};

function defaultsForCode(code: ProviderErrorCode): Pick<
  ProviderError,
  'category' | 'requiresRecapture' | 'userAction' | 'message'
> {
  switch (code) {
    case 'image_quality_failure':
    case 'no_face':
    case 'multiple_faces':
    case 'invalid_input':
      return {
        category: 'capture_quality',
        requiresRecapture: true,
        userAction: 'recapture',
        message: DEFAULT_MESSAGES[code],
      };
    case 'provider_timeout':
      return {
        category: 'timeout',
        requiresRecapture: false,
        userAction: 'retry',
        message: DEFAULT_MESSAGES[code],
      };
    case 'provider_unavailable':
    case 'provider_quota_exceeded':
    case 'provider_auth_failure':
    case 'unsafe_mock_blocked':
    case 'malformed_provider_response':
      return {
        category: 'provider',
        requiresRecapture: false,
        userAction: 'retry',
        message: DEFAULT_MESSAGES[code],
      };
    case 'unsupported_capability':
      return {
        category: 'input',
        requiresRecapture: false,
        userAction: 'none',
        message: DEFAULT_MESSAGES[code],
      };
    default:
      return {
        category: 'internal',
        requiresRecapture: false,
        userAction: 'retry',
        message: DEFAULT_MESSAGES.internal_error,
      };
  }
}

/** Public payload for Nest HTTP mapping — excludes internalDetails. */
export function toClientProviderError(
  error: Pick<
    ProviderError,
    'code' | 'retryable' | 'safeUserMessageKey' | 'provider' | 'traceId'
  > &
    Partial<ProviderError>,
): Omit<ProviderError, 'internalDetails'> & { message: string } {
  const d = defaultsForCode(error.code);
  return {
    code: error.code,
    retryable: error.retryable,
    safeUserMessageKey: error.safeUserMessageKey,
    message: error.message?.trim() || d.message,
    category: error.category ?? d.category,
    requiresRecapture: error.requiresRecapture ?? d.requiresRecapture,
    userAction: error.userAction ?? d.userAction,
    ...(error.captureCode ? { captureCode: error.captureCode } : {}),
    provider: error.provider,
    traceId: error.traceId,
  };
}

export function createProviderError(
  partial: Omit<ProviderError, 'retryable' | 'message' | 'category' | 'requiresRecapture' | 'userAction'> &
    Partial<
      Pick<
        ProviderError,
        'retryable' | 'message' | 'category' | 'requiresRecapture' | 'userAction' | 'captureCode'
      >
    >,
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
  const d = defaultsForCode(partial.code);
  return {
    ...partial,
    retryable: partial.retryable ?? retryableDefaults[partial.code] ?? false,
    message: partial.message?.trim() || d.message,
    category: partial.category ?? d.category,
    requiresRecapture: partial.requiresRecapture ?? d.requiresRecapture,
    userAction: partial.userAction ?? d.userAction,
  };
}

/** Map Nest / YouCam-ish messages into taxonomy without leaking secrets. */
export function classifyProviderFailure(input: {
  message: string;
  provider: string;
  traceId: string;
}): ProviderError {
  const m = input.message.toLowerCase();
  const youcam = classifyYouCamCaptureError(input.message);
  if (youcam) {
    const code: ProviderErrorCode =
      youcam.code === 'CAPTURE_NO_FACE'
        ? 'no_face'
        : youcam.code === 'CAPTURE_MULTIPLE_FACES'
          ? 'multiple_faces'
          : 'image_quality_failure';
    return createProviderError({
      code,
      safeUserMessageKey: `errors.${youcam.code.toLowerCase()}`,
      message: youcam.message,
      category: 'capture_quality',
      requiresRecapture: true,
      userAction: 'recapture',
      captureCode: youcam.code,
      provider: input.provider,
      traceId: input.traceId,
      internalDetails: input.message.slice(0, 200),
    });
  }

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
