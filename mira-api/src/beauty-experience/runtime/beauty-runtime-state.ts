/**
 * Explainable capability runtime (Engineering Law #16).
 * Every state carries reason, stage, policy, version.
 * providerId is server-audit only — stripped from public canonical DTOs.
 */
export type BeautyRuntimeStatus =
  | 'NOT_REQUESTED'
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'SKIPPED'
  | 'BLOCKED_BY_POLICY'
  | 'BLOCKED_BY_LICENSE'
  | 'BLOCKED_BY_COST'
  | 'BLOCKED_BY_PLATFORM'
  | 'BLOCKED_BY_PROVIDER'
  | 'BLOCKED_BY_ASSETS'
  | 'BLOCKED_BY_QUALITY'
  | 'BLOCKED_BY_CONFIGURATION';

export type BeautyRuntimeStage =
  | 'idle'
  | 'registry'
  | 'policy'
  | 'provider_selection'
  | 'asset_check'
  | 'configuration'
  | 'execution'
  | 'mapping'
  | 'session_persist'
  | 'terminal';

export interface BeautyRuntimeState {
  status: BeautyRuntimeStatus;
  reasonCode?: string;
  reasonEn?: string;
  reasonAr?: string;
  stage: BeautyRuntimeStage;
  policyRuleId?: string;
  capabilityVersion?: string;
  capabilityId?: string;
  /** Server-audit only — stripped from public DTOs */
  providerId?: string;
  traceId?: string;
  /** Retry policy from runtime catalog */
  retryable?: boolean;
}

export const RUNTIME_STATUS_CATALOG: Record<
  BeautyRuntimeStatus,
  {
    meaning: string;
    terminal: boolean;
    retryable: boolean;
    allowedNext: BeautyRuntimeStatus[];
  }
