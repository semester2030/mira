/**
 * C07 local chain: partners-portal bulk → materialize → publish → marketplace catalog
 * → cart (product+variant) → service availability.
 *
 * Uses real Nest HTTP for portal+catalog; CommerceService for cart/availability
 * (same server code path as app; not a Flutter device run).
 *
 * Run from mira-api:
 *   set -a && source .env.rc13 && set +a && export MIRA_PARTNER_EDITOR_V2=true
 *   npx tsx scripts/c07-portal-to-app.integration.mjs
 */
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../src/common/auth/firebase-id-token-verifier';
import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';
import { AdminApiKeyGuard } from '../src/common/guards/admin-api-key.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogContentService } from '../src/marketplace/catalog-content.service';
import { CatalogMediaController } from '../src/marketplace/catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../src/marketplace/catalog-media.storage';
import { CatalogReviewAdminController } from '../src/marketplace/catalog-review.admin.controller';
import { MarketplaceController } from '../src/marketplace/marketplace.controller';
import { MarketplaceService } from '../src/marketplace/marketplace.service';
import { CommerceService } from '../src/marketplace/commerce.service';
import { CommerceController } from '../src/marketplace/commerce.controller';
import { PartnerTokenGuard } from '../src/partners-portal/guards/partner-token.guard';
import { PartnersPortalController } from '../src/partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../src/partners-portal/partners-portal.service';
import { RegistryService } from '../src/partners-portal/registry/registry.service';
import { BulkBatchesService } from '../src/partners-portal/bulk-batches/bulk-batches.service';
import { EditorDraftsService } from '../src/partners-portal/editor-drafts/editor-drafts.service';
import { ServiceProfileService } from '../src/partners-portal/editor-drafts/service-profile.service';
import { VariantInventoryService } from '../src/partners-portal/variant-inventory.service';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const outDir = join(root, 'audit-out/p0-p7-final/logs/c07-portal-to-app');
mkdirSync(outDir, { recursive: true });

