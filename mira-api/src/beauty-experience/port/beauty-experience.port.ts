import { ResultMeta } from '../../ports/shared/result-meta';
import { ProviderPortError } from '../../ports/shared/provider-error';
import { BeautyRuntimeState } from '../runtime/beauty-runtime-state';
import {
  CanonicalCapabilityDto,
  CanonicalTryOnDto,
  CanonicalSessionDto,
  CanonicalComparisonDto,
  CanonicalHistoryDto,
  CanonicalBeautyExperienceDto,
  CanonicalLookDto,
  CanonicalFavoriteDto,
  CanonicalCollectionDto,
  CanonicalShareDto,
} from '../dto/canonical.dto';
import { BeautyAnalysisSources } from '../session/analysis-sources';
import { BeautyPolicyContext } from '../policy/policy-context';

export const BEAUTY_EXPERIENCE_PORT = Symbol('BEAUTY_EXPERIENCE_PORT');

/**
 * Canonical Beauty Experience Port — integration-ready (5B.1).
 * Flutter requests capabilities — never providers.
 * Provider execution remains disabled until activation + license.
 */
export interface BeautyExperienceExecuteRequest {
  capabilityId: string;
  sessionId: string;
  lookId?: string;
  imageBytes?: Buffer;
  params?: Record<string, string | number | boolean | null>;
  policy: BeautyPolicyContext;
  traceId?: string;
}

export interface BeautyExperienceExecuteResult {
  /**
   * true only after real provider activation + successful execution.
   * Phase 5B.1 always returns false — never fabricate success.
   */
  success: boolean;
  tryOn: CanonicalTryOnDto | null;
  session: CanonicalSessionDto;
  runtime: BeautyRuntimeState;
  meta: ResultMeta;
}

export interface BeautyExperiencePort {
  listCapabilities(): Promise<CanonicalCapabilityDto[]>;
  describe(): Promise<CanonicalBeautyExperienceDto>;
  createSession(userId?: string): Promise<CanonicalSessionDto>;
  getSession(sessionId: string): Promise<CanonicalSessionDto>;
  attachAnalysisSources(
    sessionId: string,
    sources: BeautyAnalysisSources,
  ): Promise<CanonicalSessionDto>;
  createLook(
    sessionId: string,
    labelEn?: string,
    labelAr?: string,
  ): Promise<CanonicalLookDto>;
  listLooks(sessionId: string): Promise<CanonicalLookDto[]>;
  /**
   * Capability → Policy → Readiness → (no provider) → Canonical DTO.
   * Never fabricates images. Never calls Perfect/Banuba in 5B.1.
   */
  executeCapability(
    request: BeautyExperienceExecuteRequest,
  ): Promise<BeautyExperienceExecuteResult>;
  compare(
    sessionId: string,
    attemptIds: string[],
  ): Promise<CanonicalComparisonDto>;
  history(userId?: string): Promise<CanonicalHistoryDto>;
  addFavorite(sessionId: string, lookId: string): Promise<CanonicalFavoriteDto>;
  createCollection(
    sessionId: string,
    titleEn: string,
    titleAr: string,
    lookIds: string[],
  ): Promise<CanonicalCollectionDto>;
  share(sessionId: string, lookId?: string): Promise<CanonicalShareDto>;
}

export type BeautyExperienceProviderError = ProviderPortError;
