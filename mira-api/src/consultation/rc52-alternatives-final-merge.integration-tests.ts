/**
 * RC5.2-fix — integration through sendMessage → resolveAssistantPayload → finalize.
 * Asserts the *final* assistant payload cards (after attachDiscoveryCards), not buildAlternatives alone.
 *
 * Isolated fixtures — not live customer data. Re-runnable without network.
 */
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import { MceModerationService } from './services/mce-moderation.service';
import {
  McePromptAssemblerService,
  MceResponseValidatorService,
} from './services/mce-prompt-assembler.service';
import { marketplaceOfferFacts } from './services/consultation-scope';
import type { ConsultantOfferCard, ConsultantTurnResult } from '../consultant-discovery/consultant-discovery.service';

const now = new Date('2026-11-19T14:00:00Z');

const openFacts = marketplaceOfferFacts({
  id: 'svc-clean',
  kind: 'service',
  nameAr: 'تنظيف',
  descriptionAr: 'تنظيف منشور',
  priceHalalas: 15000,
  availability: true,
  durationMin: 45,
});

function card(partial: Partial<ConsultantOfferCard> & Pick<ConsultantOfferCard, 'id' | 'titleAr' | 'kind'>): ConsultantOfferCard {
  const kind = partial.kind;
  const action = partial.action ?? (kind === 'service' ? 'book' : 'buy');
  return {
    kind,
    id: partial.id,
    titleAr: partial.titleAr,
    priceSar: partial.priceSar ?? null,
    priceLabelAr: partial.priceLabelAr ?? (partial.priceSar != null ? `${partial.priceSar} ر.س` : null),
    action,
    actionLabelAr: partial.actionLabelAr ?? (action === 'book' ? 'احجزي' : action === 'buy' ? 'اطلبي' : 'عرض التفاصيل'),
    lane: partial.lane ?? null,
    category: partial.category ?? null,
    subcategory: partial.subcategory ?? null,
    partnerId: partial.partnerId ?? 'partner-1',
    branchId: partial.branchId ?? 'br-1',
    inStock: partial.inStock ?? true,
    openPath: partial.openPath ?? `/${kind}/${partial.id}`,
    liveStatus: partial.liveStatus ?? 'published',
  };
}

const cleanCard = card({
  id: 'svc-clean',
  titleAr: 'تنظيف',
  kind: 'service',
  priceSar: 150,
  action: 'book',
  inStock: true,
});
const hydrateCard = card({
  id: 'svc-hydrate',
  titleAr: 'ترطيب',
  kind: 'service',
  priceSar: 120,
  action: 'book',
  inStock: true,
});
const hydrateClosed = card({
  id: 'svc-hydrate',
  titleAr: 'ترطيب',
  kind: 'service',
  priceSar: 120,
  action: 'view',
  actionLabelAr: 'عرض التفاصيل',
  inStock: false,
});

function discoveryResult(offers: ConsultantOfferCard[], opts?: { searchFailed?: boolean; side?: ConsultantOfferCard | null }): ConsultantTurnResult {
  return {
    enabled: true,
    version: 'test',
    intent: {
      kind: 'direct_service_search',
      replyAr: 'نتائج بحث خام',
      askAr: '',
      choiceChipsAr: [],
      blockers: [],
    } as never,
    offers,
    sideOffer: opts?.side ?? null,
    catalogFingerprint: 'fp-test',
    searchFailed: opts?.searchFailed === true,
    searchErrorAr: opts?.searchFailed ? 'تعذّر البحث في الكتالوج' : null,
    noMatch: offers.length === 0 && !opts?.searchFailed,
    browseQuery: null,
    notes: [],
    sessionPatch: null,
  };
}

type HarnessOpts = {
  discoveryOffers?: ConsultantOfferCard[];
  discoveryEnabled?: boolean;
  searchFailed?: boolean;
  sideOffer?: ConsultantOfferCard | null;
  /** When true, discovery claims the turn before alternatives (raw cards in first payload). */
  discoveryClaimsTurn?: boolean;
};

