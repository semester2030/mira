import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { RateLimitService } from '../../common/services/rate-limit.service';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvisorChatResponse } from '../../advisor/contracts/advisor-response.interface';
import { CreateConsultationSessionDto } from '../dto/create-session.dto';
import {
  ConsultationSessionResponseDto,
  ConsultationTurnResponseDto,
} from '../dto/consultation-response.dto';
import {
  MceAssistantPayloadV1,
  MceContextSnapshotV1,
  MceFactEntry,
} from '../contracts/mce-context-snapshot.v1';
import { SendConsultationMessageDto } from '../dto/send-message.dto';
import { UpdateConsultationContextDto } from '../dto/update-session-context.dto';
import { ConsultationMessageService } from './consultation-message.service';
import { ConsultationSessionService, pickSuggestedStarters } from './consultation-session.service';
import { MceContextSnapshotService } from './mce-context-snapshot.service';
import { MceCostGuardService } from './mce-cost-guard.service';
import { MceGroundingPipelineService } from './mce-grounding-pipeline.service';
import { MceIntentClassifierService, MceConsultationIntent } from './mce-intent-classifier.service';
import { MceLlmService } from './mce-llm.service';
import { MceMemoryCompactionService } from './mce-memory-compaction.service';
import { MceModerationService } from './mce-moderation.service';
import { McePromptAssemblerService, MceResponseValidatorService } from './mce-prompt-assembler.service';
import { evaluateMceFashionQuarantine } from '../../fashion-knowledge/advisor-integration/mce-bypass';

