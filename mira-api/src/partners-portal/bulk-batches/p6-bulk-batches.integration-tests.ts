/**
 * P6 bulk batches — local DB integration.
 * Requires DATABASE_URL → localhost and MIRA_PARTNER_EDITOR_V2=true.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../../common/auth/firebase-id-token-verifier';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogContentService } from '../../marketplace/catalog-content.service';
import { CatalogMediaController } from '../../marketplace/catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { CatalogReviewAdminController } from '../../marketplace/catalog-review.admin.controller';
import { MarketplaceController } from '../../marketplace/marketplace.controller';
import { MarketplaceService } from '../../marketplace/marketplace.service';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import { PartnersPortalController } from '../partners-portal.controller';
import { PartnersPortalService } from '../partners-portal.service';
import { RegistryService } from '../registry/registry.service';
import { BulkBatchesService } from './bulk-batches.service';
import { EditorDraftsService } from '../editor-drafts/editor-drafts.service';
import { ServiceProfileService } from '../editor-drafts/service-profile.service';
import { VariantInventoryService } from '../variant-inventory.service';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
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
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class P6BulkHttpTestModule {}

async function baseUrl(app: INestApplication) {
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

async function json(res: Response) {
  return res.json().catch(() => ({}));
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'p6-admin-test-key';
  process.env.AUTH_SKIP = 'false';

  const startedUTC = new Date().toISOString();
  const runId = `p6-bulk-${Date.now()}`;
  const outDir = join(process.cwd(), '..', 'audit-out', 'p0-p7-final', 'logs', runId);
  mkdirSync(outDir, { recursive: true });
  const results: Array<Record<string, unknown>> = [];
  const record = (id: string, ok: boolean, detail: unknown) => {
    results.push({ id, ok, detail });
    console.log(JSON.stringify({ id, ok, detail }));
  };

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P6 Brand ${suffix}`, nameEn: 'P6 Brand', city: 'الرياض' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `P6 Salon ${suffix}`, nameEn: 'P6 Salon', city: 'جدة' },
  });
  const brandToken = `token-p6-brand-${suffix}`;
  const salonToken = `token-p6-salon-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brand-p6-${suffix}@test.local`, accessToken: brandToken },
  });
  await prisma.partnerUser.create({
    data: { partnerId: salon.id, email: `salon-p6-${suffix}@test.local`, accessToken: salonToken },
  });

  const app = await NestFactory.create(P6BulkHttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const base = await baseUrl(app);
  const brandH = { Authorization: `Bearer ${brandToken}`, 'Content-Type': 'application/json' };
  const salonH = { Authorization: `Bearer ${salonToken}`, 'Content-Type': 'application/json' };

  try {
    // —— 1 card product batch
    const one = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 1, batchId: `one-${suffix}` }),
    });
    const oneBody = (await json(one)) as { batchId: string; cards: Array<{ cardId: string; revision: number }> };
    record('P6_BULK_CREATE_ONE', one.status === 201 || one.status === 200, { status: one.status, cards: oneBody.cards?.length });

    const put1 = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${oneBody.batchId}/cards/c001`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: oneBody.cards[0].revision,
        values: {
          nameAr: `منتج فردي ${suffix}`,
          priceHalalas: 12000,
          purchaseMode: 'external',
          externalUrl: 'https://example.test/p6-one',
        },
        overwriteWritten: true,
      }),
    });
    const put1Body = (await json(put1)) as { revision: number };
    record('P6_BULK_PUT_ONE', put1.status === 200 || put1.status === 201, { status: put1.status });

    const mat1 = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${oneBody.batchId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': `mat-one-${suffix}` },
      body: JSON.stringify({ submitReview: false }),
    });
    const mat1Body = (await json(mat1)) as {
      succeeded: number;
      failed: number;
      results: Array<{ ok: boolean; targetOwnerId?: string }>;
    };
    record(
      'P6_BULK_MAT_ONE',
      mat1.status === 200 || mat1.status === 201 ? mat1Body.succeeded === 1 && mat1Body.failed === 0 : false,
      mat1Body,
    );
    const owner1 = mat1Body.results?.[0]?.targetOwnerId;
    const product1 = owner1
      ? await prisma.product.findFirst({ where: { id: owner1, partnerId: brand.id } })
      : null;
    record('P6_BULK_OWNER_ONE', !!product1 && product1.partnerId === brand.id, {
      owner1,
      partnerId: product1?.partnerId,
    });

    // Replay materialize must not duplicate
    const mat1b = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${oneBody.batchId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': `mat-one-${suffix}` },
      body: JSON.stringify({ submitReview: false, failedOnly: true }),
    });
    const mat1bBody = (await json(mat1b)) as { succeeded: number; skipped: number; results: Array<{ skipped?: boolean }> };
    const countProducts = await prisma.product.count({
      where: { partnerId: brand.id, nameAr: `منتج فردي ${suffix}` },
    });
    record(
      'P6_BULK_NO_DUP_ONE',
      (mat1b.status === 200 || mat1b.status === 201) && countProducts === 1 && mat1bBody.skipped >= 1,
      { countProducts, mat1bBody },
    );

    // —— 10 cards; one incomplete mid-batch
    const ten = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 10, batchId: `ten-${suffix}` }),
    });
    const tenBody = (await json(ten)) as {
      batchId: string;
      cards: Array<{ cardId: string; revision: number }>;
      maxCards: number;
    };
    record('P6_BULK_CREATE_TEN', (ten.status === 200 || ten.status === 201) && tenBody.cards?.length === 10, {
      status: ten.status,
      n: tenBody.cards?.length,
      maxCards: tenBody.maxCards,
    });

    // Shared fill preview then apply (file count must not drive card count — we keep 10)
    const preview = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}/apply-shared`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({
        previewOnly: true,
        cardIds: tenBody.cards.map((c) => c.cardId),
        values: { purchaseMode: 'external', externalUrl: 'https://example.test/p6-ten' },
      }),
    });
    const previewBody = (await json(preview)) as { preview: boolean; fieldsThatWillChange: string[] };
    const okHttp = (s: number) => s === 200 || s === 201;
    record('P6_BULK_SHARED_PREVIEW', okHttp(preview.status) && previewBody.preview === true, previewBody);

    const shared = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}/apply-shared`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({
        cardIds: tenBody.cards.map((c) => c.cardId),
        values: { purchaseMode: 'external', externalUrl: 'https://example.test/p6-ten' },
        overwriteWritten: true,
      }),
    });
    const sharedBody = (await json(shared)) as { results: Array<{ ok: boolean }> };
    record(
      'P6_BULK_SHARED_APPLY',
      okHttp(shared.status) && sharedBody.results?.every((r) => r.ok) === true,
      { status: shared.status, nOk: sharedBody.results?.filter((r) => r.ok).length },
    );

    // Fill 9 cards with names+prices; leave c005 incomplete
    for (const card of tenBody.cards) {
      if (card.cardId === 'c005') continue;
      const got = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}`, { headers: brandH });
      const gotBody = (await json(got)) as { cards: Array<{ cardId: string; revision: number }> };
      const rev = gotBody.cards.find((c) => c.cardId === card.cardId)!.revision;
      await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}/cards/${card.cardId}`, {
        method: 'PUT',
        headers: brandH,
        body: JSON.stringify({
          expectedRevision: rev,
          values: { nameAr: `دفعة10 ${card.cardId} ${suffix}`, priceHalalas: 5000 + Number(card.cardId.slice(1)) },
          overwriteWritten: true,
        }),
      });
    }

    // Overwrite guard: writing without overwriteWritten on filled name must 409
    const gotGuard = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}`, { headers: brandH });
    const guardBatch = (await json(gotGuard)) as { cards: Array<{ cardId: string; revision: number }> };
    const c001 = guardBatch.cards.find((c) => c.cardId === 'c001')!;
    const guard = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}/cards/c001`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: c001.revision,
        values: { nameAr: 'استبدال ممنوع' },
        overwriteWritten: false,
      }),
    });
    const guardBody = await json(guard);
    record('P6_BULK_OVERWRITE_GUARD', guard.status === 409, { status: guard.status, body: guardBody });

    const matTen = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': `mat-ten-${suffix}` },
      body: JSON.stringify({ submitReview: false }),
    });
    const matTenBody = (await json(matTen)) as {
      succeeded: number;
      failed: number;
      results: Array<{ cardId: string; ok: boolean; targetOwnerId?: string }>;
    };
    record(
      'P6_BULK_MAT_TEN_PARTIAL',
      matTenBody.succeeded === 9 && matTenBody.failed === 1 && matTenBody.results.some((r) => r.cardId === 'c005' && !r.ok),
      matTenBody,
    );

    // Fix c005 and retry failed only
    const after = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}`, { headers: brandH });
    const afterBody = (await json(after)) as { cards: Array<{ cardId: string; revision: number; status: string }> };
    const c005 = afterBody.cards.find((c) => c.cardId === 'c005')!;
    await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}/cards/c005`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: c005.revision,
        values: {
          nameAr: `دفعة10 c005 ${suffix}`,
          priceHalalas: 5500,
          purchaseMode: 'external',
          externalUrl: 'https://example.test/p6-ten',
        },
        overwriteWritten: true,
      }),
    });
    const matRetry = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${tenBody.batchId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': `mat-ten-retry-${suffix}` },
      body: JSON.stringify({ submitReview: false, failedOnly: true }),
    });
    const matRetryBody = (await json(matRetry)) as { succeeded: number; skipped: number; failed: number };
    const tenCount = await prisma.product.count({
      where: { partnerId: brand.id, nameAr: { startsWith: `دفعة10 `, contains: suffix } },
    });
    record(
      'P6_BULK_RETRY_FAILED_ONLY',
      matRetryBody.succeeded === 1 && matRetryBody.skipped === 9 && matRetryBody.failed === 0 && tenCount === 10,
      { matRetryBody, tenCount },
    );

    // Independent offers under same partner
    const owners = matTenBody.results.filter((r) => r.ok).map((r) => r.targetOwnerId!);
    const uniqueOwners = new Set(owners);
    record('P6_BULK_INDEPENDENT_OWNERS', uniqueOwners.size === 9, { unique: uniqueOwners.size });

    // —— service batch (salon)
    const svc = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: salonH,
      body: JSON.stringify({ kind: 'service', profileId: 'service.salon_hair_cut', count: 2, batchId: `svc-${suffix}` }),
    });
    const svcBody = (await json(svc)) as { batchId: string; cards: Array<{ cardId: string; revision: number }> };
    for (const card of svcBody.cards ?? []) {
      await fetch(`${base}/api/v1/partners-portal/bulk-batches/${svcBody.batchId}/cards/${card.cardId}`, {
        method: 'PUT',
        headers: salonH,
        body: JSON.stringify({
          expectedRevision: card.revision,
          values: {
            nameAr: `خدمة جماعية ${card.cardId} ${suffix}`,
            priceHalalas: 8000,
            durationMin: card.cardId === 'c001' ? 45 : 90,
          },
          overwriteWritten: true,
        }),
      });
      // refresh revision after first put — re-get for second card uses original; fix by re-fetching each time
    }
    // Re-fill with fresh revisions
    const svcGot = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${svcBody.batchId}`, { headers: salonH });
    const svcGotBody = (await json(svcGot)) as { cards: Array<{ cardId: string; revision: number; values: Record<string, unknown> }> };
    for (const card of svcGotBody.cards) {
      if (card.values?.nameAr) continue;
      await fetch(`${base}/api/v1/partners-portal/bulk-batches/${svcBody.batchId}/cards/${card.cardId}`, {
        method: 'PUT',
        headers: salonH,
        body: JSON.stringify({
          expectedRevision: card.revision,
          values: {
            nameAr: `خدمة جماعية ${card.cardId} ${suffix}`,
            priceHalalas: 8000,
            durationMin: card.cardId === 'c001' ? 45 : 90,
          },
          overwriteWritten: true,
        }),
      });
    }
    // Ensure both filled (first loop may have 409 on second if revision stale — rewrite both cleanly)
    const svcFresh = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${svcBody.batchId}`, { headers: salonH });
    const svcFreshBody = (await json(svcFresh)) as { cards: Array<{ cardId: string; revision: number }> };
    for (const card of svcFreshBody.cards) {
      await fetch(`${base}/api/v1/partners-portal/bulk-batches/${svcBody.batchId}/cards/${card.cardId}`, {
        method: 'PUT',
        headers: salonH,
        body: JSON.stringify({
          expectedRevision: card.revision,
          values: {
            nameAr: `خدمة جماعية ${card.cardId} ${suffix}`,
            priceHalalas: 8000,
            durationMin: card.cardId === 'c001' ? 45 : 90,
          },
          overwriteWritten: true,
        }),
      });
    }
    const matSvc = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${svcBody.batchId}/materialize`, {
      method: 'POST',
      headers: { ...salonH, 'Idempotency-Key': `mat-svc-${suffix}` },
      body: JSON.stringify({ submitReview: false }),
    });
    const matSvcBody = (await json(matSvc)) as { succeeded: number; failed: number; results: Array<{ targetOwnerId?: string }> };
    const svcRows = await prisma.service.findMany({
      where: { partnerId: salon.id, nameAr: { contains: suffix } },
    });
    record(
      'P6_BULK_SERVICE_TWO',
      matSvcBody.succeeded === 2 && svcRows.length === 2 && svcRows.every((s) => s.partnerId === salon.id),
      { matSvcBody, durations: svcRows.map((s) => s.durationMin) },
    );

    // Cross-partner isolation
    const steal = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${oneBody.batchId}`, { headers: salonH });
    record('P6_BULK_CROSS_PARTNER_404', steal.status === 404, { status: steal.status });

    // Idempotent create same batchId
    const again = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 1, batchId: `one-${suffix}` }),
    });
    const againBody = (await json(again)) as { cards: unknown[] };
    record('P6_BULK_CREATE_IDEMPOTENT', okHttp(again.status) && againBody.cards?.length === 1, {
      status: again.status,
      n: againBody.cards?.length,
    });

    // —— Partial create resume: meta+1 card then ensure completes remaining
    const resumeId = `resume-${suffix}`;
    await prisma.partnerEditorDraft.create({
      data: {
        partnerId: brand.id,
        clientDraftId: `p6:${resumeId}:_meta`,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        valuesJson: {
          v: 1,
          batchId: resumeId,
          kind: 'product',
          profileId: 'product.clothes',
          cardIds: ['c001', 'c002', 'c003'],
          count: 3,
          limit: 50,
          createdAt: new Date().toISOString(),
          createStatus: 'creating',
        },
        revision: 1,
        status: 'open',
      },
    });
    await prisma.partnerEditorDraft.create({
      data: {
        partnerId: brand.id,
        clientDraftId: `p6:${resumeId}:c001`,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        valuesJson: {},
        revision: 1,
        status: 'open',
      },
    });
    const resume = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 3, batchId: resumeId }),
    });
    const resumeBody = (await json(resume)) as { cards: unknown[]; ready?: boolean; createStatus?: string };
    record(
      'P6_BULK_CREATE_RESUME',
      okHttp(resume.status) && resumeBody.cards?.length === 3 && resumeBody.ready === true,
      { status: resume.status, n: resumeBody.cards?.length, ready: resumeBody.ready },
    );

    // Same batchId different count → conflict
    const mismatch = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 5, batchId: resumeId }),
    });
    const mismatchBody = await json(mismatch);
    record('P6_BULK_CREATE_MISMATCH', mismatch.status === 409, { status: mismatch.status, body: mismatchBody });

    // Non-integer count rejected (no silent floor)
    const floor = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 2.7, batchId: `floor-${suffix}` }),
    });
    record('P6_BULK_COUNT_NO_FLOOR', floor.status === 400, { status: floor.status, body: await json(floor) });

    // Concurrent identical creates
    const concId = `conc-${suffix}`;
    const [a, b] = await Promise.all([
      fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
        method: 'POST',
        headers: brandH,
        body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 2, batchId: concId }),
      }),
      fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
        method: 'POST',
        headers: brandH,
        body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 2, batchId: concId }),
      }),
    ]);
    const aBody = (await json(a)) as { cards: unknown[]; batchId: string };
    const bBody = (await json(b)) as { cards: unknown[]; batchId: string };
    const metaCount = await prisma.partnerEditorDraft.count({
      where: { partnerId: brand.id, clientDraftId: `p6:${concId}:_meta` },
    });
    record(
      'P6_BULK_CREATE_CONCURRENT',
      okHttp(a.status) && okHttp(b.status) && aBody.cards?.length === 2 && bBody.cards?.length === 2 && metaCount === 1,
      { a: a.status, b: b.status, metaCount },
    );

    // Clear field then reload
    const clearBatch = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 1, batchId: `clear-${suffix}` }),
    });
    const clearBody = (await json(clearBatch)) as { batchId: string; cards: Array<{ cardId: string; revision: number }> };
    await fetch(`${base}/api/v1/partners-portal/bulk-batches/${clearBody.batchId}/cards/c001`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: clearBody.cards[0].revision,
        values: { nameAr: 'للمسح', priceHalalas: 1000, purchaseMode: 'external', externalUrl: 'https://example.test/x' },
        overwriteWritten: true,
      }),
    });
    const afterName = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${clearBody.batchId}`, { headers: brandH });
    const afterNameBody = (await json(afterName)) as { cards: Array<{ revision: number; values: Record<string, unknown> }> };
    const cleared = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${clearBody.batchId}/cards/c001`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: afterNameBody.cards[0].revision,
        values: {},
        clearFields: ['nameAr'],
        overwriteWritten: true,
      }),
    });
    const clearedBody = (await json(cleared)) as { values: Record<string, unknown> };
    const reload = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${clearBody.batchId}`, { headers: brandH });
    const reloadBody = (await json(reload)) as { cards: Array<{ values: Record<string, unknown> }> };
    record(
      'P6_BULK_CLEAR_FIELD',
      okHttp(cleared.status) &&
        !Object.prototype.hasOwnProperty.call(clearedBody.values || {}, 'nameAr') &&
        !Object.prototype.hasOwnProperty.call(reloadBody.cards[0].values || {}, 'nameAr'),
      { cleared: clearedBody.values, reload: reloadBody.cards[0].values },
    );

    // Shared apply honesty: allOk false when overwrite blocked
    const sharedHonesty = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${clearBody.batchId}/apply-shared`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({
        cardIds: ['c001'],
        values: { priceHalalas: 999 },
        overwriteWritten: false,
      }),
    });
    const sharedHonestyBody = (await json(sharedHonesty)) as {
      allOk?: boolean;
      failed?: number;
      results: Array<{ ok: boolean }>;
    };
    record(
      'P6_BULK_SHARED_HONEST_PARTIAL',
      okHttp(sharedHonesty.status) &&
        sharedHonestyBody.allOk === false &&
        sharedHonestyBody.failed === 1 &&
        sharedHonestyBody.results?.[0]?.ok === false,
      sharedHonestyBody,
    );

    // List batches
    const listed = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, { headers: brandH });
    const listedBody = (await json(listed)) as { items: Array<{ batchId: string; ready?: boolean }> };
    record(
      'P6_BULK_LIST',
      okHttp(listed.status) && (listedBody.items || []).some((i) => i.batchId === resumeId && i.ready !== false),
      { n: listedBody.items?.length },
    );

    // Preview revision drift: apply with stale expectedRevisions
    const driftBatch = await fetch(`${base}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 1, batchId: `drift-${suffix}` }),
    });
    const driftBody = (await json(driftBatch)) as { batchId: string; cards: Array<{ cardId: string; revision: number }> };
    await fetch(`${base}/api/v1/partners-portal/bulk-batches/${driftBody.batchId}/cards/c001`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: driftBody.cards[0].revision,
        values: { nameAr: 'قبل', priceHalalas: 100 },
        overwriteWritten: true,
      }),
    });
    const driftGot = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${driftBody.batchId}`, { headers: brandH });
    const driftGotBody = (await json(driftGot)) as { cards: Array<{ revision: number }> };
    const driftApply = await fetch(`${base}/api/v1/partners-portal/bulk-batches/${driftBody.batchId}/apply-shared`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({
        cardIds: ['c001'],
        values: { nameAr: 'بعد' },
        overwriteWritten: true,
        expectedRevisions: { c001: driftGotBody.cards[0].revision - 1 },
      }),
    });
    const driftApplyBody = (await json(driftApply)) as {
      allOk?: boolean;
      results: Array<{ ok: boolean; error?: { code?: string } }>;
    };
    record(
      'P6_BULK_PREVIEW_REVISION_DRIFT',
      okHttp(driftApply.status) &&
        driftApplyBody.allOk === false &&
        driftApplyBody.results?.[0]?.error?.code === 'BULK_PREVIEW_REVISION_DRIFT',
      driftApplyBody,
    );

    const failed = results.filter((r) => !r.ok);
    const finishedUTC = new Date().toISOString();
    writeFileSync(
      join(outDir, 'RESULTS.json'),
      JSON.stringify({ runId, startedUTC, finishedUTC, sourceHint: 'p6-bulk-batches', results, failed: failed.map((f) => f.id) }, null, 2),
    );
    console.log(JSON.stringify({ ok: failed.length === 0, failed: failed.map((f) => f.id), outDir }));
    if (failed.length) process.exitCode = 1;
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
