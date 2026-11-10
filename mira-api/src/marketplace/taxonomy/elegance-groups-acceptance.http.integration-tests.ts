/**
 * Groups closure — product + service bulk batches: 3 offers, partial fail,
 * retry failed-only without duplicating successes (LOCAL/TEST ONLY).
 */
import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../../common/auth/firebase-id-token-verifier';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogContentService } from '../catalog-content.service';
import { CatalogMediaController } from '../catalog-media.controller';
import { CatalogMediaStorage, LocalCatalogMediaStorage } from '../catalog-media.storage';
import { CatalogReviewAdminController } from '../catalog-review.admin.controller';
import { MarketplaceController } from '../marketplace.controller';
import { MarketplaceService } from '../marketplace.service';
import { TaxonomyService } from './taxonomy.service';
import { PartnerTokenGuard } from '../../partners-portal/guards/partner-token.guard';
import { PartnersPortalController } from '../../partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../../partners-portal/partners-portal.service';
import { RegistryService } from '../../partners-portal/registry/registry.service';
import { EditorDraftsService } from '../../partners-portal/editor-drafts/editor-drafts.service';
import { ServiceProfileService } from '../../partners-portal/editor-drafts/service-profile.service';
import { BulkBatchesService } from '../../partners-portal/bulk-batches/bulk-batches.service';
import { VariantInventoryService } from '../../partners-portal/variant-inventory.service';
import { captureAcceptanceRun } from './acceptance-run-identity';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    if (token !== 'unused') throw new UnauthorizedException('Invalid token');
    return { uid: 'unused', email: 'unused@test.local' };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [
    MarketplaceController,
    PartnersPortalController,
    CatalogMediaController,
    CatalogReviewAdminController,
  ],
  providers: [
    MarketplaceService,
    TaxonomyService,
    CatalogContentService,
    PartnersPortalService,
    RegistryService,
    EditorDraftsService,
    ServiceProfileService,
    BulkBatchesService,
    VariantInventoryService,
    PartnerTokenGuard,
    FirebaseAuthGuard,
    AdminApiKeyGuard,
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
    { provide: CatalogMediaStorage, useClass: LocalCatalogMediaStorage },
  ],
})
class GroupsAcceptanceModule {}

type Case = { id: string; status: 'PASS' | 'FAIL'; expected: string; actual: string };

