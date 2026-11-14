/**
 * Close staff roles + booking detail + booking isolation + attention UI.
 * DATABASE_URL local *test* only.
 *
 *   MIRA_ADMIN_STAFF=ops.support:support:supportSecret,ops.sara:supervisor:superSecret \
 *   DATABASE_URL=…/mira_sbws_proof_test npx tsx src/marketplace/ops-tracking.staff-closure.ts
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { Controller, Get, INestApplication, Module, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { chromium, type Page } from 'playwright';
import { FirebaseIdTokenVerifier } from '../common/auth/firebase-id-token-verifier';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogContentService } from './catalog-content.service';
import { CatalogMediaController } from './catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from './catalog-media.storage';
import { CatalogReviewAdminController } from './catalog-review.admin.controller';
import { CommerceAdminController } from './commerce.admin.controller';
import { CommerceController } from './commerce.controller';
import { CommercePartnerController } from './commerce-partner.controller';
import { CommerceService } from './commerce.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { TaxonomyService } from './taxonomy/taxonomy.service';
import { BulkBatchesService } from '../partners-portal/bulk-batches/bulk-batches.service';
import { EditorDraftsService } from '../partners-portal/editor-drafts/editor-drafts.service';
import { ServiceProfileService } from '../partners-portal/editor-drafts/service-profile.service';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { PartnerActivitiesCatalog } from '../partners-portal/partner-activities/partner-activities.catalog';
import { PartnerActivitiesService } from '../partners-portal/partner-activities/partner-activities.service';
import { PartnersPortalController } from '../partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { hashPartnerPassword } from '../partners-portal/partner-password';
import { RegistryService } from '../partners-portal/registry/registry.service';
import { VariantInventoryService } from '../partners-portal/variant-inventory.service';
import { localInstant } from './commerce.types';

type Class = 'ثبت من الواجهة' | 'ثبت من الخادم فقط' | 'فشل' | 'لم يُختبر';
type Row = { step: string; actor: string; classification: Class; actual: string; ok: boolean; evidence: string };

const run = `staff${Date.now().toString(36)}`;
const MASTER_KEY = 'ops-staff-master-key';
const SUPPORT_SECRET = 'supportSecret';
const SUPER_SECRET = 'superSecret';
const SUPPORT_ID = 'ops.support';
const SUPER_ID = 'ops.sara';
const MIRA_EMAIL = `mira-staff-${run}@test.local`;
const MIRA_PASS = 'MiraStaff#9';
const OTHER_EMAIL = `other-staff-${run}@test.local`;
const OTHER_PASS = 'OtherStaff#9';
const ADMIN_PORT = Number(process.env.OPS_STAFF_ADMIN_PORT || 18796);
const PARTNER_PORT = Number(process.env.OPS_STAFF_PARTNER_PORT || 18795);
const rows: Row[] = [];
const outDir = resolve(process.cwd(), '../docs/mira-commerce-reference/evidence/ops-tracking/staff');
mkdirSync(outDir, { recursive: true });

function note(r: Row) {
  rows.push(r);
  console.log(`[${r.ok ? 'PASS' : 'FAIL'}][${r.classification}] ${r.step} — ${r.actual}`);
}

function mime(p: string) {
  return (
    ({
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
    } as Record<string, string>)[extname(p)] || 'application/octet-stream'
  );
}

function staticServer(root: string, port: number): Promise<{ close: () => Promise<void>; origin: string }> {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(root, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': mime(file) });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolveP) => {
    server.listen(port, '127.0.0.1', () =>
      resolveP({ origin: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) }),
    );
  });
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
}

@Controller('admin')
@UseGuards(AdminApiKeyGuard)
class AdminLoginStatsStubController {
  @Get('stats/overview')
  overview() {
    return {
      generatedAt: new Date().toISOString(),
      users: { total: 2, newToday: 0, newThisWeek: 0 },
      analyses: { skinToday: 0, outfitToday: 0, recommendationsToday: 0, totalToday: 0 },
      subscriptions: { enabled: false, premiumActive: 0, freeActive: 2 },
      partners: { total: 2, active: 2, suspended: 0, pendingApplications: 0, eventsThisWeek: 0 },
      feedback: { total: 0, needsAttention: 0 },
      leads: { total: 0 },
      auditEventsToday: 0,
    };
  }
  @Get('stats/analyses-trend')
  trend() {
    return { series: [] };
  }
  @Get('stats/audit-actions')
  actions() {
    return [];
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [
    PartnersPortalController,
    CatalogMediaController,
    CatalogReviewAdminController,
    MarketplaceController,
    CommerceController,
    CommercePartnerController,
    CommerceAdminController,
    AdminLoginStatsStubController,
  ],
  providers: [
    PartnersPortalService,
    PartnerActivitiesCatalog,
    {
      provide: PartnerActivitiesService,
      useValue: {
        profile: async () => ({ grants: [], requests: [] }),
        catalogItems: () => [],
        hasGrants: async () => false,
        resolveWriteActivity: () => null,
        assertAuthorizedWrite: async () => ({ ok: true }),
      },
    },
    PartnerTokenGuard,
    AdminApiKeyGuard,
    FirebaseAuthGuard,
    CatalogContentService,
    RegistryService,
    EditorDraftsService,
    BulkBatchesService,
    ServiceProfileService,
    VariantInventoryService,
    TaxonomyService,
    CommerceService,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService, tax: TaxonomyService) => new MarketplaceService(prisma, tax),
      inject: [PrismaService, TaxonomyService],
    },
    {
      provide: FirebaseIdTokenVerifier,
      useValue: {
        verify: async (token: string) => {
          if (token === 'cust-b') return { uid: 'staff-cust-b', email: 'b@staff.local', name: 'B' };
          return { uid: 'staff-cust-a', email: 'a@staff.local', name: 'A' };
        },
      },
    },
  ],
})
class StaffClosureModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local test DB required');
    process.exit(1);
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName || dbName === 'mira_db' || !/test/i.test(dbName)) {
    console.error(`REFUSE: *test* DB required, got "${dbName}"`);
    process.exit(1);
  }

  process.env.ADMIN_API_KEY = MASTER_KEY;
  process.env.MIRA_ADMIN_STAFF = `${SUPPORT_ID}:support:${SUPPORT_SECRET},${SUPER_ID}:supervisor:${SUPER_SECRET}`;
  process.env.AUTH_SKIP = 'false';
  process.env.MIRA_OPS_ORDER_ACCEPT_HOURS = '0';
  process.env.MIRA_OPS_COLLECT_HOURS = '0';
  process.env.MIRA_OPS_BOOKING_REPLY_HOURS = '168';
  process.env.NODE_ENV = 'development';

  const prisma = new PrismaClient();
  const partnerIds: string[] = [];
  let adminStatic: { close: () => Promise<void>; origin: string } | null = null;
  let partnerStatic: { close: () => Promise<void>; origin: string } | null = null;
  let app: INestApplication | null = null;
  const partnersRoot = existsSync(resolve(process.cwd(), '../partners-portal/web/dashboard.html'))
    ? resolve(process.cwd(), '../partners-portal/web')
    : resolve('/Users/fayez/Desktop/mira/partners-portal/web');
  const adminRoot = existsSync(resolve(process.cwd(), '../admin-portal/web/index.html'))
    ? resolve(process.cwd(), '../admin-portal/web')
    : resolve('/Users/fayez/Desktop/mira/admin-portal/web');

  try {
    const mira = await prisma.partner.create({
      data: {
        type: 'developer',
        nameAr: 'ميرا',
        nameEn: `${run}-mira`,
        storeUrl: null,
        canSellProducts: true,
        city: 'الرياض',
        status: 'active',
      },
    });
    partnerIds.push(mira.id);
    await prisma.partnerUser.create({
      data: {
        partnerId: mira.id,
        email: MIRA_EMAIL,
        accessToken: `${run}-mira`,
        passwordHash: await hashPartnerPassword(MIRA_PASS),
      },
    });
    const other = await prisma.partner.create({
      data: {
        type: 'brand',
        nameAr: 'شريك آخر',
        nameEn: `${run}-other`,
        storeUrl: null,
        canSellProducts: true,
        city: 'جدة',
        status: 'active',
      },
    });
    partnerIds.push(other.id);
    await prisma.partnerUser.create({
      data: {
        partnerId: other.id,
        email: OTHER_EMAIL,
        accessToken: `${run}-other`,
        passwordHash: await hashPartnerPassword(OTHER_PASS),
      },
    });

    const product = await prisma.product.create({
      data: {
        partnerId: mira.id,
        nameAr: 'منتج صلاحيات ميرا',
        nameEn: `${run}-p`,
        priceHalalas: 8000,
        deliveryFeeHalalas: 1000,
        externalUrl: '',
        category: 'clothes',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        contentStatus: 'published',
        active: true,
      },
    });
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 600, endMin: 900, capacity: 1 }));
    const service = await prisma.service.create({
      data: {
        partnerId: mira.id,
        nameAr: 'خدمة صلاحيات ميرا',
        nameEn: `${run}-s`,
        durationMin: 60,
        priceHalalas: 15000,
        concernTags: [],
        bookingEnabled: true,
        payMode: 'pay_at_venue',
        availabilityJson: allWeek,
        contentStatus: 'published',
        active: true,
      },
    });

    app = await NestFactory.create(StaffClosureModule, { logger: ['error'] });
    app.setGlobalPrefix('api/v1');
    app.enableCors({ origin: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const port = (app.getHttpServer().address() as { port: number }).port;
    const apiBase = `http://127.0.0.1:${port}/api/v1`;

    const authA = { Authorization: 'Bearer cust-a', 'content-type': 'application/json' };
    const authB = { Authorization: 'Bearer cust-b', 'content-type': 'application/json' };
    const supportH = { 'X-Admin-Key': SUPPORT_SECRET, 'content-type': 'application/json' };
    const superH = { 'X-Admin-Key': SUPER_SECRET, 'content-type': 'application/json' };

    await fetch(`${apiBase}/marketplace/commerce/cart`, { method: 'POST', headers: authA });
    assert.equal(
      (
        await fetch(`${apiBase}/marketplace/commerce/cart/items`, {
          method: 'POST',
          headers: authA,
          body: JSON.stringify({ productId: product.id, quantity: 1 }),
        })
      ).status,
      201,
    );
    const quote = await (await fetch(`${apiBase}/marketplace/commerce/checkout/quote`, { method: 'POST', headers: authA })).json();
    const orderJson = await (
      await fetch(`${apiBase}/marketplace/commerce/orders`, {
        method: 'POST',
        headers: { ...authA, 'idempotency-key': `${run}-o` },
        body: JSON.stringify({
          contactName: 'عميلة أ',
          contactPhone: '0501111111',
          addressLine: 'حي الاختبار',
          city: 'الرياض',
          confirmationFingerprint: quote.confirmationFingerprint,
        }),
      })
    ).json();
    const orderPublic = orderJson.order.publicNumber as string;
    const orderId = orderJson.order.id as string;
    await prisma.commerceOrder.update({ where: { id: orderId }, data: { createdAt: new Date(Date.now() - 120_000) } });

    const day = new Date();
    const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const bookJson = await (
      await fetch(`${apiBase}/marketplace/commerce/bookings`, {
        method: 'POST',
        headers: { ...authA, 'idempotency-key': `${run}-b` },
        body: JSON.stringify({
          serviceId: service.id,
          startsAt: localInstant(dateKey, 660)!.toISOString(),
          contactName: 'عميلة أ',
          contactPhone: '0501111111',
        }),
      })
    ).json();
    const bookingPublic = bookJson.booking.publicNumber as string;
    const bookingId = bookJson.booking.id as string;

    // Booking isolation
    const bkA = await fetch(`${apiBase}/marketplace/commerce/bookings/${encodeURIComponent(bookingPublic)}`, { headers: authA });
    const bkB = await fetch(`${apiBase}/marketplace/commerce/bookings/${encodeURIComponent(bookingPublic)}`, { headers: authB });
    note({
      step: 'عزل رقم الحجز: المالكة 200 · عميلة أخرى 404',
      actor: 'customer API',
      classification: 'ثبت من الخادم فقط',
      actual: `A=${bkA.status} B=${bkB.status} ref=${bookingPublic}`,
      ok: bkA.status === 200 && bkB.status === 404,
      evidence: bookingPublic,
    });

    const supportSession = await (await fetch(`${apiBase}/admin/commerce/session`, { headers: supportH })).json();
    assert.equal(supportSession.role, 'support');
    assert.equal(supportSession.canMutate, false);
    assert.equal(supportSession.actorId, SUPPORT_ID);

    const supportGet = await fetch(`${apiBase}/admin/commerce/orders/${orderPublic}`, { headers: supportH });
    assert.equal(supportGet.status, 200);
    const supportMutate = await fetch(`${apiBase}/admin/commerce/orders/${orderPublic}/transition`, {
      method: 'POST',
      headers: supportH,
      body: JSON.stringify({ fulfillmentStatus: 'accepted', note: 'محاولة دعم' }),
    });
    assert.equal(supportMutate.status, 403);
    note({
      step: 'دعم يقرأ الطلب ويُرفض تعديله (403 ADMIN_READ_ONLY)',
      actor: 'ops.support API',
      classification: 'ثبت من الخادم فقط',
      actual: `get=${supportGet.status} mutate=${supportMutate.status} actor=${supportSession.actorId}`,
      ok: true,
      evidence: orderPublic,
    });

    // Spoof attempt: support secret + fake actor header must still be ops.support
    const spoof = await (
      await fetch(`${apiBase}/admin/commerce/session`, {
        headers: { 'X-Admin-Key': SUPPORT_SECRET, 'X-Admin-Actor': 'ops.sara' },
      })
    ).json();
    note({
      step: 'سر الدعم يثبت الهوية ولا يُزوَّر عبر X-Admin-Actor',
      actor: 'guard',
      classification: 'ثبت من الخادم فقط',
      actual: `actor=${spoof.actorId} role=${spoof.role}`,
      ok: spoof.actorId === SUPPORT_ID && spoof.role === 'support',
      evidence: 'session',
    });

    const attention = await (await fetch(`${apiBase}/admin/commerce/attention`, { headers: supportH })).json();
    const attnHit = (attention.items || []).some((i: { publicNumber: string }) => i.publicNumber === orderPublic);
    note({
      step: 'دعم يرى «يحتاج تدخل» لنفس الطلب المتأخر',
      actor: 'ops.support API',
      classification: 'ثبت من الخادم فقط',
      actual: `hit=${attnHit}`,
      ok: attnHit,
      evidence: 'attention',
    });

    adminStatic = await staticServer(adminRoot, ADMIN_PORT);
    partnerStatic = await staticServer(partnersRoot, PARTNER_PORT);
    const browser = await chromium.launch({ headless: true });
    const supportCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
    const superCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
    const otherCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });

    // Support UI: open order, no mutate buttons
    const supportPage = await supportCtx.newPage();
    await supportPage.goto(`${adminStatic.origin}/index.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'domcontentloaded',
    });
    await supportPage.locator('#adminKey').fill(SUPPORT_SECRET);
    await supportPage.locator('#loginBtn').click();
    await supportPage.locator('#appShell:not(.hidden)').waitFor({ state: 'visible', timeout: 10_000 });
    await shot(supportPage, '01_support_session');
    await supportPage.locator('[data-view="orders"]').click().catch(() => undefined);
    await supportPage.waitForTimeout(800);
    await supportPage.locator('#viewRoot input').first().fill(orderPublic);
    await supportPage.getByRole('button', { name: 'تطبيق' }).click();
    await supportPage.waitForTimeout(1000);
    await supportPage.locator('#viewRoot button', { hasText: 'تفاصيل' }).first().click({ timeout: 8000 });
    await supportPage.waitForTimeout(1000);
    await shot(supportPage, '02_support_order_readonly');
    const supportHtml = await supportPage.content();
    const supportSees = supportHtml.includes(orderPublic) && /قراءة فقط|متابعة وقراءة/.test(supportHtml);
    const supportHasCollect = /تسجيل التحصيل/.test(supportHtml);
    note({
      step: 'واجهة الدعم: تفتح الطلب ولا تعرض أزرار التعديل/التحصيل',
      actor: 'support UI',
      classification: supportSees && !supportHasCollect ? 'ثبت من الواجهة' : 'فشل',
      actual: `sees=${supportSees} collectBtn=${supportHasCollect}`,
      ok: supportSees && !supportHasCollect,
      evidence: 'staff/02_support_order_readonly.png',
    });

    // Supervisor UI: intervene on SAME mira order with reason
    const superPage = await superCtx.newPage();
    await superPage.goto(`${adminStatic.origin}/index.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'domcontentloaded',
    });
    await superPage.locator('#adminKey').fill(SUPER_SECRET);
    await superPage.locator('#loginBtn').click();
    await superPage.locator('#appShell:not(.hidden)').waitFor({ state: 'visible', timeout: 10_000 });
    await shot(superPage, '03_supervisor_session');
    await superPage.locator('[data-view="orders"]').click().catch(() => undefined);
    await superPage.waitForTimeout(600);
    await superPage.locator('#viewRoot input').first().fill(orderPublic);
    await superPage.getByRole('button', { name: 'تطبيق' }).click();
    await superPage.waitForTimeout(1000);
    await superPage.locator('#viewRoot button', { hasText: 'تفاصيل' }).first().click({ timeout: 8000 });
    await superPage.waitForTimeout(800);
    superPage.once('dialog', async (d) => {
      await d.accept('قبول مشرف موثّق على طلب ميرا');
    });
    await superPage.getByRole('button', { name: 'قبول' }).click();
    await superPage.waitForTimeout(1500);
    await shot(superPage, '04_supervisor_after_accept_same_order');
    const after = await (await fetch(`${apiBase}/admin/commerce/orders/${orderPublic}`, { headers: superH })).json();
    const superEvent = (after.events || []).find(
      (e: { actorId?: string; toStatus?: string; note?: string }) =>
        e.actorId === SUPER_ID && e.toStatus === 'accepted',
    );
    note({
      step: 'مشرف موثّق يقبل نفس طلب ميرا ويظهر اسمه وسببه في السجل',
      actor: 'ops.sara UI+API',
      classification: superEvent && after.fulfillmentStatus === 'accepted' ? 'ثبت من الواجهة' : 'فشل',
      actual: `status=${after.fulfillmentStatus} actor=${superEvent?.actorId} note=${superEvent?.note} display=${superEvent?.actorDisplayAr}`,
      ok: Boolean(superEvent) && after.fulfillmentStatus === 'accepted',
      evidence: 'staff/04_supervisor_after_accept_same_order.png',
    });

    const attention2 = await (await fetch(`${apiBase}/admin/commerce/attention`, { headers: supportH })).json();
    const still = (attention2.items || []).some(
      (i: { publicNumber: string; reasonCode: string }) => i.publicNumber === orderPublic && i.reasonCode === 'ORDER_ACCEPT_OVERDUE',
    );
    note({
      step: 'بعد قبول المشرف يختفي تنبيه مهلة القبول لنفس الرقم',
      actor: 'attention API',
      classification: !still ? 'ثبت من الخادم فقط' : 'فشل',
      actual: `still=${still}`,
      ok: !still,
      evidence: orderPublic,
    });

    // Booking detail from admin search
    await superPage.getByRole('button', { name: 'الحجوزات' }).click();
    await superPage.waitForTimeout(600);
    await superPage.locator('#viewRoot input').first().fill(bookingPublic);
    await superPage.getByRole('button', { name: 'تطبيق' }).click();
    await superPage.waitForTimeout(1000);
    await superPage.locator('#viewRoot button', { hasText: 'تفاصيل' }).first().click({ timeout: 8000 });
    await superPage.waitForTimeout(1000);
    await shot(superPage, '05_booking_detail');
    const bkHtml = await superPage.content();
    const bkDetailOk =
      bkHtml.includes(bookingPublic) &&
      /ميرا/.test(bkHtml) &&
      /الخط الزمني/.test(bkHtml) &&
      /الخطوة التالية|بانتظار/.test(bkHtml);
    note({
      step: 'الإدارة تفتح تفاصيل الحجز بالرقم مع المقدّم والخطوة والتسلسل',
      actor: 'supervisor UI',
      classification: bkDetailOk ? 'ثبت من الواجهة' : 'فشل',
      actual: `ref=${bookingPublic} ok=${bkDetailOk}`,
      ok: bkDetailOk,
      evidence: 'staff/05_booking_detail.png',
    });

    // Other partner cannot see booking by number
    const otherPage = await otherCtx.newPage();
    await otherPage.goto(`${partnerStatic.origin}/login.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'domcontentloaded',
    });
    await otherPage.locator('input[name="email"]').fill(OTHER_EMAIL);
    await otherPage.locator('input[name="password"]').fill(OTHER_PASS);
    await otherPage.getByRole('button', { name: 'دخول' }).click();
    await otherPage.waitForURL(/dashboard\.html/, { timeout: 15_000 });
    await otherPage.locator('#commerceTabBookings').click();
    await otherPage.locator('#commerceSearch').fill(bookingPublic);
    await otherPage.locator('#commerceSearchBtn').click();
    await otherPage.waitForTimeout(1200);
    await shot(otherPage, '06_other_partner_booking_search');
    const otherSees = (await otherPage.content()).includes(bookingPublic);
    note({
      step: 'شريك آخر يبحث برقم حجز ميرا ولا يراه',
      actor: 'other partner UI',
      classification: !otherSees ? 'ثبت من الواجهة' : 'فشل',
      actual: `sees=${otherSees}`,
      ok: !otherSees,
      evidence: 'staff/06_other_partner_booking_search.png',
    });

    note({
      step: 'Flutter من فيديو → نسخ الرقم',
      actor: 'iOS',
      classification: 'لم يُختبر',
      actual: 'ما زال مانع OTP/Firebase على المحاكي؛ الكود جاهز للنسخ والخطوة التالية',
      ok: false,
      evidence: 'order_detail_screen',
    });

    await browser.close();

    const report = {
      run,
      database: dbName,
      refs: { orderPublic, bookingPublic, orderId, bookingId },
      staff: { support: SUPPORT_ID, supervisor: SUPER_ID },
      rows,
    };
    writeFileSync(resolve(outDir, '../STAFF_CLOSURE.json'), JSON.stringify(report, null, 2));
    writeFileSync(
      resolve(outDir, '../STAFF_CLOSURE.md'),
      [
        '# Staff + booking detail closure',
        '',
        `| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |`,
        `|---|---|---|---|---|`,
        ...rows.map((r) => `| ${r.step} | ${r.actor} | ${r.classification} | ${r.actual.replace(/\|/g, '/')} | ${r.evidence} |`),
        '',
      ].join('\n'),
    );
    console.log('staff closure done', report.refs);
  } finally {
    try {
      if (partnerIds.length) {
        await prisma.commerceOrderEvent.deleteMany({ where: { order: { partnerId: { in: partnerIds } } } }).catch(() => undefined);
        await prisma.commerceBookingEvent.deleteMany({ where: { booking: { partnerId: { in: partnerIds } } } }).catch(() => undefined);
        await prisma.commerceOrder.deleteMany({ where: { partnerId: { in: partnerIds } } });
        await prisma.commerceBooking.deleteMany({ where: { partnerId: { in: partnerIds } } });
        await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
      }
      await prisma.user.deleteMany({ where: { firebaseUid: { in: ['staff-cust-a', 'staff-cust-b'] } } }).catch(() => undefined);
    } catch (e) {
      console.warn('cleanup', e);
    }
    await prisma.$disconnect();
    if (adminStatic) await adminStatic.close();
    if (partnerStatic) await partnerStatic.close();
    if (app) await app.close();
  }

  if (rows.some((r) => (r.classification === 'ثبت من الواجهة' || r.classification === 'ثبت من الخادم فقط') && !r.ok)) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
