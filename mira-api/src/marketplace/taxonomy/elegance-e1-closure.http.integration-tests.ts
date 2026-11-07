/**
 * E1 closure acceptance A–F against real Nest HTTP + local DB.
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
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogContentService } from '../catalog-content.service';
import { CatalogMediaController } from '../catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../catalog-media.storage';
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
    TaxonomyService,
    FirebaseAuthGuard,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class E1ClosureHttpTestModule {}

function pass(name: string) {
  console.log(`PASS ${name}`);
}

async function baseUrl(app: INestApplication) {
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

async function readJson(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

async function main() {
  const started = new Date().toISOString();
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'e1-closure-admin';
  process.env.AUTH_SKIP = 'false';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E1C Brand ${suffix}`, nameEn: 'E1C Brand', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E1C Other ${suffix}`, nameEn: 'E1C Other', city: 'جدة' },
  });
  const developer = await prisma.partner.create({
    data: { type: 'developer', status: 'active', nameAr: `E1C Dev ${suffix}`, nameEn: 'E1C Dev', city: 'الرياض' },
  });
  const tokenBrand = `token-e1c-brand-${suffix}`;
  const tokenOther = `token-e1c-other-${suffix}`;
  const tokenDev = `token-e1c-dev-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brand-e1c-${suffix}@test.local`, accessToken: tokenBrand },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `other-e1c-${suffix}@test.local`, accessToken: tokenOther },
  });
  await prisma.partnerUser.create({
    data: { partnerId: developer.id, email: `dev-e1c-${suffix}@test.local`, accessToken: tokenDev },
  });

  const app = await NestFactory.create(E1ClosureHttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const root = await baseUrl(app);
  const auth = (token: string) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });

  const createdIds: string[] = [];
  try {
    // —— A partial merge ——
    const createA = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products`, {
        method: 'POST',
        headers: auth(tokenBrand),
        body: JSON.stringify({
          nameAr: `دمج A ${suffix}`,
          priceHalalas: 8000,
          category: 'clothes',
          subcategory: 'clothes.abaya',
          profileId: 'product.abaya',
          attributes: { material: ['silk', 'cotton'], dimensionsCm: { w: 40, h: 100 } },
          externalUrl: 'https://example.test/a',
          optionsJson: [{ id: 'color', nameAr: 'لون', values: [{ id: 'black', labelAr: 'أسود' }] }],
          variantsJson: [{ id: 'v1', selections: { color: 'black' }, available: true, priceHalalas: 8000 }],
        }),
      }),
    );
    assert.ok(createA.status === 200 || createA.status === 201, createA.text);
    createdIds.push(createA.json.id);
    const patchDim = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${createA.json.id}`, {
        method: 'PATCH',
        headers: auth(tokenBrand),
        body: JSON.stringify({ attributes: { dimensionsCm: { w: 45 } } }),
      }),
    );
    assert.equal(patchDim.status, 200, patchDim.text);
    const rowA = await prisma.product.findUniqueOrThrow({ where: { id: createA.json.id } });
    assert.deepEqual(rowA.attributesJson, {
      material: ['silk', 'cotton'],
      dimensionsCm: { w: 45, h: 100 },
    });
    pass('A-partial-dimension-merge');

    const patchName = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${createA.json.id}`, {
        method: 'PATCH',
        headers: auth(tokenBrand),
        body: JSON.stringify({ nameAr: `دمج اسم ${suffix}` }),
      }),
    );
    assert.equal(patchName.status, 200, patchName.text);
    const rowName = await prisma.product.findUniqueOrThrow({ where: { id: createA.json.id } });
    assert.equal(rowName.nameAr, `دمج اسم ${suffix}`);
    assert.deepEqual(rowName.attributesJson, {
      material: ['silk', 'cotton'],
      dimensionsCm: { w: 45, h: 100 },
    });
    assert.equal(rowName.priceHalalas, 8000);
    assert.ok(Array.isArray(rowName.optionsJson) && (rowName.optionsJson as unknown[]).length === 1);
    assert.ok(Array.isArray(rowName.variantsJson) && (rowName.variantsJson as unknown[]).length === 1);
    pass('A-name-only-preserves');

    const patchArr = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${createA.json.id}`, {
        method: 'PATCH',
        headers: auth(tokenBrand),
        body: JSON.stringify({ attributes: { material: ['linen'] } }),
      }),
    );
    assert.equal(patchArr.status, 200, patchArr.text);
    const rowArr = await prisma.product.findUniqueOrThrow({ where: { id: createA.json.id } });
    assert.deepEqual(rowArr.attributesJson, {
      material: ['linen'],
      dimensionsCm: { w: 45, h: 100 },
    });
    pass('A-array-replace');

    const emptyPatch = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${createA.json.id}`, {
        method: 'PATCH',
        headers: auth(tokenBrand),
        body: JSON.stringify({ attributes: {} }),
      }),
    );
    assert.equal(emptyPatch.status, 200, emptyPatch.text);
    const rowEmpty = await prisma.product.findUniqueOrThrow({ where: { id: createA.json.id } });
    assert.deepEqual(rowEmpty.attributesJson, {
      material: ['linen'],
      dimensionsCm: { w: 45, h: 100 },
    });
    pass('A-empty-attributes-keeps');

    // —— D validation ——
    for (const [label, body, code] of [
      ['attrs-array', { nameAr: `x ${suffix}`, priceHalalas: 1, category: 'clothes', attributes: [], externalUrl: 'https://example.test/x' }, 'ATTRIBUTES_TYPE'],
      [
        'dim-null',
        {
          nameAr: `x ${suffix}`,
          priceHalalas: 1,
          category: 'clothes',
          attributes: { dimensionsCm: { w: null } },
          externalUrl: 'https://example.test/x',
        },
        'DIMENSIONS_NULL',
      ],
      [
        'material-num',
        {
          nameAr: `x ${suffix}`,
          priceHalalas: 1,
          category: 'clothes',
          subcategory: 'clothes.abaya',
          profileId: 'product.abaya',
          attributes: { material: 123 },
          externalUrl: 'https://example.test/x',
        },
        'ATTRIBUTE_TYPE',
      ],
      [
        'mismatch',
        {
          nameAr: `x ${suffix}`,
          priceHalalas: 1,
          category: 'face',
          subcategory: 'clothes.abaya',
          externalUrl: 'https://example.test/x',
        },
        'CATEGORY_SUBCATEGORY_MISMATCH',
      ],
      [
        'cat-as-sub',
        {
          nameAr: `x ${suffix}`,
          priceHalalas: 1,
          category: 'face',
          subcategory: 'clothes',
          profileId: 'product.clothes',
          externalUrl: 'https://example.test/x',
        },
        'SUBCATEGORY_IS_CATEGORY',
      ],
      [
        'browse',
        {
          nameAr: `x ${suffix}`,
          priceHalalas: 1,
          category: 'clothes',
          subcategory: 'clothes.all',
          externalUrl: 'https://example.test/x',
        },
        'SUBCATEGORY_BROWSE_ONLY',
      ],
      [
        'profile-unknown',
        {
          nameAr: `x ${suffix}`,
          priceHalalas: 1,
          category: 'clothes',
          profileId: 'product.does-not-exist',
          externalUrl: 'https://example.test/x',
        },
        'PROFILE_UNKNOWN',
      ],
    ] as const) {
      const bad = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify(body),
        }),
      );
      assert.equal(bad.status, 400, `${label} ${bad.text}`);
      const codes = [
        bad.json?.code,
        ...(Array.isArray(bad.json?.fieldErrors) ? bad.json.fieldErrors.map((e: any) => e.code) : []),
      ];
      assert.ok(codes.includes(code), `${label} expected ${code} got ${JSON.stringify(codes)}`);
      pass(`D-${label}`);
    }

    // null subcategory must not 500
    const nullSub = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${createA.json.id}`, {
        method: 'PATCH',
        headers: auth(tokenBrand),
        body: JSON.stringify({ subcategory: null }),
      }),
    );
    assert.notEqual(nullSub.status, 500, nullSub.text);
    assert.ok(nullSub.status === 200 || nullSub.status === 400, nullSub.text);
    pass('D-null-subcategory-no-500');

    // —— C published pending taxonomy ——
    const pub = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: `منشور ${suffix}`,
        nameEn: `pub-${suffix}`,
        priceHalalas: 11000,
        externalUrl: 'https://example.test/pub',
        category: 'clothes',
        subcategory: 'clothes.evening',
        profileId: 'product.clothes',
        attributesJson: { material: ['silk'] },
        contentStatus: 'published',
        reviewStatus: 'none',
        active: true,
        catalogSource: 'catalog',
        concernTags: [],
        skinTypes: [],
      },
    });
    createdIds.push(pub.id);
    const pubPatch = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${pub.id}`, {
        method: 'PATCH',
        headers: auth(tokenBrand),
        body: JSON.stringify({
          subcategory: 'clothes.abaya',
          profileId: 'product.abaya',
          attributes: { material: ['cotton'], dimensionsCm: { w: 10, h: 20 } },
          nameAr: `منشور معلّق ${suffix}`,
        }),
      }),
    );
    assert.equal(pubPatch.status, 200, pubPatch.text);
    const pubAfter = await prisma.product.findUniqueOrThrow({ where: { id: pub.id } });
    assert.equal(pubAfter.subcategory, 'clothes.evening', 'live subcategory unchanged until approve');
    assert.equal(pubAfter.nameAr, `منشور ${suffix}`, 'live name unchanged until approve');
    assert.equal(pubAfter.draftTaxonomySet, true);
    assert.equal(pubAfter.draftSubcategory, 'clothes.abaya');
    assert.equal(pubAfter.draftNameAr, `منشور معلّق ${suffix}`);
    assert.deepEqual(pubAfter.draftAttributesJson, {
      material: ['cotton'],
      dimensionsCm: { w: 10, h: 20 },
    });
    pass('C-published-pending-taxonomy');

    const preview = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${pub.id}/preview`, {
        headers: auth(tokenBrand),
      }),
    );
    assert.equal(preview.status, 200, `preview required (not SKIP): ${preview.text}`);
    assert.equal(preview.json.draftTaxonomySet, true);
    assert.equal(preview.json.publishedSubcategory, 'clothes.evening');
    assert.equal(preview.json.draftSubcategory, 'clothes.abaya');
    pass('C-preview-pending');

    // Attach minimal image so submit-review media gate can pass, then approve via admin HTTP.
    const tinyPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const media = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${pub.id}/media`, {
        method: 'POST',
        headers: auth(tokenBrand),
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: tinyPng }),
      }),
    );
    assert.ok(media.status === 200 || media.status === 201, media.text);
    const submit = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${pub.id}/submit-review`, {
        method: 'POST',
        headers: auth(tokenBrand),
        body: '{}',
      }),
    );
    assert.ok(submit.status === 200 || submit.status === 201, submit.text);
    const rev = submit.json.revision ?? submit.json.submittedRevision;
    const approved = await readJson(
      await fetch(`${root}/api/v1/admin/catalog-reviews/product/${pub.id}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-key': 'e1-closure-admin' },
        body: JSON.stringify({ decision: 'approve', revision: rev }),
      }),
    );
    assert.ok(
      approved.status === 200 || approved.status === 201,
      `approve must succeed via HTTP (no service bypass): ${approved.status} ${approved.text}`,
    );
    pass('C-approve-via-http');
    const pubLive = await prisma.product.findUniqueOrThrow({ where: { id: pub.id } });
    assert.equal(pubLive.subcategory, 'clothes.abaya');
    assert.equal(pubLive.nameAr, `منشور معلّق ${suffix}`);
    assert.equal(pubLive.draftTaxonomySet, false);
    assert.deepEqual(pubLive.attributesJson, {
      material: ['cotton'],
      dimensionsCm: { w: 10, h: 20 },
    });
    pass('C-approve-applies-taxonomy');

    // —— E legacy + isolation ——
    const legacy = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: `قديم ${suffix}`,
        nameEn: `leg-${suffix}`,
        priceHalalas: 2000,
        externalUrl: 'https://example.test/leg',
        category: 'clothes',
        subcategory: null,
        contentStatus: 'draft',
        reviewStatus: 'draft',
        active: false,
        concernTags: [],
        skinTypes: [],
        attributesJson: { material: ['silk'] },
      },
    });
    createdIds.push(legacy.id);
    const legPatch = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${legacy.id}`, {
        method: 'PATCH',
        headers: auth(tokenBrand),
        body: JSON.stringify({ nameAr: `قديم محدّث ${suffix}` }),
      }),
    );
    assert.equal(legPatch.status, 200, legPatch.text);
    const legAfter = await prisma.product.findUniqueOrThrow({ where: { id: legacy.id } });
    assert.equal(legAfter.subcategory, null);
    assert.deepEqual(legAfter.attributesJson, { material: ['silk'] });
    pass('E-legacy-null-subcategory');

    const steal = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products/${createA.json.id}`, {
        method: 'PATCH',
        headers: auth(tokenOther),
        body: JSON.stringify({ nameAr: 'سرقة' }),
      }),
    );
    assert.equal(steal.status, 404);
    pass('E-partner-isolation');

    // —— F subcategory filter pagination ——
    const filterIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const p = await prisma.product.create({
        data: {
          partnerId: brand.id,
          nameAr: `فلتر ${i} ${suffix}`,
          nameEn: `f-${i}-${suffix}`,
          priceHalalas: 1000 + i,
          externalUrl: 'https://example.test/f',
          category: 'clothes',
          subcategory: i % 2 === 0 ? 'clothes.abaya' : 'clothes.wedding_dress',
          contentStatus: 'published',
          reviewStatus: 'none',
          active: true,
          catalogSource: 'catalog',
          concernTags: [],
          skinTypes: [],
        },
      });
      filterIds.push(p.id);
      createdIds.push(p.id);
    }
    const page1 = await readJson(
      await fetch(
        `${root}/api/v1/marketplace/catalog?lane=elegance&partnerId=${brand.id}&subcategory=clothes.abaya&limit=8&sort=key`,
      ),
    );
    assert.equal(page1.status, 200, page1.text);
    assert.ok(page1.json.items.length <= 8);
    assert.ok(page1.json.items.every((it: any) => it.subcategory === 'clothes.abaya'));
    const expectedAbaya = new Set(filterIds.filter((_, i) => i % 2 === 0));
    const seen = new Set(page1.json.items.map((it: any) => it.id));
    let cursor = page1.json.nextCursor;
    let pages = 1;
    while (cursor && pages < 10) {
      const page = await readJson(
        await fetch(
          `${root}/api/v1/marketplace/catalog?lane=elegance&partnerId=${brand.id}&subcategory=clothes.abaya&limit=8&sort=key&cursor=${encodeURIComponent(cursor)}`,
        ),
      );
      assert.equal(page.status, 200, page.text);
      for (const it of page.json.items) {
        assert.equal(it.subcategory, 'clothes.abaya');
        assert.ok(!seen.has(it.id), 'no duplicate across pages');
        seen.add(it.id);
      }
      cursor = page.json.nextCursor;
      pages += 1;
    }
    assert.equal(cursor, null, 'pagination must finish');
    for (const id of expectedAbaya) assert.ok(seen.has(id), `missing abaya ${id}`);
    for (const id of seen) {
      if (filterIds.includes(id)) assert.ok(expectedAbaya.has(id), `non-abaya leaked ${id}`);
    }
    pass('F-subcategory-pagination');

    assert.ok(page1.json.nextCursor, 'need cursor for filter-change mismatch');
    const badCursor = await readJson(
      await fetch(
        `${root}/api/v1/marketplace/catalog?lane=elegance&partnerId=${brand.id}&subcategory=clothes.wedding_dress&limit=8&sort=key&cursor=${encodeURIComponent(page1.json.nextCursor)}`,
      ),
    );
    assert.equal(badCursor.status, 400, `cursor filter change must be 400: ${badCursor.text}`);
    pass('F-cursor-filter-change');

    // —— B draft materialize without fake price (editor) ——
    const draftId = `e1c-draft-${suffix}`;
    const putDraft = await readJson(
      await fetch(`${root}/api/v1/partners-portal/editor-drafts/${draftId}`, {
        method: 'PUT',
        headers: { ...auth(tokenBrand), 'idempotency-key': `put-${suffix}` },
        body: JSON.stringify({
          expectedRevision: null,
          kind: 'product',
          profileId: 'product.clothes',
          schemaVersion: 2,
          values: { nameAr: `مسودة بلا سعر ${suffix}`, category: 'clothes' },
        }),
      }),
    );
    assert.ok(putDraft.status === 200 || putDraft.status === 201, putDraft.text);
    const mat = await readJson(
      await fetch(`${root}/api/v1/partners-portal/editor-drafts/${draftId}/materialize`, {
        method: 'POST',
        headers: { ...auth(tokenBrand), 'idempotency-key': `mat-${suffix}` },
        body: JSON.stringify({ expectedRevision: putDraft.json.revision }),
      }),
    );
    assert.ok(mat.status === 400 || mat.status === 422, mat.text);
    assert.ok(!mat.json?.targetOwnerId, mat.text);
    pass('B-draft-no-fake-price');

    const draftOk = `e1c-draft-ok-${suffix}`;
    const putOk = await readJson(
      await fetch(`${root}/api/v1/partners-portal/editor-drafts/${draftOk}`, {
        method: 'PUT',
        headers: { ...auth(tokenBrand), 'idempotency-key': `put-ok-${suffix}` },
        body: JSON.stringify({
          expectedRevision: null,
          kind: 'product',
          profileId: 'product.clothes',
          schemaVersion: 2,
          values: {
            nameAr: `مسودة كاملة ${suffix}`,
            category: 'clothes',
            priceHalalas: 4500,
            externalUrl: 'https://example.test/draft-ok',
            material: ['silk', 'cotton'],
          },
        }),
      }),
    );
    assert.ok(putOk.status === 200 || putOk.status === 201, putOk.text);
    const matOk = await readJson(
      await fetch(`${root}/api/v1/partners-portal/editor-drafts/${draftOk}/materialize`, {
        method: 'POST',
        headers: { ...auth(tokenBrand), 'idempotency-key': `mat-ok-${suffix}` },
        body: JSON.stringify({ expectedRevision: putOk.json.revision, submitReview: false }),
      }),
    );
    assert.ok(matOk.status === 200 || matOk.status === 201, matOk.text);
    assert.ok(matOk.json.targetOwnerId);
    createdIds.push(matOk.json.targetOwnerId);
    const draftRow = await prisma.product.findUniqueOrThrow({ where: { id: matOk.json.targetOwnerId } });
    assert.equal(draftRow.priceHalalas, 4500);
    assert.deepEqual(draftRow.attributesJson, { material: ['silk', 'cotton'] });
    const matReplay = await readJson(
      await fetch(`${root}/api/v1/partners-portal/editor-drafts/${draftOk}/materialize`, {
        method: 'POST',
        headers: { ...auth(tokenBrand), 'idempotency-key': `mat-ok-${suffix}` },
        body: JSON.stringify({ expectedRevision: putOk.json.revision, submitReview: false }),
      }),
    );
    assert.ok(matReplay.status === 200 || matReplay.status === 201, matReplay.text);
    assert.equal(matReplay.json.targetOwnerId, matOk.json.targetOwnerId);
    pass('B-draft-complete-and-idempotent');

    // developer direct publish still validates
    const devCreate = await readJson(
      await fetch(`${root}/api/v1/partners-portal/products`, {
        method: 'POST',
        headers: auth(tokenDev),
        body: JSON.stringify({
          nameAr: `مطوّر ${suffix}`,
          priceHalalas: 5000,
          category: 'clothes',
          subcategory: 'clothes.all',
          externalUrl: 'https://example.test/dev',
        }),
      }),
    );
    assert.equal(devCreate.status, 400);
    pass('C-developer-still-validates');

    console.log(`E1_CLOSURE_HTTP_PASS started=${started} ended=${new Date().toISOString()}`);
  } finally {
    await app.close();
    await prisma.product.deleteMany({ where: { id: { in: createdIds } } }).catch(() => undefined);
    await prisma.product.deleteMany({ where: { partnerId: { in: [brand.id, other.id, developer.id] } } }).catch(() => undefined);
    await prisma.partnerUser.deleteMany({ where: { partnerId: { in: [brand.id, other.id, developer.id] } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: [brand.id, other.id, developer.id] } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