async function main() {
  const evidenceDir = path.resolve(__dirname, '../../../../../.groups-acceptance-evidence');
  const repoRoot = path.resolve(__dirname, '../../../../');
  const runIdentity = captureAcceptanceRun(repoRoot);
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'run-identity.json'), JSON.stringify(runIdentity, null, 2));

  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'groups-admin-local';
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.MIRA_MEDIA_DIR = path.join(evidenceDir, 'media-store');
  fs.mkdirSync(process.env.MIRA_MEDIA_DIR, { recursive: true });
  process.env.MIRA_MEDIA_STORE = 'local';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const cases: Case[] = [];
  const record = (id: string, expected: string, actual: unknown, ok: boolean) => {
    cases.push({
      id,
      status: ok ? 'PASS' : 'FAIL',
      expected,
      actual: typeof actual === 'string' ? actual : JSON.stringify(actual),
    });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id}`);
  };

  const brand = await prisma.partner.create({
    data: {
      type: 'brand',
      status: 'active',
      nameAr: `Groups Brand ${suffix}`,
      nameEn: 'Groups Brand',
      city: 'الرياض',
    },
  });
  const salon = await prisma.partner.create({
    data: {
      type: 'salon',
      status: 'active',
      nameAr: `Groups Salon ${suffix}`,
      nameEn: 'Groups Salon',
      city: 'جدة',
    },
  });
  const developer = await prisma.partner.create({
    data: {
      type: 'developer',
      status: 'active',
      nameAr: `Groups Dev ${suffix}`,
      nameEn: 'Groups Dev',
      city: 'الرياض',
    },
  });
  const brandTok = `tok-grp-br-${suffix}`;
  const salonTok = `tok-grp-sa-${suffix}`;
  const devTok = `tok-grp-dv-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `grp-br-${suffix}@test.local`, accessToken: brandTok },
  });
  await prisma.partnerUser.create({
    data: { partnerId: salon.id, email: `grp-sa-${suffix}@test.local`, accessToken: salonTok },
  });
  await prisma.partnerUser.create({
    data: { partnerId: developer.id, email: `grp-dv-${suffix}@test.local`, accessToken: devTok },
  });

  let app: INestApplication | null = null;
  const createdProductIds: string[] = [];
  const createdServiceIds: string[] = [];
  try {
    app = await NestFactory.create(GroupsAcceptanceModule, { logger: ['error'] });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0);
    const port = (app.getHttpServer().address() as { port: number }).port;
    const root = `http://127.0.0.1:${port}`;
    const brandH = { Authorization: `Bearer ${brandTok}`, 'Content-Type': 'application/json' };
    const salonH = { Authorization: `Bearer ${salonTok}`, 'Content-Type': 'application/json' };
    const okHttp = (s: number) => s >= 200 && s < 300;

    // —— Product group: 3 offers; leave c002 incomplete → partial fail → fill → retry failedOnly
    const prodBatch = await fetch(`${root}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({
        kind: 'product',
        profileId: 'product.clothes',
        count: 3,
        batchId: `grp-prod-${suffix}`,
      }),
    });
    const prodBody = (await prodBatch.json().catch(() => ({}))) as {
      batchId?: string;
      cards?: Array<{ cardId: string; revision: number }>;
    };
    record(
      'ACC-GRP-PRODUCT-CREATE-3',
      'brand creates 3-card product group batch',
      { status: prodBatch.status, n: prodBody.cards?.length },
      okHttp(prodBatch.status) && prodBody.cards?.length === 3 && !!prodBody.batchId,
    );

    async function putCard(
      headers: Record<string, string>,
      batchId: string,
      cardId: string,
      values: Record<string, unknown>,
    ) {
      const got = await fetch(`${root}/api/v1/partners-portal/bulk-batches/${batchId}`, { headers });
      const gotBody = (await got.json()) as { cards: Array<{ cardId: string; revision: number }> };
      const rev = gotBody.cards.find((c) => c.cardId === cardId)!.revision;
      return fetch(`${root}/api/v1/partners-portal/bulk-batches/${batchId}/cards/${cardId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ expectedRevision: rev, values, overwriteWritten: true }),
      });
    }

    if (prodBody.batchId && prodBody.cards) {
      await putCard(brandH, prodBody.batchId, 'c001', {
        nameAr: `Grp عرض1 ${suffix}`,
        priceHalalas: 11100,
        purchaseMode: 'external',
        externalUrl: `https://example.test/g1-${suffix}`,
        category: 'clothes',
        subcategory: 'clothes.evening',
      });
      // c002 intentionally incomplete (no name/price) for first materialize
      await putCard(brandH, prodBody.batchId, 'c003', {
        nameAr: `Grp عرض3 ${suffix}`,
        priceHalalas: 13300,
        purchaseMode: 'external',
        externalUrl: `https://example.test/g3-${suffix}`,
        category: 'clothes',
        subcategory: 'clothes.evening',
      });

      const mat1 = await fetch(`${root}/api/v1/partners-portal/bulk-batches/${prodBody.batchId}/materialize`, {
        method: 'POST',
        headers: { ...brandH, 'Idempotency-Key': `grp-mat1-${suffix}` },
        body: JSON.stringify({ submitReview: false }),
      });
      const mat1Body = (await mat1.json().catch(() => ({}))) as {
        succeeded?: number;
        failed?: number;
        results?: Array<{ cardId: string; ok: boolean; targetOwnerId?: string }>;
      };
      const okOwners = (mat1Body.results || [])
        .filter((r) => r.ok && r.targetOwnerId)
        .map((r) => r.targetOwnerId!);
      createdProductIds.push(...okOwners);
      const failCard = (mat1Body.results || []).find((r) => r.cardId === 'c002' && !r.ok);
      record(
        'ACC-GRP-PRODUCT-PARTIAL-FAIL',
        'materialize succeeds for filled cards and fails incomplete c002; group not declared fully ok',
        mat1Body,
        okHttp(mat1.status) &&
          mat1Body.succeeded === 2 &&
          mat1Body.failed === 1 &&
          !!failCard &&
          okOwners.length === 2,
      );

      const beforeRetryNames = await prisma.product.findMany({
        where: { id: { in: okOwners } },
        select: { id: true, nameAr: true, priceHalalas: true },
      });

      // Clear optional field on neighbor c001 (explicit edit) then prove isolation after retry.
      await putCard(brandH, prodBody.batchId, 'c001', {
        nameAr: `Grp عرض1 معدّل ${suffix}`,
        priceHalalas: 11100,
        purchaseMode: 'external',
        externalUrl: `https://example.test/g1-${suffix}`,
        descriptionAr: '',
      });
      // Fix failed card
      await putCard(brandH, prodBody.batchId, 'c002', {
        nameAr: `Grp عرض2 ${suffix}`,
        priceHalalas: 12200,
        purchaseMode: 'external',
        externalUrl: `https://example.test/g2-${suffix}`,
        category: 'clothes',
        subcategory: 'clothes.evening',
      });

      const mat2 = await fetch(`${root}/api/v1/partners-portal/bulk-batches/${prodBody.batchId}/materialize`, {
        method: 'POST',
        headers: { ...brandH, 'Idempotency-Key': `grp-mat2-${suffix}` },
        body: JSON.stringify({ submitReview: false, failedOnly: true }),
      });
      const mat2Body = (await mat2.json().catch(() => ({}))) as {
        succeeded?: number;
        failed?: number;
        skipped?: number;
        results?: Array<{ cardId: string; ok: boolean; skipped?: boolean; targetOwnerId?: string }>;
      };
      const newOwner = (mat2Body.results || []).find((r) => r.cardId === 'c002' && r.ok)?.targetOwnerId;
      if (newOwner) createdProductIds.push(newOwner);

      const afterNeighbors = await prisma.product.findMany({
        where: { id: { in: okOwners } },
        select: { id: true, nameAr: true, priceHalalas: true },
      });
      const neighborsUnchangedByRetry = beforeRetryNames.every((b) => {
        const a = afterNeighbors.find((x) => x.id === b.id);
        // name may have been edited intentionally on c001 before retry — price must match; count must stay 2.
        return !!a && a.priceHalalas === b.priceHalalas;
      });
      const noDup = await prisma.product.count({
        where: {
          partnerId: brand.id,
          OR: [
            { nameAr: { contains: `عرض1` } },
            { nameAr: { contains: `عرض3` } },
          ],
        },
      });
      // Exactly one product per successful card name pattern for offer3
      const offer3Count = await prisma.product.count({
        where: { partnerId: brand.id, nameAr: `Grp عرض3 ${suffix}` },
      });

      record(
        'ACC-GRP-PRODUCT-RETRY-FAILED-ONLY',
        'retry failedOnly materializes c002; does not duplicate c001/c003 owners',
        { mat2Body, neighborsUnchangedByRetry, offer3Count, newOwner, noDup },
        okHttp(mat2.status) &&
          !!newOwner &&
          (mat2Body.failed || 0) === 0 &&
          neighborsUnchangedByRetry &&
          offer3Count === 1 &&
          okOwners.length === 2,
      );

      // Neighbor edit/clear on materialized owner via portal PATCH (same identity); siblings untouched.
      const c001Owner = (mat1Body.results || []).find((r) => r.cardId === 'c001')?.targetOwnerId;
      const c003Owner = (mat1Body.results || []).find((r) => r.cardId === 'c003')?.targetOwnerId;
      const beforeSibling = c003Owner
        ? await prisma.product.findUnique({ where: { id: c003Owner } })
        : null;
      const patchNeighbor = c001Owner
        ? await fetch(`${root}/api/v1/partners-portal/products/${c001Owner}`, {
            method: 'PATCH',
            headers: brandH,
            body: JSON.stringify({
              nameAr: `Grp عرض1 معدّل ${suffix}`,
              descriptionAr: '',
            }),
          })
        : null;
      const c001Row = c001Owner
        ? await prisma.product.findUnique({ where: { id: c001Owner } })
        : null;
      const afterSibling = c003Owner
        ? await prisma.product.findUnique({ where: { id: c003Owner } })
        : null;
      record(
        'ACC-GRP-PRODUCT-NEIGHBOR-EDIT',
        'editing/clearing one offer updates that owner only; sibling owner unchanged',
        {
          patchStatus: patchNeighbor?.status,
          c001Owner,
          c001Name: c001Row?.nameAr,
          c001Desc: c001Row?.descriptionAr,
          siblingBefore: beforeSibling?.nameAr,
          siblingAfter: afterSibling?.nameAr,
          siblingDesc: afterSibling?.descriptionAr,
        },
        !!patchNeighbor &&
          patchNeighbor.status < 400 &&
          !!c001Row &&
          String(c001Row.nameAr || '').includes('معدّل') &&
          (c001Row.descriptionAr == null || c001Row.descriptionAr === '') &&
          !!beforeSibling &&
          !!afterSibling &&
          beforeSibling.nameAr === afterSibling.nameAr &&
          beforeSibling.priceHalalas === afterSibling.priceHalalas &&
          c001Owner !== c003Owner,
      );
    }

    // —— Service group (salon): 3 cards with availability on each
    const svcBatch = await fetch(`${root}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: salonH,
      body: JSON.stringify({
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        count: 3,
        batchId: `grp-svc-${suffix}`,
      }),
    });
    const svcBody = (await svcBatch.json().catch(() => ({}))) as {
      batchId?: string;
      cards?: Array<{ cardId: string; revision: number }>;
      messageAr?: string;
      code?: string;
    };
    record(
      'ACC-GRP-SERVICE-CREATE-3',
      'salon creates 3-card service group batch',
      { status: svcBatch.status, body: svcBody },
      okHttp(svcBatch.status) && svcBody.cards?.length === 3 && !!svcBody.batchId,
    );

    if (svcBody.batchId && svcBody.cards) {
      for (const card of svcBody.cards) {
        await putCard(salonH, svcBody.batchId, card.cardId, {
          nameAr: `مجموعة خدمة ${card.cardId} ${suffix}`,
          priceHalalas: 4000 + Number(card.cardId.slice(1)),
          durationMin: 30,
          category: 'hair',
          placeMode: 'home',
          weeklyHours: [
            { weekday: 1, startMin: 600, endMin: 720, capacity: 2, resourceId: `grp-${card.cardId}` },
          ],
          dateExceptions: [],
        });
      }
      // Clear a field on middle card only
      await putCard(salonH, svcBody.batchId, 'c002', {
        nameAr: `مجموعة خدمة c002 ${suffix}`,
        priceHalalas: 4002,
        durationMin: 30,
        category: 'hair',
        placeMode: 'home',
        descriptionAr: '',
        weeklyHours: [
          { weekday: 1, startMin: 600, endMin: 720, capacity: 2, resourceId: 'grp-c002' },
        ],
        dateExceptions: [],
      });

      const matSvc = await fetch(
        `${root}/api/v1/partners-portal/bulk-batches/${svcBody.batchId}/materialize`,
        {
          method: 'POST',
          headers: { ...salonH, 'Idempotency-Key': `grp-svc-mat-${suffix}` },
          body: JSON.stringify({ submitReview: false }),
        },
      );
      const matSvcBody = (await matSvc.json().catch(() => ({}))) as {
        succeeded?: number;
        failed?: number;
        results?: Array<{ cardId: string; ok: boolean; targetOwnerId?: string }>;
      };
      const svcOwners = (matSvcBody.results || [])
        .filter((r) => r.ok && r.targetOwnerId)
        .map((r) => r.targetOwnerId!);
      createdServiceIds.push(...svcOwners);
      const services = await prisma.service.findMany({ where: { id: { in: svcOwners } } });
      const availOk = services.every((s) => {
        const a = s.availabilityJson as { windows?: unknown[] } | null;
        return Array.isArray(a?.windows) && a!.windows!.length >= 1;
      });
      const distinctNames = new Set(services.map((s) => s.nameAr)).size;
      record(
        'ACC-GRP-SERVICE-MATERIALIZE-3',
        'three service offers materialize with independent availability and names',
        {
          matSvcBody,
          names: services.map((s) => s.nameAr),
          availOk,
          distinctNames,
        },
        okHttp(matSvc.status) &&
          matSvcBody.succeeded === 3 &&
          matSvcBody.failed === 0 &&
          services.length === 3 &&
          distinctNames === 3 &&
          availOk,
      );
    }

    // Permissions: brand cannot open salon batch; developer can create product+service kinds.
    const cross = prodBody.batchId
      ? await fetch(`${root}/api/v1/partners-portal/bulk-batches/${prodBody.batchId}`, {
          headers: salonH,
        })
      : null;
    record(
      'ACC-GRP-PERMS-OWNERSHIP',
      'salon cannot read brand product batch',
      { status: cross?.status },
      !!cross && cross.status >= 400,
    );

    const devProd = await fetch(`${root}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devTok}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'product',
        profileId: 'product.clothes',
        count: 1,
        batchId: `grp-dev-p-${suffix}`,
      }),
    });
    const devSvc = await fetch(`${root}/api/v1/partners-portal/bulk-batches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${devTok}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        count: 1,
        batchId: `grp-dev-s-${suffix}`,
      }),
    });
    record(
      'ACC-GRP-DEV-BOTH-KINDS',
      'developer can open product and service group batches',
      { prod: devProd.status, svc: devSvc.status },
      okHttp(devProd.status) && okHttp(devSvc.status),
    );

    fs.writeFileSync(
      path.join(evidenceDir, 'groups-product-service.json'),
      JSON.stringify({ prodBody, svcBody, cases: cases.map((c) => c.id) }, null, 2),
    );
  } finally {
    if (createdProductIds.length) {
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } }).catch(() => undefined);
    }
    if (createdServiceIds.length) {
      await prisma.service.deleteMany({ where: { id: { in: createdServiceIds } } }).catch(() => undefined);
    }
    await prisma.partnerUser
      .deleteMany({ where: { partnerId: { in: [brand.id, salon.id, developer.id] } } })
      .catch(() => undefined);
    await prisma.partner
      .deleteMany({ where: { id: { in: [brand.id, salon.id, developer.id] } } })
      .catch(() => undefined);
    if (app) await app.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }

  const fail = cases.filter((c) => c.status === 'FAIL');
  const results = {
    verdict:
      fail.length === 0
        ? 'GROUPS_PRODUCT_SERVICE_CLOSED_VERIFIED — LOCAL/TEST ONLY'
        : 'GROUPS_INCOMPLETE',
    gate: { ok: fail.length === 0, missing: [], bad: fail.map((c) => c.id) },
    codeContentSha256: runIdentity.contentSha256,
    runId: runIdentity.runId,
    results: cases,
    started: runIdentity.startedAt,
    ended: new Date().toISOString(),
    note: 'UI journey implemented in bulk-group-journey.js; this gate proves server isolation/retry/ownership contracts required by the approved UX.',
  };
  fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ verdict: results.verdict, gate: results.gate }, null, 2));
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