> = {
  NOT_REQUESTED: {
    meaning: 'Capability not requested in this session.',
    terminal: false,
    retryable: true,
    allowedNext: [
      'AVAILABLE',
      'UNAVAILABLE',
      'BLOCKED_BY_POLICY',
      'BLOCKED_BY_LICENSE',
      'BLOCKED_BY_COST',
      'BLOCKED_BY_PLATFORM',
      'BLOCKED_BY_PROVIDER',
      'BLOCKED_BY_ASSETS',
      'BLOCKED_BY_QUALITY',
      'BLOCKED_BY_CONFIGURATION',
      'SKIPPED',
    ],
  },
  AVAILABLE: {
    meaning: 'Capability may execute after negotiation.',
    terminal: false,
    retryable: true,
    allowedNext: [
      'FAILED',
      'SKIPPED',
      'UNAVAILABLE',
      'BLOCKED_BY_PROVIDER',
      'BLOCKED_BY_CONFIGURATION',
    ],
  },
  UNAVAILABLE: {
    meaning: 'Capability registered but not executable now.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  FAILED: {
    meaning: 'Execution attempted and failed.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  SKIPPED: {
    meaning: 'Intentionally skipped for this session.',
    terminal: true,
    retryable: false,
    allowedNext: ['NOT_REQUESTED'],
  },
  BLOCKED_BY_POLICY: {
    meaning: 'Generic or multi-rule policy block.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  BLOCKED_BY_LICENSE: {
    meaning: 'No licensed provider / license gate.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  BLOCKED_BY_COST: {
    meaning: 'Quota or cost class entitlement failed.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  BLOCKED_BY_PLATFORM: {
    meaning: 'Platform not supported for this capability.',
    terminal: true,
    retryable: false,
    allowedNext: ['NOT_REQUESTED'],
  },
  BLOCKED_BY_PROVIDER: {
    meaning: 'Providers unhealthy or none selectable.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  BLOCKED_BY_ASSETS: {
    meaning: 'Required assets missing (mask/mesh/image).',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  BLOCKED_BY_QUALITY: {
    meaning: 'Capture quality gate failed.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
  BLOCKED_BY_CONFIGURATION: {
    meaning: 'Provider/config incomplete — readiness platform gate.',
    terminal: true,
    retryable: true,
    allowedNext: ['AVAILABLE', 'NOT_REQUESTED'],
  },
};

export function runtimeAvailable(
  capabilityId?: string,
  capabilityVersion?: string,
  traceId?: string,
): BeautyRuntimeState {
  return withRetryPolicy({
    status: 'AVAILABLE',
    stage: 'registry',
    capabilityId,
    capabilityVersion,
    traceId,
    reasonEn: 'Capability is available for execution.',
    reasonAr: 'القدرة متاحة للتنفيذ.',
  });
}

export function runtimeExplainable(input: {
  status: BeautyRuntimeStatus;
  stage: BeautyRuntimeStage;
  reasonCode: string;
  reasonEn: string;
  reasonAr: string;
  capabilityId?: string;
  capabilityVersion?: string;
  policyRuleId?: string;
  providerId?: string;
  traceId?: string;
}): BeautyRuntimeState {
  const meta = RUNTIME_STATUS_CATALOG[input.status];
  return {
    ...input,
    retryable: meta.retryable,
  };
}

function withRetryPolicy(
  state: BeautyRuntimeState,
): BeautyRuntimeState {
  const meta = RUNTIME_STATUS_CATALOG[state.status];
  return {
    ...state,
    retryable: state.retryable ?? meta.retryable,
  };
}

export function runtimeBlocked(
  reasonCode: string,
  reasonEn: string,
  reasonAr: string,
  capabilityId?: string,
  traceId?: string,
  extras?: Partial<BeautyRuntimeState>,
): BeautyRuntimeState {
  return withRetryPolicy({
    status: 'BLOCKED_BY_POLICY',
    stage: 'policy',
    reasonCode,
    reasonEn,
    reasonAr,
    capabilityId,
    traceId,
    ...extras,
  });
}

export function runtimeUnavailable(
  reasonCode: string,
  reasonEn: string,
  reasonAr: string,
  capabilityId?: string,
  traceId?: string,
  extras?: Partial<BeautyRuntimeState>,
): BeautyRuntimeState {
  return withRetryPolicy({
    status: 'UNAVAILABLE',
    stage: 'registry',
    reasonCode,
    reasonEn,
    reasonAr,
    capabilityId,
    traceId,
    ...extras,
  });
}

export function runtimeFailed(
  reasonCode: string,
  reasonEn: string,
  reasonAr: string,
  capabilityId?: string,
  traceId?: string,
  extras?: Partial<BeautyRuntimeState>,
): BeautyRuntimeState {
  return withRetryPolicy({
    status: 'FAILED',
    stage: 'execution',
    reasonCode,
    reasonEn,
    reasonAr,
    capabilityId,
    traceId,
    ...extras,
  });
}

/** Map policy rule → specific blocked runtime status */
export function runtimeStatusForPolicyRule(
  ruleId: string,
): BeautyRuntimeStatus {
  switch (ruleId) {
    case 'license':
      return 'BLOCKED_BY_LICENSE';
    case 'quota':
    case 'cost':
      return 'BLOCKED_BY_COST';
    case 'platform':
      return 'BLOCKED_BY_PLATFORM';
    case 'provider_availability':
      return 'BLOCKED_BY_PROVIDER';
    case 'quality':
      return 'BLOCKED_BY_QUALITY';
    case 'configuration':
      return 'BLOCKED_BY_CONFIGURATION';
    case 'feature_flag':
    case 'real_tryon_flag':
    case 'subscription':
    case 'country':
    case 'device':
    case 'consent':
    case 'age':
    default:
      return 'BLOCKED_BY_POLICY';
  }
}

export function assertNoVendorLeakage(blob: string): void {
  const banned = [
    'perfect_corp_payload',
    'banuba_sdk',
    'rawYouCam',
    'YMKMakeup',
    'BanubaSdkManager',
  ];
  for (const b of banned) {
    if (blob.includes(b)) {
      throw new Error(`Vendor leakage detected: ${b}`);
    }
  }
}
