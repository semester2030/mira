/**
 * Ops tracking proof: public numbers, scopes, attention queue, admin actor attribution, portal UI.
 * DATABASE_URL must be local *test* DB. Does not touch production.
 *
 * Run:
 *   DATABASE_URL=postgresql://…/mira_sbws_proof_test \
 *   MIRA_OPS_ORDER_ACCEPT_HOURS=0 MIRA_OPS_COLLECT_HOURS=0 MIRA_OPS_BOOKING_REPLY_HOURS=168 \
 *   npx tsx src/marketplace/ops-tracking.ui.proof.ts
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

const run = `ops${Date.now().toString(36)}`;
const ADMIN_KEY = 'ops-tracking-admin-key';
const STAFF_ID = 'ops.sara';
const MIRA_EMAIL = `mira-ops-${run}@test.local`;
const MIRA_PASS = 'MiraOps#Test9';
const OTHER_EMAIL = `other-ops-${run}@test.local`;
const OTHER_PASS = 'OtherOps#Test9';
const PARTNER_PORT = Number(process.env.OPS_UI_PARTNER_PORT || 18785);
const ADMIN_PORT = Number(process.env.OPS_UI_ADMIN_PORT || 18786);
const rows: Row[] = [];
const outDir = resolve(process.cwd(), '../docs/mira-commerce-reference/evidence/ops-tracking');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'ui'), { recursive: true });

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
  await page.screenshot({ path: join(outDir, 'ui', `${name}.png`), fullPage: true });
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
          if (token === 'cust-b') return { uid: 'ops-cust-b', email: 'b@ops.local', name: 'B' };
          return { uid: 'ops-cust-a', email: 'a@ops.local', name: 'A' };
        },
      },
    },
  ],
})
class OpsTrackingModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  let dbName = '';
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    dbName = '';
  }
  if (!dbName || dbName === 'mira_db' || !/test/i.test(dbName)) {
    console.error(`REFUSE: dedicated *test* DB required, got "${dbName}"`);
    process.exit(1);
  }

  process.env.ADMIN_API_KEY = ADMIN_KEY;
  // Multi-customer scope tests need real Bearer → Firebase verifier (not AUTH_SKIP).
  process.env.AUTH_SKIP = 'false';
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.NODE_ENV = 'development';
  process.env.MIRA_OPS_ORDER_ACCEPT_HOURS = process.env.MIRA_OPS_ORDER_ACCEPT_HOURS || '0';
  process.env.MIRA_OPS_COLLECT_HOURS = process.env.MIRA_OPS_COLLECT_HOURS || '0';
  process.env.MIRA_OPS_BOOKING_REPLY_HOURS = process.env.MIRA_OPS_BOOKING_REPLY_HOURS || '168';

  const prisma = new PrismaClient();
  const partnerIds: string[] = [];
  let partnerStatic: { close: () => Promise<void>; origin: string } | null = null;
  let adminStatic: { close: () => Promise<void>; origin: string } | null = null;
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
        accessToken: `${run}-mira-tok`,
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
        accessToken: `${run}-other-tok`,
        passwordHash: await hashPartnerPassword(OTHER_PASS),
      },
    });

    const product = await prisma.product.create({
      data: {
        partnerId: mira.id,
        nameAr: 'منتج متابعة ميرا',
        nameEn: `${run}-prod`,
        priceHalalas: 5000,
        externalUrl: '',
        category: 'clothes',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        deliveryFeeHalalas: 1000,
        contentStatus: 'published',
        active: true,
      },
    });
    const otherProduct = await prisma.product.create({
      data: {
        partnerId: other.id,
        nameAr: 'منتج شريك آخر',
        nameEn: `${run}-other-prod`,
        priceHalalas: 3000,
        externalUrl: '',
        category: 'clothes',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        deliveryFeeHalalas: 500,
        contentStatus: 'published',
        active: true,
      },
    });
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 600, endMin: 900, capacity: 1 }));
    const service = await prisma.service.create({
      data: {
        partnerId: mira.id,
        nameAr: 'خدمة متابعة ميرا',
        nameEn: `${run}-svc`,
        durationMin: 60,
        priceHalalas: 12000,
        concernTags: [],
        bookingEnabled: true,
        payMode: 'pay_at_venue',
        availabilityJson: allWeek,
        contentStatus: 'published',
        active: true,
      },
    });

    app = await NestFactory.create(OpsTrackingModule, { logger: ['error'] });
    app.setGlobalPrefix('api/v1');
    app.enableCors({ origin: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const port = (app.getHttpServer().address() as { port: number }).port;
    const apiBase = `http://127.0.0.1:${port}/api/v1`;

    const authA = { Authorization: 'Bearer cust-a', 'content-type': 'application/json' };
    const authB = { Authorization: 'Bearer cust-b', 'content-type': 'application/json' };
    const adminH = { 'X-Admin-Key': ADMIN_KEY, 'X-Admin-Actor': STAFF_ID, 'content-type': 'application/json' };

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
    const idem = `${run}-ord`;
    const orderBody = {
      contactName: 'عميلة أ',
      contactPhone: '0501111111',
      addressLine: 'حي الاختبار',
      city: 'الرياض',
      confirmationFingerprint: quote.confirmationFingerprint,
    };
    const o1 = await (
      await fetch(`${apiBase}/marketplace/commerce/orders`, {
        method: 'POST',
        headers: { ...authA, 'idempotency-key': idem },
        body: JSON.stringify(orderBody),
      })
    ).json();
    assert.ok(o1.order?.publicNumber?.startsWith('MO-'));
    const orderPublic = o1.order.publicNumber as string;
    const orderId = o1.order.id as string;
    const oReplay = await (
      await fetch(`${apiBase}/marketplace/commerce/orders`, {
        method: 'POST',
        headers: { ...authA, 'idempotency-key': idem },
        body: JSON.stringify(orderBody),
      })
    ).json();
    assert.equal(oReplay.order.id, orderId);
    assert.equal(oReplay.order.publicNumber, orderPublic);
    note({
      step: 'إنشاء طلب MO + ثبات الرقم عند إعادة التأكيد',
      actor: 'customer A API',
      classification: 'ثبت من الخادم فقط',
      actual: `ref=${orderPublic} replaySame=${oReplay.order.id === orderId}`,
      ok: true,
      evidence: orderPublic,
    });

    // Age the order so accept-SLA (0h) flags attention
    await prisma.commerceOrder.update({ where: { id: orderId }, data: { createdAt: new Date(Date.now() - 60_000) } });

    const byNumberA = await fetch(`${apiBase}/marketplace/commerce/orders/${encodeURIComponent(orderPublic)}`, { headers: authA });
    assert.equal(byNumberA.status, 200);
    const byNumberB = await fetch(`${apiBase}/marketplace/commerce/orders/${encodeURIComponent(orderPublic)}`, { headers: authB });
    assert.equal(byNumberB.status, 404);
    note({
      step: 'العميلة أ تفتح برقمها العام؛ العميلة ب لا ترى نفس الرقم',
      actor: 'customer scope',
      classification: 'ثبت من الخادم فقط',
      actual: `A=${byNumberA.status} B=${byNumberB.status}`,
      ok: true,
      evidence: orderPublic,
    });

    // Other partner order for cross-tenant partner check
    await fetch(`${apiBase}/marketplace/commerce/cart`, { method: 'POST', headers: authB });
    await fetch(`${apiBase}/marketplace/commerce/cart/items`, {
      method: 'POST',
      headers: authB,
      body: JSON.stringify({ productId: otherProduct.id, quantity: 1 }),
    });
    const qB = await (await fetch(`${apiBase}/marketplace/commerce/checkout/quote`, { method: 'POST', headers: authB })).json();
    const oOther = await (
      await fetch(`${apiBase}/marketplace/commerce/orders`, {
        method: 'POST',
        headers: { ...authB, 'idempotency-key': `${run}-ord-b` },
        body: JSON.stringify({
          contactName: 'عميلة ب',
          contactPhone: '0502222222',
          addressLine: 'حي آخر',
          city: 'جدة',
          confirmationFingerprint: qB.confirmationFingerprint,
        }),
      })
    ).json();
    const otherPublic = oOther.order.publicNumber as string;

    const day = new Date();
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${d}`;
    const book = await (
      await fetch(`${apiBase}/marketplace/commerce/bookings`, {
        method: 'POST',
        headers: { ...authA, 'idempotency-key': `${run}-bk` },
        body: JSON.stringify({
          serviceId: service.id,
          startsAt: localInstant(dateKey, 660)!.toISOString(),
          contactName: 'عميلة أ',
          contactPhone: '0501111111',
        }),
      })
    ).json();
    assert.ok(book.booking?.publicNumber?.startsWith('MB-'));
    const bookingPublic = book.booking.publicNumber as string;
    const bookingId = book.booking.id as string;
    note({
      step: 'إنشاء حجز MB على مقدّم ميرا',
      actor: 'customer A API',
      classification: 'ثبت من الخادم فقط',
      actual: `ref=${bookingPublic} partner=ميرا`,
      ok: true,
      evidence: bookingPublic,
    });

    const attention1 = await (await fetch(`${apiBase}/admin/commerce/attention`, { headers: adminH })).json();
    const seesStale = (attention1.items || []).some((i: { publicNumber: string; reasonCode: string }) => i.publicNumber === orderPublic && i.reasonCode === 'ORDER_ACCEPT_OVERDUE');
    note({
      step: 'يحتاج تدخل: طلب تجاوز مهلة القبول',
      actor: 'admin API',
      classification: 'ثبت من الخادم فقط',
      actual: `hit=${seesStale} count=${(attention1.items || []).length}`,
      ok: seesStale,
      evidence: 'attention before accept',
    });

    partnerStatic = await staticServer(partnersRoot, PARTNER_PORT);
    adminStatic = await staticServer(adminRoot, ADMIN_PORT);
    const browser = await chromium.launch({ headless: true });
    const miraCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
    const otherCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });

    const miraPage = await miraCtx.newPage();
    await miraPage.goto(`${partnerStatic.origin}/login.html?api-base=${encodeURIComponent(apiBase)}`, { waitUntil: 'domcontentloaded' });
    await miraPage.locator('input[name="email"]').fill(MIRA_EMAIL);
    await miraPage.locator('input[name="password"]').fill(MIRA_PASS);
    await miraPage.getByRole('button', { name: 'دخول' }).click();
    await miraPage.waitForURL(/dashboard\.html/, { timeout: 15_000 });
    await miraPage.locator('#commerceTabOrders').click();
    await miraPage.locator('#commerceRefresh').click();
    await miraPage.waitForTimeout(1000);
    await miraPage.locator('#commerceSearch').fill(orderPublic);
    await miraPage.locator('#commerceSearchBtn').click();
    await miraPage.waitForTimeout(1200);
    await shot(miraPage, '01_mira_search_order');
    const miraSees = (await miraPage.content()).includes(orderPublic);
    const miraSeesOther = (await miraPage.content()).includes(otherPublic);
    note({
      step: 'ميرا البائع تبحث برقم طلبها وتراه؛ لا ترى طلب الشريك الآخر',
      actor: 'mira partner UI',
      classification: miraSees && !miraSeesOther ? 'ثبت من الواجهة' : 'فشل',
      actual: `own=${miraSees} foreign=${miraSeesOther}`,
      ok: miraSees && !miraSeesOther,
      evidence: 'ui/01_mira_search_order.png',
    });

    const otherPage = await otherCtx.newPage();
    await otherPage.goto(`${partnerStatic.origin}/login.html?api-base=${encodeURIComponent(apiBase)}`, { waitUntil: 'domcontentloaded' });
    await otherPage.locator('input[name="email"]').fill(OTHER_EMAIL);
    await otherPage.locator('input[name="password"]').fill(OTHER_PASS);
    await otherPage.getByRole('button', { name: 'دخول' }).click();
    await otherPage.waitForURL(/dashboard\.html/, { timeout: 15_000 });
    await otherPage.locator('#commerceTabOrders').click();
    await otherPage.locator('#commerceSearch').fill(orderPublic);
    await otherPage.locator('#commerceSearchBtn').click();
    await otherPage.waitForTimeout(1200);
    await shot(otherPage, '02_other_search_mira_order');
    const otherSeesMira = (await otherPage.content()).includes(orderPublic);
    note({
      step: 'شريك غير مالك يبحث برقم طلب ميرا ولا يراه',
      actor: 'other partner UI',
      classification: !otherSeesMira ? 'ثبت من الواجهة' : 'فشل',
      actual: `seesForeign=${otherSeesMira}`,
      ok: !otherSeesMira,
      evidence: 'ui/02_other_search_mira_order.png',
    });

    // Accept from MIRA UI to clear accept-overdue
    const card = miraPage.locator('article.commerce-card', { hasText: orderPublic });
    await card.getByRole('button', { name: 'قبول' }).click();
    await miraPage.waitForTimeout(1000);
    await shot(miraPage, '03_mira_after_accept');

    const attention2 = await (await fetch(`${apiBase}/admin/commerce/attention`, { headers: adminH })).json();
    const stillStale = (attention2.items || []).some((i: { publicNumber: string; reasonCode: string }) => i.publicNumber === orderPublic && i.reasonCode === 'ORDER_ACCEPT_OVERDUE');
    note({
      step: 'بعد القبول يزول تنبيه مهلة القبول لنفس الرقم',
      actor: 'admin API after UI accept',
      classification: !stillStale ? 'ثبت من الخادم فقط' : 'فشل',
      actual: `stillStale=${stillStale}`,
      ok: !stillStale,
      evidence: orderPublic,
    });

    // Admin staff attribution on a forced cancel of other order
    const cancelRes = await fetch(`${apiBase}/admin/commerce/orders/${otherPublic}/transition`, {
      method: 'POST',
      headers: adminH,
      body: JSON.stringify({ fulfillmentStatus: 'cancelled', note: 'اختبار إسناد موظف' }),
    });
    const cancelledText = await cancelRes.text();
    assert.ok([200, 201].includes(cancelRes.status), cancelledText);
    const cancelled = JSON.parse(cancelledText);
    const staffEvent = (cancelled.events || []).find(
      (e: { actorId?: string; toStatus?: string }) => e.toStatus === 'cancelled' && e.actorId === STAFF_ID,
    );
    note({
      step: 'إجراء إداري يُسند لموظف عبر X-Admin-Actor وليس المفتاح وحده',
      actor: 'admin API',
      classification: staffEvent ? 'ثبت من الخادم فقط' : 'فشل',
      actual: `actorId=${staffEvent?.actorId} display=${staffEvent?.actorDisplayAr}`,
      ok: Boolean(staffEvent),
      evidence: otherPublic,
    });

    const adminPage = await adminCtx.newPage();
    await adminPage.goto(`${adminStatic.origin}/index.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'domcontentloaded',
    });
    await adminPage.locator('#adminKey').fill(ADMIN_KEY);
    await adminPage.locator('#adminActor').fill(STAFF_ID);
    await adminPage.locator('#loginBtn').click();
    await adminPage.locator('#appShell:not(.hidden)').waitFor({ state: 'visible', timeout: 10_000 });
    await shot(adminPage, '04_admin_logged_in');
    await adminPage.locator('[data-view="orders"]').click();
    await adminPage.waitForTimeout(800);
    await adminPage.getByRole('button', { name: 'يحتاج تدخل' }).click();
    await adminPage.waitForTimeout(1200);
    await shot(adminPage, '05_admin_attention');
    await adminPage.getByRole('button', { name: 'الطلبات' }).click();
    await adminPage.waitForTimeout(600);
    await adminPage.locator('#viewRoot input').first().fill(orderPublic);
    await adminPage.getByRole('button', { name: 'تطبيق' }).click();
    await adminPage.waitForTimeout(1200);
    await adminPage.locator('#viewRoot button', { hasText: 'تفاصيل' }).first().click({ timeout: 8_000 });
    await adminPage.waitForTimeout(1000);
    await shot(adminPage, '06_admin_order_detail');
    const adminHtml = await adminPage.content();
    const adminSees = adminHtml.includes(orderPublic) && /ميرا/.test(adminHtml);
    const adminSeesNext = /الخطوة التالية/.test(adminHtml);
    note({
      step: 'الإدارة: دخول بموظف مسمّى + بحث بالرقم + تفاصيل مع الخطوة التالية',
      actor: 'admin UI',
      classification: adminSees ? 'ثبت من الواجهة' : 'فشل',
      actual: `sees=${adminSees} next=${adminSeesNext} staff=${STAFF_ID}`,
      ok: adminSees,
      evidence: 'ui/04–06_*.png',
    });

    await adminPage.getByRole('button', { name: 'الحجوزات' }).click();
    await adminPage.waitForTimeout(600);
    await adminPage.locator('#viewRoot input').first().fill(bookingPublic);
    await adminPage.getByRole('button', { name: 'تطبيق' }).click();
    await adminPage.waitForTimeout(1200);
    await shot(adminPage, '07_admin_booking_search');
    const adminSeesBk = (await adminPage.content()).includes(bookingPublic);
    note({
      step: 'الإدارة تفتح/تجد الحجز بنفس الرقم MB',
      actor: 'admin UI',
      classification: adminSeesBk ? 'ثبت من الواجهة' : 'فشل',
      actual: `booking=${bookingPublic} sees=${adminSeesBk}`,
      ok: adminSeesBk,
      evidence: 'ui/07_admin_booking_search.png',
    });

    // Customer detail nextAction via API (Flutter UI not closed)
    const custDetail = await (await fetch(`${apiBase}/marketplace/commerce/orders/${orderPublic}`, { headers: authA })).json();
    note({
      step: 'تفاصيل العميلة تتضمن nextActionAr والرقم العام',
      actor: 'customer API',
      classification: 'ثبت من الخادم فقط',
      actual: `next=${custDetail.nextActionAr} ref=${custDetail.publicNumber}`,
      ok: Boolean(custDetail.nextActionAr) && custDetail.publicNumber === orderPublic,
      evidence: 'order DTO',
    });

    note({
      step: 'Flutter Discover → طلباتي مع نسخ الرقم',
      actor: 'iOS MiraRC2',
      classification: 'لم يُختبر',
      actual: 'أُضيف نسخ الرقم والخطوة التالية في شاشات الطلب/الحجز؛ مسار OTP على المحاكي لم يُغلق في هذا التشغيل',
      ok: false,
      evidence: 'order_detail_screen / bookings_list_screen',
    });

    await browser.close();

    const matrix = {
      customer: { sees: 'own MO/MB only', mutate: 'cancel when allowed', searchByPublic: 'own only → 404 else' },
      partner_seller: { sees: 'own orders', mutate: 'fulfillment + collect', searchByPublic: 'own scope' },
      partner_provider: { sees: 'own bookings', mutate: 'confirm/complete/cancel', searchByPublic: 'own scope' },
      admin_shared_key: { sees: 'all', mutate: 'with note', actorLabel: 'مفتاح الإدارة المشترك' },
      admin_named_staff: { sees: 'all', mutate: 'with note', actorHeader: 'X-Admin-Actor', example: STAFF_ID },
      support_read_note:
        'لا دور قراءة منفصل في المشروع اليوم؛ مفتاح الإدارة يفتح القراءة والتعديل. الفصل التشغيلي عبر عدم منح المفتاح لمن يحتاج المتابعة فقط — موثّق في صفحة المتابعة.',
    };

    const report = {
      run,
      database: dbName,
      apiBase,
      refs: { orderPublic, bookingPublic, otherPublic, orderId, bookingId },
      miraPartnerId: mira.id,
      staffId: STAFF_ID,
      matrix,
      rows,
    };
    writeFileSync(join(outDir, 'OPS_TRACKING_PROOF.json'), JSON.stringify(report, null, 2));
    writeFileSync(join(outDir, 'PERMISSIONS_MATRIX.json'), JSON.stringify(matrix, null, 2));
    writeFileSync(
      join(outDir, 'OPS_TRACKING_PROOF.md'),
      [
        '# متابعة العمليات — إثبات',
        '',
        `| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |`,
        `|---|---|---|---|---|`,
        ...rows.map((r) => `| ${r.step} | ${r.actor} | ${r.classification} | ${r.actual.replace(/\|/g, '/')} | ${r.evidence} |`),
        '',
      ].join('\n'),
    );
    console.log('ops-tracking proof done', report.refs);
  } finally {
    try {
      if (partnerIds.length) {
        await prisma.commerceOrderEvent.deleteMany({ where: { order: { partnerId: { in: partnerIds } } } }).catch(() => undefined);
        await prisma.commerceBookingEvent.deleteMany({ where: { booking: { partnerId: { in: partnerIds } } } }).catch(() => undefined);
        await prisma.commerceOrder.deleteMany({ where: { partnerId: { in: partnerIds } } });
        await prisma.commerceBooking.deleteMany({ where: { partnerId: { in: partnerIds } } });
        await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
      }
      await prisma.user.deleteMany({ where: { firebaseUid: { in: ['ops-cust-a', 'ops-cust-b'] } } }).catch(() => undefined);
    } catch (e) {
      console.warn('cleanup', e);
    }
    await prisma.$disconnect();
    if (partnerStatic) await partnerStatic.close();
    if (adminStatic) await adminStatic.close();
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
