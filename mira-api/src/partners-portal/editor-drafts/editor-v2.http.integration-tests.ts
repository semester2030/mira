/**
 * P1 Partner Editor v2 — isolated local DB integration tests.
 * Requires DATABASE_URL pointing at localhost.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
import { EditorDraftsService } from './editor-drafts.service';
import { ServiceProfileService } from './service-profile.service';

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
    ServiceProfileService,
    FirebaseAuthGuard,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class EditorV2HttpTestModule {}

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
  process.env.ADMIN_API_KEY = 'p1-admin-test-key';
  process.env.AUTH_SKIP = 'false';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P1 Brand ${suffix}`, nameEn: 'P1 Brand', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P1 Other ${suffix}`, nameEn: 'P1 Other', city: 'جدة' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `P1 Salon ${suffix}`, nameEn: 'P1 Salon', city: 'الرياض' },
  });
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brand-p1-${suffix}@test.local`, accessToken: `token-brand-p1-${suffix}` },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `other-p1-${suffix}@test.local`, accessToken: `token-other-p1-${suffix}` },
  });
  await prisma.partnerUser.create({
    data: { partnerId: salon.id, email: `salon-p1-${suffix}@test.local`, accessToken: `token-salon-p1-${suffix}` },
  });

  const app = await NestFactory.create(EditorV2HttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const base = await baseUrl(app);

  const brandH = { authorization: `Bearer token-brand-p1-${suffix}`, 'content-type': 'application/json' };
  const otherH = { authorization: `Bearer token-other-p1-${suffix}`, 'content-type': 'application/json' };
  const salonH = { authorization: `Bearer token-salon-p1-${suffix}`, 'content-type': 'application/json' };

  const results: Array<{ id: string; status: string; detail?: string }> = [];
  const pass = (id: string, detail?: string) => results.push({ id, status: 'PASS_LOCAL', detail });

  try {
    const reg = await fetch(`${base}/api/v1/partners-portal/registry`, { headers: brandH });
    const regBody = await json(reg);
    assert.equal(reg.status, 200, JSON.stringify(regBody));
    assert.equal(regBody.editorV2Enabled, true);
    assert.equal(regBody.schemaVersion, 2);
    assert.ok(regBody.registryHash);
    assert.equal(regBody.registry.fields.nameAr.draftRequired, false);
    pass('P1.1-registry-meta');

    const legacy = await fetch(`${base}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({
        nameAr: 'منتج قديم',
        priceHalalas: 1200,
        externalUrl: '',
        concernTags: [],
        category: 'clothes',
      }),
    });
    const legacyBody = await json(legacy);
    assert.ok(legacy.status === 201 || legacy.status === 200, JSON.stringify(legacyBody));
    pass('A10-legacy-with-flag-on');

    const clientDraftId = `draft-${suffix}`;
    const emptyPut = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: {},
      }),
    });
    const emptyBody = await json(emptyPut);
    assert.equal(emptyPut.status, 200, JSON.stringify(emptyBody));
    assert.equal(emptyBody.revision, 1);
    assert.deepEqual(emptyBody.values, {});
    pass('A01-empty-draft-no-fake-price');

    const future = await fetch(`${base}/api/v1/partners-portal/editor-drafts/future-${suffix}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.abaya',
        schemaVersion: 2,
        values: {},
      }),
    });
    assert.equal(future.status, 400);
    pass('P1.1-future-profile-disabled');

    const unknown = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: 1,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: { totallyUnknownField: 'x' },
      }),
    });
    assert.equal(unknown.status, 400);
    pass('P1.1-unknown-field');

    const got = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}`, { headers: brandH });
    const gotBody = await json(got);
    assert.equal(got.status, 200);
    assert.equal(gotBody.revision, 1);
    pass('A02-retrieve-draft');

    const stolen = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}`, { headers: otherH });
    assert.equal(stolen.status, 404);
    pass('A03-deny-other-partner');

    const conflict = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: 99,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: { nameAr: 'لن تُحفظ' },
      }),
    });
    const conflictBody = await json(conflict);
    assert.equal(conflict.status, 409, JSON.stringify(conflictBody));
    assert.equal(conflictBody.code, 'DRAFT_REVISION_CONFLICT');
    pass('A05-revision-conflict');

    const filled = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: 1,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: { nameAr: 'عباية تجريبية', priceHalalas: 5000, category: 'clothes' },
      }),
    });
    const filledBody = await json(filled);
    assert.equal(filled.status, 200, JSON.stringify(filledBody));
    assert.equal(filledBody.revision, 2);

    const matKey = `mat-${suffix}`;
    const mat = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': matKey },
      body: JSON.stringify({ expectedRevision: 2, submitReview: false }),
    });
    const matBody = await json(mat);
    assert.ok(mat.status === 200 || mat.status === 201, JSON.stringify(matBody));
    assert.equal(matBody.status, 'materialized');
    assert.ok(matBody.targetOwnerId);
    assert.ok(matBody.materializedAt);
    const productRow = await prisma.product.findUniqueOrThrow({ where: { id: matBody.targetOwnerId } });
    assert.equal(productRow.contentStatus, 'draft');
    assert.equal(productRow.active, false);
    assert.equal(productRow.nameAr, 'عباية تجريبية');
    assert.equal(productRow.priceHalalas, 5000);
    pass('P1.2-materialize-create');

    const publicHit = await fetch(`${base}/api/v1/marketplace/catalog/product/${matBody.targetOwnerId}`);
    assert.equal(publicHit.status, 404);
    pass('A04-draft-absent-public');

    const matReplay = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': matKey },
      body: JSON.stringify({ expectedRevision: 2, submitReview: false }),
    });
    const matReplayBody = await json(matReplay);
    assert.ok(matReplay.status === 200 || matReplay.status === 201, JSON.stringify(matReplayBody));
    assert.equal(matReplayBody.replay, true);
    assert.equal(matReplayBody.targetOwnerId, matBody.targetOwnerId);
    assert.equal(await prisma.product.count({ where: { partnerId: brand.id, nameAr: 'عباية تجريبية' } }), 1);
    pass('A06-idempotent-same-key');

    const matMismatch = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': matKey },
      body: JSON.stringify({ expectedRevision: 2, submitReview: true }),
    });
    assert.equal(matMismatch.status, 409);
    pass('P1.2-idempotency-fingerprint-conflict');

    const matOtherKey = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${clientDraftId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': `${matKey}-other` },
      body: JSON.stringify({ expectedRevision: 2, submitReview: false }),
    });
    assert.equal(matOtherKey.status, 409);
    assert.equal(await prisma.product.count({ where: { partnerId: brand.id, nameAr: 'عباية تجريبية' } }), 1);
    pass('P1.2-two-keys-no-duplicate');

    const incompleteId = `incomplete-${suffix}`;
    await fetch(`${base}/api/v1/partners-portal/editor-drafts/${incompleteId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: { nameAr: 'بدون سعر' },
      }),
    });
    const incompleteMat = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${incompleteId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': `inc-${suffix}` },
      body: JSON.stringify({ expectedRevision: 1, submitReview: false }),
    });
    const incompleteBody = await json(incompleteMat);
    assert.equal(incompleteMat.status, 422, JSON.stringify(incompleteBody));
    assert.equal(incompleteBody.code, 'MATERIALIZE_INVALID');
    const stillOpen = await prisma.partnerEditorDraft.findUniqueOrThrow({
      where: { partnerId_clientDraftId: { partnerId: brand.id, clientDraftId: incompleteId } },
    });
    assert.equal(stillOpen.status, 'open');
    pass('P1.2-materialize-no-fake-zeros');

    const raceId = `race-${suffix}`;
    await fetch(`${base}/api/v1/partners-portal/editor-drafts/${raceId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: {},
      }),
    });
    const [r1, r2] = await Promise.all([
      fetch(`${base}/api/v1/partners-portal/editor-drafts/${raceId}`, {
        method: 'PUT',
        headers: brandH,
        body: JSON.stringify({
          expectedRevision: 1,
          kind: 'product',
          profileId: 'product.clothes',
          schemaVersion: 2,
          values: { nameAr: 'سباق واحد' },
        }),
      }),
      fetch(`${base}/api/v1/partners-portal/editor-drafts/${raceId}`, {
        method: 'PUT',
        headers: brandH,
        body: JSON.stringify({
          expectedRevision: 1,
          kind: 'product',
          profileId: 'product.clothes',
          schemaVersion: 2,
          values: { nameAr: 'سباق اثنان' },
        }),
      }),
    ]);
    const raceBodies = [await json(r1), await json(r2)];
    assert.deepEqual([r1.status, r2.status].sort(), [200, 409], JSON.stringify(raceBodies));
    pass('P1.2-concurrent-revision-db');

    const svcCreate = await fetch(`${base}/api/v1/partners-portal/services`, {
      method: 'POST',
      headers: salonH,
      body: JSON.stringify({
        nameAr: 'قص شعر P1',
        priceHalalas: 8000,
        durationMin: 45,
        category: 'hair',
        bookingEnabled: false,
      }),
    });
    const svc = await json(svcCreate);
    assert.ok(svcCreate.status === 201 || svcCreate.status === 200, JSON.stringify(svc));

    const profilePut = await fetch(`${base}/api/v1/partners-portal/services/${svc.id}/service-profile`, {
      method: 'PUT',
      headers: salonH,
      body: JSON.stringify({
        expectedRevision: svc.reviewRevision ?? 0,
        templateId: 'salon_hair_cut',
        templateVersion: 1,
        priceMode: 'fixed',
        answers: { session_kind: 'single', includes: ['wash'] },
      }),
    });
    const profileBody = await json(profilePut);
    assert.equal(profilePut.status, 200, JSON.stringify(profileBody));
    assert.equal(profileBody.serviceProfileJson.templateId, 'salon_hair_cut');
    assert.equal(profileBody.draftServiceProfileSet, false);
    pass('A07-service-profile-roundtrip-draft-row');

    await prisma.service.update({
      where: { id: svc.id },
      data: {
        contentStatus: 'published',
        active: true,
        reviewStatus: 'none',
        reviewRevision: profileBody.reviewRevision,
      },
    });
    const afterPublish = await prisma.service.findUniqueOrThrow({ where: { id: svc.id } });
    const draftProfile = await fetch(`${base}/api/v1/partners-portal/services/${svc.id}/service-profile`, {
      method: 'PUT',
      headers: salonH,
      body: JSON.stringify({
        expectedRevision: afterPublish.reviewRevision,
        templateId: 'salon_hair_cut',
        templateVersion: 1,
        priceMode: 'from',
        answers: { session_kind: 'package', package_sessions: 4 },
      }),
    });
    const draftProfileBody = await json(draftProfile);
    assert.equal(draftProfile.status, 200, JSON.stringify(draftProfileBody));
    assert.equal(draftProfileBody.draftServiceProfileSet, true);
    assert.equal(draftProfileBody.serviceProfileJson.priceMode, 'fixed');
    assert.equal(draftProfileBody.draftServiceProfileJson.priceMode, 'from');

    const publicSvc = await fetch(`${base}/api/v1/marketplace/catalog/service/${svc.id}`);
    const publicSvcBody = await json(publicSvc);
    assert.equal(publicSvc.status, 200, JSON.stringify(publicSvcBody));
    assert.equal(publicSvcBody.serviceProfileJson.priceMode, 'fixed');
    assert.equal(publicSvcBody.draftServiceProfileJson, undefined);
    pass('A09-public-keeps-approved-until-review');

    const importConflictPreviewRev = draftProfileBody.reviewRevision;
    await prisma.service.update({
      where: { id: svc.id },
      data: { reviewRevision: { increment: 1 } },
    });
    const importStale = await fetch(`${base}/api/v1/partners-portal/services/${svc.id}/import-local-template`, {
      method: 'POST',
      headers: salonH,
      body: JSON.stringify({
        confirm: true,
        expectedRevision: importConflictPreviewRev,
        force: true,
        templateState: {
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: { session_kind: 'single' },
        },
      }),
    });
    assert.equal(importStale.status, 409);
    pass('A08-import-force-cannot-bypass-newer-revision');

    const fresh = await prisma.service.findUniqueOrThrow({ where: { id: svc.id } });
    const importOk = await fetch(`${base}/api/v1/partners-portal/services/${svc.id}/import-local-template`, {
      method: 'POST',
      headers: salonH,
      body: JSON.stringify({
        confirm: true,
        expectedRevision: fresh.reviewRevision,
        force: true,
        templateState: {
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: { session_kind: 'single', package_sessions: 3 },
        },
      }),
    });
    const importOkBody = await json(importOk);
    assert.ok(importOk.status === 200 || importOk.status === 201, JSON.stringify(importOkBody));
    pass('A08-import-confirm-on-fresh-revision');

    process.env.MIRA_PARTNER_EDITOR_V2 = 'false';
    const blocked = await fetch(`${base}/api/v1/partners-portal/editor-drafts/blocked-${suffix}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: {},
      }),
    });
    assert.equal(blocked.status, 403);
    assert.ok((await prisma.partnerEditorDraft.count({ where: { partnerId: brand.id } })) >= 1);
    pass('A11-flag-off-keeps-drafts');

    const legacyOff = await fetch(`${base}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({
        nameAr: 'منتج بعد التعطيل',
        priceHalalas: 900,
        externalUrl: '',
        concernTags: [],
        category: 'clothes',
      }),
    });
    assert.ok(legacyOff.status === 201 || legacyOff.status === 200);
    pass('A10-legacy-with-flag-off');

    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, results, error: String(error) }, null, 2));
    process.exitCode = 1;
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main();