@Injectable()
export class ConsultationOrchestratorService {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
    private readonly costGuard: MceCostGuardService,
    private readonly compaction: MceMemoryCompactionService,
    private readonly sessions: ConsultationSessionService,
    private readonly messages: ConsultationMessageService,
    private readonly snapshots: MceContextSnapshotService,
    private readonly grounding: MceGroundingPipelineService,
    private readonly intentClassifier: MceIntentClassifierService,
    private readonly moderation: MceModerationService,
    private readonly promptAssembler: McePromptAssemblerService,
    private readonly validator: MceResponseValidatorService,
    private readonly llm: MceLlmService,
  ) {}

  mceEnabled(): boolean {
    const flag = this.config.get<string>('MCE_CONSULTATION_ENABLED', 'true');
    return flag !== 'false' && flag !== '0';
  }

  async createSession(
    authUser: RequestUser,
    dto: CreateConsultationSessionDto,
  ): Promise<ConsultationSessionResponseDto> {
    const user = await this.users.findOrCreateFromFirebase(authUser);
    const prefs = await this.users.getPreferences(user.id);
    const sub = await this.prisma.subscription.findUnique({ where: { userId: user.id } });
    const planTier = sub?.plan ?? 'free';

    return this.sessions.create(user.id, dto, planTier, prefs?.birthYear ?? null);
  }

  async bindContext(
    authUser: RequestUser,
    sessionId: string,
    dto: UpdateConsultationContextDto,
  ): Promise<ConsultationSessionResponseDto> {
    const user = await this.users.findOrCreateFromFirebase(authUser);
    const prefs = await this.users.getPreferences(user.id);
    const sub = await this.prisma.subscription.findUnique({ where: { userId: user.id } });
    const planTier = sub?.plan ?? 'free';

    return this.sessions.bindContext(
      user.id,
      sessionId,
      dto,
      planTier,
      prefs?.birthYear ?? null,
    );
  }

  async deleteSession(authUser: RequestUser, sessionId: string): Promise<{ deleted: boolean }> {
    const user = await this.users.findOrCreateFromFirebase(authUser);
    await this.sessions.getForUser(user.id, sessionId);

    await this.prisma.consultationSession.update({
      where: { id: sessionId },
      data: { status: 'deleted', updatedAt: new Date() },
    });

    await this.users.writeAuditLog({
      userId: user.id,
      action: 'consultation.deleted',
      metadata: { sessionId, gdpr: true },
    });

    return { deleted: true };
  }

  async sendMessage(
    authUser: RequestUser,
    sessionId: string,
    dto: SendConsultationMessageDto,
  ): Promise<ConsultationTurnResponseDto> {
    const ctx = await this.prepareTurn(authUser, sessionId, dto);
    const assistantPayload = await this.resolveAssistantPayload(ctx);
    return this.finalizeTurn(ctx, assistantPayload);
  }

  async sendMessageStream(
    authUser: RequestUser,
    sessionId: string,
    dto: SendConsultationMessageDto,
    res: Response,
  ): Promise<void> {
    const ctx = await this.prepareTurn(authUser, sessionId, dto);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const write = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    write('user', { id: ctx.userRow.id, contentAr: ctx.userRow.contentAr });

    let assistantPayload: MceAssistantPayloadV1;
    if (ctx.mod.blocked && ctx.mod.safeReply) {
      assistantPayload = this.validator.blockedPayload(
        `${ctx.mod.safeReply}\n\n${this.moderation.disclaimer()}`,
      );
      write('delta', { text: assistantPayload.answerAr });
    } else {
      const fashionQ = evaluateMceFashionQuarantine(
        ctx.userRow.contentAr,
        (k, d) => {
          const v = this.config.get<string>(k);
          return v ?? d;
        },
      );
      if (fashionQ.quarantine && fashionQ.safeReplyAr) {
        assistantPayload = this.validator.blockedPayload(
          `${fashionQ.safeReplyAr}\n\n${this.moderation.disclaimer()}`,
        );
        write('delta', { text: assistantPayload.answerAr });
      } else if (!this.llm.isConfigured()) {
        write('error', {
          code: 'MCE_LLM_NOT_CONFIGURED',
          message: 'محرك الاستشارة غير متاح',
        });
        res.end();
        return;
      } else {
        let accumulated = '';
        for await (const chunk of this.llm.stream(ctx.llmMessages!)) {
          accumulated += chunk;
          const preview = extractPartialAnswerAr(accumulated);
          if (preview) write('delta', { text: preview });
        }

        let parsed: MceAssistantPayloadV1;
        try {
          parsed = JSON.parse(accumulated) as MceAssistantPayloadV1;
        } catch {
          parsed = {
            answerAr: accumulated,
            confidence: 'low',
            intent: 'parse_fallback',
            citedFactIds: [],
            suggestedQuestionsAr: [],
            blocked: false,
            disclaimerAr: '',
          };
        }
        assistantPayload = this.validator.validate(parsed, ctx.factRegistry);
      }
    }

    const turn = await this.finalizeTurn(ctx, assistantPayload);
    write('done', turn);
    res.end();
  }

  private async prepareTurn(
    authUser: RequestUser,
    sessionId: string,
    dto: SendConsultationMessageDto,
  ) {
    const started = Date.now();
    const user = await this.users.findOrCreateFromFirebase(authUser);
    const sub = await this.prisma.subscription.findUnique({ where: { userId: user.id } });
    const planTier = sub?.plan ?? 'free';

    await this.rateLimit.assertWithinLimit(user.id, 'consultation-message');
    await this.costGuard.assertDailyQuota(user.id, planTier);

    const session = await this.sessions.getForUser(user.id, sessionId);
    const loaded = await this.snapshots.loadForSession(
      sessionId,
      dto.contextSnapshotId ?? session.activeSnapshotId ?? undefined,
    );

    const mod = this.moderation.preCheck(dto.message, loaded.snapshot.user.isMinor);
    const userRow = await this.messages.persistUser(sessionId, dto.message.trim());

    const faqKey = this.costGuard.faqCacheKey(dto.message, loaded.id);
    const cached = mod.blocked ? null : await this.costGuard.getFaqCache(faqKey);

    let llmMessages: ReturnType<McePromptAssemblerService['buildMessages']> | undefined;
    let detectedIntent: MceConsultationIntent | undefined;

    if (!mod.blocked && !cached && this.llm.isConfigured()) {
      const history = await this.messages.recentPairs(sessionId, 8);
      detectedIntent = this.intentClassifier.classify(dto.message.trim(), loaded.snapshot);
      llmMessages = this.promptAssembler.buildMessages({
        snapshot: loaded.snapshot,
        factRegistry: loaded.factRegistry,
        rollingSummary: session.rollingSummaryAr,
        history,
        userMessage: dto.message.trim(),
        detectedIntent,
        intentHintAr: this.intentClassifier.intentHintAr(detectedIntent),
      });
    }

    return {
      started,
      user,
      planTier,
      session,
      snapshot: loaded.snapshot,
      factRegistry: loaded.factRegistry,
      snapshotId: loaded.id,
      mod,
      userRow,
      faqKey,
      cached,
      llmMessages,
      detectedIntent,
    };
  }

  private async resolveAssistantPayload(ctx: {
    mod: { blocked?: boolean; safeReply?: string };
    cached: MceAssistantPayloadV1 | null;
    llmMessages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    factRegistry: MceFactEntry[];
    faqKey: string;
    userRow: { contentAr: string };
  }): Promise<MceAssistantPayloadV1> {
    if (ctx.mod.blocked && ctx.mod.safeReply) {
      return this.validator.blockedPayload(
        `${ctx.mod.safeReply}\n\n${this.moderation.disclaimer()}`,
      );
    }
    // FK-10: quarantine free-form fashion prescriptions when Advisor integration is on.
    const fashionQ = evaluateMceFashionQuarantine(ctx.userRow.contentAr, (k, d) => {
      const v = this.config.get<string>(k);
      return v ?? d;
    });
    if (fashionQ.quarantine && fashionQ.safeReplyAr) {
      return this.validator.blockedPayload(
        `${fashionQ.safeReplyAr}\n\n${this.moderation.disclaimer()}`,
      );
    }
    if (ctx.cached) {
      return this.validator.validate(ctx.cached, ctx.factRegistry);
    }
    if (!this.llm.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'MCE_LLM_NOT_CONFIGURED',
        message: 'محرك الاستشارة غير متاح حالياً',
      });
    }
    const llmResult = await this.llm.complete(ctx.llmMessages!);
    const payload = this.validator.validate(llmResult.payload, ctx.factRegistry);
    await this.costGuard.setFaqCache(ctx.faqKey, payload);
    return payload;
  }

  private async finalizeTurn(
    ctx: {
      started: number;
      user: { id: string };
      session: { id: string; turnCount: number; rollingSummaryAr: string | null };
      snapshot: MceContextSnapshotV1;
      factRegistry: MceFactEntry[];
      snapshotId: string;
      userRow: { id: string; contentAr: string; role: string; blocked: boolean; createdAt: Date };
      detectedIntent?: MceConsultationIntent;
    },
    assistantPayload: MceAssistantPayloadV1,
  ): Promise<ConsultationTurnResponseDto> {
    const answerText = assistantPayload.blocked
      ? assistantPayload.answerAr
      : `${assistantPayload.answerAr}\n\n${assistantPayload.disclaimerAr}`;

    const assistantRow = await this.messages.persistAssistant(
      ctx.session.id,
      answerText,
      assistantPayload,
      {
        modelId: this.llm.isConfigured() ? undefined : 'rule-fallback',
        latencyMs: Date.now() - ctx.started,
        blocked: assistantPayload.blocked,
      },
    );

    const newTurnCount = ctx.session.turnCount + 1;
    let rollingSummaryAr = ctx.session.rollingSummaryAr;
    if (this.compaction.shouldCompact(newTurnCount)) {
      rollingSummaryAr = await this.compaction.compact(ctx.session.id, rollingSummaryAr);
    }

    await this.prisma.consultationSession.update({
      where: { id: ctx.session.id },
      data: {
        turnCount: { increment: 1 },
        rollingSummaryAr,
        updatedAt: new Date(),
      },
    });

    await this.users.writeAuditLog({
      userId: ctx.user.id,
      action: 'consultation.message',
      metadata: {
        sessionId: ctx.session.id,
        snapshotId: ctx.snapshotId,
        intent: assistantPayload.intent,
        blocked: assistantPayload.blocked,
      },
    });

    const refreshed = await this.sessions.getForUser(ctx.user.id, ctx.session.id);
    const citedFacts = this.citedFacts(ctx.factRegistry, assistantPayload.citedFactIds);

    return {
      userMessage: this.messages.toDto(ctx.userRow),
      assistantMessage: {
        ...this.messages.toDto(assistantRow),
        citedFacts,
        confidence: assistantPayload.confidence,
        intent: assistantPayload.intent,
      },
      session: this.sessions.toDto(refreshed, ctx.snapshot),
    };
  }

  citedFacts(
    registry: MceFactEntry[],
    ids: string[],
  ): Array<{ id: string; labelAr: string; valueAr: string }> {
    const map = new Map(registry.map((f) => [f.id, f]));
    return ids
      .map((id) => map.get(id))
      .filter((f): f is MceFactEntry => Boolean(f))
      .map((f) => ({ id: f.id, labelAr: f.labelAr, valueAr: f.valueAr }));
  }

  /** Advisor bridge — MCE + LLM only (no template fallback). */
  async advisorBridge(
    authUser: RequestUser,
    message: string,
    analysisId?: string,
  ): Promise<AdvisorChatResponse> {
    if (!this.mceEnabled()) {
      throw new ServiceUnavailableException({
        code: 'MCE_DISABLED',
        message: 'محرك الاستشارة MCE غير مفعّل على السيرفر',
      });
    }
    if (!this.llm.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'MCE_LLM_NOT_CONFIGURED',
        message: 'LLM_API_KEY غير مضبوط — المستشار الذكي غير متاح',
      });
    }

    const user = await this.users.findOrCreateFromFirebase(authUser);
    const prefs = await this.users.getPreferences(user.id);
    const sub = await this.prisma.subscription.findUnique({ where: { userId: user.id } });
    const grounding = await this.grounding.build({
      userId: user.id,
      skinAnalysisId: analysisId,
      locale: 'ar',
      birthYear: prefs?.birthYear ?? null,
      subscriptionPlan: sub?.plan ?? 'free',
    });

    const mod = this.moderation.preCheck(message, grounding.snapshot.user.isMinor);
    if (mod.blocked && mod.safeReply) {
      const payload = this.validator.blockedPayload(
        `${mod.safeReply}\n\n${this.moderation.disclaimer()}`,
      );
      return this.toAdvisorResponse(payload, grounding.snapshot);
    }

    const llmMessages = this.promptAssembler.buildMessages({
      snapshot: grounding.snapshot,
      factRegistry: grounding.factRegistry,
      rollingSummary: null,
      history: [],
      userMessage: message.trim(),
    });
    const llmResult = await this.llm.complete(llmMessages);
    const payload = this.validator.validate(llmResult.payload, grounding.factRegistry);

    await this.users.writeAuditLog({
      userId: user.id,
      action: 'consultation.advisor_bridge',
      metadata: { analysisId, intent: payload.intent, blocked: payload.blocked },
    });

    return this.toAdvisorResponse(payload, grounding.snapshot);
  }

  private toAdvisorResponse(
    payload: MceAssistantPayloadV1,
    snapshot: MceContextSnapshotV1,
  ): AdvisorChatResponse {
    const starters = pickSuggestedStarters(snapshot);
    return {
      answer: payload.blocked
        ? payload.answerAr
        : `${payload.answerAr}\n\n${payload.disclaimerAr}`,
      suggestedQuestions:
        payload.suggestedQuestionsAr.length > 0 ? payload.suggestedQuestionsAr : starters,
      confidence: payload.confidence,
      intent: payload.intent,
      blocked: payload.blocked,
      disclaimerAr: payload.disclaimerAr,
    };
  }
}

function extractPartialAnswerAr(accumulated: string): string {
  const marker = '"answerAr"';
  const idx = accumulated.indexOf(marker);
  if (idx < 0) return '';
  const after = accumulated.slice(idx + marker.length);
  const colon = after.indexOf(':');
  if (colon < 0) return '';
  const rest = after.slice(colon + 1).trimStart();
  if (!rest.startsWith('"')) return '';
  let out = '';
  let escaped = false;
  for (let i = 1; i < rest.length; i++) {
    const ch = rest[i];
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }
  return out;
}
