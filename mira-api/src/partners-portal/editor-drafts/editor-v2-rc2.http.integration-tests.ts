/**
 * P1 RC2 integration: colors mapping, submit-review resume, serviceProfile draft field.
 * DATABASE_URL must be host localhost/127.0.0.1 and a dedicated/local DB name.
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

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
class EditorV2Rc2HttpTestModule {}

function assertLocalTestDb(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL parse failed');
  }
  const host = parsed.hostname;
  const db = parsed.pathname.replace(/^\//, '').split('?')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`REFUSE: host must be localhost/127.0.0.1, got ${host}`);
  }
  if (!db || db === '') throw new Error('REFUSE: database name missing');
  // Explicit allowlist for local test DBs — not production names.
  if (!/^(mira_db|mira_p1_test|mira_p1_rc2_test)$/.test(db)) {
    throw new Error(`REFUSE: unexpected database name ${db}`);
  }
  return { host, db };
}

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
  const { host, db } = assertLocalTestDb(url);
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'p1-rc2-admin';
  process.env.AUTH_SKIP = 'false';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `RC2 Brand ${suffix}`, nameEn: 'RC2', city: 'الرياض' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `RC2 Salon ${suffix}`, nameEn: 'RC2S', city: 'الرياض' },
  });
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brand-rc2-${suffix}@test.local`, accessToken: `token-brand-rc2-${suffix}` },
  });
  await prisma.partnerUser.create({
    data: { partnerId: salon.id, email: `salon-rc2-${suffix}@test.local`, accessToken: `token-salon-rc2-${suffix}` },
  });

  const app = await NestFactory.create(EditorV2Rc2HttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const base = await baseUrl(app);
  const brandH = { authorization: `Bearer token-brand-rc2-${suffix}`, 'content-type': 'application/json' };
  const salonH = { authorization: `Bearer token-salon-rc2-${suffix}`, 'content-type': 'application/json' };
  const results: Array<{ id: string; status: string }> = [];
  const pass = (id: string) => results.push({ id, status: 'PASS_LOCAL' });

  try {
    // Colors → optionsJson on materialize
    const draftId = `colors-${suffix}`;
    const sizeField = (await (await fetch(`${base}/api/v1/partners-portal/registry`, { headers: brandH })).json())
      .registry.fields.sizes.values[0];
    let put = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: {
          nameAr: 'عباية ألوان',
          priceHalalas: 7000,
          category: 'clothes',
          colors: ['black', 'ivory'],
          sizes: [sizeField],
        },
      }),
    });
    let body = await json(put);
    assert.equal(put.status, 200, JSON.stringify(body));
    const matKey = `mat-colors-${suffix}`;
    let mat = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': matKey },
      body: JSON.stringify({ expectedRevision: 1, submitReview: false }),
    });
    body = await json(mat);
    assert.ok(mat.status === 200 || mat.status === 201, JSON.stringify(body));
    const product = await prisma.product.findUniqueOrThrow({ where: { id: body.targetOwnerId } });
    assert.ok(Array.isArray(product.optionsJson), 'optionsJson missing');
    const groups = product.optionsJson as Array<{ id: string; values: Array<{ id: string }> }>;
    assert.ok(groups.some((g) => g.id === 'color' && g.values.some((v) => v.id === 'black')));
    assert.ok(groups.some((g) => g.id === 'size'));
    pass('RC2-colors-sizes-materialize');

    // Draft serviceProfile accepted (registry field)
    const svcDraft = `svcprof-${suffix}`;
    put = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${svcDraft}`, {
      method: 'PUT',
      headers: salonH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        schemaVersion: 2,
        values: {
          nameAr: 'قص مع قالب',
          priceHalalas: 5000,
          durationMin: 40,
          serviceProfile: {
            templateId: 'salon_hair_cut',
            templateVersion: 1,
            priceMode: 'fixed',
            answers: { session_kind: 'single', includes: ['wash'] },
          },
        },
      }),
    });
    body = await json(put);
    assert.equal(put.status, 200, JSON.stringify(body));
    pass('RC2-serviceProfile-in-draft-values');

    mat = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${svcDraft}/materialize`, {
      method: 'POST',
      headers: { ...salonH, 'Idempotency-Key': `mat-svc-${suffix}` },
      body: JSON.stringify({ expectedRevision: 1, submitReview: false }),
    });
    body = await json(mat);
    assert.ok(mat.status === 200 || mat.status === 201, JSON.stringify(body));
    const service = await prisma.service.findUniqueOrThrow({ where: { id: body.targetOwnerId } });
    const profile = service.serviceProfileJson as { answers?: Record<string, unknown> };
    assert.ok(profile?.answers?.includes || profile?.answers?.session_kind);
    pass('RC2-serviceProfile-persisted-on-materialize');

    // materialize success + submitReview fail (no media) → honest error + resume
    const resumeId = `resume-${suffix}`;
    await fetch(`${base}/api/v1/partners-portal/editor-drafts/${resumeId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: { nameAr: 'استئناف مراجعة', priceHalalas: 3000, category: 'clothes' },
      }),
    });
    const resumeKey = `resume-key-${suffix}`;
    mat = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${resumeId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': resumeKey },
      body: JSON.stringify({ expectedRevision: 1, submitReview: true }),
    });
    body = await json(mat);
    assert.equal(mat.status, 503, JSON.stringify(body));
    assert.equal(body.code, 'MATERIALIZE_SUBMIT_REVIEW_FAILED');
    assert.ok(body.targetOwnerId);
    const draftRow = await prisma.partnerEditorDraft.findUniqueOrThrow({
      where: { partnerId_clientDraftId: { partnerId: brand.id, clientDraftId: resumeId } },
    });
    assert.equal(draftRow.status, 'materialized');
    assert.equal(draftRow.submitReviewStatus, 'failed');
    assert.equal(
      await prisma.product.count({ where: { partnerId: brand.id, nameAr: 'استئناف مراجعة' } }),
      1,
    );
    pass('RC2-materialize-submit-fail-keeps-one-product');

    // add media then retry same key
    await fetch(`${base}/api/v1/partners-portal/products/${body.targetOwnerId}/media`, {
      method: 'POST',
      headers: brandH,
      body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
    });
    mat = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${resumeId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': resumeKey },
      body: JSON.stringify({ expectedRevision: 1, submitReview: true }),
    });
    body = await json(mat);
    assert.ok(mat.status === 200 || mat.status === 201, JSON.stringify(body));
    assert.equal(body.reviewSubmitted, true);
    assert.equal(body.replay, true);
    const after = await prisma.partnerEditorDraft.findUniqueOrThrow({
      where: { partnerId_clientDraftId: { partnerId: brand.id, clientDraftId: resumeId } },
    });
    assert.equal(after.submitReviewStatus, 'submitted');
    assert.equal(
      await prisma.product.count({ where: { partnerId: brand.id, nameAr: 'استئناف مراجعة' } }),
      1,
    );
    pass('RC2-submit-resume-same-key');

    // Reject bad colors via API
    put = await fetch(`${base}/api/v1/partners-portal/editor-drafts/bad-color-${suffix}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: { colors: ['NOT_A_COLOR'] },
      }),
    });
    assert.equal(put.status, 400);
    pass('RC2-api-rejects-unknown-color');

    console.log(JSON.stringify({ ok: true, host, db, results }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, host, db, results, error: String(error) }, null, 2));
    process.exitCode = 1;
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main();
