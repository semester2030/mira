/**
 * Closure: old clips owned by MIRA developer seller — real portal buttons + admin login form.
 * No ownership claim. Customer Discover/Flutter attempted separately (auth emulator hook).
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
import { localInstant, localParts } from './commerce.types';

/** Minimal admin stats so the real login form can verify X-Admin-Key against this isolated Nest app. */
@Controller('admin')
@UseGuards(AdminApiKeyGuard)
class AdminLoginStatsStubController {
  @Get('stats/overview')
  overview() {
    return {
      generatedAt: new Date().toISOString(),
      users: { total: 1, newToday: 0, newThisWeek: 0 },
      analyses: { skinToday: 0, outfitToday: 0, recommendationsToday: 0, totalToday: 0 },
      subscriptions: { enabled: false, premiumActive: 0, freeActive: 1 },
      partners: { total: 1, active: 1, suspended: 0, pendingApplications: 0, eventsThisWeek: 0 },
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

type Class = 'ثبت من الواجهة' | 'ثبت من الخادم فقط' | 'فشل' | 'لم يُختبر';
type Row = { step: string; actor: string; classification: Class; actual: string; ok: boolean; evidence: string };

const run = `sbmira${Date.now().toString(36)}`;
const ADMIN_KEY = 'sbws-mira-admin-key';
const MIRA_EMAIL = `mira-seller-${run}@test.local`;
const MIRA_PASS = 'MiraSeller#Test9';
const PARTNER_PORT = Number(process.env.SBWS_UI_PARTNER_PORT || 18775);
const ADMIN_PORT = Number(process.env.SBWS_UI_ADMIN_PORT || 18776);
const rows: Row[] = [];
const outDir = resolve(process.cwd(), '../docs/mira-commerce-reference/evidence/sell-book-without-store/mira-seller');
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
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

/** Click a visible commerce button on the card for publicNumber. Fails if missing. */
async function clickOrderButton(page: Page, publicNumber: string, label: string) {
  const card = page.locator(`article.commerce-card`, { hasText: publicNumber });
  await card.waitFor({ state: 'visible', timeout: 10_000 });
  const btn = card.getByRole('button', { name: label });
  await btn.waitFor({ state: 'visible', timeout: 8_000 });
  await btn.click();
  await page.waitForTimeout(900);
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
    { provide: FirebaseIdTokenVerifier, useValue: { verify: async () => ({ uid: 'dev-user', email: 'dev@mira.local', name: 'Dev' }) } },
  ],
})
class MiraSellerModule {}

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
    // —— MIRA developer = seller (and service provider) ——————————————
    const mira = await prisma.partner.create({
      data: {
        type: 'developer',
        nameAr: 'ميرا',
        nameEn: `${run}-mira-dev`,
        storeUrl: null,
        canSellProducts: true,
        city: 'الرياض',
        status: 'active',
      },
    });
    partnerIds.push(mira.id);
    const passwordHash = await hashPartnerPassword(MIRA_PASS);
    await prisma.partnerUser.create({
      data: {
        partnerId: mira.id,
        email: MIRA_EMAIL,
        accessToken: `${run}-mira-tok`,
        passwordHash,
      },
    });

    note({
      step: 'تمثيل حساب ميرا كبائع (developer) بلا storeUrl',
      actor: 'seed',
      classification: 'ثبت من الخادم فقط',
      actual: `partnerId=${mira.id} type=developer nameAr=ميرا storeUrl=null email=${MIRA_EMAIL}`,
      ok: true,
      evidence: 'نفس علاقة type=developer المعتمدة لصلاحية البيع+الخدمة',
    });

