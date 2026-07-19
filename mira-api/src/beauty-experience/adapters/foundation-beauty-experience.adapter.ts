import {
  BEAUTY_INTEGRATION_RELEASE,
  BEAUTY_INTEGRATION_STATUS,
} from '../integration/release';
import {
  isProviderExecutionAllowed,
  resolveBeautyFeatureFlags,
} from '../integration/feature-flags';
import { beautyTelemetry } from '../integration/beauty-telemetry';
import {
  BEAUTY_EXPERIENCE_ARCHITECTURE,
  BEAUTY_EXPERIENCE_COMPAT,
  BEAUTY_EXPERIENCE_RELEASE,
  BEAUTY_EXPERIENCE_STATUS,
} from '../release';
import { BEAUTY_CAPABILITY_CATALOG_VERSION } from '../capability/catalog-release';
import {
  runtimeUnavailable,
  runtimeExplainable,
  runtimeStatusForPolicyRule,
} from '../runtime/beauty-runtime-state';
import {
  CanonicalCapabilityDto,
  CanonicalSessionDto,
  CanonicalComparisonDto,
  CanonicalHistoryDto,
  CanonicalBeautyExperienceDto,
  CanonicalTryOnDto,
  CanonicalLookDto,
  CanonicalFavoriteDto,
  CanonicalCollectionDto,
  CanonicalShareDto,
  assertCanonicalDtoNoProviderFields,
  toPublicRuntime,
} from '../dto/canonical.dto';
import { buildHistoryEntry } from '../history/history-model';
import {
  createComparison,
  BeautyComparisonCandidate,
} from '../comparison/comparison-model';
import { BeautyAnalysisSources } from '../session/analysis-sources';
import { BeautySessionStore } from '../session/beauty-session-store';
import {
  createFoundationProviderManager,
  ProviderManager,
} from '../provider-manager/provider-manager';
import { CapabilityPolicyEngine } from '../policy/capability-policy-engine';
import { defaultCapabilityRegistry } from '../capability/capability-registry';
import { CapabilityEngine } from '../capability/capability-engine';
import {
  BeautyExperienceExecuteRequest,
  BeautyExperienceExecuteResult,
  BeautyExperiencePort,
} from '../port/beauty-experience.port';
import {
  buildResultMeta,
  newTraceId,
} from '../../ports/shared/result-meta';
import { isProductionEnv } from '../../config/production-integrity';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';


/**
 * Beauty Experience adapter — integration-ready (5B.1).
 * Full session/look/history/compare/favorites flow.
 * NEVER calls Perfect/Banuba. NEVER fabricates try-on images.
 */
@Injectable()
export class FoundationBeautyExperienceAdapter implements BeautyExperiencePort {
  private readonly capabilityEngine = new CapabilityEngine(
    defaultCapabilityRegistry,
  );
  private readonly policyEngine = new CapabilityPolicyEngine();
  private readonly providerManager: ProviderManager =
    createFoundationProviderManager();
  private readonly sessions = new BeautySessionStore();
  private readonly userSessions = new Map<string, string[]>();

  constructor(private readonly config: ConfigService) {}

  private flags() {
    return resolveBeautyFeatureFlags((k, d) => this.config.get(k, d));
  }

  async listCapabilities(): Promise<CanonicalCapabilityDto[]> {
    return this.capabilityEngine.listPublic().map((c) => {
      const resolved = this.capabilityEngine.resolve(c.capabilityId);
      const dto: CanonicalCapabilityDto = {
        ...c,
        runtime: toPublicRuntime(resolved.runtime),
      };
      assertCanonicalDtoNoProviderFields(dto);
      return dto;
    });
  }

