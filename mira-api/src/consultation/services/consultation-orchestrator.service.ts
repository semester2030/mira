import { ConflictException, HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
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
import { MceLlmMessage, MceLlmService } from './mce-llm.service';
import { MceMemoryCompactionService } from './mce-memory-compaction.service';
import { MceModerationService } from './mce-moderation.service';
import { McePromptAssemblerService, MceResponseValidatorService } from './mce-prompt-assembler.service';
import { evaluateMceFashionQuarantine } from '../../fashion-knowledge/advisor-integration/mce-bypass';
import { isDirectCommercialQuestion, serverCommercialTurnReply } from './mce-commercial-guard';
import { ConsultationDialogueService } from './consultation-attachment.service';
import { answerCacheAllowed, consultationQuarantineApplies, readPinnedAttachmentIds } from './consultation-dialogue';
import { decideConsultationScope, guardScopeAnswer } from './consultation-scope';

@Injectable()
export class ConsultationOrchestratorService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService,
    @Inject(MceCostGuardService) private readonly costGuard: MceCostGuardService,
    @Inject(MceMemoryCompactionService) private readonly compaction: MceMemoryCompactionService,
    @Inject(ConsultationSessionService) private readonly sessions: ConsultationSessionService,
    @Inject(ConsultationMessageService) private readonly messages: ConsultationMessageService,
    @Inject(MceContextSnapshotService) private readonly snapshots: MceContextSnapshotService,
    @Inject(MceGroundingPipelineService) private readonly grounding: MceGroundingPipelineService,
    @Inject(MceIntentClassifierService) private readonly intentClassifier: MceIntentClassifierService,
    @Inject(MceModerationService) private readonly moderation: MceModerationService,
    @Inject(McePromptAssemblerService) private readonly promptAssembler: McePromptAssemblerService,
    @Inject(MceResponseValidatorService) private readonly validator: MceResponseValidatorService,
    @Inject(MceLlmService) private readonly llm: MceLlmService,
    @Inject(ConsultationDialogueService) private readonly dialogue?: ConsultationDialogueService,
  ) {}

  mceEnabled(): boolean {
    const flag = this.config.get('MCE_CONSULTATION_ENABLED', 'true');
    if (flag === false || flag === 0) return false;
    const text = String(flag ?? 'true').trim().toLowerCase();
    return text !== 'false' && text !== '0';
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
    await this.dialogue?.deleteSession(user.id, sessionId);

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
    this.assertSendEnabled();
    const opened = await this.openTurn(authUser, sessionId, dto);
    if (opened.turn) return opened.turn;
    let ctx: Awaited<ReturnType<ConsultationOrchestratorService['prepareTurn']>>;
    const attemptToken = opened.attemptToken;
    try {
      ctx = await this.prepareTurn(authUser, sessionId, dto, opened.userRow);
    } catch (error) {
      await this.failOwned(opened.userRow.id, attemptToken);
      throw error;
    }
    try {
      if (!(await this.leaseStillHeld(opened.userRow.id, attemptToken))) {
        throw new ConflictException({ code: 'MCE_TURN_LEASE_LOST', message: 'انتهت محاولة هذا الطلب بعد بدء محاولة أحدث.' });
      }
      const assistantPayload = await this.resolveAssistantPayload(ctx);
      return await this.finalizeTurn({ ...ctx, attemptToken }, assistantPayload);
    } catch (error) {
      const saved = await this.messages.assistantFor(opened.userRow.id);
      if (saved && await this.leaseStillHeld(opened.userRow.id, attemptToken)) {
        await this.completeOwned(opened.userRow.id, attemptToken);
        return this.turnFromSaved(ctx, saved);
      }
      if (saved && !(await this.leaseStillHeld(opened.userRow.id, attemptToken))) {
        return this.turnFromSaved(ctx, saved);
      }
      await this.failOwned(opened.userRow.id, attemptToken);
      throw error;
    }
  }

  async sendMessageStream(
    authUser: RequestUser,
    sessionId: string,
    dto: SendConsultationMessageDto,
    res: Response,
  ): Promise<void> {
    this.assertSendEnabled();
    const opened = await this.openTurn(authUser, sessionId, dto);
    if (opened.turn) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.flushHeaders?.();
      res.write(`event: done\ndata: ${JSON.stringify(opened.turn)}\n\n`);
      res.end();
      return;
    }
    const abort = new AbortController();
    if (typeof res.on === 'function') {
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });
    }
    let ctx: Awaited<ReturnType<ConsultationOrchestratorService['prepareTurn']>>;
    const attemptToken = opened.attemptToken;
    try {
      ctx = await this.prepareTurn(authUser, sessionId, dto, opened.userRow);
    } catch (error) {
      await this.failOwned(opened.userRow.id, attemptToken);
      throw error;
    }
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const write = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    write('user', { id: ctx.userRow.id, contentAr: ctx.userRow.contentAr });

    let assistantPayload: MceAssistantPayloadV1;
    try {
      const serverPriced = isDirectCommercialQuestion(ctx.userRow.contentAr);
      if (!(await this.leaseStillHeld(opened.userRow.id, attemptToken))) {
        throw new ConflictException({ code: 'MCE_TURN_LEASE_LOST', message: 'انتهت محاولة هذا الطلب بعد بدء محاولة أحدث.' });
      }
      if (!ctx.localReply && !ctx.mod.blocked && !ctx.cached && !serverPriced && (!this.llm.isConfigured() || !ctx.llmMessages)) {
        await this.failOwned(opened.userRow.id, attemptToken);
        write('error', {
          code: 'MCE_LLM_NOT_CONFIGURED',
          message: 'محرك الاستشارة غير متاح',
        });
        res.end();
        return;
      }
      const llmMessages = ctx.llmMessages;
      assistantPayload = await this.resolveAssistantPayload(
        { ...ctx, signal: abort.signal },
        ctx.localReply || ctx.cached || ctx.mod.blocked || !llmMessages
          ? undefined
          : () => this.llm.stream(llmMessages, { signal: abort.signal }),
      );
    } catch (error) {
      const body = error instanceof HttpException ? error.getResponse() : null;
      const coded = body && typeof body === 'object' ? (body as { code?: string; message?: string }) : null;
      await this.failOwned(opened.userRow.id, attemptToken);
      write('error', {
        code: coded?.code ?? 'MCE_LLM_FAILED',
        message: coded?.message ?? 'تعذر إكمال الرد',
      });
      res.end();
      return;
    }
    write('delta', { text: assistantPayload.answerAr });

    try {
      const turn = await this.finalizeTurn({ ...ctx, attemptToken }, assistantPayload);
      write('done', turn);
    } catch (error) {
      const saved = await this.messages.assistantFor(opened.userRow.id);
      if (saved) {
        await this.completeOwned(opened.userRow.id, attemptToken);
        write('done', await this.turnFromSaved(ctx, saved));
      } else {
        await this.failOwned(opened.userRow.id, attemptToken);
        write('error', { code: 'MCE_TURN_SAVE_FAILED', message: 'تعذر حفظ الرد' });
      }
    }
    res.end();
  }

  private async prepareTurn(
    authUser: RequestUser,
    sessionId: string,
    dto: SendConsultationMessageDto,
    userRow: { id: string; contentAr: string; role: string; blocked: boolean; createdAt: Date },
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
    const history = await this.messages.recentPairs(sessionId, 8);
    const priorHistory = history[history.length - 1]?.role === 'user' && history[history.length - 1]?.content === dto.message.trim()
      ? history.slice(0, -1)
      : history;
    const faqKey = this.costGuard.answerCacheKey({
      userId: user.id,
      sessionId,
      question: dto.message.trim(),
      snapshotId: loaded.id,
      snapshot: loaded.snapshot,
      factRegistry: loaded.factRegistry,
      history,
      rollingSummary: session.rollingSummaryAr,
    });
    const cacheImages = answerCacheAllowed(dto.attachmentIds?.length ?? 0);
    const cached = mod.blocked || !faqKey || !cacheImages ? null : await this.costGuard.getFaqCache(faqKey);

    let localReply: string | null = null;
    let imageDataUrls: string[] = [];
    let imageLabels: string[] = [];
    if (this.dialogue) {
      const resolved = await this.dialogue.prepare({
        userId: user.id,
        sessionId,
        message: dto.message.trim(),
        attachmentIds: dto.attachmentIds ?? [],
        pinnedIds: readPinnedAttachmentIds(session.metadataJson),
        history: priorHistory,
        model: this.llm.configuredModel(),
      });
      localReply = resolved.localReply;
      imageDataUrls = resolved.dataUrls;
      imageLabels = resolved.imageLabels;
      const previousPins = readPinnedAttachmentIds(session.metadataJson);
      if (resolved.pinIds.join(',') !== previousPins.join(',')) {
        const metadata = session.metadataJson && typeof session.metadataJson === 'object'
          ? session.metadataJson as Record<string, unknown>
          : {};
        await this.prisma.consultationSession.update({
          where: { id: session.id },
          data: { metadataJson: { ...metadata, pinnedAttachmentIds: resolved.pinIds } },
        });
      }
      if (dto.attachmentIds?.length) {
        await this.dialogue.bind(dto.attachmentIds, userRow.id, { userId: user.id, sessionId });
      }
    }

    if (!localReply && !mod.blocked) {
      const scope = decideConsultationScope(dto.message.trim(), priorHistory);
      if (!scope.allow) localReply = scope.replyAr;
    }

    let llmMessages: ReturnType<McePromptAssemblerService['buildMessages']> | undefined;
    let detectedIntent: MceConsultationIntent | undefined;

    if (!localReply && !mod.blocked && !cached && !isDirectCommercialQuestion(dto.message) && this.llm.isConfigured()) {
      detectedIntent = this.intentClassifier.classify(dto.message.trim(), loaded.snapshot);
      llmMessages = this.promptAssembler.buildMessages({
        snapshot: loaded.snapshot,
        factRegistry: loaded.factRegistry,
        rollingSummary: session.rollingSummaryAr,
        history,
        userMessage: dto.message.trim(),
        detectedIntent,
        intentHintAr: this.intentClassifier.intentHintAr(detectedIntent),
        imageDataUrls,
        imageLabels,
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
      faqKey: cacheImages ? faqKey : null,
      cached,
      llmMessages,
      detectedIntent,
      localReply,
    };
  }

  private async openTurn(
    authUser: RequestUser,
    sessionId: string,
    dto: SendConsultationMessageDto,
  ): Promise<
    | { turn: ConsultationTurnResponseDto; userRow?: undefined }
    | { turn?: undefined; userRow: { id: string; contentAr: string; role: string; blocked: boolean; createdAt: Date }; attemptToken: string | null }
  > {
    const user = await this.users.findOrCreateFromFirebase(authUser);
    await this.messages.recoverStuck(sessionId);
    const session = await this.sessions.getForUser(user.id, sessionId);
    if (dto.attachmentIds?.length && this.dialogue) {
      for (const attachmentId of dto.attachmentIds) {
        await this.dialogue.assertInSession(user.id, sessionId, attachmentId);
      }
    }
    const claim = await this.messages.claimUser({
      sessionId,
      contentAr: dto.message.trim(),
      attachmentIds: dto.attachmentIds,
      clientMessageId: dto.clientMessageId,
    });
    if (claim.status === 'complete') {
      return {
        turn: {
          userMessage: this.messages.toDto(claim.user),
          assistantMessage: this.messages.toDto(claim.assistant),
          session: this.sessions.toDto(session),
        },
      };
    }
    return { userRow: claim.user, attemptToken: claim.attemptToken ?? null };
  }

  private async failOwned(messageId: string, attemptToken: string | null): Promise<void> {
    if (!attemptToken) {
      await this.messages.markTurn(messageId, 'failed');
      return;
    }
    await this.messages.markOwned(messageId, attemptToken, 'failed');
  }

  private async completeOwned(messageId: string, attemptToken: string | null): Promise<void> {
    if (!attemptToken) {
      await this.messages.markTurn(messageId, 'complete');
      return;
    }
    await this.messages.markOwned(messageId, attemptToken, 'complete');
  }

  private async leaseStillHeld(messageId: string, attemptToken: string | null): Promise<boolean> {
    if (!attemptToken) return true;
    return this.messages.holdsLease(messageId, attemptToken);
  }

  async collectValidatedStream(
    chunks: AsyncIterable<string>,
    factRegistry: MceFactEntry[],
    userMessage?: string,
  ): Promise<MceAssistantPayloadV1> {
    let accumulated = '';
    for await (const chunk of chunks) accumulated += chunk;
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
    return this.validator.validate(parsed, factRegistry, userMessage);
  }

  private async resolveAssistantPayload(
    ctx: {
      mod: { blocked?: boolean; safeReply?: string };
      cached: MceAssistantPayloadV1 | null;
      llmMessages?: MceLlmMessage[];
      factRegistry: MceFactEntry[];
      faqKey: string | null;
      signal?: AbortSignal;
      userRow: { contentAr: string };
      localReply?: string | null;
    },
    streamFactory?: () => AsyncIterable<string>,
  ): Promise<MceAssistantPayloadV1> {
    if (ctx.localReply) {
      return guardScopeAnswer(this.validator.validate({
        answerAr: ctx.localReply,
        confidence: 'high',
        intent: 'general',
        citedFactIds: [],
        suggestedQuestionsAr: [],
        blocked: false,
        disclaimerAr: '',
      }, ctx.factRegistry, ctx.userRow.contentAr), ctx.userRow.contentAr);
    }
    if (ctx.mod.blocked && ctx.mod.safeReply) {
      return this.validator.blockedPayload(
        `${ctx.mod.safeReply}\n\n${this.moderation.disclaimer()}`,
      );
    }
    // FK-10: quarantine free-form fashion prescriptions when Advisor integration is on.
    const commercialAsk = isDirectCommercialQuestion(ctx.userRow.contentAr);
    const fashionQ = evaluateMceFashionQuarantine(ctx.userRow.contentAr, (k, d) => {
      const v = this.config.get<string>(k);
      return v ?? d;
    });
    if (!commercialAsk && fashionQ.quarantine && fashionQ.safeReplyAr && consultationQuarantineApplies(fashionQ.reasonCode)) {
      return this.validator.blockedPayload(
        `${fashionQ.safeReplyAr}\n\n${this.moderation.disclaimer()}`,
      );
    }
    if (isDirectCommercialQuestion(ctx.userRow.contentAr)) {
      return this.serverCommercialPayload(ctx.userRow.contentAr, ctx.factRegistry);
    }
    if (ctx.cached) {
      return guardScopeAnswer(
        this.validator.validate(ctx.cached, ctx.factRegistry, ctx.userRow.contentAr),
        ctx.userRow.contentAr,
      );
    }
    if (!this.llm.isConfigured() || !ctx.llmMessages) {
      throw new ServiceUnavailableException({
        code: 'MCE_LLM_NOT_CONFIGURED',
        message: 'محرك الاستشارة غير متاح حالياً',
      });
    }
    const payload = streamFactory
      ? await this.collectValidatedStream(streamFactory(), ctx.factRegistry, ctx.userRow.contentAr)
      : this.validator.validate(
          (await this.llm.complete(ctx.llmMessages, { signal: ctx.signal })).payload,
          ctx.factRegistry,
          ctx.userRow.contentAr,
        );
    const scoped = guardScopeAnswer(payload, ctx.userRow.contentAr);
    if (ctx.faqKey) await this.costGuard.setFaqCache(ctx.faqKey, scoped);
    return scoped;
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
      attemptToken?: string | null;
    },
    assistantPayload: MceAssistantPayloadV1,
  ): Promise<ConsultationTurnResponseDto> {
    const existing = await this.messages.assistantFor(ctx.userRow.id);
    if (existing) {
      await this.completeOwned(ctx.userRow.id, ctx.attemptToken ?? null);
      return this.turnFromSaved(ctx, existing);
    }
    if (!(await this.leaseStillHeld(ctx.userRow.id, ctx.attemptToken ?? null))) {
      throw new ConflictException({ code: 'MCE_TURN_LEASE_LOST', message: 'انتهت محاولة هذا الطلب بعد بدء محاولة أحدث.' });
    }

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
        replyToMessageId: ctx.userRow.id,
        attemptToken: ctx.attemptToken,
      },
    );
    await this.completeOwned(ctx.userRow.id, ctx.attemptToken ?? null);

    const newTurnCount = ctx.session.turnCount + 1;
    let rollingSummaryAr = ctx.session.rollingSummaryAr;
    try {
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
    } catch {
      // The assistant row is already the answer for this request.
    }

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

  private async turnFromSaved(
    ctx: {
      user: { id: string };
      session: { id: string };
      snapshot: MceContextSnapshotV1;
      factRegistry: MceFactEntry[];
      userRow: { id: string; contentAr: string; role: string; blocked: boolean; createdAt: Date };
    },
    assistantRow: { id: string; role: string; contentAr: string; payloadJson?: unknown; blocked: boolean; createdAt: Date },
  ): Promise<ConsultationTurnResponseDto> {
    const payload = (assistantRow.payloadJson ?? {}) as MceAssistantPayloadV1;
    const refreshed = await this.sessions.getForUser(ctx.user.id, ctx.session.id);
    return {
      userMessage: this.messages.toDto(ctx.userRow),
      assistantMessage: {
        ...this.messages.toDto(assistantRow),
        citedFacts: this.citedFacts(ctx.factRegistry, payload.citedFactIds ?? []),
        confidence: payload.confidence,
        intent: payload.intent,
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

  private serverCommercialPayload(message: string, facts: MceFactEntry[]): MceAssistantPayloadV1 {
    return this.validator.validate(
      {
        answerAr: serverCommercialTurnReply(facts, message),
        confidence: 'high',
        intent: 'product',
        citedFactIds: [],
        suggestedQuestionsAr: [],
        blocked: false,
        disclaimerAr: '',
      },
      facts,
      message,
    );
  }

  private assertSendEnabled(): void {
    if (!this.mceEnabled()) {
      throw new ServiceUnavailableException({
        code: 'MCE_DISABLED',
        message: 'محرك الاستشارة MCE غير مفعّل على السيرفر',
      });
    }
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

    if (isDirectCommercialQuestion(message)) {
      const payload = this.serverCommercialPayload(message.trim(), grounding.factRegistry);
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
    const payload = this.validator.validate(llmResult.payload, grounding.factRegistry, message.trim());

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

