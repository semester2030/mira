/**
 * P1 RC4 HTTP: UI-shaped options payload, optionsJson registry, resume semantics.
 * DATABASE_URL must be mira_p1_rc4_test on localhost/127.0.0.1.
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
import { hashPartnerPassword } from '../partner-password';

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
class EditorV2Rc4HttpTestModule {}

function assertRc4Db(url: string) {
  const parsed = new URL(url);
  const host = parsed.hostname;
  const db = parsed.pathname.replace(/^\//, '').split('?')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`REFUSE host ${host}`);
  if (db !== 'mira_p1_rc4_test') throw new Error(`REFUSE db ${db}`);
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

/** Payload shaped like portal after M + أسود chips (canonical ids + optionsJson). */
function uiShapedClothesValues() {
  return {
    nameAr: 'منتج خيارات RC4',
    nameEn: 'RC4 Options',
    descriptionAr: 'وصف',
    category: 'clothes',
    priceHalalas: 4200,
    purchaseMode: 'external',
    stockQty: 3,
    deliveryFeeHalalas: 1000,
    colors: ['black'],
    sizes: ['M'],
    optionsJson: [
      { id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 'M', labelAr: 'M' }] },
      {
        id: 'color',
        labelAr: 'اللون',
        kind: 'color',
        values: [
          { id: 'black', labelAr: 'أسود' },
          { id: 'custom:gold-special', labelAr: 'ذهبي خاص' },
        ],
      },
    ],
    variantsJson: [
      {
        id: 'sku-m-black',
        selections: { size: 'M', color: 'black' },
        labels: { size: 'M', color: 'أسود' },
        available: true,
      },
    ],
  };
}

async function main() {
  const { host, db } = assertRc4Db(process.env.DATABASE_URL ?? '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'p1-rc4-admin';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `RC4 Brand ${suffix}`, nameEn: 'RC4B', city: 'الرياض' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `RC4 Salon ${suffix}`, nameEn: 'RC4S', city: 'الرياض' },
  });
  const password = `Rc4!${suffix}pass`;
  const passwordHash = await hashPartnerPassword(password);
  await prisma.partnerUser.create({
    data: {
      partnerId: brand.id,
      email: `brand-rc4-${suffix}@test.local`,
      accessToken: `token-brand-rc4-${suffix}`,
      passwordHash,
    },
  });
  await prisma.partnerUser.create({
    data: {
      partnerId: salon.id,
      email: `salon-rc4-${suffix}@test.local`,
      accessToken: `token-salon-rc4-${suffix}`,
      passwordHash: await hashPartnerPassword(password),
    },
  });

  const app = await NestFactory.create(EditorV2Rc4HttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const base = await baseUrl(app);
  const brandH = { authorization: `Bearer token-brand-rc4-${suffix}`, 'content-type': 'application/json' };
  const salonH = { authorization: `Bearer token-salon-rc4-${suffix}`, 'content-type': 'application/json' };
  const results: Array<{ id: string; status: string }> = [];
  const pass = (id: string) => results.push({ id, status: 'PASS_LOCAL' });

  try {
    // Reject lowercase m / Arabic color id in colors/sizes arrays
    let res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/rc4-bad-ids-${suffix}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: { colors: ['أسود'], sizes: ['m'] },
      }),
    });
    let body = await json(res);
    assert.equal(res.status, 400);
    pass('RC4-reject-noncanonical-color-size-ids');

    // Accept UI-shaped payload
    const draftId = `rc4-ui-options-${suffix}`;
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: uiShapedClothesValues(),
      }),
    });
    body = await json(res);
    assert.ok(res.status === 200 || res.status === 201, JSON.stringify(body));
    assert.equal(body.revision, 1);
    assert.deepEqual(body.values.sizes, ['M']);
    assert.deepEqual(body.values.colors, ['black']);
    assert.ok(Array.isArray(body.values.optionsJson));
    pass('RC4-ui-shaped-options-save');

    // Broken variant ref rejected
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/rc4-bad-var-${suffix}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: {
          optionsJson: [{ id: 'size', values: [{ id: 'M', labelAr: 'M' }] }],
          variantsJson: [{ id: 'x', selections: { size: 'ZZ' } }],
        },
      }),
    });
    body = await json(res);
    assert.equal(res.status, 400);
    assert.equal(body.code, 'VARIANTS_JSON_BROKEN_REF');
    pass('RC4-reject-broken-variant-ref');

    // Materialize keeps option ids
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}/materialize`, {
      method: 'POST',
      headers: { ...brandH, 'Idempotency-Key': `mat-rc4-${suffix}` },
      body: JSON.stringify({ expectedRevision: 1, submitReview: false }),
    });
    body = await json(res);
    assert.ok(res.status === 200 || res.status === 201, JSON.stringify(body));
    const product = await prisma.product.findUnique({ where: { id: body.targetOwnerId } });
    assert.ok(product);
    const groups = product!.optionsJson as Array<{ id: string; values: Array<{ id: string; labelAr: string }> }>;
    const sizeG = groups.find((g) => g.id === 'size');
    const colorG = groups.find((g) => g.id === 'color');
    assert.ok(sizeG!.values.some((v) => v.id === 'M'));
    assert.ok(colorG!.values.some((v) => v.id === 'black' && v.labelAr === 'أسود'));
    assert.ok(colorG!.values.some((v) => v.id.startsWith('custom:')));
    pass('RC4-materialize-preserves-option-ids');

    // Second PUT on materialized draft fails (resume must not use open PUT)
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/${draftId}`, {
      method: 'PUT',
      headers: brandH,
      body: JSON.stringify({
        expectedRevision: 1,
        kind: 'product',
        profileId: 'product.clothes',
        schemaVersion: 2,
        values: uiShapedClothesValues(),
      }),
    });
    body = await json(res);
    assert.equal(res.status, 409);
    assert.equal(body.code, 'DRAFT_ALREADY_MATERIALIZED');
    pass('RC4-materialized-draft-rejects-put');

    // Salon service draft with real answers
    res = await fetch(`${base}/api/v1/partners-portal/editor-drafts/rc4-svc-${suffix}`, {
      method: 'PUT',
      headers: salonH,
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        schemaVersion: 2,
        values: {
          nameAr: 'قص RC4',
          category: 'hair',
          priceHalalas: 9000,
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
    body = await json(res);
    assert.ok(res.status === 200 || res.status === 201, JSON.stringify(body));
    pass('RC4-salon-service-draft');

    console.log(
      JSON.stringify(
        {
          ok: true,
          host,
          db,
          brandEmail: `brand-rc4-${suffix}@test.local`,
          salonEmail: `salon-rc4-${suffix}@test.local`,
          password,
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
