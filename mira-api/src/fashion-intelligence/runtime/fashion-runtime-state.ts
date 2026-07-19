/**
 * Canonical Fashion Runtime (Phase 6A.5 §9) — Wardrobe Foundation (6B).
 * Law #29: stable vocabulary across provider swap.
 */
export type FashionRuntimeStatus =
  | 'NOT_REQUESTED'
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'BLOCKED'
  | 'FAILED';

export type FashionRuntimeStage =
  | 'idle'
  | 'registry'
  | 'policy'
  | 'provider_selection'
  | 'execution'
  | 'mapping'
  | 'session_persist'
  | 'terminal';

export type FashionTrustLevel =
  | 'full'
  | 'partial'
  | 'degraded'
  | 'blocked'
  | 'unknown';

export interface CanonicalFashionRuntime {
  status: FashionRuntimeStatus;
  reasonCode?: string;
  reasonEn?: string;
  reasonAr?: string;
  stage: FashionRuntimeStage;
  retryable: boolean;
  trustLevel: FashionTrustLevel;
  capabilityId?: string;
  capabilityVersion?: string;
  policyRuleId?: string;
  traceId?: string;
  /** SERVER AUDIT ONLY — stripped from public DTOs */
  providerId?: string;
}

export const FASHION_RUNTIME_STATUS_CATALOG: Record<
  FashionRuntimeStatus,
  {
    meaning: string;
    terminal: boolean;
    retryable: boolean;
    allowedNext: FashionRuntimeStatus[];
  }
> = {
  NOT_REQUESTED: {
    meaning: 'Capability or model not requested.',
    terminal: false,
    retryable: true,
    allowedNext: [
      'AVAILABLE',
      'PARTIAL',
      'DEGRADED',
      'UNAVAILABLE',
      'BLOCKED',
      'FAILED',
    ],
  },
  AVAILABLE: {
    meaning: 'May proceed.',
    terminal: false,
    retryable: true,
    allowedNext: ['PARTIAL', 'DEGRADED', 'BLOCKED', 'FAILED', 'UNAVAILABLE'],
  },
  PARTIAL: {
    meaning: 'Some fields/models available.',
    terminal: false,
    retryable: true,
    allowedNext: ['AVAILABLE', 'DEGRADED', 'BLOCKED', 'FAILED'],
  },
  DEGRADED: {
    meaning: 'Usable with limitations.',
    terminal: false,
    retryable: true,
    allowedNext: ['AVAILABLE', 'PARTIAL', 'BLOCKED', 'FAILED'],
  },
  UNAVAILABLE: {
    meaning: 'Registered but not executable.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  BLOCKED: {
    meaning: 'Policy / trust / config / license block.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  FAILED: {
    meaning: 'Execution failed.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
};

export function isValidFashionRuntimeTransition(
  from: FashionRuntimeStatus,
  to: FashionRuntimeStatus,
): boolean {
  if (from === to) return true;
  return FASHION_RUNTIME_STATUS_CATALOG[from].allowedNext.includes(to);
}

export function fashionRuntime(
  input: Omit<CanonicalFashionRuntime, 'retryable' | 'trustLevel'> & {
    retryable?: boolean;
    trustLevel?: FashionTrustLevel;
  },
): CanonicalFashionRuntime {
  const meta = FASHION_RUNTIME_STATUS_CATALOG[input.status];
  return {
    ...input,
    retryable: input.retryable ?? meta.retryable,
    trustLevel: input.trustLevel ?? defaultTrust(input.status),
  };
}

function defaultTrust(status: FashionRuntimeStatus): FashionTrustLevel {
  switch (status) {
    case 'AVAILABLE':
      return 'full';
    case 'PARTIAL':
      return 'partial';
    case 'DEGRADED':
      return 'degraded';
    case 'BLOCKED':
    case 'FAILED':
      return 'blocked';
    case 'UNAVAILABLE':
    case 'NOT_REQUESTED':
    default:
      return 'unknown';
  }
}

export function toPublicFashionRuntime(
  runtime: CanonicalFashionRuntime,
): CanonicalFashionRuntime {
  return {
    status: runtime.status,
    reasonCode: runtime.reasonCode,
    reasonEn: runtime.reasonEn,
    reasonAr: runtime.reasonAr,
    stage: runtime.stage,
    retryable: runtime.retryable,
    trustLevel: runtime.trustLevel,
    capabilityId: runtime.capabilityId,
    capabilityVersion: runtime.capabilityVersion,
    policyRuleId: runtime.policyRuleId,
    traceId: runtime.traceId,
    // providerId intentionally omitted
  };
}

export function assertNoFashionProviderLeakage(dto: unknown): void {
  const json = JSON.stringify(dto);
  const banned = [
    '"providerId"',
    'perfect_corp_payload',
    'banuba_sdk',
    'BanubaSdkManager',
    'rawYouCam',
    'YMKMakeup',
    'fashnPayload',
    'openaiRaw',
    '"perfect_beauty"',
    '"banuba_beauty"',
    // 6C.1 expanded ban list (Major: provider leakage)
    'rawFashn',
    'rawOpenAi',
    'fashnRaw',
    'fashn+openai',
    '"vision_platform"',
    'FASHN',
    'OpenAI',
    'openai.com',
    'fashn.ai',
    '"providers":[',
  ];
  for (const b of banned) {
    if (json.includes(b)) {
      throw new Error(`Canonical Fashion DTO provider leakage: ${b}`);
    }
  }
}
