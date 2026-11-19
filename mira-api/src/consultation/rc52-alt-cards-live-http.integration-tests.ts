/**
 * Live HTTP proof for alternatives cards (in-process Nest + Scripted Firebase).
 * Simulates partner-portal outcomes by flipping discovery liveStatus:
 *   published+booking closed → view details
 *   withdrawn → omitted entirely
 *   searchFailed → distinct retry copy
 *
 * Uses DATABASE_URL only when local; does not print secrets.
 * Isolated fixture ids — not real customers.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import {
  FirebaseIdTokenVerifier,
  VerifiedFirebaseIdentity,
} from '../common/auth/firebase-id-token-verifier';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { PrismaModule } from '../prisma/prisma.module';
import { RateLimitService } from '../common/services/rate-limit.service';
import { UsersService } from '../users/users.service';
import { ConsultantDiscoveryService } from '../consultant-discovery/consultant-discovery.service';
import type { ConsultantOfferCard, ConsultantTurnResult } from '../consultant-discovery/consultant-discovery.service';
import { ConsultationController } from './consultation.controller';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import { ConsultationSessionService } from './services/consultation-session.service';
import { ConsultationMessageService } from './services/consultation-message.service';
import { ConsultationDialogueService } from './services/consultation-attachment.service';
import { MceContextSnapshotService } from './services/mce-context-snapshot.service';
import { MceIntentClassifierService } from './services/mce-intent-classifier.service';
import { MceModerationService } from './services/mce-moderation.service';
import {
  McePromptAssemblerService,
  MceResponseValidatorService,
} from './services/mce-prompt-assembler.service';
import { MceMemoryCompactionService } from './services/mce-memory-compaction.service';
import { MceCostGuardService } from './services/mce-cost-guard.service';
import { MceLlmService } from './services/mce-llm.service';
import { MceGroundingPipelineService } from './services/mce-grounding-pipeline.service';
import { marketplaceOfferFacts, ALTERNATIVES_SEARCH_FAILED_AR } from './services/consultation-scope';

class ScriptedVerifier extends FirebaseIdTokenVerifier {
  constructor(private readonly known: Record<string, string>) {
    super();
  }
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    const uid = this.known[token];
    if (!uid) throw new UnauthorizedException('Invalid or expired Firebase token');
    return { uid, email: `${uid}@test.local`, name: uid };
  }
}

type Phase = 'both_bookable' | 'hydrate_booking_closed' | 'hydrate_withdrawn' | 'search_failed';

function card(
  partial: Partial<ConsultantOfferCard> & Pick<ConsultantOfferCard, 'id' | 'titleAr' | 'kind'>,
): ConsultantOfferCard {
  const kind = partial.kind;
  const action = partial.action ?? (kind === 'service' ? 'book' : 'buy');
  return {
    kind,
    id: partial.id,
    titleAr: partial.titleAr,
    priceSar: partial.priceSar ?? null,
    priceLabelAr: partial.priceLabelAr ?? (partial.priceSar != null ? `${partial.priceSar} ر.س` : null),
    action,
    actionLabelAr:
      partial.actionLabelAr ??
      (action === 'book' ? 'احجزي' : action === 'buy' ? 'اطلبي' : 'عرض التفاصيل'),
    lane: null,
    category: null,
    subcategory: null,
    partnerId: 'partner-bc',
    branchId: 'br-1',
    inStock: partial.inStock ?? true,
    openPath: `/${kind}/${partial.id}`,
    liveStatus: partial.liveStatus ?? 'published',
  };
}

const clean = card({
  id: 'svc-clean-http',
  titleAr: 'تنظيف',
  kind: 'service',
  priceSar: 150,
  action: 'book',
});
const hydrateOpen = card({
  id: 'svc-hydrate-http',
  titleAr: 'ترطيب',
  kind: 'service',
  priceSar: 120,
  action: 'book',
});
const hydrateClosed = card({
  id: 'svc-hydrate-http',
  titleAr: 'ترطيب',
  kind: 'service',
  priceSar: 120,
  action: 'view',
  actionLabelAr: 'عرض التفاصيل',
  inStock: false,
  liveStatus: 'published',
});
const hydrateWithdrawn = card({
  id: 'svc-hydrate-http',
  titleAr: 'ترطيب',
  kind: 'service',
  priceSar: 120,
  action: 'view',
  inStock: false,
  liveStatus: 'withdrawn',
});

const openFacts = marketplaceOfferFacts({
  id: 'svc-clean-http',
  kind: 'service',
  nameAr: 'تنظيف',
  descriptionAr: 'تنظيف منشور',
  priceHalalas: 15000,
  availability: true,
  durationMin: 45,
});

class PhaseDiscovery {
  phase: Phase = 'both_bookable';
  enabled() {
    return true;
  }
  shouldHandleAsDiscovery() {
    return true;
  }
  async turn(): Promise<ConsultantTurnResult> {
    if (this.phase === 'search_failed') {
      return {
        enabled: true,
        version: 'http-proof',
        intent: { kind: 'direct_service_search', replyAr: '', askAr: '', choiceChipsAr: [], blockers: [] } as never,
        offers: [],
        sideOffer: null,
        catalogFingerprint: null,
        searchFailed: true,
        searchErrorAr: 'تعذّر البحث في الكتالوج',
        noMatch: false,
        browseQuery: null,
        notes: ['portal_sim:search_failed'],
        sessionPatch: null,
      };
    }
    const offers =
      this.phase === 'both_bookable'
        ? [clean, hydrateOpen]
        : this.phase === 'hydrate_booking_closed'
          ? [clean, hydrateClosed]
          : [clean, hydrateWithdrawn];
    return {
      enabled: true,
      version: 'http-proof',
      intent: { kind: 'direct_service_search', replyAr: 'نتائج', askAr: '', choiceChipsAr: [], blockers: [] } as never,
      offers,
      sideOffer: null,
      catalogFingerprint: 'fp',
      searchFailed: false,
      searchErrorAr: null,
      noMatch: false,
      browseQuery: null,
      notes: [`portal_sim:${this.phase}`],
      sessionPatch: null,
    };
  }
}

const discovery = new PhaseDiscovery();
const stamp = Date.now().toString(36);
const tokens = { 'cust-tok': `alt-http-${stamp}` };

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [ConsultationController],
  providers: [
    ConsultationOrchestratorService,
    ConsultationSessionService,
    ConsultationMessageService,
    ConsultationDialogueService,
    MceContextSnapshotService,
    MceIntentClassifierService,
    MceModerationService,
    McePromptAssemblerService,
    MceResponseValidatorService,
    UsersService,
    FirebaseAuthGuard,
    { provide: FirebaseIdTokenVerifier, useValue: new ScriptedVerifier(tokens) },
    {
      provide: MceGroundingPipelineService,
      useValue: {
        build: async () => ({
          snapshot: {
            schemaVersion: '1.0.0',
            user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' },
            builtAt: new Date().toISOString(),
          },
          factRegistry: openFacts,
          contentHash: 'alt-http',
        }),
      },
    },
    {
      provide: MceLlmService,
      useValue: {
        isConfigured: () => false,
        configuredModel: () => 'none',
        complete: async () => {
          throw new Error('LLM must not run');
        },
      },
    },
    { provide: RateLimitService, useValue: { assertWithinLimit: async () => undefined } },
    {
      provide: MceCostGuardService,
      useValue: {
        assertDailyQuota: async () => undefined,
        answerCacheKey: () => null,
        faqCacheKey: () => null,
        getFaqCache: async () => null,
        setFaqCache: async () => undefined,
      },
    },
    { provide: MceMemoryCompactionService, useValue: { shouldCompact: () => false, compact: async () => null } },
    { provide: ConsultantDiscoveryService, useValue: discovery },
  ],
})
class AltCardsHttpModule {}

function redact(payload: unknown) {
  return JSON.parse(
    JSON.stringify(payload, (_k, v) => {
      if (typeof v === 'string' && (v.includes('Bearer') || v.includes('postgresql://'))) return '***';
      return v;
    }),
  );
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.AUTH_SKIP = 'false';
  process.env.MCE_CONSULTATION_ENABLED = 'true';
  process.env.MIRA_CONSULTANT_DISCOVERY_V1 = 'true';

  const app: INestApplication = await NestFactory.create(AltCardsHttpModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api/v1`;
  const prisma = new PrismaClient();

  // Ensure session.refreshMarketplaceOfferState sees open offer facts via metadata.
  const sessions = app.get(ConsultationSessionService);
  const origRefresh = sessions.refreshMarketplaceOfferState.bind(sessions);
  sessions.refreshMarketplaceOfferState = async () => ({ status: 'ok', facts: openFacts });

  const call = async (method: string, path: string, json?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: 'Bearer cust-tok',
        'content-type': 'application/json',
      },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    return { status: res.status, body };
  };

  const evidenceDir = join(process.cwd(), '..', 'evidence', 'rc5.2-alt-cards', 'raw');
  mkdirSync(evidenceDir, { recursive: true });
  const responses: Record<string, unknown> = {
    note: 'HTTP in-process Nest on ephemeral port; portal outcomes simulated via discovery liveStatus',
    base: `http://127.0.0.1:${port}/api/v1`,
    partnerPortal: 'SIMULATED (PARTNER_BEARER not required for this proof)',
  };

  try {
    const created = await call('POST', '/consultation/sessions', {
      locale: 'ar',
      statedGoalAr: 'اختبار بدائل',
    });
    assert.equal(created.status, 201);
    const sessionId = String((created.body as { id?: string }).id ?? '');
    assert.ok(sessionId);

    // Bind open offer context if API supports marketplaceOfferId on context — optional metadata via session update.
    // Session create may not bind offer; refreshMarketplaceOfferState is stubbed above.

    const ask = async (phase: Phase, message: string, label: string) => {
      discovery.phase = phase;
      const r = await call('POST', `/consultation/sessions/${sessionId}/messages`, {
        message,
        clientMessageId: `${label}-${Date.now()}`,
      });
      assert.equal(r.status, 201, `${label} status ${r.status}`);
      const asst = (r.body as { assistantMessage?: { contentAr?: string; payload?: Record<string, unknown> } })
        .assistantMessage;
      const payload = asst?.payload ?? {};
      const offers = Array.isArray(payload.discoveryOffers) ? payload.discoveryOffers : [];
      responses[label] = redact({
        httpStatus: r.status,
        phase,
        message,
        contentAr: asst?.contentAr,
        discoveryOfferIds: offers.map((o) => (o as { id?: string }).id),
        discoveryOfferActions: offers.map((o) => ({
          id: (o as { id?: string }).id,
          action: (o as { action?: string }).action,
          liveStatus: (o as { liveStatus?: string }).liveStatus,
        })),
        discoverySideOffer: payload.discoverySideOffer ?? null,
        searchFailed: payload.searchFailed ?? false,
        suggestedQuestionsAr: payload.suggestedQuestionsAr ?? [],
      });
      return { contentAr: String(asst?.contentAr ?? ''), payload, offers };
    };

    // 1) Both bookable → hydrate card only
    {
      const { contentAr, offers } = await ask('both_bookable', 'بكم البديل؟', 'http_alt_both_bookable');
      assert.match(contentAr, /120/);
      assert.equal(offers.length, 1);
      assert.equal((offers[0] as { id: string }).id, 'svc-hydrate-http');
      assert.equal((offers[0] as { action: string }).action, 'book');
      console.log('pass http both_bookable');
    }

    // 2) Portal: close booking on hydrate → view only
    {
      const { contentAr, offers } = await ask(
        'hydrate_booking_closed',
        'بكم البديل؟',
        'http_alt_booking_closed',
      );
      assert.match(contentAr, /120/);
      assert.equal(offers.length, 1);
      assert.equal((offers[0] as { action: string }).action, 'view');
      console.log('pass http booking_closed view');
    }

    // 3) Portal: withdraw hydrate → omit from text and cards
    {
      const { contentAr, offers } = await ask('hydrate_withdrawn', 'بكم البديل؟', 'http_alt_withdrawn');
      assert.equal(offers.length, 0);
      assert.doesNotMatch(contentAr, /120/);
      assert.doesNotMatch(contentAr, /ترطيب/);
      assert.doesNotMatch(contentAr, /تعذّر عليّ البحث الآن/);
      console.log('pass http withdrawn omitted');
    }

    // 4) Search failed → retry copy
    {
      const { contentAr, payload, offers } = await ask('search_failed', 'بكم البديل؟', 'http_alt_search_failed');
      assert.equal(offers.length, 0);
      assert.equal(contentAr.includes(ALTERNATIVES_SEARCH_FAILED_AR) || /تعذّر عليّ البحث الآن/.test(contentAr), true);
      assert.equal(payload.searchFailed, true);
      console.log('pass http search_failed retry');
    }

    // Open offer still 150
    {
      discovery.phase = 'both_bookable';
      const r = await call('POST', `/consultation/sessions/${sessionId}/messages`, {
        message: 'بكم هذه؟',
        clientMessageId: `open-${Date.now()}`,
      });
      assert.equal(r.status, 201);
      const contentAr = String(
        (r.body as { assistantMessage?: { contentAr?: string } }).assistantMessage?.contentAr ?? '',
      );
      assert.match(contentAr, /150/);
      responses.http_open_offer_price = redact({ contentAr: contentAr.slice(0, 240) });
      console.log('pass http بكم هذه؟ 150');
    }

    writeFileSync(join(evidenceDir, 'http_live_responses.json'), JSON.stringify(responses, null, 2));
    console.log('OK rc52-alt-cards-live-http');
  } finally {
    sessions.refreshMarketplaceOfferState = origRefresh;
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
