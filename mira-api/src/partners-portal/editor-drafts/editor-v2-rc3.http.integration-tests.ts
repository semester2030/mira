/**
 * P1 RC3 HTTP: cross-partner isolation, field round-trip values, template rejects.
 * Requires DATABASE_URL → mira_p1_rc3_test on localhost/127.0.0.1.
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
class EditorV2Rc3HttpTestModule {}

function assertRc3Db(url: string) {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const db = parsed.pathname.replace(/^\//, '').split('?')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(`REFUSE: host must be localhost/127.0.0.1, got ${host}`);
  }
  if (db !== 'mira_p1_rc3_test') {
    throw new Error(`REFUSE: RC3 requires database mira_p1_rc3_test, got ${db}`);
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
  const { host, db } = assertRc3Db(url);
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'p1-rc3-admin';
  process.env.AUTH_SKIP = 'false';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brandA = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `RC3 A ${suffix}`, nameEn: 'RC3A', city: 'الرياض' },
  });
  const brandB = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `RC3 B ${suffix}`, nameEn: 'RC3B', city: 'جدة' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `RC3 Salon ${suffix}`, nameEn: 'RC3S', city: 'الرياض' },
  });
  await prisma.partnerUser.create({
    data: { partnerId: brandA.id, email: `a-rc3-${suffix}@test.local`, accessToken: `token-a-rc3-${suffix}` },
  });
  await prisma.partnerUser.create({
    data: { partnerId: brandB.id, email: `b-rc3-${suffix}@test.local`, accessToken: `token-b-rc3-${suffix}` },
  });
  await prisma.partnerUser.create({
    data: { partnerId: salon.id, email: `salon-rc3-${suffix}@test.local`, accessToken: `token-salon-rc3-${suffix}` },
  });

  const app = await NestFactory.create(EditorV2Rc3HttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const base = await baseUrl(app);
  const aH = { authorization: `Bearer token-a-rc3-${suffix}`, 'content-type': 'application/json' };
  const bH = { authorization: `Bearer token-b-rc3-${suffix}`, 'content-type': 'application/json' };
  const salonH = { authorization: `Bearer token-salon-rc3-${suffix}`, 'content-type': 'application/json' };

  const results: Array<{ id: string; status: string }> = [];
  const pass = (id: string) => results.push({ id, status: 'PASS_LOCAL' });

  try {
    const draftId = `rc3-product-${suffix}`;
    const sizeField = (await (await fetch(`${base}/api/v1/partners-portal/registry`, { headers: aH })).json())
      .registry.fields.sizes.values[0];

    let res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}`, {
      method: 'PUT',
      headers: aH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: {
          nameAr: 'منتج RC3',
          nameEn: 'RC3 Product',
          descriptionAr: 'وصف تجريبي',
          category: 'clothes',
          priceHalalas: 5500,
          colors: ['black', 'ivory'],
          sizes: [sizeField],
          stockQty: 7,
          purchaseMode: 'external',
          deliveryFeeHalalas: 1500,
        },
      }),
    });
    let body = await json(res);
    assert.ok(res.status === 200 || res.status === 201, JSON.stringify(body));
    assert.equal(body.revision, 1);
    pass('RC3-draft-save-full-fields');

    // B cannot read A's draft
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}`, { headers: bH });
    assert.ok(res.status === 403 || res.status === 404, `B read status ${res.status}`);
    pass('RC3-cross-partner-get-denied');

    // B may create its own row under the same clientDraftId string (scoped by partnerId),
    // but must not mutate A's draft values.
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}`, {
      method: 'PUT',
      headers: bH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: { nameAr: 'اختراق' },
      }),
    });
    assert.ok(res.status === 200 || res.status === 201 || res.status === 403 || res.status === 404, `B write status ${res.status}`);

    // reopen A — values intact (B did not overwrite partner A)
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}`, { headers: aH });
    body = await json(res);
    assert.equal(res.status, 200);
    assert.equal(body.values.nameAr, 'منتج RC3');
    assert.equal(body.values.nameEn, 'RC3 Product');
    assert.equal(body.values.stockQty, 7);
    assert.equal(body.values.deliveryFeeHalalas, 1500);
    assert.deepEqual(body.values.colors, ['black', 'ivory']);
    assert.deepEqual(body.values.sizes, [sizeField]);
    pass('RC3-cross-partner-cannot-mutate-A');
    pass('RC3-draft-reopen-values');

    // second draft identity independent
    const draft2 = `rc3-product-b-${suffix}`;
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draft2}`, {
      method: 'PUT',
      headers: aH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: { nameAr: 'مسودة ثانية' },
      }),
    });
    body = await json(res);
    assert.ok(res.status === 200 || res.status === 201);
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}`, {
      method: 'PUT',
      headers: aH,
      body: JSON.stringify({
        expectedRevision: 1,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: {
          nameAr: 'منتج RC3 محدّث',
          nameEn: 'RC3 Product',
          descriptionAr: 'وصف تجريبي',
          category: 'clothes',
          priceHalalas: 5500,
          colors: ['black'],
          sizes: [sizeField],
          stockQty: 7,
          purchaseMode: 'external',
          deliveryFeeHalalas: 1500,
        },
      }),
    });
    body = await json(res);
    assert.equal(res.status, 200);
    assert.equal(body.revision, 2);
    const other = await json(await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draft2}`, { headers: aH }));
    assert.equal(other.values.nameAr, 'مسودة ثانية');
    pass('RC3-two-drafts-independent');

    // materialize and assert exact options + commerce fields
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}/materialize`, {
      method: 'POST',
      headers: { ...aH, 'Idempotency-Key': `mat-rc3-${suffix}` },
      body: JSON.stringify({ expectedRevision: 2, submitReview: false }),
    });
    body = await json(res);
    assert.ok(res.status === 200 || res.status === 201, JSON.stringify(body));
    const product = await prisma.product.findUnique({ where: { id: body.targetOwnerId } });
    assert.ok(product);
    assert.equal(product!.nameEn, 'RC3 Product');
    assert.equal(product!.descriptionAr, 'وصف تجريبي');
    assert.equal(product!.stockQty, 7);
    assert.equal(product!.deliveryFeeHalalas, 1500);
    const groups = product!.optionsJson as Array<{ id: string; values: Array<{ id: string }> }>;
    assert.ok(Array.isArray(groups));
    const colorG = groups.find((g) => g.id === 'color');
    assert.ok(colorG);
    assert.deepEqual(colorG!.values.map((v) => v.id), ['black']);
    pass('RC3-materialize-field-roundtrip');

    // service draft with real answers
    const svcId = `rc3-svc-${suffix}`;
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${svcId}`, {
      method: 'PUT',
      headers: salonH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        schemaVersion: 2,
        values: {
          nameAr: 'قص تجريبي',
          category: 'hair',
          priceHalalas: 8000,
          durationMin: 45,
          serviceProfile: {
            templateId: 'salon_hair_cut',
            templateVersion: 1,
            priceMode: 'fixed',
            answers: {
              session_kind: 'package',
              package_sessions: 4,
              includes: ['wash'],
            },
          },
        },
      }),
    });
    body = await json(res);
    assert.ok(res.status === 200 || res.status === 201, JSON.stringify(body));
    pass('RC3-service-draft-with-answers');

    // reject unsupported template version via draft values
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/rc3-bad-ver-${suffix}`, {
      method: 'PUT',
      headers: salonH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        schemaVersion: 2,
        values: {
          serviceProfile: {
            templateId: 'salon_hair_cut',
            templateVersion: 9999,
            priceMode: 'fixed',
            answers: {},
          },
        },
      }),
    });
    body = await json(res);
    assert.equal(res.status, 400);
    assert.equal(body.code, 'SERVICE_TEMPLATE_VERSION_UNSUPPORTED');
    pass('RC3-reject-templateVersion-9999');

    // reject answers array
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/rc3-bad-ans-${suffix}`, {
      method: 'PUT',
      headers: salonH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        schemaVersion: 2,
        values: {
          serviceProfile: {
            templateId: 'salon_hair_cut',
            templateVersion: 1,
            priceMode: 'fixed',
            answers: [],
          },
        },
      }),
    });
    body = await json(res);
    assert.equal(res.status, 400);
    assert.equal(body.code, 'SERVICE_ANSWERS_TYPE_INVALID');
    pass('RC3-reject-answers-array');

    // reject negative package_sessions
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/rc3-bad-sess-${suffix}`, {
      method: 'PUT',
      headers: salonH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        schemaVersion: 2,
        values: {
          serviceProfile: {
            templateId: 'salon_hair_cut',
            templateVersion: 1,
            priceMode: 'fixed',
            answers: { session_kind: 'package', package_sessions: -4 },
          },
        },
      }),
    });
    body = await json(res);
    assert.equal(res.status, 400);
    assert.equal(body.code, 'FIELD_VALUE_OUT_OF_RANGE');
    pass('RC3-reject-package-sessions-negative');

    console.log(JSON.stringify({ ok: true, host, db, results }, null, 2));
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
