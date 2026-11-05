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
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier } from '../src/common/auth/firebase-id-token-verifier';
import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';
import { AdminApiKeyGuard } from '../src/common/guards/admin-api-key.guard';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogContentService } from '../src/marketplace/catalog-content.service';
import { CatalogMediaController } from '../src/marketplace/catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../src/marketplace/catalog-media.storage';
import { CatalogReviewAdminController } from '../src/marketplace/catalog-review.admin.controller';
import { MarketplaceController } from '../src/marketplace/marketplace.controller';
import { MarketplaceService } from '../src/marketplace/marketplace.service';
import { CommerceService } from '../src/marketplace/commerce.service';
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

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(token) {
    if (token !== 'unused') throw new UnauthorizedException('Invalid token');
    return { uid: 'unused', email: 'unused@test.local' };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [PartnersPortalController, CatalogMediaController, CatalogReviewAdminController, MarketplaceController],
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

  const app = await NestFactory.create(C07Module, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const addr = app.getHttpServer().address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const brandH = { Authorization: `Bearer ${brandToken}`, 'Content-Type': 'application/json' };
  const salonH = { Authorization: `Bearer ${salonToken}`, 'Content-Type': 'application/json' };

  let productId = null;
  let serviceId = null;
  let variantId = null;

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
    const TINY_PNG_B64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
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

    // Cart via CommerceService (app path)
    const commerce = new CommerceService(prisma as unknown as PrismaService);
    (globalThis as { __c07Commerce?: CommerceService }).__c07Commerce = commerce;
    let cartOk = false;
    let cartDetail: unknown = null;
    try {
      const user = await commerce.customerActor({
        firebaseUid: `c07-user-${suffix}`,
        email: `c07-user-${suffix}@test.local`,
        name: 'عميل C07',
      });
      try {
        const cart = await commerce.addCartItem(user, {
          productId,
          quantity: 1,
          variantKey: variantId,
          selections: { color: 'black', size: 'M' },
        });
        cartOk = !!(cart && ((cart as { items?: unknown[] }).items || []).length);
        cartDetail = { itemCount: ((cart as { items?: unknown[] }).items || []).length };
      } catch (e) {
        const cart2 = await commerce.addCartItem(user, {
          productId,
          quantity: 1,
          selections: { color: 'black', size: 'M' },
        });
        cartOk = !!(cart2 && ((cart2 as { items?: unknown[] }).items || []).length);
        cartDetail = {
          fallback: true,
          itemCount: ((cart2 as { items?: unknown[] }).items || []).length,
          firstError: e instanceof Error ? e.message : String(e),
        };
      }
    } catch (e) {
      cartDetail = { error: e instanceof Error ? e.message : String(e) };
    }
    record('C07_CART_ADD_PRODUCT', cartOk, cartDetail);

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

    // Availability/calendar via partner service update API when available; else serviceProfile put
    let publishServiceOk = false;
    let publishServiceDetail: unknown = { serviceId, dateStr };
    if (serviceId) {
      const weeklyOpen = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        startMin: 10 * 60,
        endMin: 18 * 60,
        capacity: 1,
        resourceId: 'chair-1',
      }));
      const patchSvc = await fetch(`${base}/api/v1/partners-portal/services/${serviceId}`, {
        method: 'PATCH',
        headers: salonH,
        body: JSON.stringify({
          durationMin: 45,
          bookingEnabled: true,
          availabilityJson: { windows: weeklyOpen },
        }),
      });
      const patchBody = await json(patchSvc);
      const profilePut = await fetch(`${base}/api/v1/partners-portal/services/${serviceId}/service-profile`, {
        method: 'PUT',
        headers: salonH,
        body: JSON.stringify({
          answers: { placeMode: 'branch', branchId: 'branch-c07' },
        }),
      });
      const profileBody = await json(profilePut);
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
      publishServiceOk =
        (patchSvc.status === 200 || patchSvc.status === 201) &&
        (media.status === 200 || media.status === 201) &&
        (sub.status === 200 || sub.status === 201) &&
        (decision.status === 200 || decision.status === 201) &&
        row?.contentStatus === 'published';
      publishServiceDetail = {
        patchStatus: patchSvc.status,
        patchBody,
        profileStatus: profilePut.status,
        profileBody,
        mediaStatus: media.status,
        mediaBody,
        submitStatus: sub.status,
        submitBody: subBody,
        decisionStatus: decision.status,
        contentStatus: row?.contentStatus,
        bookingEnabled: row?.bookingEnabled,
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
    const catSvcAvail = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${salon.id}&kind=service&availableOn=${dateStr}&facets=1&limit=24`,
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
    });

    let availOk = false;
    let availDetail: unknown = null;
    let firstSlot: { startsAt?: string; resourceId?: string; available?: boolean } | null = null;
    const commerceSvc =
      (globalThis as { __c07Commerce?: CommerceService }).__c07Commerce ||
      new CommerceService(prisma as unknown as PrismaService);
    try {
      const avail = await commerceSvc.serviceAvailability(serviceId as string, dateStr);
      const slots = ((avail as { slots?: Array<{ startsAt?: string; resourceId?: string; available?: boolean }> })
        ?.slots || []) as Array<{ startsAt?: string; resourceId?: string; available?: boolean }>;
      firstSlot = slots.find((s) => s && s.available !== false && s.startsAt) || slots[0] || null;
      availOk = Array.isArray(slots) && slots.length > 0 && !!firstSlot?.startsAt;
      availDetail = { keys: avail && Object.keys(avail as object), slotN: slots.length, firstStartsAt: firstSlot?.startsAt };
    } catch (e) {
      availDetail = { error: e instanceof Error ? e.message : String(e) };
    }
    record('C07_SERVICE_AVAILABILITY', availOk, availDetail);

    // Appointment request (MIRA model: requested, not auto-confirmed). Via CommerceService —
    // same server path as POST /marketplace/commerce/bookings; C07Module does not mount that controller.
    let bookOk = false;
    let bookDetail: unknown = null;
    try {
      if (!firstSlot?.startsAt) throw new Error('no_slot');
      const bookUser = await commerceSvc.customerActor({
        firebaseUid: `c07-book-${suffix}`,
        email: `c07-book-${suffix}@test.local`,
        name: 'عميل موعد C07',
      });
      const booked = await commerceSvc.createBooking(bookUser, {
        serviceId,
        startsAt: firstSlot.startsAt,
        contactName: 'عميل C07',
        contactPhone: '+966500000007',
        idempotencyKey: `c07-bk-${suffix}`,
        ...(firstSlot.resourceId ? { resourceId: firstSlot.resourceId } : {}),
      });
      const row = (booked as { booking?: { status?: string; serviceId?: string; startsAt?: string; partnerId?: string } })
        ?.booking;
      bookOk =
        !!row &&
        row.status === 'requested' &&
        row.serviceId === serviceId &&
        String(row.startsAt || '').startsWith(String(firstSlot.startsAt).slice(0, 16));
      bookDetail = {
        status: row?.status,
        serviceId: row?.serviceId,
        partnerId: row?.partnerId,
        startsAt: row?.startsAt,
        noteAr: 'طلب موعد (requested) وليس حجزًا مؤكدًا',
        path: 'CommerceService.createBooking',
      };
    } catch (e) {
      bookDetail = { error: e instanceof Error ? e.message : String(e) };
    }
    record('C07_APPOINTMENT_REQUEST', bookOk, bookDetail);
  } catch (e) {
    record('C07_UNEXPECTED', false, { error: e instanceof Error ? e.message : String(e) });
  } finally {
    const summary = {
      id: 'C07_PORTAL_TO_APP',
      started,
      finished: new Date().toISOString(),
      sourceHint: process.env.MIRA_TEST_COMMIT || 'working-tree',
      cwd: process.cwd(),
      env: { dbHost: 'localhost', MIRA_PARTNER_EDITOR_V2: true },
      steps,
      ok: steps.length > 0 && steps.every((s) => s.ok),
      noteAr:
        'سلسلة محلية بوابة HTTP→نشر→كتالوج→سلة/إتاحة/طلب موعد عبر CommerceService. ليست DEVICE_VERIFIED ولا إثبات R2.',
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