const customerTokens: Record<string, string> = Object.create(null);

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    const uid = customerTokens[token];
    if (!uid) throw new UnauthorizedException('Invalid token');
    return { uid, email: `${uid}@test.local`, name: uid };
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
  ],
  providers: [
    PartnersPortalService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    CatalogContentService,
    RegistryService,
    EditorDraftsService,
    BulkBatchesService,
    ServiceProfileService,
    VariantInventoryService,
    CommerceService,
    FirebaseAuthGuard,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    { provide: MarketplaceService, useFactory: (prisma) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class C07Module {}

async function json(res) {
  return res.json().catch(() => ({}));
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'c07-admin';
  process.env.AUTH_SKIP = 'false';

  const started = new Date().toISOString();
  const suffix = randomUUID().slice(0, 8);
  const steps = [];
  const record = (id, ok, detail) => {
    steps.push({ id, ok, detail });
    console.log(JSON.stringify({ id, ok, detail }));
  };

  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `C07 Brand ${suffix}`, nameEn: 'c07-brand', city: 'الرياض' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `C07 Salon ${suffix}`, nameEn: 'c07-salon', city: 'جدة' },
  });
  const brandToken = `c07-brand-${suffix}`;
  const salonToken = `c07-salon-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `c07-b-${suffix}@test.local`, accessToken: brandToken },
  });
  await prisma.partnerUser.create({
    data: { partnerId: salon.id, email: `c07-s-${suffix}@test.local`, accessToken: salonToken },
  });

  const custTok = `c07-cust-${suffix}`;
  customerTokens[custTok] = `c07-uid-${suffix}`;

  const app = await NestFactory.create(C07Module, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const addr = app.getHttpServer().address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const brandH = { Authorization: `Bearer ${brandToken}`, 'Content-Type': 'application/json' };
  const salonH = { Authorization: `Bearer ${salonToken}`, 'Content-Type': 'application/json' };

  let productId = null;
  let serviceId = null;
  let variantId = null;
  const TINY_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  try {
    // —— Product via portal bulk
    const create = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 1, batchId: `c07p-${suffix}` }),
    });
    const createBody = await json(create);
    record('C07_PORTAL_CREATE_PRODUCT_BATCH', create.status === 201 || create.status === 200, { status: create.status });

    variantId = `c07-${suffix}-bm`;
    const put = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${createBody.batchId}/cards/c001`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: createBody.cards[0].revision,
        values: {
          nameAr: `فستان C07 ${suffix}`,
          priceHalalas: 20000,
          purchaseMode: 'internal_cod',
          externalUrl: 'https://example.test/c07',
          colors: ['black'],
          sizes: ['M'],
          optionsJson: [
            { id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }] },
            { id: 'size', labelAr: 'المقاس', values: [{ id: 'M', labelAr: 'M' }] },
          ],
          variantsJson: [
            {
              id: variantId,
              selections: { color: 'black', size: 'M' },
              priceHalalas: 20000,
              available: true,
              stockQty: 3,
            },
          ],
          inventoryMode: 'variant',
        },
        overwriteWritten: true,
      }),
    });
    record('C07_PORTAL_PUT_PRODUCT', put.status === 200 || put.status === 201, { status: put.status, body: await json(put) });

    const mat = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${createBody.batchId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': `c07-mat-p-${suffix}` },
      body: JSON.stringify({ submitReview: false }),
    });
    const matBody = await json(mat);
    productId = matBody.results?.[0]?.targetOwnerId || null;
    record('C07_PORTAL_MATERIALIZE_PRODUCT', matBody.succeeded === 1 && !!productId, matBody);

    // Publish via portal media + submit-review + admin decision (HTTP paths)
    const adminH = {
      'Content-Type': 'application/json',
      'x-admin-key': process.env.ADMIN_API_KEY || 'c07-admin',
    };
    let publishProductOk = false;
    let publishProductDetail: unknown = null;
    if (productId) {
      const media = await fetch(`${base}/api/v1/partners-portal/products/${productId}/media`, {
        method: 'POST',
        headers: brandH,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG_B64, placement: 'main' }),
      });
      const mediaBody = await json(media);
      const sub = await fetch(`${base}/api/v1/partners-portal/products/${productId}/submit-review`, {
        method: 'POST',
        headers: brandH,
        body: JSON.stringify({}),
      });
      const subBody = await json(sub);
      const decision = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${productId}/decision`, {
        method: 'POST',
        headers: adminH,
        body: JSON.stringify({
          decision: 'approve',
          note: 'c07',
          revision: subBody.revision ?? subBody.reviewRevision ?? 1,
        }),
      });
      const decisionBody = await json(decision);
      const row = await prisma.product.findUnique({ where: { id: productId } });
      publishProductOk =
        (media.status === 200 || media.status === 201) &&
        (sub.status === 200 || sub.status === 201) &&
        (decision.status === 200 || decision.status === 201) &&
        row?.contentStatus === 'published';
      publishProductDetail = {
        mediaStatus: media.status,
        mediaBody,
        submitStatus: sub.status,
        submitBody: subBody,
        decisionStatus: decision.status,
        decisionBody,
        contentStatus: row?.contentStatus,
      };
    }
    record('C07_PUBLISH_PRODUCT', publishProductOk, publishProductDetail);

    // Discover
    const cat = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${brand.id}&kind=product&variant.color=black&variant.size=M&facets=1&limit=24`,
    );
    const catBody = await json(cat);
    const found = (catBody.items || catBody.results || []).some((it) => it.id === productId || it.productId === productId);
    record('C07_DISCOVER_PRODUCT_VARIANT', cat.status === 200 && found, {
      status: cat.status,
      n: (catBody.items || catBody.results || []).length,
      found,
    });

    // Cart via HTTP CommerceController (no silent fallback that hides variant failure)
    const custH = { Authorization: `Bearer ${custTok}`, 'Content-Type': 'application/json' };
    const cartRes = await fetch(`${base}/api/v1/marketplace/commerce/cart/items`, {
      method: 'POST',
      headers: custH,
      body: JSON.stringify({
        productId,
        quantity: 1,
        variantKey: variantId,
        selections: { color: 'black', size: 'M' },
      }),
    });
    const cartBody = await json(cartRes);
    const cartItems = (cartBody && cartBody.items) || [];
    const cartItem = cartItems[0] || null;
    /** Contract: selections is SelectionSnapshot[] with groupId/valueId — not {color,size}. */
    const snapRaw = (cartItem && (cartItem.selections || cartItem.variantSelections)) || [];
    const selectionMap: Record<string, string> = {};
    if (Array.isArray(snapRaw)) {
      for (const row of snapRaw) {
        if (row && typeof row === 'object' && typeof row.groupId === 'string' && typeof row.valueId === 'string') {
          selectionMap[row.groupId] = row.valueId;
        }
      }
    } else if (snapRaw && typeof snapRaw === 'object') {
      Object.assign(selectionMap, snapRaw as Record<string, string>);
    }
    const cartPrice =
      cartItem &&
      (cartItem.unitPriceHalalas ?? cartItem.priceHalalas ?? cartItem.linePriceHalalas ?? cartItem.price);
    const cartOk =
      cartRes.status >= 200 &&
      cartRes.status < 300 &&
      cartItems.length >= 1 &&
      !!cartItem &&
      cartItem.productId === productId &&
      (cartItem.variantKey === variantId || cartItem.variantId === variantId) &&
      selectionMap.color === 'black' &&
      selectionMap.size === 'M' &&
      cartItem.quantity === 1 &&
      Number(cartPrice) === 20000;
    record('C07_CART_ADD_PRODUCT_HTTP', cartOk, {
      status: cartRes.status,
      itemCount: cartItems.length,
      productId: cartItem && cartItem.productId,
      variantKey: cartItem && (cartItem.variantKey || cartItem.variantId),
      quantity: cartItem && cartItem.quantity,
      selectionMap,
      selectionsRaw: snapRaw,
      price: cartPrice,
      path: 'POST /marketplace/commerce/cart/items',
    });
    // Unavailable / wrong variant must be rejected with expected client error (not 500)
    const badCart = await fetch(`${base}/api/v1/marketplace/commerce/cart/items`, {
      method: 'POST',
      headers: custH,
      body: JSON.stringify({
        productId,
        quantity: 1,
        selections: { color: 'nope', size: 'XXL' },
      }),
    });
    const badCartBody = await json(badCart);
    const badCode = badCartBody && (badCartBody.code || badCartBody.errorCode);
    record(
      'C07_CART_REJECT_BAD_VARIANT',
      badCart.status >= 400 &&
        badCart.status < 500 &&
        (badCode === 'SELECTION_INVALID' ||
          badCode === 'VARIANT_UNAVAILABLE' ||
          badCode === 'SELECTION_REQUIRED' ||
          typeof badCode === 'string'),
      {
        status: badCart.status,
        code: badCode,
        body: badCartBody,
      },
    );
    // Internal service check retained with correct classification (not a substitute for HTTP)
    let cartSvcOk = false;
    let cartSvcDetail: unknown = null;
    try {
      const commerce = new CommerceService(prisma as unknown as PrismaService);
      const user = await commerce.customerActor({
        firebaseUid: `c07-svc-${suffix}`,
        email: `c07-svc-${suffix}@test.local`,
        name: 'عميل خدمة داخلية',
      });
      const cart = await commerce.addCartItem(user, {
        productId,
        quantity: 1,
        variantKey: variantId,
        selections: { color: 'black', size: 'M' },
      });
      cartSvcOk = !!(((cart as { items?: unknown[] }).items || []).length);
      cartSvcDetail = { itemCount: ((cart as { items?: unknown[] }).items || []).length, class: 'CommerceService_internal' };
    } catch (e) {
      cartSvcDetail = { error: e instanceof Error ? e.message : String(e), class: 'CommerceService_internal' };
    }
    record('C07_CART_ADD_PRODUCT_SERVICE_INTERNAL', cartSvcOk, cartSvcDetail);

    // —— Service via portal bulk
    const svcCreate = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: salonH,
      body: JSON.stringify({
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        count: 1,
        batchId: `c07s-${suffix}`,
      }),
    });
    const svcCreateBody = await json(svcCreate);
    record('C07_PORTAL_CREATE_SERVICE_BATCH', svcCreate.status === 201 || svcCreate.status === 200, {
      status: svcCreate.status,
    });

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const svcPut = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${svcCreateBody.batchId}/cards/c001`, {
      method: 'PUT',
      headers: salonH,
      body: JSON.stringify({
        expectedRevision: svcCreateBody.cards[0].revision,
        values: {
          nameAr: `قص C07 ${suffix}`,
          priceHalalas: 15000,
          durationMin: 45,
          bookingMode: 'request',
          // Distinctive portal schedule — must reach booking without any later PATCH substitution.
          weeklyHours: [
            { day: 'sun', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
            { day: 'mon', open: '10:00', close: '18:00', resourceId: 'chair-B', capacity: 5 },
            { day: 'tue', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
            { day: 'wed', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
            { day: 'thu', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
            { day: 'fri', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
            { day: 'sat', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
          ],
          dateExceptions: [{ date: dateStr, closed: true }],
          serviceProfile: {
            templateId: 'salon_hair_cut',
            templateVersion: 1,
            priceMode: 'fixed',
            answers: { session_kind: 'single', place_mode: 'branch' },
          },
        },
        overwriteWritten: true,
      }),
    });
    const svcPutBody = await json(svcPut);
    record('C07_PORTAL_PUT_SERVICE', svcPut.status === 200 || svcPut.status === 201, {
      status: svcPut.status,
      body: svcPutBody,
    });

    const svcMat = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${svcCreateBody.batchId}/materialize`, {
      method: 'POST',
      headers: { ...salonH, 'Idempotency-Key': `c07-mat-s-${suffix}` },
      body: JSON.stringify({ submitReview: false }),
    });
    const svcMatBody = await json(svcMat);
    serviceId = svcMatBody.results?.[0]?.targetOwnerId || null;
    record('C07_PORTAL_MATERIALIZE_SERVICE', svcMatBody.succeeded === 1 && !!serviceId, svcMatBody);

    // Open booking day = day after the closed exception (portal schedule only — no availability PATCH).
    const openDay = new Date(tomorrow);
    openDay.setUTCDate(openDay.getUTCDate() + 1);
    const openDateStr = openDay.toISOString().slice(0, 10);

    let publishServiceOk = false;
    let publishServiceDetail: unknown = { serviceId, dateStr, openDateStr };
    if (serviceId) {
      const matRow = await prisma.service.findUnique({ where: { id: serviceId } });
      const matAvail = matRow?.availabilityJson as {
        windows?: Array<{ weekday?: number; resourceId?: string; capacity?: number }>;
        closedDates?: string[];
      } | null;
      const sunWin = (matAvail?.windows || []).find((w) => w.weekday === 0);
      const monWin = (matAvail?.windows || []).find((w) => w.weekday === 1);
      const portalScheduleIntact =
        !!matRow?.bookingEnabled &&
        sunWin?.resourceId === 'chair-A' &&
        sunWin?.capacity === 3 &&
        monWin?.resourceId === 'chair-B' &&
        monWin?.capacity === 5 &&
        Array.isArray(matAvail?.closedDates) &&
        matAvail!.closedDates!.includes(dateStr);
      record('C07_PORTAL_SCHEDULE_INTACT', portalScheduleIntact, {
        bookingEnabled: matRow?.bookingEnabled,
        sunWin,
        monWin,
        closedDates: matAvail?.closedDates,
        noteAr: 'جدول البوابة بعد التحويل دون PATCH وسيط',
      });

      const profileGet = await fetch(`${base}/api/v1/partners-portal/services/${serviceId}/service-profile`, {
        headers: salonH,
      });
      const profileGetBody = await json(profileGet);
      const expectedRevision =
        typeof profileGetBody.reviewRevision === 'number' ? profileGetBody.reviewRevision : 1;
      const profilePut = await fetch(`${base}/api/v1/partners-portal/services/${serviceId}/service-profile`, {
        method: 'PUT',
        headers: salonH,
        body: JSON.stringify({
          expectedRevision,
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: {
            session_kind: 'single',
            includes: ['wash'],
            place_mode: 'branch',
          },
        }),
      });
      const profileBody = await json(profilePut);
      const profileGet2 = await fetch(`${base}/api/v1/partners-portal/services/${serviceId}/service-profile`, {
        headers: salonH,
      });
      const profileGet2Body = await json(profileGet2);
      const restoredDoc =
        profileGet2Body.serviceProfileJson || profileGet2Body.draftServiceProfileJson || null;
      const answers = (restoredDoc && restoredDoc.answers) || {};
      const profilePersisted =
        (profilePut.status === 200 || profilePut.status === 201) &&
        restoredDoc &&
        restoredDoc.templateId === 'salon_hair_cut' &&
        answers.session_kind === 'single';
      record('C07_SERVICE_PROFILE_SAVE', profilePersisted, {
        getStatus: profileGet.status,
        putStatus: profilePut.status,
        expectedRevision,
        profileBody,
        restored: restoredDoc,
      });
      const media = await fetch(`${base}/api/v1/partners-portal/services/${serviceId}/media`, {
        method: 'POST',
        headers: salonH,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG_B64, placement: 'main' }),
      });
      const mediaBody = await json(media);
      const sub = await fetch(`${base}/api/v1/partners-portal/services/${serviceId}/submit-review`, {
        method: 'POST',
        headers: salonH,
        body: JSON.stringify({}),
      });
      const subBody = await json(sub);
      const decision = await fetch(`${base}/api/v1/admin/catalog-reviews/service/${serviceId}/decision`, {
        method: 'POST',
        headers: adminH,
        body: JSON.stringify({
          decision: 'approve',
          note: 'c07',
          revision: subBody.revision ?? subBody.reviewRevision ?? 1,
        }),
      });
      const row = await prisma.service.findUnique({ where: { id: serviceId } });
      const rowAvail = row?.availabilityJson as {
        windows?: Array<{ weekday?: number; resourceId?: string; capacity?: number }>;
        closedDates?: string[];
      } | null;
      const afterPublishSun = (rowAvail?.windows || []).find((w) => w.weekday === 0);
      const scheduleStillPortal =
        afterPublishSun?.resourceId === 'chair-A' &&
        afterPublishSun?.capacity === 3 &&
        Array.isArray(rowAvail?.closedDates) &&
        rowAvail!.closedDates!.includes(dateStr);
      publishServiceOk =
        portalScheduleIntact &&
        scheduleStillPortal &&
        profilePersisted &&
        (media.status === 200 || media.status === 201) &&
        (sub.status === 200 || sub.status === 201) &&
        (decision.status === 200 || decision.status === 201) &&
        row?.contentStatus === 'published';
      publishServiceDetail = {
        portalScheduleIntact,
        scheduleStillPortal,
        profileStatus: profilePut.status,
        profileBody,
        profilePersisted,
        mediaStatus: media.status,
        mediaBody,
        submitStatus: sub.status,
        submitBody: subBody,
        decisionStatus: decision.status,
        contentStatus: row?.contentStatus,
        bookingEnabled: row?.bookingEnabled,
        availabilityWindows: rowAvail?.windows?.length,
        closedDates: rowAvail?.closedDates,
      };
    }
    record('C07_PUBLISH_SERVICE', publishServiceOk, publishServiceDetail);

    const catSvc = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${salon.id}&kind=service&limit=24`,
    );
    const catSvcBody = await json(catSvc);
    const foundSvc = (catSvcBody.items || catSvcBody.results || []).some(
      (it) => it.id === serviceId || it.serviceId === serviceId,
    );
    const closedAvailHttp = await fetch(
      `${base}/api/v1/marketplace/commerce/services/${serviceId}/availability?date=${encodeURIComponent(dateStr)}`,
    );
    const closedAvailBody = await json(closedAvailHttp);
    const closedSlots = (closedAvailBody && closedAvailBody.slots) || [];
    const closedOk =
      closedAvailHttp.status === 200 &&
      (!Array.isArray(closedSlots) ||
        closedSlots.length === 0 ||
        closedSlots.every((s: { available?: boolean }) => s && s.available === false));
    record('C07_CLOSED_DATE_NO_SLOTS', closedOk, {
      status: closedAvailHttp.status,
      date: dateStr,
      slotN: Array.isArray(closedSlots) ? closedSlots.length : null,
      noteAr: 'تاريخ الاستثناء المغلق من البوابة لا يُرجع فترات قابلة للحجز',
    });

    const catSvcAvail = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${salon.id}&kind=service&availableOn=${openDateStr}&facets=1&limit=24`,
    );
    const catSvcAvailBody = await json(catSvcAvail);
    const foundAvail = (catSvcAvailBody.items || catSvcAvailBody.results || []).some(
      (it) => it.id === serviceId || it.serviceId === serviceId,
    );
    record('C07_DISCOVER_SERVICE_AVAIL', catSvc.status === 200 && foundSvc && catSvcAvail.status === 200 && foundAvail, {
      status: catSvc.status,
      foundSvc,
      n: (catSvcBody.items || catSvcBody.results || []).length,
      availStatus: catSvcAvail.status,
      foundAvail,
      availN: (catSvcAvailBody.items || catSvcAvailBody.results || []).length,
      openDateStr,
    });

    const availHttp = await fetch(
      `${base}/api/v1/marketplace/commerce/services/${serviceId}/availability?date=${encodeURIComponent(openDateStr)}`,
    );
    const availBody = await json(availHttp);
    const slots = (availBody && availBody.slots) || [];
    const firstSlot =
      slots.find((s: { available?: boolean; startsAt?: string }) => s && s.available !== false && s.startsAt) ||
      slots[0] ||
      null;
    const openWeekday = new Date(`${openDateStr}T12:00:00+03:00`).getDay();
    const expectedResource = openWeekday === 1 ? 'chair-B' : 'chair-A';
    const expectedCapacity = openWeekday === 1 ? 5 : 3;
    const availOk =
      availHttp.status === 200 &&
      Array.isArray(slots) &&
      slots.length > 0 &&
      !!firstSlot?.startsAt &&
      firstSlot?.resourceId === expectedResource;
    record('C07_SERVICE_AVAILABILITY_HTTP', availOk, {
      status: availHttp.status,
      slotN: slots.length,
      firstStartsAt: firstSlot?.startsAt,
      resourceId: firstSlot?.resourceId,
      expectedResource,
      expectedCapacity,
      openDateStr,
      openWeekday,
      path: 'GET /marketplace/commerce/services/:id/availability',
      noteAr: 'إتاحة من جدول البوابة الأصلي دون PATCH',
    });

    const bookHttp = await fetch(`${base}/api/v1/marketplace/commerce/bookings`, {
      method: 'POST',
      headers: { ...custH, 'Idempotency-Key': `c07-bk-${suffix}` },
      body: JSON.stringify({
        serviceId,
        startsAt: firstSlot?.startsAt,
        contactName: 'عميل C07',
        contactPhone: '+966500000007',
        idempotencyKey: `c07-bk-${suffix}`,
        resourceId: expectedResource,
      }),
    });
    const bookBody = await json(bookHttp);
    const bookRow = bookBody && (bookBody.booking || bookBody);
    const bookDb = bookRow?.id
      ? await prisma.commerceBooking.findUnique({ where: { id: String(bookRow.id) } })
      : null;
    const bookOk =
      bookHttp.status >= 200 &&
      bookHttp.status < 300 &&
      bookRow &&
      bookRow.status === 'requested' &&
      bookRow.serviceId === serviceId &&
      !!bookRow.startsAt &&
      !!bookRow.endsAt &&
      Number(bookRow.priceHalalas) === 15000 &&
      !!bookDb &&
      bookDb.partnerId === salon.id &&
      bookDb.status === 'requested' &&
      (bookRow.resourceId === expectedResource || bookDb.resourceId === expectedResource);
    record('C07_APPOINTMENT_REQUEST_HTTP', bookOk, {
      status: bookHttp.status,
      bookingStatus: bookRow && bookRow.status,
      serviceId: bookRow && bookRow.serviceId,
      partnerId: bookDb && bookDb.partnerId,
      resourceId: bookRow && bookRow.resourceId,
      expectedResource,
      startsAt: bookRow && bookRow.startsAt,
      endsAt: bookRow && bookRow.endsAt,
      priceHalalas: bookRow && bookRow.priceHalalas,
      noteAr: 'طلب موعد يحمل المورد من جدول البوابة الأصلي',
      path: 'POST /marketplace/commerce/bookings',
    });

    // Unauthorized booking must fail with 401 specifically
    const bookUnauth = await fetch(`${base}/api/v1/marketplace/commerce/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId,
        startsAt: firstSlot?.startsAt,
        contactName: 'x',
        contactPhone: '+966500000001',
      }),
    });
    record('C07_BOOKING_UNAUTHORIZED', bookUnauth.status === 401, { status: bookUnauth.status });
  } catch (e) {
    record('C07_UNEXPECTED', false, { error: e instanceof Error ? e.message : String(e) });
  } finally {
    let sourceHint = process.env.MIRA_TEST_COMMIT || '';
    if (!sourceHint) {
      try {
        sourceHint = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      } catch {
        sourceHint = 'working-tree';
      }
    }
    const summary = {
      id: 'C07_PORTAL_TO_APP',
      started,
      finished: new Date().toISOString(),
      sourceHint,
      cwd: process.cwd(),
      env: { dbHost: 'localhost', MIRA_PARTNER_EDITOR_V2: true },
      steps,
      ok: steps.length > 0 && steps.every((s) => s.ok),
      noteAr:
        'سلسلة محلية بوابة HTTP→نشر→كتالوج→سلة/إتاحة/طلب موعد عبر HTTP Commerce. ليست DEVICE_VERIFIED ولا إثبات R2.',
    };
    writeFileSync(join(outDir, 'RESULTS.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ ok: summary.ok, failed: steps.filter((s) => !s.ok).map((s) => s.id), outDir }));
    await app.close();
    await prisma.$disconnect();
    process.exit(summary.ok ? 0 : 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
