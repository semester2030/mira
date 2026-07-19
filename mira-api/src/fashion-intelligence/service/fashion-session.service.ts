import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { newTraceId } from '../../ports/shared/result-meta';
import {
  FASHION_SESSION_VERSION,
  FASHION_WARDROBE_SCHEMA_VERSION,
} from '../release';
import {
  CanonicalFashionSession,
  FashionAttempt,
  FashionHistoryEvent,
  FashionProgressSkeleton,
  FashionSessionSource,
  FashionSessionState,
} from '../models/canonical-fashion-session';
import {
  assertNoFashionProviderLeakage,
  fashionRuntime,
  toPublicFashionRuntime,
} from '../runtime/fashion-runtime-state';
import { resolveFashionFeatureFlags } from '../feature-flags';
import { InMemoryFashionSessionRepository } from '../repository/in-memory.repository';
import { InMemoryWardrobeRepository } from '../repository/in-memory.repository';
import {
  assertValidSession,
  validateRuntimeTransition,
} from '../validation/fashion-validators';
import { fashionAuditLog, fashionTelemetry } from '../telemetry/fashion-telemetry';
import {
  getFashionCapability,
  listPublicFashionCapabilities,
} from '../capability/fashion-capability-catalog';

function emptyProgress(): FashionProgressSkeleton {
  return {
    goals: [
      {
        goalId: 'fill_wardrobe',
        labelEn: 'Add first wardrobe items',
        labelAr: 'أضيفي أولى قطع الخزانة',
        done: false,
      },
    ],
    completionRatio: 0,
    milestones: [],
  };
}

@Injectable()
export class FashionSessionService {
  constructor(
    private readonly sessions: InMemoryFashionSessionRepository,
    private readonly wardrobes: InMemoryWardrobeRepository,
    private readonly config: ConfigService,
  ) {}

  private flags() {
    return resolveFashionFeatureFlags((k, d) => this.config.get(k, d));
  }

  private ensureEnabled(): void {
    if (!this.flags().fashionSessionEnabled) {
      throw new Error('Fashion session disabled (FASHION_SESSION_ENABLED)');
    }
  }

  async createSession(input?: {
    userId?: string;
    source?: FashionSessionSource;
    wardrobeId?: string;
  }): Promise<CanonicalFashionSession> {
    this.ensureEnabled();
    const now = new Date().toISOString();
    const sessionId = newTraceId('fsess');
    const session: CanonicalFashionSession = {
      sessionId,
      userId: input?.userId,
      version: FASHION_SESSION_VERSION,
      state: 'created',
      source: input?.source ?? 'system',
      trust: { level: 'unknown', reasons: [] },
      analysisSources: {},
      garmentIds: [],
      outfitIds: [],
      wardrobeId: input?.wardrobeId,
      lookIds: [],
      favoriteIds: [],
      collectionIds: [],
      styleIds: [],
      recommendationIds: [],
      attemptIds: [],
      history: [
        {
          eventId: newTraceId('fhist'),
          type: 'session_created',
          at: now,
          refs: [sessionId],
          runtimeStatus: 'AVAILABLE',
        },
      ],
      progress: emptyProgress(),
      runtime: fashionRuntime({
        status: 'AVAILABLE',
        stage: 'session_persist',
        reasonCode: 'session_created',
        reasonEn: 'Fashion session created — Mira-owned.',
        reasonAr: 'تم إنشاء جلسة الموضة — ملك ميرا.',
        capabilityId: 'history',
        capabilityVersion: FASHION_SESSION_VERSION,
        traceId: newTraceId('fs'),
      }),
      createdAt: now,
      updatedAt: now,
    };

    if (input?.wardrobeId) {
      const w = await this.wardrobes.findById(input.wardrobeId);
      if (!w) throw new Error(`Wardrobe not found: ${input.wardrobeId}`);
      session.state = 'enriched';
      session.trust = { level: 'partial', reasons: ['wardrobe_bound'] };
    }

    assertValidSession(session);
    const saved = await this.sessions.save(session);
    fashionTelemetry.track({
      name: 'fashion_session_created',
      traceId: saved.runtime.traceId ?? sessionId,
      sessionId,
      wardrobeId: saved.wardrobeId,
    });
    fashionAuditLog.append({
      action: 'session_created',
      sessionId,
      wardrobeId: saved.wardrobeId,
      detail: { source: saved.source },
    });
    return this.toPublic(saved);
  }

  async getSession(sessionId: string): Promise<CanonicalFashionSession> {
    this.ensureEnabled();
    const s = await this.sessions.findById(sessionId);
    if (!s) throw new Error(`Session not found: ${sessionId}`);
    return this.toPublic(s);
  }

