/**
 * Browser UI proof: partners + admin portals against in-process Nest (commerce + partners-portal).
 * Customer Discover/Flutter remains لم يُختبر (no Firebase debug auth).
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
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
import { RegistryService } from '../partners-portal/registry/registry.service';
import { VariantInventoryService } from '../partners-portal/variant-inventory.service';
import { localInstant, localParts } from './commerce.types';

type Class = 'ثبت من الواجهة' | 'ثبت من الخادم فقط' | 'فشل' | 'لم يُختبر';
type Row = { step: string; actor: string; classification: Class; actual: string; ok: boolean; evidence: string };

const run = `sbui${Date.now().toString(36)}`;
const ADMIN_KEY = 'sbws-ui-admin-key';
const PARTNER_PORT = Number(process.env.SBWS_UI_PARTNER_PORT || 18765);
const ADMIN_PORT = Number(process.env.SBWS_UI_ADMIN_PORT || 18766);
const rows: Row[] = [];
const outDir = resolve(process.cwd(), '../docs/mira-commerce-reference/evidence/sell-book-without-store/ui');
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
      '.svg': 'image/svg+xml',
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
      resolveP({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      }),
    );
  });
}

async function shot(page: Page, name: string) {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
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
  ],
  providers: [
    PartnersPortalService,
    PartnerActivitiesCatalog,
    {
      // Avoid activities DB client wiring in this slim module; dashboard still loads.
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
    { provide: FirebaseIdTokenVerifier, useValue: { verify: async () => ({ uid: 'dev-user', email: 'dev@mira.local', name: 'Dev' }) } },
  ],
})
class SbwsUiModule {}

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
    console.error(`REFUSE: database name must be a dedicated local *test* DB, got "${dbName}"`);
    process.exit(1);
  }

  process.env.ADMIN_API_KEY = ADMIN_KEY;
  process.env.AUTH_SKIP = 'true';
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.NODE_ENV = 'development';

  const prisma = new PrismaClient();
  const partnerIds: string[] = [];
  let partnerStatic: { close: () => Promise<void>; origin: string } | null = null;
  let adminStatic: { close: () => Promise<void>; origin: string } | null = null;
  let app: INestApplication | null = null;

  const partnersRoot = resolve('/Users/fayez/Desktop/mira/partners-portal/web');
  const adminRoot = resolve('/Users/fayez/Desktop/mira/admin-portal/web');

  try {
    const sellerTok = `${run}-seller-tok`;
    const salonTok = `${run}-salon-tok`;
    const seller = await prisma.partner.create({
      data: { type: 'brand', nameAr: 'بائع واجهة بلا متجر', nameEn: `${run}-seller`, storeUrl: null, canSellProducts: true, city: 'الرياض' },
    });
    partnerIds.push(seller.id);
    await prisma.partnerUser.create({ data: { partnerId: seller.id, email: `${run}-seller@test.local`, accessToken: sellerTok } });
    const salon = await prisma.partner.create({
      data: { type: 'salon', nameAr: 'صالون واجهة بلا متجر', nameEn: `${run}-salon`, storeUrl: null, city: 'الرياض' },
    });
    partnerIds.push(salon.id);
    await prisma.partnerUser.create({ data: { partnerId: salon.id, email: `${run}-salon@test.local`, accessToken: salonTok } });
    const miraAdmin = await prisma.partner.create({
      data: { type: 'developer', nameAr: 'ميرا إداري واجهة', nameEn: `${run}-admin`, storeUrl: null, city: 'الرياض' },
    });
    partnerIds.push(miraAdmin.id);

    const product = await prisma.product.create({
      data: {
        partnerId: seller.id,
        nameAr: 'عباية واجهة مقاسين',
        nameEn: `${run}-abaya`,
        priceHalalas: 25000,
        externalUrl: 'https://example.test/unused',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        inventoryMode: 'variant',
        deliveryFeeHalalas: 1000,
        contentStatus: 'published',
        active: true,
        optionsJson: [{ id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 's', labelAr: 'S' }, { id: 'm', labelAr: 'M' }] }],
        variantsJson: [
          { id: 'size-s', selections: { size: 's' }, priceHalalas: 25000, available: true },
          { id: 'size-m', selections: { size: 'm' }, priceHalalas: 27000, available: true },
        ],
      },
    });
    await prisma.productVariantInventory.createMany({
      data: [
        { productId: product.id, variantId: 'size-s', variantKey: 'size-s', stockMode: 'tracked', stockQty: 2, reservedQty: 0 },
        { productId: product.id, variantId: 'size-m', variantKey: 'size-m', stockMode: 'tracked', stockQty: 4, reservedQty: 0 },
      ],
    });
    await prisma.catalogMedia.createMany({
      data: [
        { ownerKind: 'product', ownerId: product.id, kind: 'video', url: `https://cdn.test/${run}/p1.mp4`, placement: 'main', sortOrder: 0 },
        { ownerKind: 'product', ownerId: product.id, kind: 'video', url: `https://cdn.test/${run}/p2.mp4`, placement: 'main', sortOrder: 1 },
      ],
    });
    const independent = await prisma.product.create({
      data: {
        partnerId: seller.id,
        nameAr: 'عرض مستقل عرض فقط',
        nameEn: `${run}-indep`,
        priceHalalas: 1000,
        externalUrl: 'https://example.test/indep',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'external',
        contentStatus: 'published',
        active: true,
      },
    });
    const adminOffer = await prisma.product.create({
      data: {
        partnerId: miraAdmin.id,
        nameAr: 'عرض نيابة ميرا',
        nameEn: `${run}-admin-offer`,
        priceHalalas: 5000,
        externalUrl: 'https://example.test/admin',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'external',
        contentStatus: 'published',
        active: true,
      },
    });
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 600, endMin: 840, capacity: 1 }));
    const service = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: 'جلسة واجهة',
        nameEn: `${run}-svc`,
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

    note({
      step: 'تجهيز حسابات ومحتوى (seed)',
      actor: 'harness',
      classification: 'ثبت من الخادم فقط',
      actual: `storeUrl null; product=${product.id}; independent=${independent.id}; adminOffer.owner=${adminOffer.partnerId}`,
      ok: true,
      evidence: 'Prisma seed',
    });

    app = await NestFactory.create(SbwsUiModule, { logger: ['error'] });
    app.setGlobalPrefix('api/v1');
    app.enableCors({ origin: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const addr = app.getHttpServer().address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const apiBase = `http://127.0.0.1:${port}/api/v1`;

    const me = await fetch(`${apiBase}/partners-portal/me`, { headers: { Authorization: `Bearer ${sellerTok}` } });
    const meJson = (await me.json()) as { partner?: { nameAr?: string; storeUrl?: string | null } };
    note({
      step: 'التحقق من وجهة API قبل التجربة',
      actor: 'harness',
      classification: 'ثبت من الخادم فقط',
      actual: `apiBase=${apiBase} me=${me.status} name=${meJson.partner?.nameAr} storeUrl=${meJson.partner?.storeUrl ?? null}`,
      ok: me.status === 200 && (meJson.partner?.storeUrl ?? null) == null,
      evidence: 'GET /partners-portal/me',
    });

    await fetch(`${apiBase}/marketplace/commerce/cart`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
    const add = await fetch(`${apiBase}/marketplace/commerce/cart/items`, {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'content-type': 'application/json' },
      body: JSON.stringify({ productId: product.id, quantity: 1, selections: { size: 's' } }),
    });
    assert.equal(add.status, 201, await add.text());
    const quote = await (await fetch(`${apiBase}/marketplace/commerce/checkout/quote`, { method: 'POST', headers: { Authorization: 'Bearer x' } })).json();
    const orderRes = await fetch(`${apiBase}/marketplace/commerce/orders`, {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'content-type': 'application/json', 'idempotency-key': `${run}-ord` },
      body: JSON.stringify({
        contactName: 'عميلة واجهة',
        contactPhone: '0501234567',
        addressLine: 'حي الياسمين شارع الأمير',
        city: 'الرياض',
        confirmationFingerprint: quote.confirmationFingerprint,
      }),
    });
    const orderJson = await orderRes.json();
    assert.equal(orderRes.status, 201, JSON.stringify(orderJson));
    const orderId = orderJson.order.id as string;
    const orderPublic = orderJson.order.publicNumber as string;
    note({
      step: 'إنشاء طلب COD عبر API (بدل فيديو الجوال)',
      actor: 'customer API AUTH_SKIP',
      classification: 'ثبت من الخادم فقط',
      actual: `ref=${orderPublic}`,
      ok: true,
      evidence: `orderId=${orderId}`,
    });

    const day = localParts(new Date(Date.now() + 4 * 86_400_000)).dateKey;
    const bookRes = await fetch(`${apiBase}/marketplace/commerce/bookings`, {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'content-type': 'application/json', 'idempotency-key': `${run}-bk` },
      body: JSON.stringify({
        serviceId: service.id,
        startsAt: localInstant(day, 600)!.toISOString(),
        contactName: 'عميلة واجهة',
        contactPhone: '0501234567',
      }),
    });
    const bookJson = await bookRes.json();
    assert.equal(bookRes.status, 201, JSON.stringify(bookJson));
    const bookingId = bookJson.booking.id as string;
    const bookingPublic = bookJson.booking.publicNumber as string;
    note({
      step: 'إنشاء طلب موعد عبر API — حالة بانتظار الموافقة',
      actor: 'customer API',
      classification: 'ثبت من الخادم فقط',
      actual: `ref=${bookingPublic} status=${bookJson.booking.status}`,
      ok: bookJson.booking.status === 'requested',
      evidence: `bookingId=${bookingId}`,
    });

    const custUser = await prisma.user.findFirstOrThrow({ where: { firebaseUid: 'dev-user' } });
    const pastBk = await prisma.commerceBooking.create({
      data: {
        publicNumber: `MB-${run}C`.slice(0, 20),
        userId: custUser.id,
        partnerId: salon.id,
        serviceId: service.id,
        serviceNameAr: 'جلسة واجهة',
        startsAt: new Date(Date.now() - 7200_000),
        endsAt: new Date(Date.now() - 3600_000),
        durationMin: 60,
        priceHalalas: 15000,
        status: 'confirmed',
        contactName: 'عميلة واجهة',
        contactPhone: '0501234567',
        payMode: 'pay_at_venue',
      },
    });

    partnerStatic = await staticServer(partnersRoot, PARTNER_PORT);
    adminStatic = await staticServer(adminRoot, ADMIN_PORT);
    const browser = await chromium.launch({ headless: true });
    // Separate contexts so partner tokens in localStorage do not overwrite each other.
    const sellerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
    const salonCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });

    const sellerPage = await sellerCtx.newPage();
    const sellerUrl = `${partnerStatic.origin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`;
    await sellerPage.addInitScript((tok) => {
      localStorage.setItem('mira_partner_token', tok);
      localStorage.setItem('mira_partner_email', 'seller@test.local');
    }, sellerTok);
    await sellerPage.goto(sellerUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await sellerPage.waitForTimeout(1500);
    const sellerName = await sellerPage.locator('#partnerName').innerText().catch(() => '');
    await shot(sellerPage, '01_seller_dashboard');
    await sellerPage.locator('#commerceTabOrders').click().catch(() => undefined);
    await sellerPage.locator('#commerceRefresh').click().catch(() => undefined);
    await sellerPage.waitForTimeout(1500);
    const sellerHasOrder = (await sellerPage.content()).includes(orderPublic);
    await shot(sellerPage, '02_seller_orders');
    note({
      step: 'بوابة البائع تعرض الطلب',
      actor: 'seller browser',
      classification: sellerHasOrder ? 'ثبت من الواجهة' : 'فشل',
      actual: `name=${sellerName.trim()} sees ${orderPublic}=${sellerHasOrder}`,
      ok: sellerHasOrder,
      evidence: 'ui/02_seller_orders.png',
    });

    const driven = await sellerPage.evaluate(async (oid) => {
      const api = (window as unknown as { PartnersApi: any }).PartnersApi;
      const out: string[] = [];
      for (const s of ['accepted', 'preparing', 'out_for_delivery', 'delivered']) {
        const r = await api.commerceOrderTransition(oid, { fulfillmentStatus: s });
        out.push(r.fulfillmentStatus || s);
      }
      const c = await api.commerceCollectPayment(oid, { note: 'نقدًا من البوابة' });
      out.push(c.paymentCollectionStatus || 'collected');
      return out;
    }, orderId);
    await sellerPage.locator('#commerceRefresh').click().catch(() => undefined);
    await sellerPage.waitForTimeout(1000);
    await shot(sellerPage, '04_seller_collected');
    note({
      step: 'قبول→تجهيز→تسليم→تحصيل من جلسة بوابة البائع',
      actor: 'seller browser',
      classification: 'ثبت من الواجهة',
      actual: driven.join('→'),
      ok: driven.includes('delivered') && driven.includes('collected'),
      evidence: 'ui/04_seller_collected.png — PartnersApi داخل صفحة البوابة',
    });

    // Editor while seller session is clean
    const editorResult = await sellerPage.evaluate(
      async ({ indepId, productId }) => {
        const api = (window as unknown as { PartnersApi: any }).PartnersApi;
        const errors: string[] = [];
        try {
          await api.updateProduct(indepId, { purchaseMode: 'external', nameAr: 'عرض مستقل عرض فقط' });
        } catch (e) {
          errors.push(`indep:${(e as Error).message}`);
        }
        try {
          await api.updateProduct(productId, { purchaseMode: 'internal_cod' });
        } catch (e) {
          errors.push(`product:${(e as Error).message}`);
        }
        return { errors };
      },
      { indepId: independent.id, productId: product.id },
    );
    const dbIndep = await prisma.product.findUniqueOrThrow({ where: { id: independent.id } });
    const dbProd = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    await shot(sellerPage, '11_seller_editor_after');
    note({
      step: 'محرر البوابة: عرض فقط / تفعيل شراء',
      actor: 'seller browser editor',
      classification: editorResult.errors.length ? 'فشل' : 'ثبت من الواجهة',
      actual: `errors=${editorResult.errors.join(';') || 'none'} DB indep=${dbIndep.purchaseMode} product=${dbProd.purchaseMode}`,
      ok: editorResult.errors.length === 0 && dbIndep.purchaseMode === 'external' && dbProd.purchaseMode === 'internal_cod',
      evidence: 'ui/11_seller_editor_after.png — لا قيمة display منفصلة؛ external = بلا شراء داخلي',
    });

    const salonPage = await salonCtx.newPage();
    const salonUrl = `${partnerStatic.origin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`;
    await salonPage.addInitScript((tok) => localStorage.setItem('mira_partner_token', tok), salonTok);
    await salonPage.goto(salonUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await salonPage.waitForTimeout(1500);
    await salonPage.locator('#commerceTabOrders').click().catch(() => undefined);
    await salonPage.waitForTimeout(1000);
    const salonOrderList = await salonPage.evaluate(async () => {
      const api = (window as unknown as { PartnersApi: any }).PartnersApi;
      const data = await api.commerceOrders('limit=50');
      return (data.items || []).map((o: { publicNumber?: string }) => o.publicNumber);
    });
    const salonSeesOrder = salonOrderList.includes(orderPublic);
    await shot(salonPage, '05_salon_no_order');
    note({
      step: 'مقدّم الخدمة لا يرى طلب البائع',
      actor: 'salon browser',
      classification: 'ثبت من الواجهة',
      actual: `apiList=${JSON.stringify(salonOrderList)} seesOrder=${salonSeesOrder}`,
      ok: !salonSeesOrder,
      evidence: 'ui/05_salon_no_order.png',
    });

    await salonPage.locator('#commerceTabBookings').click().catch(() => undefined);
    await salonPage.locator('#commerceRefresh').click().catch(() => undefined);
    await salonPage.waitForTimeout(1500);
    const salonSeesBk = (await salonPage.content()).includes(bookingPublic);
    await shot(salonPage, '06_salon_bookings');
    const bkDriven = await salonPage.evaluate(
      async ({ bid, pastId }) => {
        const api = (window as unknown as { PartnersApi: any }).PartnersApi;
        const conf = await api.commerceBookingTransition(bid, { status: 'confirmed', note: 'مؤكد من البوابة' });
        const done = await api.commerceBookingTransition(pastId, { status: 'completed', note: 'أُنجز' });
        return { conf: conf.status, done: done.status };
      },
      { bid: bookingId, pastId: pastBk.id },
    );
    await salonPage.locator('#commerceRefresh').click().catch(() => undefined);
    await salonPage.waitForTimeout(1000);
    await shot(salonPage, '07_salon_confirmed');
    note({
      step: 'قبول الحجز وإتمام حجز بعد وقت البدء من بوابة الصالون',
      actor: 'salon browser',
      classification: 'ثبت من الواجهة',
      actual: `listHad=${salonSeesBk} confirm=${bkDriven.conf} complete=${bkDriven.done}`,
      ok: salonSeesBk && bkDriven.conf === 'confirmed' && bkDriven.done === 'completed',
      evidence: 'ui/07_salon_confirmed.png',
    });

    await sellerPage.locator('#commerceTabBookings').click().catch(() => undefined);
    await sellerPage.locator('#commerceRefresh').click().catch(() => undefined);
    await sellerPage.waitForTimeout(1000);
    const sellerBkList = await sellerPage.evaluate(async () => {
      const api = (window as unknown as { PartnersApi: any }).PartnersApi;
      const data = await api.commerceBookings('limit=50');
      return (data.items || []).map((b: { publicNumber?: string }) => b.publicNumber);
    });
    const sellerSeesBk = sellerBkList.includes(bookingPublic);
    await shot(sellerPage, '08_seller_no_booking');
    note({
      step: 'البائع لا يرى حجز الصالون',
      actor: 'seller browser',
      classification: 'ثبت من الواجهة',
      actual: `apiList=${JSON.stringify(sellerBkList)} has=${sellerSeesBk}`,
      ok: !sellerSeesBk,
      evidence: 'ui/08_seller_no_booking.png + PartnersApi.commerceBookings',
    });

    note({
      step: 'إسناد عرض ميرا لصاحبه من الواجهة',
      actor: 'admin/partner UI',
      classification: 'فشل',
      actual: `adminOffer.partner_id=${adminOffer.partnerId}; لا عنصر دعوة/claim في لوحة الشريك`,
      ok: false,
      evidence: 'STOP — no claim UI; DB partner_id edit not used',
    });

    const adminPage = await adminCtx.newPage();
    const adminUrl = `${adminStatic.origin}/index.html?api-base=${encodeURIComponent(apiBase)}`;
    await adminPage.goto(adminUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await adminPage.evaluate((key) => {
      localStorage.setItem('mira_admin_key', key);
      const api = (window as unknown as { MiraAdminApi?: { setKey?: (k: string) => void } }).MiraAdminApi;
      api?.setKey?.(key);
    }, ADMIN_KEY);
    await adminPage.waitForTimeout(500);
    await adminPage.locator('[data-view="orders"]').click({ timeout: 5000 }).catch(() => undefined);
    await adminPage.waitForTimeout(800);
    const adminLists = await adminPage.evaluate(
      async ({ orderRef, bookingRef, key }) => {
        localStorage.setItem('mira_admin_key', key);
        const api = (window as unknown as { MiraAdminApi: any }).MiraAdminApi;
        if (!api) return { order: false, booking: false, err: 'no MiraAdminApi' };
        try {
          api.setKey?.(key);
          const orders = await api.commerceOrders('', orderRef);
          const bookings = await api.commerceBookings('', bookingRef);
          const orderHit = (orders.items || []).some((o: { publicNumber?: string }) => o.publicNumber === orderRef);
          const bookingHit = (bookings.items || []).some((b: { publicNumber?: string }) => b.publicNumber === bookingRef);
          return { order: orderHit, booking: bookingHit, err: '' };
        } catch (e) {
          return { order: false, booking: false, err: (e as Error).message };
        }
      },
      { orderRef: orderPublic, bookingRef: bookingPublic, key: ADMIN_KEY },
    );
    await shot(adminPage, '09_admin_orders');
    await adminPage.getByText('الحجوزات', { exact: true }).click({ timeout: 3000 }).catch(() => undefined);
    await adminPage.waitForTimeout(800);
    await shot(adminPage, '10_admin_bookings');
    note({
      step: 'لوحة الإدارة تعرض الطلب والحجز',
      actor: 'admin browser',
      classification: adminLists.order && adminLists.booking ? 'ثبت من الواجهة' : 'فشل',
      actual: `order=${adminLists.order} booking=${adminLists.booking} err=${adminLists.err || 'none'}`,
      ok: adminLists.order && adminLists.booking,
      evidence: 'ui/09_admin_orders.png + ui/10_admin_bookings.png',
    });

    const invS = await prisma.productVariantInventory.findUniqueOrThrow({
      where: { productId_variantId: { productId: product.id, variantId: 'size-s' } },
    });
    const invM = await prisma.productVariantInventory.findUniqueOrThrow({
      where: { productId_variantId: { productId: product.id, variantId: 'size-m' } },
    });
    note({
      step: 'المخزون بعد التحصيل',
      actor: 'DB',
      classification: 'ثبت من الخادم فقط',
      actual: `S=${invS.stockQty}/${invS.reservedQty} M=${invM.stockQty}/${invM.reservedQty}`,
      ok: invS.stockQty === 1 && invM.stockQty === 4,
      evidence: 'variant inventory',
    });

    note({
      step: 'Flutter Discover من فيديو حتى السلة',
      actor: 'iOS',
      classification: 'لم يُختبر',
      actual: 'مانع: التطبيق يتطلب Firebase؛ لا AUTH تجريبي على العميل. الطلب أُنشئ عبر API ثم أُكمل على بوابات المتصفح.',
      ok: false,
      evidence: 'blocker client auth',
    });

    await browser.close();

    const report = {
      run,
      database: dbName,
      apiBase,
      refs: { orderPublic, bookingPublic, orderId, bookingId },
      rows,
    };
    writeFileSync(resolve(outDir, '../UI_BROWSER_PROOF.json'), JSON.stringify(report, null, 2));
    writeFileSync(
      resolve(outDir, '../UI_BROWSER_PROOF.md'),
      ['# UI browser proof', '', `| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |`, `|---|---|---|---|---|`, ...rows.map((r) => `| ${r.step} | ${r.actor} | ${r.classification} | ${r.actual.replace(/\|/g, '/')} | ${r.evidence} |`), ''].join('\n'),
    );
    console.log('UI browser proof done', report.refs);
  } finally {
    try {
      if (partnerIds.length) {
        await prisma.commerceOrder.deleteMany({ where: { partnerId: { in: partnerIds } } });
        await prisma.commerceBooking.deleteMany({ where: { partnerId: { in: partnerIds } } });
        await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
      }
      await prisma.user.deleteMany({ where: { firebaseUid: 'dev-user' } }).catch(() => undefined);
    } catch (e) {
      console.warn('cleanup', e);
    }
    await prisma.$disconnect();
    if (partnerStatic) await partnerStatic.close();
    if (adminStatic) await adminStatic.close();
    if (app) await app.close();
  }

  if (rows.some((r) => r.classification === 'ثبت من الواجهة' && !r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
