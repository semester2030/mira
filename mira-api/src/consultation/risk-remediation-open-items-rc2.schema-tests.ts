import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { CommerceService } from '../marketplace/commerce.service';
import { localInstant, localParts } from '../marketplace/commerce.types';
import { recordJourney, resetJourneyForTests, storedJourneyEvents } from '../marketplace/journey-events';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { PrismaService } from '../prisma/prisma.service';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService } from './services/mce-prompt-assembler.service';

const repo = resolve(__dirname, '../../..');
const phone = '0500000099';

function read(path: string): string {
  return readFileSync(resolve(repo, path), 'utf8');
}

function promptUsesPresentFacts(): void {
  const prompt = new McePromptAssemblerService(new MceModerationService()).buildMessages({
    snapshot: {
      schemaVersion: '1.0.0',
      builtAt: '2026-10-11T12:00:00.000Z',
      user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' },
      skin: {
        analysisId: 'synthetic',
        beautyScore: null,
        overallScoreAvailable: false,
        skinTypeAr: 'جافة',
        headlineAr: 'تقرير مصطنع',
        summaryAdviceAr: 'ترطيب.',
        mainConcerns: [],
        tipsAr: [],
        routineMorningAr: [],
        routineEveningAr: [],
        concernScores: [],
        disclaimerAr: 'نصيحة عناية.',
        isMinor: false,
        reportCreatedAt: '2024-01-15T08:00:00.000Z',
      },
    } as never,
    factRegistry: [{ id: 'skin.moisture', labelAr: 'الترطيب', valueAr: '40', confidence: 'high' }],
    history: [{ role: 'user', content: 'أستخدم حمضًا في المساء' }],
    userMessage: 'تقريري قديم',
  }).map((row) => row.content).join('\n');
  assert.equal(prompt.includes('لا تقولي إن البيانات غير متوفرة ما دامت هذه الحقائق موجودة'), true);
  assert.equal(prompt.includes('سؤال إعادة تحليل الصورة لا يعني أن التقرير غائب'), true);
  assert.equal(prompt.includes('تاريخ التقرير: 2024-01-15T08:00:00.000Z'), true);
  assert.equal(prompt.includes('الترطيب = 40'), true);
  assert.equal(prompt.includes('أستخدم حمضًا في المساء'), true);
}

function privacyPage(): void {
  const html = read('website/privacy.html');
  for (const phrase of ['Perfect Corp', 'FASHN', 'OpenAI', 'gpt-4o-mini', 'لا نعدك بحذف فوري من النسخ', 'من دون بريدك', '11 أكتوبر 2026']) {
    assert.equal(html.includes(phrase), true, phrase);
  }
  for (const hidden of ['mock', 'AUTH_SKIP', 'المفتاح غير موجود', 'perfect_corp']) {
    assert.equal(html.includes(hidden), false, hidden);
  }
}

async function measurementDoesNotThrow(): Promise<void> {
  const store = {
    journeyEvent: {
      create: async () => { throw new Error('measurement down'); },
      findMany: async () => [],
      deleteMany: async () => undefined,
      count: async () => 0,
    },
  };
  await assert.doesNotReject(() => recordJourney({ name: 'order_failed', kind: 'order', code: 'probe' }, store));
}

function configuredDatabaseUrl(): string {
  const line = read('mira-api/.env').split('\n').find((row) => row.startsWith('DATABASE_URL='));
  return line?.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '') ?? '';
}