    // Old offer: external («عرض فقط» / بدون شراء)، مقطعين
    const oldProduct = await prisma.product.create({
      data: {
        partnerId: mira.id,
        nameAr: 'عباية قديمة ميرا',
        nameEn: `${run}-old-abaya`,
        priceHalalas: 0,
        externalUrl: '',
        category: 'clothes',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'external',
        inventoryMode: 'variant',
        contentStatus: 'published',
        active: true,
        optionsJson: [{ id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 's', labelAr: 'S' }, { id: 'm', labelAr: 'M' }] }],
        variantsJson: [
          { id: 'size-s', selections: { size: 's' }, priceHalalas: 19900, available: true },
          { id: 'size-m', selections: { size: 'm' }, priceHalalas: 21900, available: true },
        ],
      },
    });
    await prisma.productVariantInventory.createMany({
      data: [
        { productId: oldProduct.id, variantId: 'size-s', variantKey: 'size-s', stockMode: 'tracked', stockQty: 2, reservedQty: 0 },
        { productId: oldProduct.id, variantId: 'size-m', variantKey: 'size-m', stockMode: 'tracked', stockQty: 3, reservedQty: 0 },
      ],
    });
    const media1 = await prisma.catalogMedia.create({
      data: { ownerKind: 'product', ownerId: oldProduct.id, kind: 'video', url: `https://cdn.test/${run}/clip-a.mp4`, placement: 'main', sortOrder: 0, isPrimary: true },
    });
    const media2 = await prisma.catalogMedia.create({
      data: { ownerKind: 'product', ownerId: oldProduct.id, kind: 'video', url: `https://cdn.test/${run}/clip-b.mp4`, placement: 'main', sortOrder: 1 },
    });
    const independent = await prisma.product.create({
      data: {
        partnerId: mira.id,
        nameAr: 'عرض مستقل يبقى عرض فقط',
        nameEn: `${run}-indep`,
        priceHalalas: 1000,
        externalUrl: '',
        category: 'clothes',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'external',
        contentStatus: 'published',
        active: true,
      },
    });
    const beforeIds = {
      productId: oldProduct.id,
      ownerPartnerId: mira.id,
      media: [media1.id, media2.id],
      independentId: independent.id,
      purchaseMode: oldProduct.purchaseMode,
    };
    writeFileSync(join(outDir, 'BEFORE_IDS.json'), JSON.stringify(beforeIds, null, 2));

    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 600, endMin: 900, capacity: 1 }));
    const service = await prisma.service.create({
      data: {
        partnerId: mira.id,
        nameAr: 'جلسة ميرا',
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

    app = await NestFactory.create(MiraSellerModule, { logger: ['error'] });
    app.setGlobalPrefix('api/v1');
    app.enableCors({ origin: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    const port = (app.getHttpServer().address() as { port: number }).port;
    const apiBase = `http://127.0.0.1:${port}/api/v1`;

    partnerStatic = await staticServer(partnersRoot, PARTNER_PORT);
    adminStatic = await staticServer(adminRoot, ADMIN_PORT);
    const browser = await chromium.launch({ headless: true });
    const miraCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-SA' });

    // —— Login as MIRA seller via login form ————————————————
    const miraPage = await miraCtx.newPage();
    const loginUrl = `${partnerStatic.origin}/login.html?api-base=${encodeURIComponent(apiBase)}`;
    await miraPage.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await miraPage.locator('input[name="email"]').fill(MIRA_EMAIL);
    await miraPage.locator('input[name="password"]').fill(MIRA_PASS);
    await miraPage.getByRole('button', { name: 'دخول' }).click();
    await miraPage.waitForURL(/dashboard\.html/, { timeout: 15_000 });
    await miraPage.waitForTimeout(1500);
    const dashName = await miraPage.locator('#partnerName').innerText();
    await shot(miraPage, '01_mira_seller_dashboard');
    note({
      step: 'دخول بوابة الشريك بصفة ميرا البائع (نموذج الدخول)',
      actor: 'mira seller UI',
      classification: 'ثبت من الواجهة',
      actual: `name=${dashName.trim()} url=${miraPage.url()}`,
      ok: /ميرا/.test(dashName),
      evidence: 'mira-seller/01_mira_seller_dashboard.png',
    });

    // —— Editor: open old product from real catalog list, display-only then COD ———
    await miraPage.locator('#catalogList').waitFor({ state: 'visible', timeout: 10_000 });
    const oldCard = miraPage.locator('#catalogList .list-item', { hasText: 'عباية قديمة ميرا' });
    await oldCard.waitFor({ state: 'visible', timeout: 10_000 });
    await oldCard.getByRole('button', { name: 'فتح في النموذج' }).click();
    await miraPage.locator('#catalogForm input[name="nameAr"]').waitFor({ state: 'visible', timeout: 8_000 });
    // Ensure required category is selected (editor blocks save without it)
    const cat = miraPage.locator('#catalogForm select[name="category"]');
    if (!(await cat.inputValue())) await cat.selectOption('clothes');
    // Confirm display-only (بدون شراء) then screenshot
    const noneRadio = miraPage.locator('#catalogForm input[name="purchaseMode"][value="none"]');
    await noneRadio.check();
    await shot(miraPage, '02_editor_display_only');
    await miraPage.locator('#catalogForm-save').click();
    await miraPage.waitForTimeout(2000);
    const afterDisplayStatus = await miraPage.locator('#catalogForm').innerText();
    // Re-open same product and activate internal COD via visible checkbox
    await miraPage.locator('#catalogList .list-item', { hasText: 'عباية قديمة ميرا' })
      .getByRole('button', { name: 'فتح في النموذج' })
      .click();
    await miraPage.locator('#catalogForm input[name="internalCod"]').waitFor({ state: 'visible', timeout: 8_000 });
    if (!(await miraPage.locator('#catalogForm select[name="category"]').inputValue())) {
      await miraPage.locator('#catalogForm select[name="category"]').selectOption('clothes');
    }
    await miraPage.locator('#catalogForm input[name="internalCod"]').check();
    await miraPage.locator('#catalogForm input[name="priceSar"]').fill('199');
    await miraPage.locator('#catalogForm input[name="deliveryFeeSar"]').fill('10');
    await miraPage.locator('#catalogForm-save').click();
    await miraPage.waitForTimeout(2500);
    const afterCodStatus = await miraPage.locator('#catalogForm').innerText();
    writeFileSync(join(outDir, 'EDITOR_STATUS.txt'), `display:\n${afterDisplayStatus.slice(0, 800)}\n\ncod:\n${afterCodStatus.slice(0, 800)}\n`);
    await shot(miraPage, '02b_editor_after_cod');

    // Independent product stays display-only — open and ensure internalCod unchecked
    const indepCard = miraPage.locator('#catalogList .list-item', { hasText: 'عرض مستقل يبقى عرض فقط' });
    await indepCard.getByRole('button', { name: 'فتح في النموذج' }).click();
    await miraPage.locator('#catalogForm input[name="internalCod"]').waitFor({ state: 'visible', timeout: 8_000 });
    if (await miraPage.locator('#catalogForm input[name="internalCod"]').isChecked()) {
      await miraPage.locator('#catalogForm input[name="internalCod"]').uncheck();
      await miraPage.locator('#catalogForm-save').click();
      await miraPage.waitForTimeout(1200);
    }
    await shot(miraPage, '02c_independent_display_only');

    const afterActivate = await prisma.product.findUniqueOrThrow({ where: { id: oldProduct.id } });
    const mediaAfter = await prisma.catalogMedia.findMany({ where: { ownerId: oldProduct.id }, orderBy: { sortOrder: 'asc' } });
    const indepAfter = await prisma.product.findUniqueOrThrow({ where: { id: independent.id } });
    const editorUiOk = afterActivate.purchaseMode === 'internal_cod';
    writeFileSync(
      join(outDir, 'AFTER_IDS.json'),
      JSON.stringify(
        {
          productId: afterActivate.id,
          purchaseMode: afterActivate.purchaseMode,
          priceHalalas: afterActivate.priceHalalas,
          media: mediaAfter.map((m) => m.id),
          independentMode: indepAfter.purchaseMode,
          editorUiOk,
        },
        null,
        2,
      ),
    );
    note({
      step: 'تفعيل شراء العرض القديم من المحرر الحقيقي (فتح في النموذج → تفعيل COD → نشر الآن)',
      actor: 'mira editor UI',
      classification: editorUiOk ? 'ثبت من الواجهة' : 'فشل',
      actual: `mode=${afterActivate.purchaseMode} mediaUnchanged=${mediaAfter.map((m) => m.id).join(',') === beforeIds.media.join(',')} indep=${indepAfter.purchaseMode} editorUiOk=${editorUiOk}`,
      ok: editorUiOk && indepAfter.purchaseMode === 'external' && mediaAfter.length === 2,
      evidence: 'mira-seller/02*.png + BEFORE/AFTER_IDS — التفعيل على صف المنتج؛ المستقل عرض فقط',
    });
    assert.equal(afterActivate.purchaseMode, 'internal_cod', 'editor must activate internal_cod via UI');
    assert.equal(indepAfter.purchaseMode, 'external');

    // —— Customer creates order (AUTH_SKIP) choosing size S ——————————
    await fetch(`${apiBase}/marketplace/commerce/cart`, { method: 'POST', headers: { Authorization: 'Bearer x' } });
    const add = await fetch(`${apiBase}/marketplace/commerce/cart/items`, {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'content-type': 'application/json' },
      body: JSON.stringify({ productId: oldProduct.id, quantity: 1, selections: { size: 's' } }),
    });
    assert.equal(add.status, 201, await add.text());
    const quote = await (await fetch(`${apiBase}/marketplace/commerce/checkout/quote`, { method: 'POST', headers: { Authorization: 'Bearer x' } })).json();
    const orderRes = await fetch(`${apiBase}/marketplace/commerce/orders`, {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'content-type': 'application/json', 'idempotency-key': `${run}-ord` },
      body: JSON.stringify({
        contactName: 'عميلة ميرا',
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
    const orderRow = await prisma.commerceOrder.findUniqueOrThrow({ where: { id: orderId } });
    assert.equal(orderRow.partnerId, mira.id);
    note({
      step: 'طلب من عرض ميرا القديم — المستلم partner_id = ميرا',
      actor: 'customer API (Flutter Discover لم يُغلق بعد)',
      classification: 'ثبت من الخادم فقط',
      actual: `ref=${orderPublic} partner=${mira.id} nameAr=ميرا`,
      ok: true,
      evidence: `orderId=${orderId}`,
    });

    // Refresh commerce list and click REAL buttons
    await miraPage.locator('#commerceTabOrders').click();
    await miraPage.locator('#commerceRefresh').click();
    await miraPage.waitForTimeout(1200);
    await shot(miraPage, '03_mira_orders_new');
    const seesOrder = (await miraPage.content()).includes(orderPublic);
    note({
      step: 'ميرا البائع يرى الطلب في البوابة',
      actor: 'mira seller UI',
      classification: seesOrder ? 'ثبت من الواجهة' : 'فشل',
      actual: `sees ${orderPublic}=${seesOrder}`,
      ok: seesOrder,
      evidence: 'mira-seller/03_mira_orders_new.png',
    });

    for (const [label, shotName] of [
      ['قبول', '04_after_accept'],
      ['بدء التجهيز', '05_after_prepare'],
      ['خرج للتوصيل', '06_after_ship'],
      ['تم التسليم', '07_after_deliver'],
      ['تأكيد استلام النقد', '08_after_collect'],
    ] as const) {
      await miraPage.locator('#commerceRefresh').click().catch(() => undefined);
      await miraPage.waitForTimeout(600);
      await clickOrderButton(miraPage, orderPublic, label);
      await shot(miraPage, shotName);
    }
    const orderFinal = await prisma.commerceOrder.findUniqueOrThrow({ where: { id: orderId } });
    const invS = await prisma.productVariantInventory.findUniqueOrThrow({
      where: { productId_variantId: { productId: oldProduct.id, variantId: 'size-s' } },
    });
    const invM = await prisma.productVariantInventory.findUniqueOrThrow({
      where: { productId_variantId: { productId: oldProduct.id, variantId: 'size-m' } },
    });
    note({
      step: 'ضغط أزرار القبول→التجهيز→التوصيل→التسليم→التحصيل',
      actor: 'mira seller UI buttons',
      classification: 'ثبت من الواجهة',
      actual: `fulfillment=${orderFinal.fulfillmentStatus} payment=${orderFinal.paymentCollectionStatus} S=${invS.stockQty} M=${invM.stockQty}`,
      ok: orderFinal.fulfillmentStatus === 'delivered' && orderFinal.paymentCollectionStatus === 'collected' && invS.stockQty === 1 && invM.stockQty === 3,
      evidence: 'mira-seller/04–08_*.png — لا page.evaluate للانتقالات',
    });

    // —— Booking on MIRA provider ————————————————————————————————
    const day = localParts(new Date(Date.now() + 3 * 86_400_000)).dateKey;
    const bookRes = await fetch(`${apiBase}/marketplace/commerce/bookings`, {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'content-type': 'application/json', 'idempotency-key': `${run}-bk` },
      body: JSON.stringify({
        serviceId: service.id,
        startsAt: localInstant(day, 600)!.toISOString(),
        contactName: 'عميلة ميرا',
        contactPhone: '0501234567',
      }),
    });
    const bookJson = await bookRes.json();
    assert.equal(bookRes.status, 201, JSON.stringify(bookJson));
    const bookingId = bookJson.booking.id as string;
    const bookingPublic = bookJson.booking.publicNumber as string;
    note({
      step: 'طلب موعد على خدمة ميرا — status=requested',
      actor: 'customer API',
      classification: 'ثبت من الخادم فقط',
      actual: `ref=${bookingPublic} partner=${mira.id}`,
      ok: bookJson.booking.status === 'requested',
      evidence: `bookingId=${bookingId}`,
    });

    await miraPage.locator('#commerceTabBookings').click();
    await miraPage.locator('#commerceRefresh').click();
    await miraPage.waitForTimeout(1000);
    await shot(miraPage, '09_bookings_requested');
    await clickOrderButton(miraPage, bookingPublic, 'تأكيد الموعد');
    await shot(miraPage, '10_booking_confirmed');
    // Test clock: move startsAt to past so «اكتمل» is allowed for the SAME booking
    await prisma.commerceBooking.update({
      where: { id: bookingId },
      data: { startsAt: new Date(Date.now() - 7200_000), endsAt: new Date(Date.now() - 3600_000) },
    });
    await miraPage.locator('#commerceRefresh').click();
    await miraPage.waitForTimeout(800);
    await clickOrderButton(miraPage, bookingPublic, 'اكتمل');
    await miraPage.locator('#commerceRefresh').click();
    await miraPage.waitForTimeout(800);
    await shot(miraPage, '11_booking_completed');
    const bkFinal = await prisma.commerceBooking.findUniqueOrThrow({ where: { id: bookingId } });
    note({
      step: 'تأكيد ثم إتمام نفس الحجز من أزرار البوابة',
      actor: 'mira provider UI buttons',
      classification: 'ثبت من الواجهة',
      actual: `status=${bkFinal.status} (ساعة اختبار: تحريك startsAt للماضي بعد التأكيد لنفس ${bookingPublic})`,
      ok: bkFinal.status === 'completed',
      evidence: 'mira-seller/09–11_*.png',
    });

    // Cancel second booking + slot frees
    const book2 = await fetch(`${apiBase}/marketplace/commerce/bookings`, {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'content-type': 'application/json', 'idempotency-key': `${run}-bk2` },
      body: JSON.stringify({
        serviceId: service.id,
        startsAt: localInstant(day, 720)!.toISOString(),
        contactName: 'عميلة ميرا',
        contactPhone: '0501234567',
      }),
    });
    const b2 = await book2.json();
    assert.equal(book2.status, 201, JSON.stringify(b2));
    const cancel = await fetch(`${apiBase}/marketplace/commerce/bookings/${b2.booking.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'content-type': 'application/json' },
      body: '{}',
    });
    const avail = await (await fetch(`${apiBase}/marketplace/commerce/services/${service.id}/availability?date=${day}`)).json();
    const free = (avail.slots || []).find((s: { startsAt: string }) => s.startsAt === localInstant(day, 720)!.toISOString());
    note({
      step: 'إلغاء حجز ثانٍ وتحرير الموعد',
      actor: 'customer API',
      classification: 'ثبت من الخادم فقط',
      actual: `cancel=${(await cancel.json()).status} slotFree=${free?.available}`,
      ok: free?.available === true,
      evidence: `second=${b2.booking.publicNumber}`,
    });

    // —— Admin: login screen → orders details ————————————————
    const adminPage = await adminCtx.newPage();
    const adminUrl = `${adminStatic.origin}/index.html?api-base=${encodeURIComponent(apiBase)}`;
    await adminPage.goto(adminUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await shot(adminPage, '12_admin_login');
    await adminPage.locator('#adminKey').fill(ADMIN_KEY);
    await adminPage.locator('#loginBtn').click();
    await adminPage.locator('#appShell:not(.hidden)').waitFor({ state: 'visible', timeout: 10_000 });
    const shellHidden = await adminPage.locator('#appShell').evaluate((el) => el.classList.contains('hidden'));
    await shot(adminPage, '13_admin_after_login');
    await adminPage.locator('[data-view="orders"]').click({ timeout: 8000 });
    await adminPage.waitForTimeout(1500);
    const orderSearch = adminPage.locator('#viewRoot input').first();
    await orderSearch.waitFor({ state: 'visible', timeout: 8_000 });
    await orderSearch.fill(orderPublic);
    await adminPage.getByRole('button', { name: 'تطبيق' }).click();
    await adminPage.waitForTimeout(1500);
    await adminPage.locator('#viewRoot button', { hasText: 'تفاصيل' }).first().click({ timeout: 8_000 });
    await adminPage.waitForTimeout(1000);
    await shot(adminPage, '14_admin_order_detail');
    const adminHtml = await adminPage.content();
    const adminSeesOrder = adminHtml.includes(orderPublic);
    const adminSeesMira = /ميرا/.test(adminHtml);
    await adminPage.getByRole('button', { name: 'الحجوزات', exact: true }).click();
    await adminPage.waitForTimeout(1000);
    const bkSearch = adminPage.locator('#viewRoot input').first();
    await bkSearch.fill(bookingPublic);
    await adminPage.getByRole('button', { name: 'تطبيق' }).click();
    await adminPage.waitForTimeout(1500);
    await shot(adminPage, '15_admin_booking_detail');
    const adminSeesBk = (await adminPage.content()).includes(bookingPublic);
    note({
      step: 'الإدارة: دخول من شاشة المفتاح ثم تفاصيل الطلب والحجز',
      actor: 'admin UI',
      classification: !shellHidden && adminSeesOrder && adminSeesBk ? 'ثبت من الواجهة' : 'فشل',
      actual: `shellOpen=${!shellHidden} order=${adminSeesOrder} miraSellerVisible=${adminSeesMira} booking=${adminSeesBk} refs=${orderPublic}/${bookingPublic}`,
      ok: !shellHidden && adminSeesOrder && adminSeesBk,
      evidence: 'mira-seller/12–15_*.png',
    });
    assert.ok(!shellHidden, 'admin login form must open shell');
    assert.ok(adminSeesOrder, `admin must show ${orderPublic}`);
    assert.ok(adminSeesBk, `admin must show ${bookingPublic}`);

    note({
      step: 'Flutter Discover من فيديو → سلة → طلباتي',
      actor: 'iOS MiraRC2',
      classification: 'لم يُختبر',
      actual:
        'مانع: شاشة دخول العميلة (OTP/Firebase). MiraRC2 أقلع؛ هوك MIRA_USE_AUTH_EMULATOR في main.dart جاهز؛ لم تُكمَل الجلسة من الشاشة إلى السلة في هذا التشغيل',
      ok: false,
      evidence: 'شاشة الدخول — لا لقطة طلب من الجوال',
    });

    await browser.close();

    const report = {
      run,
      database: dbName,
      apiBase,
      miraPartnerId: mira.id,
      refs: { orderPublic, bookingPublic, orderId, bookingId },
      beforeIds,
      after: { purchaseMode: afterActivate.purchaseMode, media: mediaAfter.map((m) => m.id), independent: indepAfter.purchaseMode },
      rows,
    };
    writeFileSync(resolve(outDir, '../MIRA_SELLER_CLOSURE.json'), JSON.stringify(report, null, 2));
    writeFileSync(
      resolve(outDir, '../MIRA_SELLER_CLOSURE.md'),
      [
        '# MIRA seller closure',
        '',
        `| الخطوة | المنفّذ | التصنيف | ما حدث | الدليل |`,
        `|---|---|---|---|---|`,
        ...rows.map((r) => `| ${r.step} | ${r.actor} | ${r.classification} | ${r.actual.replace(/\|/g, '/')} | ${r.evidence} |`),
        '',
      ].join('\n'),
    );
    console.log('MIRA seller closure done', report.refs);
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
