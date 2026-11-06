/**
 * Full 10 products + 10 services journey via HTTP portal + catalog + cart/booking.
 * Run: set -a && source .env.rc13 && set +a && export MIRA_PARTNER_EDITOR_V2=true
 *      npx tsx scripts/p6-bulk-10x10-journey.integration.ts
 */
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
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
const outDir = join(root, 'audit-out/p0-p7-final/logs/p6-bulk-10x10');
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
class JourneyModule {}

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function json(res: Response) {
  return res.json().catch(() => ({}));
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'j10-admin';
  process.env.AUTH_SKIP = 'false';

  const started = new Date().toISOString();
  const suffix = randomUUID().slice(0, 8);
  const steps: Array<{ id: string; ok: boolean; detail: unknown }> = [];
  const record = (id: string, ok: boolean, detail: unknown) => {
    steps.push({ id, ok, detail });
    console.log(JSON.stringify({ id, ok, detail }));
  };

  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `J10 Brand ${suffix}`, nameEn: 'j10-brand', city: 'الرياض' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `J10 Salon ${suffix}`, nameEn: 'j10-salon', city: 'جدة' },
  });
  const brandTok = `j10-b-${suffix}`;
  const salonTok = `j10-s-${suffix}`;
  await prisma.partnerUser.create({ data: { partnerId: brand.id, email: `j10-b-${suffix}@t.local`, accessToken: brandTok } });
  await prisma.partnerUser.create({ data: { partnerId: salon.id, email: `j10-s-${suffix}@t.local`, accessToken: salonTok } });
  const custTok = `j10-c-${suffix}`;
  customerTokens[custTok] = `j10-uid-${suffix}`;

  const app = await NestFactory.create(JourneyModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  const brandH = { Authorization: `Bearer ${brandTok}`, 'Content-Type': 'application/json' };
  const salonH = { Authorization: `Bearer ${salonTok}`, 'Content-Type': 'application/json' };
  const adminH = { 'Content-Type': 'application/json', 'x-admin-key': 'j10-admin' };
  const custH = { Authorization: `Bearer ${custTok}`, 'Content-Type': 'application/json' };

  const productIds: string[] = [];
  const serviceIds: string[] = [];

  try {
    // —— 10 products batch
    const pCreate = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 10, batchId: `j10p-${suffix}` }),
    });
    const pBatch = await json(pCreate);
    record('J10_PRODUCT_BATCH_CREATE', (pCreate.status === 201 || pCreate.status === 200) && (pBatch.cards || []).length === 10, {
      status: pCreate.status,
      n: (pBatch.cards || []).length,
      partnerId: brand.id,
    });

    for (let i = 0; i < 10; i++) {
      const card = pBatch.cards[i];
      const cardId = card.cardId;
      const price = 10000 + i * 500;
      const withVariant = i % 3 === 0;
      const values: Record<string, unknown> = {
        nameAr: `منتج J10 ${suffix}-${i + 1}`,
        priceHalalas: price,
        purchaseMode: 'internal_cod',
        externalUrl: `https://example.test/j10/${i}`,
        inventoryMode: withVariant ? 'variant' : 'product',
      };
      // leave optional description empty on even cards
      if (i % 2 === 1) values.descriptionAr = `وصف ${i + 1}`;
      if (withVariant) {
        values.colors = ['black'];
        values.sizes = ['M'];
        values.optionsJson = [
          { id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }] },
          { id: 'size', labelAr: 'المقاس', values: [{ id: 'M', labelAr: 'M' }] },
        ];
        values.variantsJson = [
          {
            id: `j10-${suffix}-${i}-bm`,
            selections: { color: 'black', size: 'M' },
            priceHalalas: price,
            available: true,
            stockQty: 5,
          },
        ];
      } else {
        values.stockQty = 8 + i;
      }
      const put = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${pBatch.batchId}/cards/${cardId}`, {
        method: 'PUT',
        headers: brandH,
        body: JSON.stringify({ expectedRevision: card.revision, values, overwriteWritten: true }),
      });
      const putBody = await json(put);
      card.revision = putBody.revision || card.revision + 1;
      record(`J10_PRODUCT_PUT_${cardId}`, put.status === 200 || put.status === 201, { status: put.status });
    }

    // shared fill on remaining draft prices for odd cards only via apply — skip if API requires; use put already done
    const matP = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${pBatch.batchId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': `j10-mat-p-${suffix}` },
      body: JSON.stringify({ submitReview: false }),
    });
    const matPBody = await json(matP);
    const matOk = matPBody.succeeded === 10 && matPBody.failed === 0;
    (matPBody.results || []).forEach((r: { targetOwnerId?: string }) => {
      if (r.targetOwnerId) productIds.push(r.targetOwnerId);
    });
    record('J10_PRODUCT_MATERIALIZE', matOk && productIds.length === 10, matPBody);

    // ownership: all products belong to brand
    const owned = await prisma.product.count({ where: { id: { in: productIds }, partnerId: brand.id } });
    record('J10_PRODUCT_OWNERSHIP', owned === 10, { owned, partnerId: brand.id });

    // publish all 10
    let publishedP = 0;
    for (let i = 0; i < productIds.length; i++) {
      const id = productIds[i];
      const media = await fetch(`${base}/api/v1/partners-portal/products/${id}/media`, {
        method: 'POST',
        headers: brandH,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG, placement: 'main' }),
      });
      const sub = await fetch(`${base}/api/v1/partners-portal/products/${id}/submit-review`, {
        method: 'POST',
        headers: brandH,
        body: JSON.stringify({}),
      });
      const subBody = await json(sub);
      if (i === 9) {
        // reject last then fix path
        const rej = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${id}/decision`, {
          method: 'POST',
          headers: adminH,
          body: JSON.stringify({
            decision: 'reject',
            note: 'j10-reject',
            revision: subBody.revision ?? subBody.reviewRevision ?? 1,
          }),
        });
        const rejOk = rej.status === 200 || rej.status === 201;
        record('J10_PRODUCT_REJECT_THEN_FIX', rejOk, { status: rej.status });
        const sub2 = await fetch(`${base}/api/v1/partners-portal/products/${id}/submit-review`, {
          method: 'POST',
          headers: brandH,
          body: JSON.stringify({}),
        });
        const sub2Body = await json(sub2);
        const dec = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${id}/decision`, {
          method: 'POST',
          headers: adminH,
          body: JSON.stringify({
            decision: 'approve',
            note: 'j10-approve',
            revision: sub2Body.revision ?? sub2Body.reviewRevision ?? 1,
          }),
        });
        const row = await prisma.product.findUnique({ where: { id } });
        if ((media.status === 200 || media.status === 201) && (dec.status === 200 || dec.status === 201) && row?.contentStatus === 'published') {
          publishedP++;
        }
        continue;
      }
      const dec = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${id}/decision`, {
        method: 'POST',
        headers: adminH,
        body: JSON.stringify({
          decision: 'approve',
          note: 'j10',
          revision: subBody.revision ?? subBody.reviewRevision ?? 1,
        }),
      });
      const row = await prisma.product.findUnique({ where: { id } });
      if (
        (media.status === 200 || media.status === 201) &&
        (sub.status === 200 || sub.status === 201) &&
        (dec.status === 200 || dec.status === 201) &&
        row?.contentStatus === 'published'
      ) {
        publishedP++;
      }
    }
    record('J10_PRODUCT_PUBLISH_ALL', publishedP === 10, { publishedP });

    const catP = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${brand.id}&kind=product&facets=1&limit=24`,
    );
    const catPBody = await json(catP);
    const foundP = (catPBody.items || catPBody.results || []).filter((it: { id?: string }) =>
      productIds.includes(it.id as string),
    ).length;
    record('J10_PRODUCT_CATALOG', catP.status === 200 && foundP === 10, { status: catP.status, foundP });

    // cart first variant product
    const variantProduct = productIds[0];
    const cart = await fetch(`${base}/api/v1/marketplace/commerce/cart/items`, {
      method: 'POST',
      headers: custH,
      body: JSON.stringify({
        productId: variantProduct,
        quantity: 1,
        selections: { color: 'black', size: 'M' },
      }),
    });
    const cartBody = await json(cart);
    record('J10_CART_VARIANT', cart.status >= 200 && cart.status < 300 && ((cartBody.items || []).length >= 1), {
      status: cart.status,
      items: (cartBody.items || []).length,
    });

    // —— 10 services
    const sCreate = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: salonH,
      body: JSON.stringify({
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        count: 10,
        batchId: `j10s-${suffix}`,
      }),
    });
    const sBatch = await json(sCreate);
    record('J10_SERVICE_BATCH_CREATE', (sCreate.status === 201 || sCreate.status === 200) && (sBatch.cards || []).length === 10, {
      status: sCreate.status,
      n: (sBatch.cards || []).length,
      partnerId: salon.id,
    });

    for (let i = 0; i < 10; i++) {
      const card = sBatch.cards[i];
      const values: Record<string, unknown> = {
        nameAr: `خدمة J10 ${suffix}-${i + 1}`,
        priceHalalas: 12000 + i * 250,
        durationMin: 30 + (i % 3) * 15,
        bookingMode: 'request',
        capacity: 1,
        // All cards get portal schedule (no later availability PATCH in this journey).
        weeklyHours: [
          { day: 'sun', open: '10:00', close: '18:00', resourceId: 'chair-j10', capacity: 1 },
          { day: 'mon', open: '10:00', close: '18:00', resourceId: 'chair-j10', capacity: 1 },
          { day: 'tue', open: '10:00', close: '18:00', resourceId: 'chair-j10', capacity: 1 },
          { day: 'wed', open: '10:00', close: '18:00', resourceId: 'chair-j10', capacity: 1 },
          { day: 'thu', open: '10:00', close: '18:00', resourceId: 'chair-j10', capacity: 1 },
        ],
        serviceProfile: {
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: { session_kind: 'single', place_mode: 'branch' },
        },
      };
      if (i === 0) values.dateExceptions = ['2099-12-31'];
      // Card 9 keeps an intentional resource override exception for isolation proof.
      if (i === 1) {
        values.weeklyHours = [
          { day: 'sun', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
          { day: 'mon', open: '10:00', close: '18:00', resourceId: 'chair-B', capacity: 5 },
          { day: 'tue', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
          { day: 'wed', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
          { day: 'thu', open: '10:00', close: '18:00', resourceId: 'chair-A', capacity: 3 },
        ];
      }
      const put = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${sBatch.batchId}/cards/${card.cardId}`, {
        method: 'PUT',
        headers: salonH,
        body: JSON.stringify({ expectedRevision: card.revision, values, overwriteWritten: true }),
      });
      const putBody = await json(put);
      record(`J10_SERVICE_PUT_${card.cardId}`, put.status === 200 || put.status === 201, {
        status: put.status,
        body: putBody,
      });
    }

    const matS = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${sBatch.batchId}/materialize`, {
      method: 'POST',
      headers: { ...salonH, 'Idempotency-Key': `j10-mat-s-${suffix}` },
      body: JSON.stringify({ submitReview: false }),
    });
    const matSBody = await json(matS);
    (matSBody.results || []).forEach((r: { targetOwnerId?: string }) => {
      if (r.targetOwnerId) serviceIds.push(r.targetOwnerId);
    });
    record('J10_SERVICE_MATERIALIZE', matSBody.succeeded === 10 && serviceIds.length === 10, matSBody);

    const ownedS = await prisma.service.count({ where: { id: { in: serviceIds }, partnerId: salon.id } });
    record('J10_SERVICE_OWNERSHIP', ownedS === 10, { ownedS, partnerId: salon.id });

    // availability persisted for first service (from weeklyHours → availabilityJson)
    if (!serviceIds[0]) {
      record('J10_SERVICE_AVAIL_PERSISTED', false, { error: 'no_service_id' });
    } else {
      const svc0 = await prisma.service.findUnique({ where: { id: serviceIds[0] } });
      const avail0 = svc0?.availabilityJson as { windows?: unknown[]; closedDates?: string[] } | null;
      record(
        'J10_SERVICE_AVAIL_PERSISTED',
        !!(avail0 && Array.isArray(avail0.windows) && avail0.windows.length >= 1),
        {
          windows: avail0 && avail0.windows && avail0.windows.length,
          closedDates: avail0?.closedDates,
          bookingEnabled: svc0?.bookingEnabled,
        },
      );
    }

    let publishedS = 0;
    for (const id of serviceIds) {
      // Do NOT PATCH availabilityJson here — journey must use portal weeklyHours → materialize only.
      const media = await fetch(`${base}/api/v1/partners-portal/services/${id}/media`, {
        method: 'POST',
        headers: salonH,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG, placement: 'main' }),
      });
      const sub = await fetch(`${base}/api/v1/partners-portal/services/${id}/submit-review`, {
        method: 'POST',
        headers: salonH,
        body: JSON.stringify({}),
      });
      const subBody = await json(sub);
      const dec = await fetch(`${base}/api/v1/admin/catalog-reviews/service/${id}/decision`, {
        method: 'POST',
        headers: adminH,
        body: JSON.stringify({
          decision: 'approve',
          note: 'j10',
          revision: subBody.revision ?? subBody.reviewRevision ?? 1,
        }),
      });
      const row = await prisma.service.findUnique({ where: { id } });
      if (
        (media.status === 200 || media.status === 201) &&
        (sub.status === 200 || sub.status === 201) &&
        (dec.status === 200 || dec.status === 201) &&
        row?.contentStatus === 'published'
      ) {
        publishedS++;
      }
    }
    record('J10_SERVICE_PUBLISH_ALL', publishedS === 10, { publishedS });

    const catS = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${salon.id}&kind=service&facets=1&limit=24`,
    );
    const catSBody = await json(catS);
    const foundS = (catSBody.items || catSBody.results || []).filter((it: { id?: string }) =>
      serviceIds.includes(it.id as string),
    ).length;
    record('J10_SERVICE_CATALOG', catS.status === 200 && foundS === 10, { status: catS.status, foundS });

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
    const dateStr = tomorrow.toISOString().slice(0, 10);
    const availHttp = await fetch(
      `${base}/api/v1/marketplace/commerce/services/${serviceIds[0]}/availability?date=${encodeURIComponent(dateStr)}`,
    );
    const availBody = await json(availHttp);
    const slots = availBody.slots || [];
    const slot = slots.find((s: { available?: boolean; startsAt?: string }) => s?.available !== false && s?.startsAt) || slots[0];
    record('J10_SERVICE_SLOTS', availHttp.status === 200 && !!slot?.startsAt, {
      status: availHttp.status,
      slotN: slots.length,
    });

    const book = await fetch(`${base}/api/v1/marketplace/commerce/bookings`, {
      method: 'POST',
      headers: { ...custH, 'Idempotency-Key': `j10-bk-${suffix}` },
      body: JSON.stringify({
        serviceId: serviceIds[0],
        startsAt: slot?.startsAt,
        contactName: 'عميل J10',
        contactPhone: '+966500000010',
        idempotencyKey: `j10-bk-${suffix}`,
        resourceId: slot?.resourceId || 'chair-j10',
      }),
    });
    const bookBody = await json(book);
    const booking = bookBody.booking || bookBody;
    const bookingId = booking?.id ? String(booking.id) : null;
    const bookingRow = bookingId
      ? await prisma.commerceBooking.findUnique({ where: { id: bookingId } })
      : null;
    record(
      'J10_BOOKING_REQUESTED',
      book.status >= 200 &&
        book.status < 300 &&
        booking?.status === 'requested' &&
        booking?.serviceId === serviceIds[0] &&
        !!bookingRow &&
        bookingRow.partnerId === salon.id &&
        bookingRow.serviceId === serviceIds[0] &&
        bookingRow.status === 'requested',
      {
        status: book.status,
        bookingStatus: booking?.status,
        serviceId: booking?.serviceId,
        partnerId: bookingRow?.partnerId,
        startsAt: booking?.startsAt,
        bookingId,
      },
    );

    // closed/unavailable reject: far past or nonsense
    const badBook = await fetch(`${base}/api/v1/marketplace/commerce/bookings`, {
      method: 'POST',
      headers: { ...custH, 'Idempotency-Key': `j10-bk-bad-${suffix}` },
      body: JSON.stringify({
        serviceId: serviceIds[0],
        startsAt: '2000-01-01T07:00:00.000Z',
        contactName: 'x',
        contactPhone: '+966500000011',
        idempotencyKey: `j10-bk-bad-${suffix}`,
      }),
    });
    record('J10_BOOKING_REJECT_PAST', badBook.status >= 400, { status: badBook.status });

    const unauth = await fetch(`${base}/api/v1/marketplace/commerce/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: serviceIds[0], startsAt: slot?.startsAt }),
    });
    record('J10_BOOKING_UNAUTHORIZED', unauth.status === 401, { status: unauth.status });
  } catch (e) {
    record('J10_UNEXPECTED', false, { error: e instanceof Error ? e.message : String(e) });
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
      id: 'P6_BULK_10x10_JOURNEY',
      started,
      finished: new Date().toISOString(),
      sourceHint,
      productIds,
      serviceIds,
      steps,
      ok: steps.length > 0 && steps.every((s) => s.ok),
      noteAr: 'رحلة HTTP 10 منتجات + 10 خدمات محلية. ليست DEVICE وليست R2.',
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
