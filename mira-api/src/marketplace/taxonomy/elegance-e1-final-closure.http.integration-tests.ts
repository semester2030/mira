/**
 * E1 final-closure decisive acceptance: V01–V05, N01–N03, P01, G01–G02, C01, D01–D02.
 * Real Nest HTTP + isolated local DB. No service bypass for approve. No silent SKIP→PASS.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
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
class E1FinalClosureHttpTestModule {}

type CaseResult = {
  id: string;
  scenario: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'NOT_RUN' | 'BLOCKED';
  exitHint?: number;
};

const results: CaseResult[] = [];

function record(id: string, scenario: string, expected: string, actual: string, ok: boolean) {
  results.push({
    id,
    scenario,
    expected,
    actual,
    status: ok ? 'PASS' : 'FAIL',
  });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${scenario}`);
  if (!ok) throw new Error(`${id} failed: expected=${expected} actual=${actual}`);
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

function codesOf(body: any): string[] {
  const out = [body?.code].filter(Boolean) as string[];
  if (Array.isArray(body?.fieldErrors)) {
    for (const e of body.fieldErrors) if (e?.code) out.push(String(e.code));
  }
  return out;
}

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  const started = new Date().toISOString();
  const testedSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'e1-final-admin';
  process.env.AUTH_SKIP = 'false';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E1F Brand ${suffix}`, nameEn: 'E1F Brand', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E1F Other ${suffix}`, nameEn: 'E1F Other', city: 'جدة' },
  });
  const developer = await prisma.partner.create({
    data: { type: 'developer', status: 'active', nameAr: `E1F Dev ${suffix}`, nameEn: 'E1F Dev', city: 'الرياض' },
  });
  const tokenBrand = `token-e1f-brand-${suffix}`;
  const tokenOther = `token-e1f-other-${suffix}`;
  const tokenDev = `token-e1f-dev-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brand-e1f-${suffix}@test.local`, accessToken: tokenBrand },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `other-e1f-${suffix}@test.local`, accessToken: tokenOther },
  });
  await prisma.partnerUser.create({
    data: { partnerId: developer.id, email: `dev-e1f-${suffix}@test.local`, accessToken: tokenDev },
  });

  const app = await NestFactory.create(E1FinalClosureHttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const root = await baseUrl(app);
  const auth = (token: string) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });
  const adminH = { 'content-type': 'application/json', 'x-admin-key': 'e1-final-admin' };
  const createdIds: string[] = [];

  try {
    // —— V01 ——
    {
      const bad = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `V01 ${suffix}`,
            priceHalalas: 1000,
            category: 'clothes',
            subcategory: 'clothes.abaya',
            attributes: { material: 123 },
            externalUrl: 'https://example.test/v01',
          }),
        }),
      );
      const codes = codesOf(bad.json);
      const ok = bad.status === 400 && codes.includes('ATTRIBUTE_TYPE');
      record(
        'V01',
        'عباية دون profileId مع material=123',
        '400 ATTRIBUTE_TYPE',
        `${bad.status} ${codes.join(',')}`,
        ok,
      );
      if (bad.status < 400 && bad.json?.id) createdIds.push(bad.json.id);
    }

    // —— V02 ——
    {
      const okRes = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `V02 ${suffix}`,
            priceHalalas: 2000,
            category: 'clothes',
            subcategory: 'clothes.abaya',
            attributes: { material: ['silk', 'cotton'] },
            externalUrl: 'https://example.test/v02',
          }),
        }),
      );
      assert.ok(okRes.status === 200 || okRes.status === 201, okRes.text);
      createdIds.push(okRes.json.id);
      const row = await prisma.product.findUniqueOrThrow({ where: { id: okRes.json.id } });
      const ok =
        row.profileId === 'product.abaya' &&
        JSON.stringify(row.attributesJson) === JSON.stringify({ material: ['silk', 'cotton'] });
      record(
        'V02',
        'نفس الطلب مع material=[silk,cotton]',
        'profile product.abaya + attributes كاملة',
        `profile=${row.profileId} attrs=${JSON.stringify(row.attributesJson)}`,
        ok,
      );
    }

    // —— V03 ——
    {
      const bad = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `V03 ${suffix}`,
            priceHalalas: 1000,
            category: 'clothes',
            subcategory: 'clothes.abaya',
            profileId: 'product.abaya',
            attributes: { notAllowedField: 'x' },
            externalUrl: 'https://example.test/v03',
          }),
        }),
      );
      const codes = codesOf(bad.json);
      const ok = bad.status === 400 && codes.includes('ATTRIBUTE_UNKNOWN');
      record('V03', 'خاصية غير معرّفة', '400 ATTRIBUTE_UNKNOWN بدون كتابة', `${bad.status} ${codes.join(',')}`, ok);
      if (bad.json?.id) {
        const leaked = await prisma.product.findUnique({ where: { id: bad.json.id } });
        assert.equal(leaked, null);
      }
    }

    // —— V04 ——
    {
      const legacy = await prisma.product.create({
        data: {
          partnerId: brand.id,
          nameAr: `V04 ${suffix}`,
          nameEn: `v04-${suffix}`,
          priceHalalas: 3000,
          externalUrl: 'https://example.test/v04',
          category: 'clothes',
          subcategory: 'clothes.abaya',
          profileId: 'product.abaya',
          attributesJson: { legacyUnknown: 'keep-me', material: ['silk'] },
          contentStatus: 'draft',
          reviewStatus: 'draft',
          active: false,
          concernTags: [],
          skinTypes: [],
        },
      });
      createdIds.push(legacy.id);
      const patch = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${legacy.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ nameAr: `V04 محدث ${suffix}` }),
        }),
      );
      assert.equal(patch.status, 200, patch.text);
      const row = await prisma.product.findUniqueOrThrow({ where: { id: legacy.id } });
      const attrs = row.attributesJson as Record<string, unknown>;
      const ok =
        row.nameAr === `V04 محدث ${suffix}` &&
        attrs != null &&
        attrs.legacyUnknown === 'keep-me' &&
        JSON.stringify(attrs.material) === JSON.stringify(['silk']);
      record(
        'V04',
        'منتج قديم بخصائص غير معروفة؛ تعديل الاسم فقط',
        'الاسم يتحدث والخصائص القديمة تبقى',
        `name=${row.nameAr} attrs=${JSON.stringify(row.attributesJson)}`,
        ok,
      );
    }

    // —— V05 ——
    {
      const bad = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `V05 ${suffix}`,
            priceHalalas: 1000,
            category: 'face',
            subcategory: 'clothes.abaya',
            profileId: 'product.abaya',
            externalUrl: 'https://example.test/v05',
          }),
        }),
      );
      const codes = codesOf(bad.json);
      const ok =
        bad.status === 400 &&
        (codes.includes('CATEGORY_SUBCATEGORY_MISMATCH') || codes.includes('PROFILE_CATEGORY_MISMATCH'));
      record('V05', 'تعارض تصنيف/ملف', '400 تعارض صريح', `${bad.status} ${codes.join(',')}`, ok);
    }

    // —— N01 ——
    {
      const pub = await prisma.product.create({
        data: {
          partnerId: brand.id,
          nameAr: `N01 ${suffix}`,
          nameEn: `n01-${suffix}`,
          priceHalalas: 9000,
          externalUrl: 'https://example.test/n01',
          category: 'clothes',
          subcategory: 'clothes.abaya',
          profileId: 'product.abaya',
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
      const clear = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${pub.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            subcategory: null,
            profileId: null,
            attributes: { material: null },
          }),
        }),
      );
      assert.equal(clear.status, 200, clear.text);
      const afterClear = await prisma.product.findUniqueOrThrow({ where: { id: pub.id } });
      assert.equal(afterClear.subcategory, 'clothes.abaya');
      assert.equal(afterClear.draftTaxonomySet, true);
      assert.equal(afterClear.draftSubcategory, null);
      assert.ok(
        afterClear.draftAttributesJson == null ||
          !Object.prototype.hasOwnProperty.call(afterClear.draftAttributesJson as object, 'material'),
      );

      const next = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${pub.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ attributes: { dimensionsCm: { w: 45 } } }),
        }),
      );
      assert.equal(next.status, 200, next.text);
      const afterNext = await prisma.product.findUniqueOrThrow({ where: { id: pub.id } });
      const draftAttrs = afterNext.draftAttributesJson as Record<string, unknown> | null;
      const ok =
        afterNext.subcategory === 'clothes.abaya' &&
        JSON.stringify(afterNext.attributesJson) === JSON.stringify({ material: ['silk'] }) &&
        afterNext.draftTaxonomySet === true &&
        afterNext.draftSubcategory === null &&
        draftAttrs != null &&
        draftAttrs.dimensionsCm &&
        JSON.stringify((draftAttrs.dimensionsCm as object)) === JSON.stringify({ w: 45 }) &&
        !Object.prototype.hasOwnProperty.call(draftAttrs, 'material');
      record(
        'N01',
        'مسح معلّق ثم تعديل خاصية أخرى',
        'بقاء المسح وعدم رجوع material/abaya المنشورة في المسودة',
        `liveSub=${afterNext.subcategory} draftSub=${afterNext.draftSubcategory} draftAttrs=${JSON.stringify(draftAttrs)}`,
        ok,
      );

      // —— N02 approve ——
      const media = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${pub.id}/media`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
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
          headers: adminH,
          body: JSON.stringify({ decision: 'approve', revision: rev }),
        }),
      );
      assert.ok(approved.status === 200 || approved.status === 201, `approve must be HTTP not service bypass: ${approved.text}`);
      const live = await prisma.product.findUniqueOrThrow({ where: { id: pub.id } });
      const attrs = live.attributesJson as Record<string, unknown> | null;
      const n02ok =
        live.subcategory === null &&
        live.draftTaxonomySet === false &&
        attrs != null &&
        JSON.stringify(attrs.dimensionsCm) === JSON.stringify({ w: 45 }) &&
        !Object.prototype.hasOwnProperty.call(attrs, 'material');
      record(
        'N02',
        'الموافقة على N01',
        'تطبيق المسح+الإضافة وتصفير التعليق',
        `sub=${live.subcategory} draftSet=${live.draftTaxonomySet} attrs=${JSON.stringify(attrs)}`,
        n02ok,
      );
    }

    // —— N03 reject ——
    {
      const pub = await prisma.product.create({
        data: {
          partnerId: brand.id,
          nameAr: `N03 ${suffix}`,
          nameEn: `n03-${suffix}`,
          priceHalalas: 8800,
          externalUrl: 'https://example.test/n03',
          category: 'clothes',
          subcategory: 'clothes.abaya',
          profileId: 'product.abaya',
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
      const patch = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${pub.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ nameAr: `N03 معلّق ${suffix}`, subcategory: 'clothes.evening' }),
        }),
      );
      assert.equal(patch.status, 200, patch.text);
      const media = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${pub.id}/media`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
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
      const rejected = await readJson(
        await fetch(`${root}/api/v1/admin/catalog-reviews/product/${pub.id}/decision`, {
          method: 'POST',
          headers: adminH,
          body: JSON.stringify({ decision: 'reject', revision: rev, note: 'رفض اختبار' }),
        }),
      );
      assert.ok(rejected.status === 200 || rejected.status === 201, rejected.text);
      const live = await prisma.product.findUniqueOrThrow({ where: { id: pub.id } });
      const ok =
        live.nameAr === `N03 ${suffix}` &&
        live.subcategory === 'clothes.abaya' &&
        JSON.stringify(live.attributesJson) === JSON.stringify({ material: ['silk'] });
      record(
        'N03',
        'رفض تعديل معلّق',
        'بقاء البيانات المنشورة',
        `name=${live.nameAr} sub=${live.subcategory} attrs=${JSON.stringify(live.attributesJson)}`,
        ok,
      );
    }

    // —— P01 editor draft taxonomy on published ——
    {
      const pub = await prisma.product.create({
        data: {
          partnerId: brand.id,
          nameAr: `P01 ${suffix}`,
          nameEn: `p01-${suffix}`,
          priceHalalas: 5500,
          externalUrl: 'https://example.test/p01',
          category: 'clothes',
          subcategory: 'clothes.evening',
          profileId: 'product.clothes',
          attributesJson: { material: ['linen'] },
          contentStatus: 'published',
          reviewStatus: 'none',
          active: true,
          catalogSource: 'catalog',
          concernTags: [],
          skinTypes: [],
        },
      });
      createdIds.push(pub.id);
      const draftId = `e1f-p01-${suffix}`;
      const put = await readJson(
        await fetch(`${root}/api/v1/partners-portal/editor-drafts/${draftId}`, {
          method: 'PUT',
          headers: { ...auth(tokenBrand), 'idempotency-key': `p01-put-${suffix}` },
          body: JSON.stringify({
            expectedRevision: null,
            kind: 'product',
            profileId: 'product.clothes',
            schemaVersion: 2,
            targetOwnerId: pub.id,
            values: {
              nameAr: `P01 معلّق ${suffix}`,
              category: 'clothes',
              subcategory: 'clothes.wedding_dress',
              priceHalalas: 5500,
              externalUrl: 'https://example.test/p01',
              material: ['silk', 'cotton'],
            },
          }),
        }),
      );
      assert.ok(put.status === 200 || put.status === 201, put.text);
      const mat = await readJson(
        await fetch(`${root}/api/v1/partners-portal/editor-drafts/${draftId}/materialize`, {
          method: 'POST',
          headers: { ...auth(tokenBrand), 'idempotency-key': `p01-mat-${suffix}` },
          body: JSON.stringify({ expectedRevision: put.json.revision, submitReview: false }),
        }),
      );
      assert.ok(mat.status === 200 || mat.status === 201, mat.text);
      const pending = await prisma.product.findUniqueOrThrow({ where: { id: pub.id } });
      assert.equal(pending.subcategory, 'clothes.evening');
      assert.equal(pending.draftTaxonomySet, true);
      assert.equal(pending.draftSubcategory, 'clothes.wedding_dress');
      assert.deepEqual(pending.draftAttributesJson, { material: ['silk', 'cotton'] });

      const media = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${pub.id}/media`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
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
          headers: adminH,
          body: JSON.stringify({ decision: 'approve', revision: rev }),
        }),
      );
      assert.ok(approved.status === 200 || approved.status === 201, approved.text);
      const live = await prisma.product.findUniqueOrThrow({ where: { id: pub.id } });
      const ok =
        live.subcategory === 'clothes.wedding_dress' &&
        live.profileId === 'product.clothes' &&
        live.nameAr === `P01 معلّق ${suffix}` &&
        live.draftTaxonomySet === false &&
        JSON.stringify(live.attributesJson) === JSON.stringify({ material: ['silk', 'cotton'] });
      record(
        'P01',
        'تعديل تصنيف وخصائص عبر editor draft ثم موافقة',
        'حفظ معلّق ثم تطبيق بعد الموافقة',
        `sub=${live.subcategory} profile=${live.profileId} attrs=${JSON.stringify(live.attributesJson)} draftSet=${live.draftTaxonomySet}`,
        ok,
      );
    }

    // —— G01 / G02 bulk ——
    {
      const batchId = `e1f-g-${suffix}`;
      const create = await readJson(
        await fetch(`${root}/api/v1/partners-portal/bulk-batches`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 2, batchId }),
        }),
      );
      assert.ok(create.status === 200 || create.status === 201, create.text);
      const cards = create.json.cards as Array<{ cardId: string; revision: number }>;
      assert.equal(cards.length, 2);
      const values = [
        {
          nameAr: `G01-A ${suffix}`,
          priceHalalas: 1111,
          category: 'clothes',
          subcategory: 'clothes.wedding_dress',
          material: ['silk'],
          externalUrl: 'https://example.test/g01a',
        },
        {
          nameAr: `G01-B ${suffix}`,
          priceHalalas: 2222,
          category: 'clothes',
          subcategory: 'clothes.evening',
          material: ['cotton'],
          externalUrl: 'https://example.test/g01b',
        },
      ];
      for (let i = 0; i < 2; i++) {
        const put = await readJson(
          await fetch(`${root}/api/v1/partners-portal/bulk-batches/${batchId}/cards/${cards[i].cardId}`, {
            method: 'PUT',
            headers: auth(tokenBrand),
            body: JSON.stringify({ expectedRevision: cards[i].revision, values: values[i], overwriteWritten: true }),
          }),
        );
        assert.ok(put.status === 200 || put.status === 201, put.text);
        cards[i].revision = put.json.revision;
      }
      const mat = await readJson(
        await fetch(`${root}/api/v1/partners-portal/bulk-batches/${batchId}/materialize`, {
          method: 'POST',
          headers: { ...auth(tokenBrand), 'idempotency-key': `g-mat-${suffix}` },
          body: JSON.stringify({ submitReview: false }),
        }),
      );
      assert.ok(mat.status === 200 || mat.status === 201, mat.text);
      const owners = (mat.json.results as Array<{ ok: boolean; targetOwnerId?: string; cardId: string }>)
        .filter((r) => r.ok && r.targetOwnerId)
        .map((r) => r.targetOwnerId!);
      assert.equal(owners.length, 2);
      createdIds.push(...owners);
      const rows = await prisma.product.findMany({ where: { id: { in: owners } } });
      assert.equal(rows.length, 2);
      assert.ok(rows.every((r) => r.partnerId === brand.id));
      const byName = new Map(rows.map((r) => [r.nameAr, r]));
      const a = byName.get(`G01-A ${suffix}`)!;
      const b = byName.get(`G01-B ${suffix}`)!;
      const g01ok =
        a &&
        b &&
        a.id !== b.id &&
        a.subcategory === 'clothes.wedding_dress' &&
        b.subcategory === 'clothes.evening' &&
        JSON.stringify(a.attributesJson) === JSON.stringify({ material: ['silk'] }) &&
        JSON.stringify(b.attributesJson) === JSON.stringify({ material: ['cotton'] }) &&
        a.priceHalalas === 1111 &&
        b.priceHalalas === 2222;
      record(
        'G01',
        'مجموعة بعنصرين مختلفين',
        'استقلال الملكية/التصنيف/الخصائص',
        `a=${a?.id}:${a?.subcategory} b=${b?.id}:${b?.subcategory}`,
        !!g01ok,
      );

      const mediaCounts = await Promise.all(
        owners.map(async (id) => {
          const m = await readJson(
            await fetch(`${root}/api/v1/partners-portal/products/${id}/media`, {
              method: 'POST',
              headers: auth(tokenBrand),
              body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
            }),
          );
          return m.status;
        }),
      );
      assert.ok(mediaCounts.every((s) => s === 200 || s === 201));

      const replay = await readJson(
        await fetch(`${root}/api/v1/partners-portal/bulk-batches/${batchId}/materialize`, {
          method: 'POST',
          headers: { ...auth(tokenBrand), 'idempotency-key': `g-mat-${suffix}` },
          body: JSON.stringify({ submitReview: false }),
        }),
      );
      assert.ok(replay.status === 200 || replay.status === 201, replay.text);
      const count = await prisma.product.count({
        where: { partnerId: brand.id, nameAr: { in: [`G01-A ${suffix}`, `G01-B ${suffix}`] } },
      });
      record('G02', 'إعادة محاولة تحويل المجموعة', 'لا تكرار وفق idempotency', `count=${count}`, count === 2);
    }

    // —— C01 concurrency / stale draft ——
    {
      const draftId = `e1f-c01-${suffix}`;
      const put = await readJson(
        await fetch(`${root}/api/v1/partners-portal/editor-drafts/${draftId}`, {
          method: 'PUT',
          headers: { ...auth(tokenBrand), 'idempotency-key': `c01-put-${suffix}` },
          body: JSON.stringify({
            expectedRevision: null,
            kind: 'product',
            profileId: 'product.clothes',
            schemaVersion: 2,
            values: { nameAr: `C01 ${suffix}`, category: 'clothes', priceHalalas: 4000, externalUrl: 'https://example.test/c01' },
          }),
        }),
      );
      assert.ok(put.status === 200 || put.status === 201, put.text);
      const stale = await readJson(
        await fetch(`${root}/api/v1/partners-portal/editor-drafts/${draftId}`, {
          method: 'PUT',
          headers: { ...auth(tokenBrand), 'idempotency-key': `c01-stale-${suffix}` },
          body: JSON.stringify({
            expectedRevision: 0,
            kind: 'product',
            profileId: 'product.clothes',
            schemaVersion: 2,
            values: { nameAr: `C01 stale ${suffix}`, category: 'clothes', priceHalalas: 4000, externalUrl: 'https://example.test/c01' },
          }),
        }),
      );
      const staleOk = stale.status === 409 || stale.status === 400 || stale.status === 422;
      // Concurrent patches on draft product: both apply under FOR UPDATE without silent loss of cleared attrs.
      const prod = await prisma.product.create({
        data: {
          partnerId: brand.id,
          nameAr: `C01p ${suffix}`,
          nameEn: `c01p-${suffix}`,
          priceHalalas: 4100,
          externalUrl: 'https://example.test/c01p',
          category: 'clothes',
          subcategory: 'clothes.abaya',
          profileId: 'product.abaya',
          attributesJson: { material: ['silk'], lengthCm: 140 },
          contentStatus: 'draft',
          reviewStatus: 'draft',
          active: false,
          concernTags: [],
          skinTypes: [],
        },
      });
      createdIds.push(prod.id);
      const [p1, p2] = await Promise.all([
        readJson(
          await fetch(`${root}/api/v1/partners-portal/products/${prod.id}`, {
            method: 'PATCH',
            headers: auth(tokenBrand),
            body: JSON.stringify({ attributes: { material: null } }),
          }),
        ),
        readJson(
          await fetch(`${root}/api/v1/partners-portal/products/${prod.id}`, {
            method: 'PATCH',
            headers: auth(tokenBrand),
            body: JSON.stringify({ attributes: { lengthCm: 150 } }),
          }),
        ),
      ]);
      assert.ok(p1.status === 200 && p2.status === 200, `${p1.text} | ${p2.text}`);
      const after = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
      const attrs = (after.attributesJson || {}) as Record<string, unknown>;
      // Under serialization one wins last; must not invent silk back if material was cleared in a winning write,
      // and lengthCm must be present if that patch won. Decisive: both HTTP succeeded and final bag is a
      // coherent merge of the two patches (no partial write / 5xx), and material is either absent or silk
      // only if clear lost the race — never a corrupted type.
      const coherent =
        (attrs.material === undefined || JSON.stringify(attrs.material) === JSON.stringify(['silk'])) &&
        (attrs.lengthCm === undefined || attrs.lengthCm === 140 || attrs.lengthCm === 150) &&
        !(attrs.material === undefined && attrs.lengthCm === undefined);
      // Stronger: after both patches sequentially re-applied, clear+set must stick.
      const clearThenSet = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${prod.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ attributes: { material: null, lengthCm: 151 } }),
        }),
      );
      assert.equal(clearThenSet.status, 200, clearThenSet.text);
      const finalRow = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
      const finalAttrs = finalRow.attributesJson as Record<string, unknown>;
      const finalOk =
        staleOk &&
        coherent &&
        finalAttrs.lengthCm === 151 &&
        !Object.prototype.hasOwnProperty.call(finalAttrs, 'material');
      record(
        'C01',
        'مسودة قديمة + تعديلات متزامنة',
        'تعارض صريح للمسودة القديمة ودمج/تسلسل صحيح بدون فقد صامت للمسح',
        `stale=${stale.status} final=${JSON.stringify(finalAttrs)}`,
        !!finalOk,
      );
    }

    // —— D01 developer direct publish success ——
    {
      const create = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenDev),
          body: JSON.stringify({
            nameAr: `D01 ${suffix}`,
            priceHalalas: 7000,
            category: 'clothes',
            subcategory: 'clothes.abaya',
            profileId: 'product.abaya',
            attributes: { material: ['silk'] },
            externalUrl: 'https://example.test/d01',
          }),
        }),
      );
      assert.ok(create.status === 200 || create.status === 201, create.text);
      createdIds.push(create.json.id);
      const media = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${create.json.id}/media`, {
          method: 'POST',
          headers: auth(tokenDev),
          body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
        }),
      );
      assert.ok(media.status === 200 || media.status === 201, media.text);
      const submit = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${create.json.id}/submit-review`, {
          method: 'POST',
          headers: auth(tokenDev),
          body: '{}',
        }),
      );
      assert.ok(submit.status === 200 || submit.status === 201, submit.text);
      const row = await prisma.product.findUniqueOrThrow({ where: { id: create.json.id } });
      const ok =
        row.contentStatus === 'published' &&
        row.active === true &&
        row.subcategory === 'clothes.abaya' &&
        JSON.stringify(row.attributesJson) === JSON.stringify({ material: ['silk'] });
      record(
        'D01',
        'المطور ينشر منتجًا صالحًا مباشرة',
        'published مع بيانات صحيحة دون موافقة بشرية',
        `status=${row.contentStatus} active=${row.active} attrs=${JSON.stringify(row.attributesJson)}`,
        ok,
      );
    }

    // —— D02 developer still validates + isolation ——
    {
      const bad = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenDev),
          body: JSON.stringify({
            nameAr: `D02 bad ${suffix}`,
            priceHalalas: 1,
            category: 'clothes',
            subcategory: 'clothes.abaya',
            attributes: { material: 123 },
            externalUrl: 'https://example.test/d02',
          }),
        }),
      );
      const codes = codesOf(bad.json);
      const brandProduct = createdIds[0];
      const steal = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${brandProduct}`, {
          method: 'PATCH',
          headers: auth(tokenDev),
          body: JSON.stringify({ nameAr: 'سرقة مطور' }),
        }),
      );
      const ok = bad.status === 400 && codes.includes('ATTRIBUTE_TYPE') && steal.status === 404;
      record(
        'D02',
        'المطور ببيانات خاطئة أو تعديل غير مملوك',
        'رفض التحقق + عزل الملكية',
        `bad=${bad.status}/${codes.join(',')} steal=${steal.status}`,
        ok,
      );
    }

    // Preview endpoint must exist (decisive — not SKIPPED).
    {
      const sample = createdIds.find(Boolean);
      assert.ok(sample);
      const preview = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${sample}/preview`, { headers: auth(tokenBrand) }),
      );
      assert.equal(preview.status, 200, `preview required: ${preview.text}`);
      assert.equal(preview.json.id, sample);
      console.log('PASS PREVIEW_ENDPOINT');
    }

    // Decisive filter pagination: exact id set + cursor mismatch = 400.
    {
      const filterIds: string[] = [];
      const expectedAbaya = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const p = await prisma.product.create({
          data: {
            partnerId: brand.id,
            nameAr: `F ${i} ${suffix}`,
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
        if (i % 2 === 0) expectedAbaya.add(p.id);
      }
      const seen = new Set<string>();
      let cursor: string | null = null;
      let pages = 0;
      do {
        const q = new URLSearchParams({
          lane: 'elegance',
          partnerId: brand.id,
          subcategory: 'clothes.abaya',
          limit: '8',
          sort: 'key',
        });
        if (cursor) q.set('cursor', cursor);
        const page = await readJson(await fetch(`${root}/api/v1/marketplace/catalog?${q}`));
        assert.equal(page.status, 200, page.text);
        for (const it of page.json.items) {
          assert.equal(it.subcategory, 'clothes.abaya');
          assert.ok(!seen.has(it.id), 'duplicate page item');
          seen.add(it.id);
        }
        cursor = page.json.nextCursor ?? null;
        pages += 1;
      } while (cursor && pages < 10);
      assert.equal(cursor, null, 'pagination must finish');
      for (const id of expectedAbaya) assert.ok(seen.has(id), `missing ${id}`);
      for (const id of seen) {
        if (filterIds.includes(id)) assert.ok(expectedAbaya.has(id), `unexpected non-abaya ${id}`);
      }
      const page1 = await readJson(
        await fetch(
          `${root}/api/v1/marketplace/catalog?lane=elegance&partnerId=${brand.id}&subcategory=clothes.abaya&limit=8&sort=key`,
        ),
      );
      assert.ok(page1.json.nextCursor, 'need cursor for mismatch test');
      const mismatch = await readJson(
        await fetch(
          `${root}/api/v1/marketplace/catalog?lane=elegance&partnerId=${brand.id}&subcategory=clothes.wedding_dress&limit=8&sort=key&cursor=${encodeURIComponent(page1.json.nextCursor)}`,
        ),
      );
      assert.equal(mismatch.status, 400, `cursor filter change must be 400, got ${mismatch.status} ${mismatch.text}`);
      console.log('PASS FILTER_PAGINATION_EXACT');
    }

    console.log(
      JSON.stringify(
        {
          verdict: 'E1_FINAL_CLOSURE_HTTP_PASS',
          started,
          ended: new Date().toISOString(),
          testedSha,
          database: 'local',
          cases: results,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
    await prisma.catalogMedia.deleteMany({ where: { ownerId: { in: createdIds } } }).catch(() => undefined);
    await prisma.product.deleteMany({ where: { id: { in: createdIds } } }).catch(() => undefined);
    await prisma.product.deleteMany({ where: { partnerId: { in: [brand.id, other.id, developer.id] } } }).catch(() => undefined);
    await prisma.partnerEditorDraft
      .deleteMany({ where: { partnerId: { in: [brand.id, other.id, developer.id] } } })
      .catch(() => undefined);
    await prisma.partnerUser.deleteMany({ where: { partnerId: { in: [brand.id, other.id, developer.id] } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: [brand.id, other.id, developer.id] } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  console.error(JSON.stringify({ verdict: 'E1_FINAL_CLOSURE_HTTP_FAIL', cases: results }, null, 2));
  process.exit(1);
});
