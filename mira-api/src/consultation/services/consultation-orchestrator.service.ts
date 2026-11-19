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
import {
  buildDegradedAdvisorReply,
  isAlternativesOrCompareAsk,
  isAlternativesPriceOrCompareAsk,
  isOpenOfferLiveAsk,
  buildAlternativesConsultationTurn,
  marketplaceOfferLiveAskReply,
  decideConsultationScope,
  guardScopeAnswer,
  historyForBeautyTurn,
  isProductOrCatalogAsk,
  type PublishedCatalogOffer,
} from './consultation-scope';
import {
  ConsultantDiscoveryService,
  type ConsultantOfferCard,
  type ConsultantTurnResult,
} from '../../consultant-discovery/consultant-discovery.service';
import type { SessionDiscoveryContext } from '../../consultant-discovery/intent';
import {
  extractAttachmentCatalogCues,
  type AttachmentCatalogCues,
} from '../../consultant-discovery/attachment-catalog-cues';

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
    @Inject(ConsultantDiscoveryService) private readonly discovery: ConsultantDiscoveryService,
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

  async recordTranscriptTurn(
    authUser: RequestUser,
    sessionId: string,
    dto: { userContentAr: string; assistantContentAr: string; clientMessageId: string },
  ) {
    const user = await this.users.findOrCreateFromFirebase(authUser);
    await this.sessions.getForUser(user.id, sessionId);
    const saved = await this.messages.recordTranscriptTurn({
      sessionId,
      userContentAr: dto.userContentAr,
      assistantContentAr: dto.assistantContentAr,
      clientMessageId: dto.clientMessageId,
    });
    return {
      userMessage: this.messages.toDto(saved.user),
      assistantMessage: this.messages.toDto(saved.assistant),
      created: saved.created,
    };
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
      // Only skip rate/quota when this turn already reserved them on a prior attempt.
      // A 429 rejection must NOT gain a free retry merely because claimStatus=resume.
      ctx = await this.prepareTurn(authUser, sessionId, dto, opened.userRow, {
        skipRateLimit: opened.quotaReserved === true,
      });
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
      ctx = await this.prepareTurn(authUser, sessionId, dto, opened.userRow, {
        skipRateLimit: opened.quotaReserved === true,
      });
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
        await this.failOwned(opened.userRow.id, attemptToken, {
          code: 'MCE_LLM_NOT_CONFIGURED',
          message: 'محرك الاستشارة غير متاح حالياً. أعيدي المحاولة بعد قليل.',
        });
        write('error', {
          code: 'MCE_LLM_NOT_CONFIGURED',
          message: 'محرك الاستشارة غير متاح حالياً. أعيدي المحاولة بعد قليل.',
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
      const code = coded?.code ?? 'MCE_LLM_FAILED';
      const message = coded?.message ?? 'تعذر إكمال الرد. أعيدي المحاولة بنفس الطلب.';
      await this.failOwned(opened.userRow.id, attemptToken, { code, message });
      write('error', { code, message });
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
    opts: { skipRateLimit?: boolean } = {},
  ) {
    const started = Date.now();
    const user = await this.users.findOrCreateFromFirebase(authUser);
    const sub = await this.prisma.subscription.findUnique({ where: { userId: user.id } });
    const planTier = sub?.plan ?? 'free';

    if (!opts.skipRateLimit) {
      await this.rateLimit.assertWithinLimit(user.id, 'consultation-message');
      await this.costGuard.assertDailyQuota(user.id, planTier);
      await this.messages.markQuotaReserved(userRow.id);
    } else {
      // Quota already reserved for this clientMessageId — do not double-count.
      // Daily guard stays fail_closed only when we cannot verify at all (new turns).
    }

    const session = await this.sessions.getForUser(user.id, sessionId);
    const loaded = await this.snapshots.loadForSession(
      sessionId,
      dto.contextSnapshotId ?? session.activeSnapshotId ?? undefined,
    );
    // Re-read open marketplace offer every turn. On withdraw/error, strip stale offer facts.
    const offerState = await this.sessions.refreshMarketplaceOfferState(session);
    if (offerState.status !== 'none') {
      const withoutStale = loaded.factRegistry.filter((f) => !f.id.startsWith('marketplace.offer.'));
      loaded.factRegistry = [...withoutStale, ...offerState.facts];
      (loaded as { marketplaceOfferLiveStatus?: string }).marketplaceOfferLiveStatus = offerState.status;
    }

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

    let discoveryTurn: ConsultantTurnResult | null = null;
    let discoveryPayload: MceAssistantPayloadV1 | null = null;
    let discoverySessionPatch: SessionDiscoveryContext | null | undefined = undefined;
    /** When true, final cards come only from discoveryPayload (alternatives filter) — never raw browse. */
    let discoveryCardsLocked = false;

    const askText = dto.message.trim();
    const altPriceAsk = isAlternativesPriceOrCompareAsk(askText);
    // Alternatives/compare must never hit open-offer price. When discovery is OFF, clarify now.
    // When discovery is ON, search first then build the final turn (reply + cards) below.
    if (!localReply && !mod.blocked && altPriceAsk && !this.discovery.enabled()) {
      const turn = buildAlternativesConsultationTurn(askText, loaded.factRegistry, [], {
        discoveryEnabled: false,
      });
      if (turn) localReply = turn.answerAr;
    }

    // Open offer live state wins over discovery for includes/price/book about *this* offer only.
    if (
      !localReply &&
      !mod.blocked &&
      !isAlternativesOrCompareAsk(askText) &&
      isOpenOfferLiveAsk(askText)
    ) {
      localReply = marketplaceOfferLiveAskReply(askText, loaded.factRegistry) ?? null;
    }

    // Real partner catalog via MarketplaceService.browse — never RC5 fixtures here.
    if (!localReply && !mod.blocked && this.discovery.enabled()) {
      const meta =
        session.metadataJson && typeof session.metadataJson === 'object'
          ? (session.metadataJson as Record<string, unknown>)
          : {};
      const priorDiscovery =
        (meta.discoveryContext as SessionDiscoveryContext | undefined) ?? null;
      const attachmentCount = dto.attachmentIds?.length ?? 0;
      const attachmentCues = await this.extractCuesFromCurrentAttachment(
        imageDataUrls,
        attachmentCount,
      );
      const imageKind =
        attachmentCues?.imageKind && attachmentCues.imageKind !== 'none'
          ? (attachmentCues.imageKind as 'face' | 'outfit' | 'unknown')
          : this.inferImageKind(loaded.snapshot, attachmentCount, dto.message.trim());
      // Prefer cues from image bytes; message text is fallback only (never filename-as-product).
      const attachmentHintAr =
        this.hintFromCues(attachmentCues) ||
        this.attachmentSearchHint(dto.message.trim(), attachmentCount);
      discoveryTurn = await this.discovery.turn({
        message: dto.message.trim(),
        hasFaceImage: imageKind === 'face',
        imageKind,
        session: priorDiscovery,
        attachmentCount,
        attachmentHintAr: attachmentHintAr || undefined,
        attachmentCues,
      });
      if (discoveryTurn.enabled && this.discovery.shouldHandleAsDiscovery(discoveryTurn.intent)) {
        const replyAr = (discoveryTurn.intent.replyAr ?? '').trim();
        const askAr = (discoveryTurn.intent.askAr ?? '').trim();
        const chips = discoveryTurn.intent.choiceChipsAr ?? [];
        // One visible question: never echo askAr when chips answer it, or when reply already asks.
        const askAlreadyInReply =
          !askAr ||
          replyAr.includes(askAr) ||
          (askAr.length > 12 && replyAr.includes(askAr.slice(0, 12)));
        const askIsMiraQuestion =
          /[؟?]/.test(askAr) || /^(هل|وش|ما |وين|في أي|أي )/.test(askAr);
        const replyParts = [
          replyAr || null,
          chips.length || askAlreadyInReply || askIsMiraQuestion ? null : askAr || null,
          discoveryTurn.searchFailed ? discoveryTurn.searchErrorAr : null,
        ].filter((s): s is string => !!s && s.trim().length > 0);
        localReply = replyParts.join('\n');
        discoverySessionPatch = discoveryTurn.sessionPatch;
        const followUps = this.discoveryFollowUps(discoveryTurn);
        const last = discoverySessionPatch?.lastOffers ?? [];
        const anyWithdrawn = last.some((o) => o.liveStatus === 'withdrawn');
        // After withdraw, push liveness so the client refuses buy/book on ordinals.
        const livenessCards =
          !discoveryTurn.offers.length && anyWithdrawn
            ? last.map((o) => ({
                id: o.id,
                kind: o.kind,
                titleAr: o.titleAr,
                priceSar: o.priceSar,
                partnerId: o.partnerId ?? null,
                inStock: o.liveStatus === 'withdrawn' ? false : o.inStock,
                liveStatus: o.liveStatus ?? 'unknown',
                action: 'view' as const,
                actionLabelAr: o.liveStatus === 'withdrawn' ? 'غير متاح' : 'عرض التفاصيل',
                openPath: `/marketplace/catalog/${o.kind}/${encodeURIComponent(o.id)}`,
              }))
            : null;
        discoveryPayload = {
          answerAr: localReply,
          confidence: 'high',
          intent: discoveryTurn.intent.kind,
          citedFactIds: [],
          suggestedQuestionsAr: followUps,
          blocked: false,
          disclaimerAr: '',
          replySource: 'discovery',
          discoveryOffers: (discoveryTurn.offers.length
            ? discoveryTurn.offers
            : livenessCards ?? []) as unknown as Array<Record<string, unknown>>,
          discoverySideOffer: discoveryTurn.sideOffer
            ? (discoveryTurn.sideOffer as unknown as Record<string, unknown>)
            : null,
          searchFailed: discoveryTurn.searchFailed,
          searchErrorAr: discoveryTurn.searchErrorAr ?? undefined,
        };
      }
    }

    // Alternatives/compare final turn: prefer published discovery cards with *their* prices;
    // never leave an open-offer price answer for these asks.
    // This path owns the final card list (including intentional empty) — lock against attachDiscoveryCards.
    if (!mod.blocked && altPriceAsk) {
      const published = (discoveryTurn?.offers ?? []).map((o) => ({
        id: o.id,
        titleAr: o.titleAr,
        kind: o.kind,
        priceSar: o.priceSar ?? null,
        inStock: o.inStock ?? null,
        // Derive from card action — ConsultantOfferCard does not expose bookingEnabled.
        bookingEnabled:
          o.kind === 'service' ? o.action === 'book' : o.kind === 'product' ? o.action === 'buy' : null,
      }));
      const turn = buildAlternativesConsultationTurn(askText, loaded.factRegistry, published, {
        discoveryEnabled: this.discovery.enabled(),
      });
      if (turn) {
        localReply = turn.answerAr;
        const lockedOffers = this.enrichLockedAlternativeCards(
          turn.discoveryOffers,
          discoveryTurn?.offers ?? [],
        );
        discoveryPayload = {
          answerAr: turn.answerAr,
          confidence: 'high',
          intent: 'general',
          citedFactIds: [],
          suggestedQuestionsAr: [],
          blocked: false,
          disclaimerAr: '',
          replySource: turn.replySource,
          discoveryOffers: lockedOffers,
          discoverySideOffer: null,
          searchFailed: discoveryTurn?.searchFailed ?? false,
          searchErrorAr: discoveryTurn?.searchErrorAr ?? undefined,
        };
        discoveryCardsLocked = true;
      }
    }

    // Catalog discovery OFF: never invent Mira products via LLM — honest unavailable copy.
    if (!localReply && !mod.blocked && isProductOrCatalogAsk(dto.message.trim()) && !this.discoveryEnabled()) {
      localReply = buildDegradedAdvisorReply(dto.message.trim(), loaded.factRegistry);
    }

    // Degraded path: keep basic skin/care replies available when the LLM key is absent.
    if (!localReply && !mod.blocked && !this.llm.isConfigured()) {
      localReply = buildDegradedAdvisorReply(dto.message.trim(), loaded.factRegistry);
    }

    let llmMessages: ReturnType<McePromptAssemblerService['buildMessages']> | undefined;
    let detectedIntent: MceConsultationIntent | undefined;
    const modelHistory = historyForBeautyTurn(priorHistory);

    if (!localReply && !mod.blocked && !cached && !isDirectCommercialQuestion(dto.message) && this.llm.isConfigured()) {
      detectedIntent = this.intentClassifier.classify(dto.message.trim(), loaded.snapshot);
      llmMessages = this.promptAssembler.buildMessages({
        snapshot: loaded.snapshot,
        factRegistry: loaded.factRegistry,
        rollingSummary: session.rollingSummaryAr,
        history: modelHistory,
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
      discoveryTurn,
      discoveryPayload,
      discoverySessionPatch,
      discoveryCardsLocked,
    };
  }

  private discoveryEnabled(): boolean {
    return this.discovery.enabled();
  }

  /**
   * Keep alternatives filter results (including empty). Enrich nav/media from matching browse cards
   * by id — never reintroduce filtered-out offers (e.g. the open service).
   */
  private enrichLockedAlternativeCards(
    filtered: Array<Record<string, unknown>>,
    rawOffers: ConsultantOfferCard[],
  ): Array<Record<string, unknown>> {
    if (!filtered.length) return [];
    const byId = new Map(rawOffers.map((o) => [o.id, o]));
    return filtered.map((card) => {
      const id = String(card.id ?? '').trim();
      const raw = id ? byId.get(id) : undefined;
      if (!raw) return { ...card };
      return {
        ...raw,
        ...card,
        id,
        // Authoritative commercial fields from the alternatives turn.
        priceSar: card.priceSar ?? raw.priceSar,
        inStock: card.inStock !== undefined ? card.inStock : raw.inStock,
        action: card.action ?? raw.action,
        actionLabelAr: card.actionLabelAr ?? raw.actionLabelAr,
        openPath: card.openPath ?? raw.openPath,
        titleAr: card.titleAr ?? raw.titleAr,
        kind: card.kind ?? raw.kind,
      };
    });
  }

  /** Map marketplace browse cards → grounding rows (id/price/stock from partner catalog). */
  private offersFromDiscoveryTurn(turn: ConsultantTurnResult | null): PublishedCatalogOffer[] {
    if (!turn?.offers?.length) return [];
    const side = turn.sideOffer ? [turn.sideOffer] : [];
    return [...turn.offers, ...side].map((o) => this.publishedFromCard(o));
  }

  private publishedFromCard(o: ConsultantOfferCard): PublishedCatalogOffer {
    return {
      id: o.id,
      titleAr: o.titleAr,
      kind: o.kind,
      priceSar: o.priceSar,
      inStock: o.inStock,
    };
  }

  private attachDiscoveryCards(
    payload: MceAssistantPayloadV1,
    turn: ConsultantTurnResult | null,
    opts?: { lockPayloadCards?: boolean },
  ): MceAssistantPayloadV1 {
    // Alternatives (and similar): payload already holds the only allowed card set — including [].
    if (opts?.lockPayloadCards) {
      return {
        ...payload,
        discoveryOffers: Array.isArray(payload.discoveryOffers) ? payload.discoveryOffers : [],
        discoverySideOffer: payload.discoverySideOffer ?? null,
        searchFailed: payload.searchFailed ?? false,
        searchErrorAr: payload.searchErrorAr,
      };
    }
    if (!turn) {
      // Keep any liveness cards already placed on the payload (do not wipe).
      return {
        ...payload,
        discoveryOffers: Array.isArray(payload.discoveryOffers) ? payload.discoveryOffers : [],
        discoverySideOffer: payload.discoverySideOffer ?? null,
        searchFailed: payload.searchFailed ?? false,
      };
    }
    const fromTurn = turn.offers.map((o) => ({ ...o }));
    const prior =
      Array.isArray(payload.discoveryOffers) && payload.discoveryOffers.length
        ? payload.discoveryOffers
        : [];
    // Prefer fresh turn cards; if turn has none, preserve prior liveness/status cards.
    const discoveryOffers = fromTurn.length ? fromTurn : prior;
    return {
      ...payload,
      discoveryOffers,
      discoverySideOffer: turn.sideOffer
        ? { ...turn.sideOffer }
        : fromTurn.length
          ? null
          : (payload.discoverySideOffer ?? null),
      searchFailed: turn.searchFailed,
      searchErrorAr: turn.searchErrorAr ?? undefined,
      replySource:
        payload.replySource ??
        (fromTurn.length || turn.searchFailed || turn.noMatch || prior.length
          ? 'discovery'
          : payload.replySource),
    };
  }

  private validateOpts(publishedOffers: PublishedCatalogOffer[] = []) {
    return {
      discoveryEnabled: this.discoveryEnabled(),
      publishedOffers,
    };
  }

  /**
   * Classify the *current* attachment from the user message — never force «face»
   * merely because the session has a prior skin report.
   */
  private inferImageKind(
    snapshot: MceContextSnapshotV1,
    attachmentCount: number,
    message: string,
  ): 'face' | 'outfit' | 'unknown' {
    if (attachmentCount <= 0) return 'unknown';
    const n = message
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه');
    if (/تسريح|قصه|قصّه|شعر|هايلايت|صبغه|لون شعر|مين تسوي|صالون/.test(n)) {
      return 'outfit';
    }
    if (
      /منتج|عبوه|عبوة|مرطب|واقي|شامبو|سيروم|كريم|علبه|علبة|براند|ماركه|علامه|نفس هذا|مثل هذا|زي هذا|ابي نفس|ابغى نفس/.test(
        n,
      )
    ) {
      return 'unknown'; // product-capable; not face
    }
    if (/وجهي|بشرتي|هالصوره لوجهي|صورة وجه|صوره وجه|تحليل بشر/.test(n)) {
      return 'face';
    }
    // Prior skin/outfit reports must not override a new unlabeled product photo.
    if (snapshot.outfitAnalysisId && /اطلال|لبس|فستان|لون/.test(n)) return 'outfit';
    return 'unknown';
  }

  /** Message-only fallback — never treat a bare Latin token as proven product identity. */
  private attachmentSearchHint(message: string, attachmentCount: number): string {
    if (attachmentCount <= 0) return '';
    const named = message.match(
      /(?:اسمه|اسمها|ماركة|ماركه|علامة|علامه|براند)\s+([^\n.؟!?]{2,40})/i,
    );
    return named?.[1]?.trim() ?? '';
  }

  private hintFromCues(cues: AttachmentCatalogCues | null): string {
    if (!cues || cues.source === 'none') return '';
    return [cues.productNameAr, cues.brandAr, cues.sizeAr, cues.hairstyleAr]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join(' ');
  }

  private async extractCuesFromCurrentAttachment(
    imageDataUrls: string[],
    attachmentCount: number,
  ): Promise<AttachmentCatalogCues | null> {
    if (attachmentCount <= 0 || !imageDataUrls.length) return null;
    const dataUrl = imageDataUrls[0];
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    const bytes = Buffer.from(m[2], 'base64');
    const visionComplete = this.llm.isConfigured()
      ? async (args: { system: string; userText: string; imageDataUrl: string }) => {
          const result = await this.llm.complete([
            { role: 'system', content: args.system },
            {
              role: 'user',
              content: [
                { type: 'text', text: args.userText },
                { type: 'image_url', image_url: { url: args.imageDataUrl, detail: 'auto' } },
              ],
            },
          ]);
          return result.payload.answerAr || JSON.stringify(result.payload);
        }
      : null;
    // Production path: vision only — never MIRA_CUE / JPEG COM as product identity.
    return extractAttachmentCatalogCues({
      bytes,
      dataUrl,
      visionComplete,
      allowEmbeddedTestCues: false,
    });
  }

  private discoveryFollowUps(turn: ConsultantTurnResult): string[] {
    const chips = (turn.intent.choiceChipsAr ?? [])
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (chips.length) return [...new Set(chips)].slice(0, 4);

    const ask = turn.intent.askAr?.trim() ?? '';
    const out: string[] = [];
    // Answers/actions only — never put Mira's own question on the chip row.
    const askIsMiraQuestion =
      /[؟?]/.test(ask) || /^(هل|وش|ما |وين|في أي|أي )/.test(ask);
    if (ask && !askIsMiraQuestion) out.push(ask);

    const kind = turn.intent.kind;
    const blockers = turn.intent.blockers ?? [];

    if (blockers.includes('bare_advice_clarify')) {
      out.push('عن بشرتي', 'عن شعري', 'عندي مناسبة', 'أبي منتج معيّن');
      return [...new Set(out)].slice(0, 4);
    }
    if (blockers.includes('ambiguous_occasion')) {
      out.push('زفاف', 'خطوبة', 'سهرة', 'مناسبة أخرى');
      return [...new Set(out)].slice(0, 4);
    }
    if (blockers.includes('ambiguous_wedding')) {
      out.push('أنا العروس', 'أنا ضيفة', 'أرتّب الحفل لشخص آخر');
      return [...new Set(out)].slice(0, 4);
    }
    if (blockers.includes('guest_need_goal')) {
      out.push('أختار فستان', 'أنسّق فستان عندي', 'أبي مكياج وشعر');
      return [...new Set(out)].slice(0, 4);
    }
    if (blockers.includes('guest_coord_dress')) {
      out.push('أرسل صورة الفستان', 'أختار لونه', 'أقترحي شنطة وحذاء');
      return [...new Set(out)].slice(0, 4);
    }
    if (blockers.includes('guest_makeup_place') || blockers.includes('guest_makeup_need_city')) {
      if (blockers.includes('guest_makeup_need_city')) {
        out.push('في الرياض', 'في جدة', 'في الدمام');
      } else {
        out.push('في الصالون', 'في البيت', 'في القاعة');
      }
      return [...new Set(out)].slice(0, 4);
    }
    if (blockers.includes('ambiguous_hospitality')) {
      out.push('شراء جاهز', 'حجز مقدم خدمة');
      return [...new Set(out)].slice(0, 4);
    }
    if (kind === 'advice_only' && blockers.includes('skin_explain_not_catalog')) {
      out.push('اربطيها بتقرير بشرتي');
      out.push('نصيحة عامة فقط');
      return [...new Set(out)].slice(0, 4);
    }
    if (blockers.includes('home_hair_service') || blockers.includes('venue_artist_service')) {
      if (!turn.intent.city) out.push('في الرياض');
      out.push('مختصة فردية');
      out.push(
        blockers.includes('venue_artist_service')
          ? 'صالون يثبت الحضور للقاعة'
          : 'صالون يقدم زيارات',
      );
      return [...new Set(out)].slice(0, 4);
    }
    if (kind === 'clarify') {
      // No generic skin/hair fallback for unrelated clarifies.
      return [...new Set(out)].slice(0, 4);
    }
    if (turn.offers.length >= 2) {
      out.push('قارني الأول بالثاني');
      out.push('أيهم أنسب لي؟');
      out.push('عطيني رابط الثاني');
    } else if (turn.offers.length === 1) {
      out.push('عطيني الرابط');
      if (turn.offers[0].action === 'book') out.push('أبي أحجز');
    }
    if (turn.noMatch) out.push('أبي بديل مشابه منشور');
    return [...new Set(out)].slice(0, 4);
  }

  private async openTurn(
    authUser: RequestUser,
    sessionId: string,
    dto: SendConsultationMessageDto,
  ): Promise<
    | { turn: ConsultationTurnResponseDto; userRow?: undefined; claimStatus?: undefined; attemptToken?: undefined; quotaReserved?: undefined }
    | {
        turn?: undefined;
        userRow: { id: string; contentAr: string; role: string; blocked: boolean; createdAt: Date };
        attemptToken: string | null;
        claimStatus: 'created' | 'resume';
        quotaReserved: boolean;
      }
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
      contentAr: dto.message
        .trim()
        .replace(/PROVIDER_PIXEL_MASK/g, '')
        .replace(/PROVIDER_SUBREGION_MASKS/g, '')
        .replace(/\(\s*\)/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim(),
      attachmentIds: dto.attachmentIds,
      clientMessageId: dto.clientMessageId,
    });
    if (claim.status === 'complete') {
      const assistantDto = this.messages.toDto(claim.assistant);
      return {
        turn: {
          userMessage: this.messages.toDto(claim.user),
          assistantMessage: assistantDto,
          session: this.sessions.toDto(session),
        },
      };
    }
    return {
      userRow: claim.user,
      attemptToken: claim.attemptToken ?? null,
      claimStatus: claim.status === 'resume' ? 'resume' : 'created',
      quotaReserved: claim.quotaReserved === true,
    };
  }

  private async failOwned(
    messageId: string,
    attemptToken: string | null,
    failMeta?: { code?: string; message?: string },
  ): Promise<void> {
    if (!attemptToken) {
      await this.messages.markTurn(messageId, 'failed');
      return;
    }
    await this.messages.markOwned(messageId, attemptToken, 'failed', failMeta);
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
    publishedOffers: PublishedCatalogOffer[] = [],
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
    const validated = this.validator.validate(
      parsed,
      factRegistry,
      userMessage,
      this.validateOpts(publishedOffers),
    );
    return { ...validated, replySource: validated.replySource ?? 'llm' };
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
      discoveryTurn?: ConsultantTurnResult | null;
      discoveryPayload?: MceAssistantPayloadV1 | null;
      discoveryCardsLocked?: boolean;
    },
    streamFactory?: () => AsyncIterable<string>,
  ): Promise<MceAssistantPayloadV1> {
    const discoveryTurn = ctx.discoveryTurn ?? null;
    const publishedOffers = this.offersFromDiscoveryTurn(discoveryTurn);
    const lockCards = ctx.discoveryCardsLocked === true;

    // Discovery already claimed this turn with marketplace browse results.
    if (ctx.discoveryPayload) {
      const grounded = this.validator.validate(
        ctx.discoveryPayload,
        ctx.factRegistry,
        ctx.userRow.contentAr,
        {
          ...this.validateOpts(publishedOffers),
          // Locked alternatives answers cite published alt prices — not open-offer facts alone.
          preserveGroundedAnswer: lockCards,
        },
      );
      // Re-apply locked cards after validate (empty list is intentional for alternatives).
      const scoped: MceAssistantPayloadV1 = {
        ...guardScopeAnswer(grounded, ctx.userRow.contentAr),
        replySource: ctx.discoveryPayload.replySource ?? grounded.replySource ?? 'discovery',
        discoveryOffers: Array.isArray(ctx.discoveryPayload.discoveryOffers)
          ? ctx.discoveryPayload.discoveryOffers
          : [],
        discoverySideOffer: lockCards ? null : (ctx.discoveryPayload.discoverySideOffer ?? null),
        searchFailed: ctx.discoveryPayload.searchFailed ?? grounded.searchFailed ?? false,
        searchErrorAr: ctx.discoveryPayload.searchErrorAr ?? grounded.searchErrorAr,
      };
      return this.attachDiscoveryCards(scoped, discoveryTurn, { lockPayloadCards: lockCards });
    }

    if (ctx.localReply) {
      const catalogBlocked =
        isProductOrCatalogAsk(ctx.userRow.contentAr) && !this.discoveryEnabled();
      const replySource = catalogBlocked || !this.llm.isConfigured() ? 'degraded' : 'dialogue';
      const ask = ctx.userRow.contentAr;
      // Open-offer / alternatives local replies are already grounded — do not replace with GAP
      // via serverCommercialTurnReply (open-offer demonstratives rarely match subjectAr).
      const preserveLocal =
        isOpenOfferLiveAsk(ask) ||
        isAlternativesPriceOrCompareAsk(ask) ||
        isAlternativesOrCompareAsk(ask);
      const validated = this.validator.validate(
        {
          answerAr: ctx.localReply,
          confidence: 'high',
          intent: catalogBlocked ? 'product' : 'general',
          citedFactIds: [],
          suggestedQuestionsAr: [],
          blocked: false,
          disclaimerAr: '',
          replySource,
        },
        ctx.factRegistry,
        ctx.userRow.contentAr,
        {
          ...this.validateOpts(publishedOffers),
          preserveGroundedAnswer: preserveLocal,
        },
      );
      return this.attachDiscoveryCards(guardScopeAnswer(validated, ctx.userRow.contentAr), discoveryTurn, {
        lockPayloadCards: lockCards,
      });
    }
    if (ctx.mod.blocked && ctx.mod.safeReply) {
      return this.validator.blockedPayload(
        `${ctx.mod.safeReply}\n\n${this.moderation.disclaimer()}`,
      );
    }
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
      return this.attachDiscoveryCards(
        this.serverCommercialPayload(ctx.userRow.contentAr, ctx.factRegistry, publishedOffers),
        discoveryTurn,
      );
    }
    if (ctx.cached) {
      return this.attachDiscoveryCards(
        guardScopeAnswer(
          this.validator.validate(
            ctx.cached,
            ctx.factRegistry,
            ctx.userRow.contentAr,
            this.validateOpts(publishedOffers),
          ),
          ctx.userRow.contentAr,
        ),
        discoveryTurn,
      );
    }

    if (!this.llm.isConfigured() || !ctx.llmMessages) {
      throw new ServiceUnavailableException({
        code: 'MCE_LLM_NOT_CONFIGURED',
        message: 'محرك الاستشارة غير متاح حالياً',
      });
    }
    const payload = streamFactory
      ? await this.collectValidatedStream(
          streamFactory(),
          ctx.factRegistry,
          ctx.userRow.contentAr,
          publishedOffers,
        )
      : this.validator.validate(
          (await this.llm.complete(ctx.llmMessages, { signal: ctx.signal })).payload,
          ctx.factRegistry,
          ctx.userRow.contentAr,
          this.validateOpts(publishedOffers),
        );

    const scoped = guardScopeAnswer(
      { ...payload, replySource: payload.replySource ?? 'llm' },
      ctx.userRow.contentAr,
    );
    const withCards = this.attachDiscoveryCards(scoped, discoveryTurn);
    if (ctx.faqKey) await this.costGuard.setFaqCache(ctx.faqKey, withCards);
    return withCards;
  }

  private async finalizeTurn(
    ctx: {
      started: number;
      user: { id: string };
      session: { id: string; turnCount: number; rollingSummaryAr: string | null; metadataJson?: unknown };
      snapshot: MceContextSnapshotV1;
      factRegistry: MceFactEntry[];
      snapshotId: string;
      userRow: { id: string; contentAr: string; role: string; blocked: boolean; createdAt: Date };
      detectedIntent?: MceConsultationIntent;
      attemptToken?: string | null;
      discoverySessionPatch?: SessionDiscoveryContext | null;
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
        modelId: assistantPayload.replySource === 'llm'
        ? this.llm.configuredModel()
        : assistantPayload.replySource === 'degraded' || !this.llm.isConfigured()
          ? 'rule-fallback'
          : this.llm.configuredModel(),
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
      const prevMeta =
        ctx.session.metadataJson && typeof ctx.session.metadataJson === 'object'
          ? (ctx.session.metadataJson as Record<string, unknown>)
          : {};
      const nextMeta =
        ctx.discoverySessionPatch != null
          ? { ...prevMeta, discoveryContext: ctx.discoverySessionPatch }
          : prevMeta;
      await this.prisma.consultationSession.update({
        where: { id: ctx.session.id },
        data: {
          turnCount: { increment: 1 },
          rollingSummaryAr,
          updatedAt: new Date(),
          metadataJson: nextMeta as import('@prisma/client').Prisma.InputJsonValue,
        },
      });
      await this.users.writeAuditLog({
        userId: ctx.user.id,
        action: 'consultation.message',
        metadata: {
          replySource: assistantPayload.replySource ?? null,
          llmConfigured: this.llm.isConfigured(),
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

  private serverCommercialPayload(
    message: string,
    facts: MceFactEntry[],
    publishedOffers: PublishedCatalogOffer[] = [],
  ): MceAssistantPayloadV1 {
    return this.validator.validate(
      {
        answerAr: serverCommercialTurnReply(facts, message),
        confidence: 'high',
        intent: 'product',
        citedFactIds: [],
        suggestedQuestionsAr: [],
        blocked: false,
        disclaimerAr: '',
        replySource: 'commercial',
      },
      facts,
      message,
      this.validateOpts(publishedOffers),
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
    const discoveryTurn = this.discovery.enabled()
      ? await this.discovery.turn({ message: message.trim() })
      : null;
    const published = this.offersFromDiscoveryTurn(discoveryTurn);
    const payload = this.attachDiscoveryCards(
      this.validator.validate(
        llmResult.payload,
        grounding.factRegistry,
        message.trim(),
        this.validateOpts(published),
      ),
      discoveryTurn,
    );

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

