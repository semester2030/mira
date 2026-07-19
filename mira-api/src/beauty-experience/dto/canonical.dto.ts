import { BeautyCapabilityCategory, BeautyCapabilityGroup, BeautyCapabilityMode, BeautyCostClass, BeautyPlatform, BeautyRequiredAsset, BeautyDependencyId, BeautyCapabilityLifecycleStatus } from '../capability/capability-ids';
import { BeautyRuntimeState } from '../runtime/beauty-runtime-state';

/** Public capability DTO — no provider fields (Law #14) */
export interface CanonicalCapabilityDto {
  capabilityId: string;
  version: string;
  formulaId?: string;
  category: BeautyCapabilityCategory;
  group?: BeautyCapabilityGroup;
  status?: BeautyCapabilityLifecycleStatus;
  modes: BeautyCapabilityMode[];
  platforms?: BeautyPlatform[];
  realtime?: boolean;
  offline?: boolean;
  costClass: BeautyCostClass;
  requiredAssets: BeautyRequiredAsset[];
  dependencies?: BeautyDependencyId[];
  qualityRequirements?: string[];
  labelEn: string;
  labelAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  futureStatus?: string;
  deprecationPolicy?: string;
  runtime: BeautyRuntimeState;
}

export interface CanonicalTryOnDto {
  attemptId: string;
  sessionId: string;
  lookId: string;
  capabilityId: string;
  resultAssetUrl: string | null;
  params: Record<string, string | number | boolean | null>;
  runtime: BeautyRuntimeState;
  generatedAt: string;
}

export interface CanonicalSessionDto {
  sessionId: string;
  state: string;
  version: string;
  analysisSources: {
    skinReportId?: string;
    faceReportId?: string;
    fashionReportId?: string;
  };
  attemptIds: string[];
  lookIds: string[];
  runtime: BeautyRuntimeState;
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalComparisonDto {
  comparisonId: string;
  sessionId: string;
  createdAt: string;
  candidates: Array<{
    lookId: string;
    capabilityId: string;
    attemptId: string;
    timestamp: string;
    metadata: Record<string, string | number | boolean | null>;
    metrics?: Record<string, number | string | boolean | null>;
    resultRef?: string;
    runtime: BeautyRuntimeState;
  }>;
}

export interface CanonicalHistoryDto {
  sessions: Array<{
    sessionId: string;
    state: string;
    createdAt: string;
    updatedAt: string;
    analysisSources: CanonicalSessionDto['analysisSources'];
    attempts: Array<{
      attemptId: string;
      capabilityId: string;
      lookId: string;
      createdAt: string;
      runtimeStatus: string;
    }>;
    looks: Array<{
      lookId: string;
      labelEn?: string;
      labelAr?: string;
      attemptIds: string[];
      createdAt: string;
    }>;
  }>;
}

export interface CanonicalLookDto {
  lookId: string;
  sessionId: string;
  labelEn?: string;
  labelAr?: string;
  attemptIds: string[];
  createdAt: string;
}

export interface CanonicalFavoriteDto {
  favoriteId: string;
  lookId: string;
  sessionId: string;
  createdAt: string;
}

export interface CanonicalCollectionDto {
  collectionId: string;
  titleEn: string;
  titleAr: string;
  lookIds: string[];
  createdAt: string;
}

export interface CanonicalShareDto {
  shareId: string;
  sessionId: string;
  lookId?: string;
  createdAt: string;
  revoked: boolean;
}

export interface CanonicalBeautyExperienceDto {
  architectureVersion: string;
  compatibilityVersion: string;
  release: string;
  status: string;
  catalogVersion?: string;
  integrationRelease?: string;
  integrationStatus?: string;
  providerExecutionEnabled?: boolean;
  capabilities: CanonicalCapabilityDto[];
  runtime: BeautyRuntimeState;
}

/** Strip server-only explainability fields before Flutter wire */
export function toPublicRuntime(runtime: BeautyRuntimeState): BeautyRuntimeState {
  return {
    status: runtime.status,
    reasonCode: runtime.reasonCode,
    reasonEn: runtime.reasonEn,
    reasonAr: runtime.reasonAr,
    stage: runtime.stage,
    policyRuleId: runtime.policyRuleId,
    capabilityVersion: runtime.capabilityVersion,
    capabilityId: runtime.capabilityId,
    traceId: runtime.traceId,
    retryable: runtime.retryable,
    // providerId intentionally omitted
  };
}

export function assertCanonicalDtoNoProviderFields(dto: unknown): void {
  const json = JSON.stringify(dto);
  const banned = [
    '"providerId"',
    '"provider":',
    'perfect_corp_payload',
    'banuba_sdk',
    'BanubaSdkManager',
    'rawYouCam',
    'YMKMakeup',
    '"perfect_beauty"',
    '"banuba_beauty"',
  ];
  for (const b of banned) {
    if (json.includes(b)) {
      throw new Error(`Canonical DTO provider leakage: ${b}`);
    }
  }
}
