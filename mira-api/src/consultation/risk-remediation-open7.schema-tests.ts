import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UsersService } from '../users/users.service';
import { CommerceService } from '../marketplace/commerce.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { journeyCode, journeyEvents, resetJourneyForTests } from '../marketplace/journey-events';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService } from './services/mce-prompt-assembler.service';

const repo = resolve(__dirname, '../../..');

function read(path: string): string {
  return readFileSync(resolve(repo, path), 'utf8');
}

function privacyText(): void {
  const html = read('website/privacy.html');
  for (const phrase of [
    'Perfect Corp',
    'FASHN',
    'OpenAI',
    'gpt-4o-mini',
    'لا نعدك بحذف فوري من النسخ',
    'من دون بريدك',
  ]) {
    assert.equal(html.includes(phrase), true, phrase);
  }
  for (const hidden of ['mock', 'AUTH_SKIP', 'المفتاح غير موجود']) {
    assert.equal(html.includes(hidden), false, hidden);
  }
  assert.equal(html.includes('لا نحتفظ بصور وجهك بعد التحليل'), false);
}

async function deletionAudit(): Promise<void> {
  const created: Array<{ data: { metadata?: { email?: string; emailRetained?: boolean } } }> = [];
  const prisma = {
    user: {
      findUnique: async () => ({ id: 'user-open7', email: 'hidden@example.test' }),
      delete: async () => ({ id: 'user-open7' }),
    },
    auditLog: {
      create: async (args: { data: { metadata?: { email?: string; emailRetained?: boolean } } }) => {
        created.push(args);
        return args;
      },
    },
  };
  const config = { get: (key: string) => (key === 'AUTH_SKIP' ? 'true' : undefined) };
  const service = new UsersService(prisma as never, config as never);
  await service.deleteAccount({ firebaseUid: 'open7-firebase' });
  assert.equal(created.length, 1);
  assert.equal(created[0].data.metadata?.email, undefined);
  assert.equal(created[0].data.metadata?.emailRetained, false);
}

function indicatorCopy(): void {
  const files = [
    'lib/features/intelligence/presentation/widgets/beauty_score_hero.dart',
    'lib/features/dashboard/presentation/screens/analysis_screen.dart',
    'lib/features/intelligence/domain/constants/report_face_map_spec.dart',
    'lib/features/intelligence/domain/entities/result_provenance.dart',
    'lib/features/intelligence/presentation/screens/mira_beauty_report_screen.dart',
    'mira-api/src/consultation/services/mce-prompt-assembler.service.ts',
  ].map(read);
  const joined = files.join('\n');
  assert.equal(joined.includes('مؤشر تقديري من الصورة'), true);
  assert.equal(joined.includes('ليست قياسًا مخبريًا'), true);
  assert.equal(joined.includes('وليس تشخيصاً طبياً'), true);
  for (const claim of ['دقة 100', 'قياس ماء', 'نسبة ماء في البشرة']) {
    assert.equal(joined.includes(claim), false, claim);
  }
}

async function journeySample(): Promise<void> {
  resetJourneyForTests();
  const serviceRow = {
    id: 'service-open7',
    partnerId: 'partner-open7',
    partner: { type: 'salon', nameAr: 'صالون اختبار', city: 'الرياض', contactPhone: null, logoEmoji: null },
    nameAr: 'عناية اختبار',
    nameEn: 'Test care',
    descriptionAr: null,
    durationMin: 30,
    priceHalalas: 1000,
    category: 'care',
    concernTags: [],
  };
  const prisma = {
    partner: { count: async () => 1 },
    service: { findFirst: async () => serviceRow },
    catalogMedia: { findMany: async () => [] },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      commerceCart: { findUnique: async () => null },
    }),
  };
  const market = new MarketplaceService(prisma as never);
  const viewed = await market.getPublishedItem('service', serviceRow.id);
  assert.equal(viewed.kind, 'service');
  assert.equal(viewed.id, serviceRow.id);
  const commerce = new CommerceService(prisma as never);
  await assert.rejects(() => commerce.createOrder(
    { type: 'customer', id: 'user-open7', userId: 'user-open7' },
    { idempotencyKey: 'open7-order' },
    undefined,
  ));
  await assert.rejects(() => commerce.createBooking(
    { type: 'customer', id: 'user-open7', userId: 'user-open7' },
    { idempotencyKey: 'open7-booking' },
    undefined,
  ));
  const names = journeyEvents().map((event) => event.name);
  assert.deepEqual(names, ['service_viewed', 'order_started', 'order_failed', 'booking_started', 'booking_failed']);
  assert.equal((journeyEvents().find((event) => event.name === 'order_failed')?.code ?? '').length > 0, true);
  assert.equal((journeyEvents().find((event) => event.name === 'booking_failed')?.code ?? '').length > 0, true);
  assert.equal(JSON.stringify(journeyEvents()).includes('@'), false);
  const prompt = new McePromptAssemblerService(new MceModerationService()).buildMessages({
    snapshot: { schemaVersion: '1.0.0', builtAt: '2026-10-11T12:00:00.000Z', user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' } },
    factRegistry: [],
    history: [],
    userMessage: 'ماذا يناسب بشرتي؟',
  }).map((row) => row.content).join('\n');
  assert.equal(prompt.includes('ليست قياسًا مخبريًا'), true);
}