  async bindWardrobe(
    sessionId: string,
    wardrobeId: string,
  ): Promise<CanonicalFashionSession> {
    this.ensureEnabled();
    const s = await this.require(sessionId);
    const w = await this.wardrobes.findById(wardrobeId);
    if (!w) throw new Error(`Wardrobe not found: ${wardrobeId}`);
    s.wardrobeId = wardrobeId;
    s.state = s.state === 'created' ? 'enriched' : s.state;
    s.lookIds = [...new Set([...s.lookIds, ...w.looks.map((l) => l.lookId)])];
    s.favoriteIds = [
      ...new Set([...s.favoriteIds, ...w.favorites.map((f) => f.favoriteId)]),
    ];
    s.collectionIds = [
      ...new Set([
        ...s.collectionIds,
        ...w.collections.map((c) => c.collectionId),
      ]),
    ];
    s.garmentIds = [
      ...new Set([
        ...s.garmentIds,
        ...w.items.filter((i) => i.status === 'active').map((i) => i.garmentId),
      ]),
    ];
    this.appendHistory(s, 'wardrobe_bound', [wardrobeId]);
    s.trust = {
      level: 'partial',
      reasons: ['wardrobe_bound'],
    };
    s.updatedAt = new Date().toISOString();
    assertValidSession(s);
    const saved = await this.sessions.save(s);
    fashionTelemetry.track({
      name: 'fashion_session_bound_wardrobe',
      traceId: newTraceId('fs'),
      sessionId,
      wardrobeId,
    });
    return this.toPublic(saved);
  }

  async setState(
    sessionId: string,
    state: FashionSessionState,
  ): Promise<CanonicalFashionSession> {
    this.ensureEnabled();
    const s = await this.require(sessionId);
    s.state = state;
    if (state === 'closed') {
      s.closedAt = new Date().toISOString();
    }
    s.updatedAt = new Date().toISOString();
    this.appendHistory(s, `state_${state}`, [sessionId]);
    assertValidSession(s);
    return this.toPublic(await this.sessions.save(s));
  }

  async recordAttempt(
    sessionId: string,
    input: {
      capabilityId: string;
      lookId?: string;
      resultRefs?: string[];
      providerId?: string;
    },
  ): Promise<{ session: CanonicalFashionSession; attempt: FashionAttempt }> {
    this.ensureEnabled();
    const s = await this.require(sessionId);
    const cap = getFashionCapability(input.capabilityId);
    const miraOk =
      !!cap &&
      cap.executionEnabled &&
      cap.providerRequirements === 'none';

    const runtime = fashionRuntime({
      status: miraOk ? 'AVAILABLE' : 'BLOCKED',
      stage: miraOk ? 'terminal' : 'policy',
      reasonCode: miraOk
        ? 'mira_capability_ok'
        : 'capability_not_executable_6b',
      reasonEn: miraOk
        ? 'Mira-owned capability recorded.'
        : 'Capability registered but not executable in Wardrobe Foundation (6B).',
      reasonAr: miraOk
        ? 'تم تسجيل قدرة ميرا.'
        : 'القدرة مسجّلة وغير قابلة للتنفيذ في أساس الخزانة (6B).',
      capabilityId: input.capabilityId,
      capabilityVersion: FASHION_WARDROBE_SCHEMA_VERSION,
      policyRuleId: miraOk ? undefined : 'foundation_gate',
      traceId: newTraceId('fs'),
      providerId: input.providerId,
    });

    const prev = s.runtime;
    const transition = validateRuntimeTransition(prev, runtime);
    if (!transition.valid && prev.status !== runtime.status) {
      // Allow first transition from AVAILABLE session runtime to BLOCKED attempt
      if (
        !(
          prev.status === 'AVAILABLE' &&
          (runtime.status === 'BLOCKED' || runtime.status === 'AVAILABLE')
        )
      ) {
        throw new Error(
          `Invalid runtime transition: ${transition.issues.map((i) => i.code).join(',')}`,
        );
      }
    }

    const attempt: FashionAttempt = {
      attemptId: newTraceId('fattempt'),
      sessionId,
      capabilityId: input.capabilityId,
      lookId: input.lookId,
      runtime,
      resultRefs: input.resultRefs ?? [],
      providerId: input.providerId,
      createdAt: new Date().toISOString(),
    };
    s.attemptIds.push(attempt.attemptId);
    s.runtime = toPublicFashionRuntime(runtime);
    this.appendHistory(s, 'attempt_recorded', [attempt.attemptId], runtime.status);
    s.updatedAt = attempt.createdAt;
    assertValidSession(s);
    const saved = await this.sessions.save(s);

    fashionTelemetry.track({
      name: miraOk ? 'fashion_attempt_recorded' : 'fashion_capability_blocked',
      traceId: runtime.traceId ?? attempt.attemptId,
      sessionId,
      capabilityId: input.capabilityId,
      runtimeStatus: runtime.status,
      props: { attemptId: attempt.attemptId },
    });

    const publicAttempt: FashionAttempt = {
      ...attempt,
      runtime: toPublicFashionRuntime(attempt.runtime),
      providerId: undefined,
    };
    assertNoFashionProviderLeakage(publicAttempt);
    return { session: this.toPublic(saved), attempt: publicAttempt };
  }