async function journeyAndIsolation(): Promise<void> {
  const source = configuredDatabaseUrl();
  if (!source) throw new Error('NOT_RUN no local database url');
  const configured = new URL(source);
  if (!['localhost', '127.0.0.1', '::1'].includes(configured.hostname)) throw new Error('REFUSED database host is not local');
  const url = new URL(`postgresql://${process.env.USER ?? 'localhost'}@${configured.hostname}:${configured.port || 5432}/mira_open_items_test`);
  if (url.pathname.includes('mira_db')) throw new Error('REFUSED test url still points at mira_db');
  process.env.DATABASE_URL = url.toString();
  resetJourneyForTests();

  const prisma = new PrismaClient();
  await prisma.journeyEvent.deleteMany();
  const commerce = new CommerceService(prisma as unknown as PrismaService);
  const market = new MarketplaceService(prisma as never);
  const stamp = `rc2${Date.now().toString(36)}`;
  const userIds: string[] = [];
  const partnerIds: string[] = [];
  try {
    const alice = await commerce.customerActor({ firebaseUid: `${stamp}-alice`, email: `${stamp}-a@example.test`, name: 'alice' });
    const bob = await commerce.customerActor({ firebaseUid: `${stamp}-bob`, email: `${stamp}-b@example.test`, name: 'bob' });
    userIds.push(alice.userId, bob.userId);
    const partner = await prisma.partner.create({
      data: { type: 'salon', nameAr: 'جهة اختبار', nameEn: `${stamp}-salon`, city: 'الرياض' },
    });
    partnerIds.push(partner.id);
    const week = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 600, endMin: 840, capacity: 1 }));
    const service = await prisma.service.create({
      data: {
        partnerId: partner.id,
        nameAr: 'جلسة اختبار',
        nameEn: `${stamp}-svc`,
        durationMin: 60,
        priceHalalas: 25000,
        concernTags: [],
        bookingEnabled: true,
        availabilityJson: week,
      },
    });
    const product = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'منتج اختبار',
        nameEn: `${stamp}-product`,
        priceHalalas: 5000,
        externalUrl: 'https://example.test/p',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        deliveryFeeHalalas: 1500,
      },
    });

    const viewed = await market.getPublishedItem('service', service.id);
    assert.equal(viewed.id, service.id);

    await assert.rejects(() => commerce.createOrder(alice, { idempotencyKey: `${stamp}-fail` }));
    await commerce.addCartItem(alice, { productId: product.id, quantity: 1 });
    const quote = await commerce.quote(alice);
    assert.equal(typeof quote.confirmationFingerprint, 'string');
    const placed = await commerce.createOrder(alice, {
      idempotencyKey: `${stamp}-ok`,
      contactName: 'مستخدمة اختبار',
      contactPhone: phone,
      addressLine: 'شارع الاختبار',
      city: 'الرياض',
      confirmationFingerprint: quote.confirmationFingerprint,
    });
    assert.equal(typeof placed.order.id, 'string');

    await assert.rejects(() => commerce.createBooking(alice, { idempotencyKey: `${stamp}-book-fail` }));
    const day = localParts(new Date(Date.now() + 5 * 86_400_000)).dateKey;
    const startsAt = localInstant(day, 600)!.toISOString();
    const booked = await commerce.createBooking(alice, {
      serviceId: service.id,
      startsAt,
      contactName: 'مستخدمة اختبار',
      contactPhone: phone,
      idempotencyKey: `${stamp}-book-ok`,
    });
    assert.equal(typeof booked.booking.id, 'string');

    const names = (await storedJourneyEvents(prisma)).map((event) => event.name);
    assert.deepEqual(names, [
      'service_viewed',
      'order_started',
      'order_failed',
      'order_started',
      'order_completed',
      'booking_started',
      'booking_failed',
      'booking_started',
      'booking_completed',
    ]);
    const stored = JSON.stringify(await storedJourneyEvents(prisma));
    assert.equal(stored.includes(phone), false);
    assert.equal(stored.includes('@'), false);
    assert.equal(stored.includes(alice.userId), false);

    const reread = execFileSync('./node_modules/.bin/tsx', ['-e', `
      import { PrismaClient } from '@prisma/client';
      async function main() {
        const prisma = new PrismaClient();
        const rows = await prisma.journeyEvent.findMany({ orderBy: { createdAt: 'asc' } });
        console.log(rows.map((row) => row.name).join(','));
        await prisma.$disconnect();
      }
      void main();
    `], {
      cwd: resolve(repo, 'mira-api'),
      env: process.env,
      encoding: 'utf8',
    }).trim();
    assert.equal(reread, names.join(','));

    const own = await commerce.listCustomerOrders(alice);
    const other = await commerce.listCustomerOrders(bob);
    assert.equal(own.items.some((row) => row.id === placed.order.id), true);
    assert.equal(other.items.some((row) => row.id === placed.order.id), false);
    await assert.rejects(() => commerce.getCustomerOrder(bob, placed.order.id));
    await assert.rejects(() => commerce.getCustomerBooking(bob, booked.booking.id));
    const ownBookings = await commerce.listCustomerBookings(alice);
    assert.equal(ownBookings.items.some((row) => row.id === booked.booking.id), true);
  } finally {
    await prisma.commerceOrder.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
    await prisma.commerceBooking.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
    await prisma.commerceCart.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    await prisma.journeyEvent.deleteMany().catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  privacyPage();
  promptUsesPresentFacts();
  await measurementDoesNotThrow();
  await journeyAndIsolation();
  console.log('OPEN_ITEMS_RC2_PASS');
}

void main();