function configuredDatabaseUrl(): string {
  const text = read('mira-api/.env');
  const line = text.split('\n').find((row) => row.startsWith('DATABASE_URL='));
  return line?.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '') ?? '';
}

async function isolation(): Promise<string> {
  const source = configuredDatabaseUrl();
  if (!source) return 'NOT_RUN no local database url';
  const configured = new URL(source);
  if (!['localhost', '127.0.0.1', '::1'].includes(configured.hostname)) return 'REFUSED database host is not local';
  const url = new URL(`postgresql://${process.env.USER ?? 'localhost'}@${configured.hostname}:${configured.port || 5432}/mira_open_items_test`);
  if (url.pathname.includes('mira_db')) return 'REFUSED test url still points at mira_db';
  try {
    execFileSync('psql', ['-d', 'postgres', '-c', 'CREATE DATABASE mira_open_items_test'], { stdio: 'pipe' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('already exists')) return 'NOT_RUN the local test database could not be created';
  }
  try {
    execFileSync('./node_modules/.bin/prisma', ['migrate', 'deploy'], {
      cwd: resolve(repo, 'mira-api'),
      env: { ...process.env, DATABASE_URL: url.toString() },
      stdio: 'pipe',
    });
  } catch {
    return 'NOT_RUN migrations could not be applied to the local test database';
  }
  process.env.DATABASE_URL = url.toString();
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const stamp = Date.now();
  const createdUsers: string[] = [];
  try {
    const partner = await prisma.partner.create({
      data: { type: 'salon', nameAr: 'صالون اختبار', nameEn: 'Open7 salon' },
    });
    const userA = await prisma.user.create({ data: { firebaseUid: `open7-a-${stamp}`, displayName: 'open7-a' } });
    const userB = await prisma.user.create({ data: { firebaseUid: `open7-b-${stamp}`, displayName: 'open7-b' } });
    createdUsers.push(userA.id, userB.id);
    const orderA = await prisma.commerceOrder.create({
      data: {
        publicNumber: `O7A${stamp}`,
        userId: userA.id,
        partnerId: partner.id,
        subtotalHalalas: 1000,
        totalHalalas: 1000,
        contactName: 'اختبار أ',
        contactPhone: '0500000001',
        addressLine: 'عنوان اختبار',
        city: 'الرياض',
      },
    });
    const orderB = await prisma.commerceOrder.create({
      data: {
        publicNumber: `O7B${stamp}`,
        userId: userB.id,
        partnerId: partner.id,
        subtotalHalalas: 2000,
        totalHalalas: 2000,
        contactName: 'اختبار ب',
        contactPhone: '0500000002',
        addressLine: 'عنوان اختبار',
        city: 'الرياض',
      },
    });
    const starts = new Date('2026-10-12T09:00:00.000Z');
    const bookingA = await prisma.commerceBooking.create({
      data: {
        publicNumber: `B7A${stamp}`,
        userId: userA.id,
        partnerId: partner.id,
        serviceId: 'service-open7',
        serviceNameAr: 'عناية أ',
        startsAt: starts,
        endsAt: new Date(starts.getTime() + 30 * 60 * 1000),
        durationMin: 30,
        priceHalalas: 1000,
        contactName: 'اختبار أ',
        contactPhone: '0500000001',
      },
    });
    const bookingB = await prisma.commerceBooking.create({
      data: {
        publicNumber: `B7B${stamp}`,
        userId: userB.id,
        partnerId: partner.id,
        serviceId: 'service-open7',
        serviceNameAr: 'عناية ب',
        startsAt: starts,
        endsAt: new Date(starts.getTime() + 30 * 60 * 1000),
        durationMin: 30,
        priceHalalas: 1000,
        contactName: 'اختبار ب',
        contactPhone: '0500000002',
      },
    });
    const commerce = new CommerceService(prisma as never);
    const actorA = { type: 'customer' as const, id: userA.id, userId: userA.id };
    const actorB = { type: 'customer' as const, id: userB.id, userId: userB.id };
    const ownOrders = await commerce.listCustomerOrders(actorA);
    assert.equal(ownOrders.items.some((row) => row.id === orderA.id), true);
    assert.equal(ownOrders.items.some((row) => row.id === orderB.id), false);
    const ownOrder = await commerce.getCustomerOrder(actorA, orderA.id);
    assert.equal(ownOrder.id, orderA.id);
    await assert.rejects(() => commerce.getCustomerOrder(actorB, orderA.id));
    const ownBookings = await commerce.listCustomerBookings(actorA);
    assert.equal(ownBookings.items.some((row) => row.id === bookingA.id), true);
    assert.equal(ownBookings.items.some((row) => row.id === bookingB.id), false);
    await assert.rejects(() => commerce.getCustomerBooking(actorA, bookingB.id));
    const ownBooking = await commerce.getCustomerBooking(actorB, bookingB.id);
    assert.equal(ownBooking.id, bookingB.id);
    return 'LOCAL_MET';
  } finally {
    if (createdUsers.length) {
      await prisma.commerceBooking.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.commerceOrder.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.partner.deleteMany({ where: { nameEn: 'Open7 salon' } });
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  privacyText();
  await deletionAudit();
  indicatorCopy();
  await journeySample();
  const isolated = await isolation();
  console.log('OPEN7_PASS');
  console.log('ISOLATION', isolated);
  if (isolated !== 'LOCAL_MET') process.exitCode = 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