  async describe(): Promise<CanonicalBeautyExperienceDto> {
    const capabilities = await this.listCapabilities();
    const flags = this.flags();
    const dto: CanonicalBeautyExperienceDto = {
      architectureVersion: BEAUTY_EXPERIENCE_ARCHITECTURE,
      compatibilityVersion: BEAUTY_EXPERIENCE_COMPAT,
      release: BEAUTY_EXPERIENCE_RELEASE,
      status: BEAUTY_EXPERIENCE_STATUS,
      catalogVersion: BEAUTY_CAPABILITY_CATALOG_VERSION,
      integrationRelease: BEAUTY_INTEGRATION_RELEASE,
      integrationStatus: BEAUTY_INTEGRATION_STATUS,
      providerExecutionEnabled: isProviderExecutionAllowed(flags),
      capabilities,
      runtime: toPublicRuntime(
        runtimeUnavailable(
          'integration_provider_execution_disabled',
          'Beauty Experience integration ready — provider execution disabled.',
          'تكامل تجربة الجمال جاهز — تنفيذ المزوّد معطّل.',
          undefined,
          undefined,
          {
            stage: 'terminal',
            capabilityVersion: BEAUTY_CAPABILITY_CATALOG_VERSION,
          },
        ),
      ),
    };
    assertCanonicalDtoNoProviderFields(dto);
    if (flags.beautyTelemetryEnabled) {
      beautyTelemetry.track({
        name: 'beauty_integration_ready',
        traceId: newTraceId('bdesc'),
        props: {
          providerExecutionEnabled: false,
          integrationRelease: BEAUTY_INTEGRATION_RELEASE,
        },
      });
    }
    return dto;
  }

  async createSession(userId?: string): Promise<CanonicalSessionDto> {
    const session = this.sessions.create(userId);
    if (userId) {
      const list = this.userSessions.get(userId) ?? [];
      list.push(session.sessionId);
      this.userSessions.set(userId, list);
    }
    beautyTelemetry.track({
      name: 'beauty_session_created',
      traceId: newTraceId('bsess'),
      sessionId: session.sessionId,
    });
    return this.toSessionDto(session.sessionId);
  }