  async updateProgress(
    sessionId: string,
    patch: Partial<FashionProgressSkeleton>,
  ): Promise<CanonicalFashionSession> {
    this.ensureEnabled();
    const s = await this.require(sessionId);
    s.progress = {
      goals: patch.goals ?? s.progress.goals,
      completionRatio: patch.completionRatio ?? s.progress.completionRatio,
      milestones: patch.milestones ?? s.progress.milestones,
    };
    if (s.wardrobeId) {
      const w = await this.wardrobes.findById(s.wardrobeId);
      const hasItems = (w?.items.filter((i) => i.status === 'active').length ?? 0) > 0;
      s.progress.goals = s.progress.goals.map((g) =>
        g.goalId === 'fill_wardrobe' ? { ...g, done: hasItems } : g,
      );
      s.progress.completionRatio = hasItems ? 0.25 : 0;
    }
    s.updatedAt = new Date().toISOString();
    this.appendHistory(s, 'progress_updated', [sessionId]);
    assertValidSession(s);
    return this.toPublic(await this.sessions.save(s));
  }

  async history(userId?: string): Promise<{
    sessions: Array<{
      sessionId: string;
      state: string;
      wardrobeId?: string;
      history: FashionHistoryEvent[];
      progress: FashionProgressSkeleton;
      createdAt: string;
      updatedAt: string;
    }>;
  }> {
    this.ensureEnabled();
    const list = userId
      ? await this.sessions.findByUserId(userId)
      : [];
    fashionTelemetry.track({
      name: 'fashion_session_history_appended',
      traceId: newTraceId('fs'),
      props: { sessionCount: list.length },
    });
    return {
      sessions: list.map((s) => ({
        sessionId: s.sessionId,
        state: s.state,
        wardrobeId: s.wardrobeId,
        history: s.history.map((h) => ({ ...h, refs: [...h.refs] })),
        progress: {
          ...s.progress,
          goals: s.progress.goals.map((g) => ({ ...g })),
          milestones: [...s.progress.milestones],
        },
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    };
  }

  listCapabilities() {
    return listPublicFashionCapabilities().map((c) => ({
      ...c,
      // Never expose provider execution path
      providerExecution: false as const,
    }));
  }

  private appendHistory(
    s: CanonicalFashionSession,
    type: string,
    refs: string[],
    runtimeStatus?: string,
  ): void {
    const event: FashionHistoryEvent = {
      eventId: newTraceId('fhist'),
      type,
      at: new Date().toISOString(),
      refs: [...refs],
      runtimeStatus,
    };
    s.history.push(event);
  }

  private async require(sessionId: string): Promise<CanonicalFashionSession> {
    const s = await this.sessions.findById(sessionId);
    if (!s) throw new Error(`Session not found: ${sessionId}`);
    return s;
  }

  private toPublic(s: CanonicalFashionSession): CanonicalFashionSession {
    const dto: CanonicalFashionSession = {
      ...s,
      trust: { ...s.trust, reasons: [...s.trust.reasons] },
      analysisSources: { ...s.analysisSources },
      garmentIds: [...s.garmentIds],
      outfitIds: [...s.outfitIds],
      lookIds: [...s.lookIds],
      favoriteIds: [...s.favoriteIds],
      collectionIds: [...s.collectionIds],
      styleIds: [...s.styleIds],
      recommendationIds: [...s.recommendationIds],
      attemptIds: [...s.attemptIds],
      history: s.history.map((h) => ({ ...h, refs: [...h.refs] })),
      progress: {
        goals: s.progress.goals.map((g) => ({ ...g })),
        completionRatio: s.progress.completionRatio,
        milestones: [...s.progress.milestones],
      },
      runtime: toPublicFashionRuntime(s.runtime),
    };
    assertNoFashionProviderLeakage(dto);
    return dto;
  }
}