function createAltHarness(opts: HarnessOpts = {}) {
  const discoveryOffers = opts.discoveryOffers ?? [cleanCard, hydrateCard];
  const discoveryEnabled = opts.discoveryEnabled !== false;
  const session = {
    id: 's-alt',
    titleAr: null,
    status: 'active',
    activeSnapshotId: 'snap',
    occasionId: null,
    turnCount: 0,
    rollingSummaryAr: null,
    metadataJson: {},
    createdAt: now,
    updatedAt: now,
  };
  const snapshot = { schemaVersion: '1.0.0', user: { isMinor: false } };
  let lastPayload: Record<string, unknown> | null = null;

  const discovery = {
    enabled: () => discoveryEnabled,
    shouldHandleAsDiscovery: () => opts.discoveryClaimsTurn === true,
    turn: async () =>
      discoveryResult(discoveryOffers, {
        searchFailed: opts.searchFailed,
        side: opts.sideOffer,
      }),
  };

  const orchestrator = new ConsultationOrchestratorService(
    {
      get: (k: string, d?: string) => {
        if (k === 'MCE_CONSULTATION_ENABLED') return 'true';
        if (k === 'MIRA_CONSULTANT_DISCOVERY_V1') return discoveryEnabled ? 'true' : 'false';
        return d;
      },
    } as unknown as ConfigService,
    {
      findOrCreateFromFirebase: async () => ({ id: 'u-alt' }),
      getPreferences: async () => ({ birthYear: 1990 }),
      writeAuditLog: async () => undefined,
    } as never,
    {
      subscription: { findUnique: async () => ({ plan: 'free' }) },
      consultationSession: { update: async () => session },
    } as never,
    { assertWithinLimit: async () => undefined } as never,
    {
      assertDailyQuota: async () => undefined,
      faqCacheKey: () => null,
      answerCacheKey: () => null,
      getFaqCache: async () => null,
      setFaqCache: async () => undefined,
    } as never,
    { shouldCompact: () => false } as never,
    {
      getForUser: async () => session,
      refreshMarketplaceOfferState: async () => ({ status: 'ok' as const, facts: openFacts }),
      toDto: () => ({
        id: 's-alt',
        titleAr: null,
        status: 'active',
        activeSnapshotId: 'snap',
        contextSummary: { hasSkin: false, hasOutfit: false, hasRecolor: false },
        turnCount: 0,
        suggestedStartersAr: [],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    } as never,
    {
      recoverStuck: async () => undefined,
      claimUser: async ({ contentAr }: { contentAr: string }) => ({
        status: 'created',
        attemptToken: 'tok-1',
        quotaReserved: true,
        user: {
          id: `user-msg-${Math.random().toString(16).slice(2, 8)}`,
          role: 'user',
          contentAr,
          blocked: false,
          createdAt: now,
        },
      }),
      markQuotaReserved: async () => undefined,
      assistantFor: async () => null,
      persistAssistant: async (_sid: string, contentAr: string, payload: Record<string, unknown>) => {
        lastPayload = payload;
        return {
          id: 'asst-1',
          role: 'assistant',
          contentAr,
          payloadJson: payload,
          blocked: false,
          createdAt: now,
        };
      },
      toDto: (row: { id: string; role: string; contentAr: string; blocked: boolean; createdAt: Date; payloadJson?: unknown }) => ({
        id: row.id,
        role: row.role,
        contentAr: row.contentAr,
        blocked: row.blocked,
        createdAt: row.createdAt.toISOString(),
        payload: (row.payloadJson ?? lastPayload ?? undefined) as never,
      }),
      recentPairs: async () => [],
      markOwned: async () => undefined,
      markTurn: async () => undefined,
      holdsLease: async () => true,
    } as never,
    {
      loadForSession: async () => ({ id: 'snap', snapshot, factRegistry: openFacts }),
    } as never,
    { build: async () => ({ snapshot, factRegistry: openFacts }) } as never,
    { classify: () => 'general', intentHintAr: () => '' } as never,
    new MceModerationService(),
    new McePromptAssemblerService(new MceModerationService()),
    new MceResponseValidatorService(new MceModerationService()),
    {
      isConfigured: () => false,
      configuredModel: () => 'none',
      complete: async () => {
        throw new Error('LLM must not run for alternatives fixtures');
      },
    } as never,
    discovery as never,
  );

  return {
    orchestrator,
    getLastPayload: () => lastPayload,
  };
}

function offerIds(payload: Record<string, unknown> | null | undefined): string[] {
  const offers = payload?.discoveryOffers;
  if (!Array.isArray(offers)) return [];
  return offers.map((o) => String((o as { id?: string }).id ?? ''));
}

function offerActions(payload: Record<string, unknown> | null | undefined): Array<{ id: string; action: string }> {
  const offers = payload?.discoveryOffers;
  if (!Array.isArray(offers)) return [];
  return offers.map((o) => {
    const row = o as { id?: string; action?: string };
    return { id: String(row.id ?? ''), action: String(row.action ?? '') };
  });
}

async function main(): Promise<void> {
  // BEFORE-bug documentation case: raw browse includes open offer + hydrate.
  {
    const h = createAltHarness({
      discoveryOffers: [cleanCard, hydrateCard],
      discoveryClaimsTurn: true,
      sideOffer: cleanCard,
    });
    const turn = await h.orchestrator.sendMessage({} as never, 's-alt', { message: 'بكم البديل؟' });
    const payload = (turn.assistantMessage.payload ?? h.getLastPayload()) as Record<string, unknown>;
    assert.match(String(turn.assistantMessage.contentAr), /120/);
    assert.doesNotMatch(String(turn.assistantMessage.contentAr), /سعر البديل المنشور «تنظيف»/);
    assert.deepEqual(offerIds(payload), ['svc-hydrate']);
    assert.equal(payload.discoverySideOffer, null);
    assert.deepEqual(offerActions(payload), [{ id: 'svc-hydrate', action: 'book' }]);
    console.log('pass final_merge alt_clean_and_hydrate → hydrate only');
  }

  // Search returns open offer only → empty alternative cards + clarify.
  {
    const h = createAltHarness({ discoveryOffers: [cleanCard], discoveryClaimsTurn: true });
    const turn = await h.orchestrator.sendMessage({} as never, 's-alt', { message: 'بكم البديل؟' });
    const payload = (turn.assistantMessage.payload ?? h.getLastPayload()) as Record<string, unknown>;
    assert.deepEqual(offerIds(payload), []);
    assert.equal(payload.discoverySideOffer, null);
    assert.match(String(turn.assistantMessage.contentAr), /أي بديل|حددي|لن أستخدم سعر/);
    assert.doesNotMatch(String(turn.assistantMessage.contentAr), /سعر البديل المنشور «تنظيف»/);
    console.log('pass final_merge open_only → empty cards');
  }

  // Open-offer price ask still 150.
  {
    const h = createAltHarness({ discoveryOffers: [cleanCard, hydrateCard], discoveryClaimsTurn: false });
    const turn = await h.orchestrator.sendMessage({} as never, 's-alt', { message: 'بكم هذه؟' });
    assert.match(String(turn.assistantMessage.contentAr), /150/);
    console.log('pass final_merge بكم هذه؟ → 150');
  }

  // Compare: both prices in text; cards must not present cleaning as the alternative card.
  {
    const h = createAltHarness({ discoveryOffers: [cleanCard, hydrateCard], discoveryClaimsTurn: true });
    const turn = await h.orchestrator.sendMessage({} as never, 's-alt', {
      message: 'قارني سعرها بخدمة الترطيب',
    });
    const payload = (turn.assistantMessage.payload ?? h.getLastPayload()) as Record<string, unknown>;
    const text = String(turn.assistantMessage.contentAr);
    assert.match(text, /150/);
    assert.match(text, /120/);
    assert.match(text, /ترطيب/);
    assert.ok(!offerIds(payload).includes('svc-clean'));
    assert.deepEqual(offerIds(payload), ['svc-hydrate']);
    console.log('pass final_merge compare → both prices, hydrate card only');
  }

  // Hydrate published but booking closed → view only.
  {
    const h = createAltHarness({ discoveryOffers: [cleanCard, hydrateClosed], discoveryClaimsTurn: true });
    const turn = await h.orchestrator.sendMessage({} as never, 's-alt', { message: 'بكم البديل؟' });
    const payload = (turn.assistantMessage.payload ?? h.getLastPayload()) as Record<string, unknown>;
    assert.deepEqual(offerIds(payload), ['svc-hydrate']);
    assert.deepEqual(offerActions(payload), [{ id: 'svc-hydrate', action: 'view' }]);
    assert.match(String(turn.assistantMessage.contentAr), /120/);
    console.log('pass final_merge closed_booking → view');
  }

  // Search failed → no bookable stale alt; clarify unverifiable.
  {
    const h = createAltHarness({
      discoveryOffers: [],
      searchFailed: true,
      discoveryClaimsTurn: true,
    });
    const turn = await h.orchestrator.sendMessage({} as never, 's-alt', { message: 'بكم البديل؟' });
    const payload = (turn.assistantMessage.payload ?? h.getLastPayload()) as Record<string, unknown>;
    assert.deepEqual(offerIds(payload), []);
    assert.equal(payload.searchFailed, true);
    assert.match(String(turn.assistantMessage.contentAr), /بديل|حددي|تعذّر/);
    console.log('pass final_merge search_failed → empty + flag');
  }

  // Normal browse path still attaches discovery cards (not locked).
  {
    const h = createAltHarness({
      discoveryOffers: [hydrateCard],
      discoveryClaimsTurn: true,
    });
    const turn = await h.orchestrator.sendMessage({} as never, 's-alt', { message: 'أبي جلسة ترطيب من الكتالوج' });
    const payload = (turn.assistantMessage.payload ?? h.getLastPayload()) as Record<string, unknown>;
    // Not an alternatives ask — raw browse cards remain.
    assert.ok(offerIds(payload).includes('svc-hydrate'));
    console.log('pass final_merge normal_browse keeps cards');
  }

  console.log('OK rc52-alternatives-final-merge.integration');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