  async getSession(sessionId: string): Promise<CanonicalSessionDto> {
    if (!this.sessions.get(sessionId)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return this.toSessionDto(sessionId);
  }

  async attachAnalysisSources(
    sessionId: string,
    sources: BeautyAnalysisSources,
  ): Promise<CanonicalSessionDto> {
    this.sessions.attachAnalysisSources(sessionId, sources);
    beautyTelemetry.track({
      name: 'beauty_session_enriched',
      traceId: newTraceId('benr'),
      sessionId,
    });
    return this.toSessionDto(sessionId);
  }

  async createLook(
    sessionId: string,
    labelEn?: string,
    labelAr?: string,
  ): Promise<CanonicalLookDto> {
    const look = this.sessions.addLook(sessionId, labelEn, labelAr);
    beautyTelemetry.track({
      name: 'beauty_look_created',
      traceId: newTraceId('blook'),
      sessionId,
      props: { lookId: look.lookId },
    });
    const dto: CanonicalLookDto = { ...look };
    assertCanonicalDtoNoProviderFields(dto);
    return dto;
  }

  async listLooks(sessionId: string): Promise<CanonicalLookDto[]> {
    const looks = this.sessions.listLooks(sessionId);
    const dtos = looks.map((l) => ({ ...l }));
    assertCanonicalDtoNoProviderFields(dtos);
    return dtos;
  }

  async executeCapability(
    request: BeautyExperienceExecuteRequest,
  ): Promise<BeautyExperienceExecuteResult> {
    const traceId = request.traceId ?? newTraceId('bex');
    const flags = this.flags();
    const capability = this.capabilityEngine.resolve(request.capabilityId);

    beautyTelemetry.track({
      name: 'beauty_capability_requested',
      traceId,
      sessionId: request.sessionId,
      capabilityId: capability.capabilityId,
    });

    if (!this.sessions.get(request.sessionId)) {
      throw new Error(`Session not found: ${request.sessionId}`);
    }
    let lookId = request.lookId;
    if (!lookId) {
      lookId = this.sessions.addLook(request.sessionId).lookId;
    }

    // Integration readiness / configuration gate (before policy)
    if (!flags.beautyExperienceEnabled) {
      return this.blockedResult({
        request,
        lookId,
        capabilityId: capability.capabilityId,
        capabilityVersion: capability.metadata.version,
        traceId,
        status: 'BLOCKED_BY_POLICY',
        stage: 'policy',
        reasonCode: 'beauty_experience_disabled',
        reasonEn: 'Beauty Experience feature flag is off.',
        reasonAr: 'علم ميزة تجربة الجمال متوقف.',
        policyRuleId: 'feature_flag',
      });
    }

    if (!flags.beautyIntegrationReady) {
      return this.blockedResult({
        request,
        lookId,
        capabilityId: capability.capabilityId,
        capabilityVersion: capability.metadata.version,
        traceId,
        status: 'BLOCKED_BY_CONFIGURATION',
        stage: 'configuration',
        reasonCode: 'integration_disabled',
        reasonEn: 'Beauty Experience integration flag disabled.',
        reasonAr: 'علم تكامل تجربة الجمال متوقف.',
      });
    }

    // Provider execution gate — never call Perfect/Banuba in 5B.1
    if (!isProviderExecutionAllowed(flags)) {
      const status = !flags.beautyLipLicenseVerified
        ? ('BLOCKED_BY_LICENSE' as const)
        : ('BLOCKED_BY_CONFIGURATION' as const);
      return this.blockedResult({
        request,
        lookId,
        capabilityId: capability.capabilityId,
        capabilityVersion: capability.metadata.version,
        traceId,
        status,
        stage: status === 'BLOCKED_BY_LICENSE' ? 'policy' : 'configuration',
        reasonCode: 'provider_execution_disabled_5b1',
        reasonEn:
          'Provider execution disabled — integration ready, awaiting verified license/activation.',
        reasonAr:
          'تنفيذ المزوّد معطّل — التكامل جاهز وبانتظار ترخيص/تفعيل موثّق.',
        policyRuleId: 'license',
      });
    }

    const policy = this.policyEngine.evaluate({
      ...request.policy,
      capabilityId: capability.capabilityId,
      hasLicensedProviderCandidate: false,
      licenseOk: flags.beautyLipLicenseVerified,
      realTryOnEnabled: flags.beautyRealTryOnEnabled,
      beautyExperienceEnabled: flags.beautyExperienceEnabled,
      traceId,
    });

    if (!policy.allowed) {
      const status = runtimeStatusForPolicyRule(
        policy.blockingRule ?? 'feature_flag',
      );
      return this.blockedResult({
        request,
        lookId,
        capabilityId: capability.capabilityId,
        capabilityVersion: capability.metadata.version,
        traceId,
        status,
        stage: 'policy',
        reasonCode: policy.reasonCode ?? 'policy_blocked',
        reasonEn: policy.reasonEn ?? 'Blocked by policy',
        reasonAr: policy.reasonAr ?? 'محظور بالسياسة',
        policyRuleId: policy.blockingRule,
      });
    }

    // Defense: even if flags somehow allow execution, 5B.1 never fabricates or calls vendors
    const selection = this.providerManager.selectForCapability(
      capability.capabilityId,
    );
    return this.blockedResult({
      request,
      lookId,
      capabilityId: capability.capabilityId,
      capabilityVersion: capability.metadata.version,
      traceId,
      status: 'BLOCKED_BY_PROVIDER',
      stage: 'provider_selection',
      reasonCode: 'no_live_provider_5b1',
      reasonEn: selection.reason ?? 'No live provider in Phase 5B.1',
      reasonAr: 'لا يوجد مزوّد حي في المرحلة 5B.1',
      providerId: selection.selected,
    });
  }

  async compare(
    sessionId: string,
    attemptIds: string[],
  ): Promise<CanonicalComparisonDto> {
    if (attemptIds.length < 2) {
      throw new Error('Comparison requires at least 2 attempts');
    }
    const candidates: BeautyComparisonCandidate[] = attemptIds.map((id) => {
      const a = this.sessions.getAttempt(id);
      if (!a || a.sessionId !== sessionId) {
        throw new Error(`Attempt ${id} not in session`);
      }
      return {
        lookId: a.lookId,
        capabilityId: a.capabilityId,
        attemptId: a.attemptId,
        timestamp: a.createdAt,
        providerId: a.providerId,
        metadata: { sessionId, capabilityId: a.capabilityId },
        metrics: a.metrics,
        resultRef: a.resultRef,
        runtime: a.runtime,
      };
    });
    const cmp = createComparison(sessionId, candidates);
    this.sessions.setState(sessionId, 'comparing');
    beautyTelemetry.track({
      name: 'beauty_compare_created',
      traceId: newTraceId('bcmp'),
      sessionId,
      props: { candidates: attemptIds.length },
    });
    const dto: CanonicalComparisonDto = {
      comparisonId: cmp.comparisonId,
      sessionId: cmp.sessionId,
      createdAt: cmp.createdAt,
      candidates: cmp.candidates.map((c) => ({
        lookId: c.lookId,
        capabilityId: c.capabilityId,
        attemptId: c.attemptId,
        timestamp: c.timestamp,
        metadata: c.metadata,
        metrics: c.metrics,
        resultRef: c.resultRef,
        runtime: toPublicRuntime(c.runtime),
      })),
    };
    assertCanonicalDtoNoProviderFields(dto);
    return dto;
  }

  async history(userId?: string): Promise<CanonicalHistoryDto> {
    const ids = userId
      ? (this.userSessions.get(userId) ?? [])
      : [...this.userSessions.values()].flat();
    const sessions = ids
      .map((id) => this.sessions.get(id))
      .filter(Boolean)
      .map((s) => {
        const attempts = this.sessions.listAttempts(s!.sessionId);
        const looks = this.sessions.listLooks(s!.sessionId);
        return buildHistoryEntry(s!, attempts, looks);
      });
    beautyTelemetry.track({
      name: 'beauty_history_listed',
      traceId: newTraceId('bhist'),
      props: { sessionCount: sessions.length },
    });
    const dto: CanonicalHistoryDto = { sessions };
    assertCanonicalDtoNoProviderFields(dto);
    return dto;
  }

  async addFavorite(
    sessionId: string,
    lookId: string,
  ): Promise<CanonicalFavoriteDto> {
    const fav = this.sessions.addFavorite(sessionId, lookId);
    beautyTelemetry.track({
      name: 'beauty_favorite_added',
      traceId: newTraceId('bfav'),
      sessionId,
      props: { lookId },
    });
    const dto: CanonicalFavoriteDto = { ...fav };
    assertCanonicalDtoNoProviderFields(dto);
    return dto;
  }

  async createCollection(
    sessionId: string,
    titleEn: string,
    titleAr: string,
    lookIds: string[],
  ): Promise<CanonicalCollectionDto> {
    const col = this.sessions.addCollection(
      sessionId,
      titleEn,
      titleAr,
      lookIds,
    );
    beautyTelemetry.track({
      name: 'beauty_collection_created',
      traceId: newTraceId('bcol'),
      sessionId,
      props: { lookCount: lookIds.length },
    });
    const dto: CanonicalCollectionDto = { ...col };
    assertCanonicalDtoNoProviderFields(dto);
    return dto;
  }

  async share(sessionId: string, lookId?: string): Promise<CanonicalShareDto> {
    const share = this.sessions.addShare(sessionId, lookId);
    beautyTelemetry.track({
      name: 'beauty_share_created',
      traceId: newTraceId('bshare'),
      sessionId,
      props: { lookId: lookId ?? null },
    });
    const dto: CanonicalShareDto = { ...share };
    assertCanonicalDtoNoProviderFields(dto);
    return dto;
  }

  getProviderManager(): ProviderManager {
    return this.providerManager;
  }

  getSessionStore(): BeautySessionStore {
    return this.sessions;
  }

  getPolicyEngine(): CapabilityPolicyEngine {
    return this.policyEngine;
  }

  getCapabilityEngine(): CapabilityEngine {
    return this.capabilityEngine;
  }

  private blockedResult(input: {
    request: BeautyExperienceExecuteRequest;
    lookId: string;
    capabilityId: string;
    capabilityVersion: string;
    traceId: string;
    status: Parameters<typeof runtimeExplainable>[0]['status'];
    stage: Parameters<typeof runtimeExplainable>[0]['stage'];
    reasonCode: string;
    reasonEn: string;
    reasonAr: string;
    policyRuleId?: string;
    providerId?: string;
  }): BeautyExperienceExecuteResult {
    const runtime = runtimeExplainable({
      status: input.status,
      stage: input.stage,
      reasonCode: input.reasonCode,
      reasonEn: input.reasonEn,
      reasonAr: input.reasonAr,
      capabilityId: input.capabilityId as never,
      capabilityVersion: input.capabilityVersion,
      policyRuleId: input.policyRuleId,
      providerId: input.providerId,
      traceId: input.traceId,
    });
    const publicRuntime = toPublicRuntime(runtime);
    const attempt = this.sessions.addAttempt({
      sessionId: input.request.sessionId,
      lookId: input.lookId,
      capabilityId: input.capabilityId as never,
      runtime,
      providerId: input.providerId,
    });
    beautyTelemetry.track({
      name: 'beauty_capability_blocked',
      traceId: input.traceId,
      sessionId: input.request.sessionId,
      capabilityId: input.capabilityId,
      runtimeStatus: runtime.status,
    });
    beautyTelemetry.track({
      name: 'beauty_attempt_recorded',
      traceId: input.traceId,
      sessionId: input.request.sessionId,
      capabilityId: input.capabilityId,
      runtimeStatus: runtime.status,
      props: { attemptId: attempt.attemptId, resultAssetUrl: null },
    });
    const tryOn: CanonicalTryOnDto = {
      attemptId: attempt.attemptId,
      sessionId: input.request.sessionId,
      lookId: input.lookId,
      capabilityId: input.capabilityId,
      resultAssetUrl: null,
      params: input.request.params ?? {},
      runtime: publicRuntime,
      generatedAt: attempt.createdAt,
    };
    assertCanonicalDtoNoProviderFields(tryOn);
    return {
      success: false,
      tryOn,
      session: this.toSessionDto(input.request.sessionId),
      runtime: publicRuntime,
      meta: buildResultMeta({
        source: 'unavailable',
        provider: 'beauty_experience_integration',
        confidence: 0,
        isMock: false,
        canDisplay: false,
        unavailableReason: runtime.reasonEn,
        isProduction: isProductionEnv(this.config.get<string>('NODE_ENV')),
        traceId: input.traceId,
        limitations: [
          'Phase 5B.1 — no live provider; no fabricated try-on images',
        ],
      }),
    };
  }

  private toSessionDto(sessionId: string): CanonicalSessionDto {
    const s = this.sessions.get(sessionId)!;
    const dto: CanonicalSessionDto = {
      sessionId: s.sessionId,
      state: s.state,
      version: s.version,
      analysisSources: {
        skinReportId: s.analysisSources.skinReportId,
        faceReportId: s.analysisSources.faceReportId,
        fashionReportId: s.analysisSources.fashionReportId,
      },
      attemptIds: s.attemptIds,
      lookIds: s.lookIds,
      runtime: toPublicRuntime(s.runtime),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
    assertCanonicalDtoNoProviderFields(dto);
    return dto;
  }
}
