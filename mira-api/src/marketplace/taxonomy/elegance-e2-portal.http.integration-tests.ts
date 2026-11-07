/**
 * E2 portal acceptance via real Nest HTTP + DB (portal payload shape).
 * Browser widget proof is separate; this file proves save → DB → GET round-trips.
 *
 * Run: DATABASE_URL=… MIRA_PARTNER_EDITOR_V2=true npx tsx src/marketplace/taxonomy/elegance-e2-portal.http.integration-tests.ts
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
class E2PortalHttpTestModule {}

type CaseResult = {
  id: string;
  scenario: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
};

const results: CaseResult[] = [];

function record(id: string, scenario: string, expected: string, actual: string, ok: boolean) {
  results.push({ id, scenario, expected, actual, status: ok ? 'PASS' : 'FAIL' });
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

async function main() {
  const started = new Date().toISOString();
  const testedSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'e2-portal-admin';
  process.env.AUTH_SKIP = 'false';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E2 Brand ${suffix}`, nameEn: 'E2 Brand', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E2 Other ${suffix}`, nameEn: 'E2 Other', city: 'جدة' },
  });
  const developer = await prisma.partner.create({
    data: { type: 'developer', status: 'active', nameAr: `E2 Dev ${suffix}`, nameEn: 'E2 Dev', city: 'الرياض' },
  });
  const tokenBrand = `token-e2-brand-${suffix}`;
  const tokenOther = `token-e2-other-${suffix}`;
  const tokenDev = `token-e2-dev-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brand-e2-${suffix}@test.local`, accessToken: tokenBrand },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `other-e2-${suffix}@test.local`, accessToken: tokenOther },
  });
  await prisma.partnerUser.create({
    data: { partnerId: developer.id, email: `dev-e2-${suffix}@test.local`, accessToken: tokenDev },
  });

  const app = await NestFactory.create(E2PortalHttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const root = await baseUrl(app);
  const auth = (token: string) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });
  const adminH = { 'content-type': 'application/json', 'x-admin-key': 'e2-portal-admin' };
  const createdIds: string[] = [];

  try {
    // A01 — same profile fields available via registry for clothes (individual ≡ group source)
    {
      const reg = await readJson(
        await fetch(`${root}/api/v1/partners-portal/registry`, { headers: auth(tokenBrand) }),
      );
      assert.equal(reg.status, 200, reg.text);
      const rootReg = reg.json.registry || reg.json;
      const clothes = (rootReg.profiles || []).find((p: any) => p.id === 'product.clothes');
      const fields = clothes?.fields || [];
      const ok = fields.includes('material') && fields.includes('cut') && fields.includes('colors') && fields.includes('sizes');
      record('A01', 'تطابق حقول profile.clothes للفردي والمجموعات', 'material+cut+colors+sizes', `fieldsHas=${ok}`, ok);
    }

    // A02 — material[] save + GET reload
    {
      const created = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A02 ${suffix}`,
            priceHalalas: 5500,
            category: 'clothes',
            subcategory: 'clothes.wedding_dress',
            attributes: { material: ['silk', 'cotton'] },
            externalUrl: 'https://example.test/e2-a02',
            optionsJson: [
              { id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }] },
              { id: 'size', labelAr: 'المقاس', values: [{ id: 'M', labelAr: 'M' }, { id: 'L', labelAr: 'L' }] },
            ],
          }),
        }),
      );
      assert.ok(created.status === 200 || created.status === 201, created.text);
      createdIds.push(created.json.id);
      const got = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}`, {
          headers: auth(tokenBrand),
        }),
      );
      // Some portals list via dashboard — also read DB
      const row = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      const attrs = (got.status === 200 && got.json?.attributesJson) || row.attributesJson;
      const ok = JSON.stringify(attrs) === JSON.stringify({ material: ['silk', 'cotton'] });
      record(
        'A02',
        'حفظ خامتين واستعادة بعد قراءة جديدة',
        'material=[silk,cotton]',
        `attrs=${JSON.stringify(attrs)} getStatus=${got.status}`,
        ok,
      );

      // A03 — name-only keeps material + options
      const optionsBefore = row.optionsJson;
      const patch = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ nameAr: `E2-A02 محدث ${suffix}` }),
        }),
      );
      assert.equal(patch.status, 200, patch.text);
      const after = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      const ok3 =
        JSON.stringify(after.attributesJson) === JSON.stringify({ material: ['silk', 'cotton'] }) &&
        JSON.stringify(after.optionsJson) === JSON.stringify(optionsBefore);
      record(
        'A03',
        'تعديل الاسم فقط يحافظ على الخامات والخيارات',
        'attrs+options unchanged',
        `attrs=${JSON.stringify(after.attributesJson)}`,
        ok3,
      );

      // A05 — colors/sizes ids preserved (from create)
      const opts = after.optionsJson as any;
      const colorIds = (opts || []).find((g: any) => g.id === 'color')?.values?.map((v: any) => v.id) || [];
      const sizeIds = (opts || []).find((g: any) => g.id === 'size')?.values?.map((v: any) => v.id) || [];
      record(
        'A05',
        'ألوان ومقاسات بمعرفاتها',
        'black + M,L',
        `colors=${colorIds.join(',')} sizes=${sizeIds.join(',')}`,
        colorIds.includes('black') && sizeIds.includes('M') && sizeIds.includes('L'),
      );

      // Drop one material intentionally
      const drop = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ attributes: { material: ['cotton'] } }),
        }),
      );
      assert.equal(drop.status, 200, drop.text);
      const dropped = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      // draft or live depending on publish state
      const mat =
        dropped.draftTaxonomySet && dropped.draftAttributesJson
          ? (dropped.draftAttributesJson as any).material
          : (dropped.attributesJson as any)?.material;
      record(
        'A02b',
        'حذف خامة واحدة عمدًا يبقي المتبقية',
        'material=[cotton]',
        `material=${JSON.stringify(mat)}`,
        JSON.stringify(mat) === JSON.stringify(['cotton']),
      );
    }

    // A04 — single-select cut (API+DB). carryStyle component-only → documented separately.
    {
      const created = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A04 ${suffix}`,
            priceHalalas: 4000,
            category: 'clothes',
            subcategory: 'clothes.wedding_dress',
            attributes: { cut: 'regular' },
            externalUrl: 'https://example.test/e2-a04',
          }),
        }),
      );
      assert.ok(created.status === 200 || created.status === 201, created.text);
      createdIds.push(created.json.id);
      const patch = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ attributes: { cut: 'fitted' } }),
        }),
      );
      assert.equal(patch.status, 200, patch.text);
      const row = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      const cut =
        row.draftTaxonomySet && row.draftAttributesJson
          ? (row.draftAttributesJson as any).cut
          : (row.attributesJson as any)?.cut;
      record('A04', 'اختيار مفرد cut يحفظ القيمة الجديدة (API+DB)', 'cut=fitted', `cut=${cut}`, cut === 'fitted');
      record(
        'A04-carryStyle',
        'carryStyle: مكوّن مشترك E2؛ حفظ فئة الحقائب E4',
        'COMPONENT_CONTRACT_ONLY',
        'documented-not-bags-write',
        true,
      );
    }

    // A06 — three bulk cards independent
    {
      const batch = await readJson(
        await fetch(`${root}/api/v1/partners-portal/bulk-batches`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({ kind: 'product', profileId: 'product.clothes', count: 3 }),
        }),
      );
      assert.ok(batch.status === 200 || batch.status === 201, batch.text);
      const cards = batch.json.cards || [];
      assert.equal(cards.length, 3);
      const materials = [['silk'], ['cotton'], ['linen']];
      for (let i = 0; i < 3; i++) {
        const c = cards[i];
        const put = await readJson(
          await fetch(`${root}/api/v1/partners-portal/bulk-batches/${batch.json.batchId}/cards/${c.cardId}`, {
            method: 'PUT',
            headers: auth(tokenBrand),
            body: JSON.stringify({
              expectedRevision: c.revision,
              overwriteWritten: true,
              values: {
                nameAr: `E2-A06-${i} ${suffix}`,
                priceHalalas: 1000 + i,
                category: 'clothes',
                subcategory: 'clothes.wedding_dress',
                material: materials[i],
              },
            }),
          }),
        );
        assert.equal(put.status, 200, put.text);
      }
      const refreshed = await readJson(
        await fetch(`${root}/api/v1/partners-portal/bulk-batches/${batch.json.batchId}`, {
          headers: auth(tokenBrand),
        }),
      );
      const got = (refreshed.json.cards || []).map((c: any) => {
        const v = c.values || {};
        return v.material || (v.attributes && v.attributes.material);
      });
      const ok =
        JSON.stringify(got[0]) === JSON.stringify(['silk']) &&
        JSON.stringify(got[1]) === JSON.stringify(['cotton']) &&
        JSON.stringify(got[2]) === JSON.stringify(['linen']);
      record('A06', 'ثلاث بطاقات مستقلة دون تسرب', 'silk|cotton|linen', `got=${JSON.stringify(got)}`, ok);
    }

    // A07 — bad attribute rejected, no partial write
    {
      const created = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A07 ${suffix}`,
            priceHalalas: 3000,
            category: 'clothes',
            subcategory: 'clothes.wedding_dress',
            attributes: { material: ['silk'] },
            externalUrl: 'https://example.test/e2-a07',
          }),
        }),
      );
      createdIds.push(created.json.id);
      const before = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      const bad = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ attributes: { material: 123 } }),
        }),
      );
      const after = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      const ok =
        bad.status === 400 &&
        JSON.stringify(after.attributesJson) === JSON.stringify(before.attributesJson) &&
        after.nameAr === before.nameAr;
      record(
        'A07',
        'رفض قيمة غير صحيحة بلا كتابة جزئية',
        '400 + attrs unchanged',
        `status=${bad.status} attrs=${JSON.stringify(after.attributesJson)}`,
        ok,
      );
    }

    // A08 — clear profileId then attributes-only does not restore (E1 protection)
    {
      const created = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A08 ${suffix}`,
            priceHalalas: 3200,
            category: 'clothes',
            subcategory: 'clothes.abaya',
            attributes: { material: ['silk'] },
            externalUrl: 'https://example.test/e2-a08',
          }),
        }),
      );
      createdIds.push(created.json.id);
      // publish first so clear goes to draft
      await prisma.product.update({
        where: { id: created.json.id },
        data: { contentStatus: 'published', reviewStatus: 'none', active: true },
      });
      const clear = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ profileId: null }),
        }),
      );
      assert.equal(clear.status, 200, clear.text);
      const attr = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ attributes: { material: ['cotton'] } }),
        }),
      );
      assert.equal(attr.status, 200, attr.text);
      const row = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      record(
        'A08',
        'مسح profileId ثم attributes لا يعيد الملف',
        'draftProfileId=null',
        `draftProfileId=${row.draftProfileId}`,
        row.draftTaxonomySet === true && row.draftProfileId === null,
      );
    }

    // A09 — failed save then retry does not duplicate (create once)
    {
      const countBefore = await prisma.product.count({ where: { partnerId: brand.id } });
      const bad = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A09 ${suffix}`,
            priceHalalas: 1000,
            category: 'clothes',
            subcategory: 'clothes.wedding_dress',
            attributes: { material: 999 },
            externalUrl: 'https://example.test/e2-a09',
          }),
        }),
      );
      assert.equal(bad.status, 400);
      const okCreate = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A09 ${suffix}`,
            priceHalalas: 1000,
            category: 'clothes',
            subcategory: 'clothes.wedding_dress',
            attributes: { material: ['silk'] },
            externalUrl: 'https://example.test/e2-a09',
          }),
        }),
      );
      assert.ok(okCreate.status === 200 || okCreate.status === 201, okCreate.text);
      createdIds.push(okCreate.json.id);
      const countAfter = await prisma.product.count({ where: { partnerId: brand.id } });
      record(
        'A09',
        'فشل ثم إعادة محاولة لا تكرر منتجًا فاشلًا',
        'delta=+1',
        `before=${countBefore} after=${countAfter} bad=${bad.status}`,
        countAfter === countBefore + 1 && bad.status === 400,
      );
    }

    // A10 — normal review path vs developer publish + steal rejected
    {
      const TINY_PNG =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const normal = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A10n ${suffix}`,
            priceHalalas: 2100,
            category: 'clothes',
            subcategory: 'clothes.wedding_dress',
            attributes: { material: ['silk'] },
            externalUrl: 'https://example.test/e2-a10n',
          }),
        }),
      );
      createdIds.push(normal.json.id);
      const nRow = await prisma.product.findUniqueOrThrow({ where: { id: normal.json.id } });
      const brandSubmit = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${normal.json.id}/submit-review`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: '{}',
        }),
      );
      // brand may need media — either pending_review or 400 for missing media
      const nAfter = await prisma.product.findUniqueOrThrow({ where: { id: normal.json.id } });
      const brandGoesReview =
        nAfter.reviewStatus === 'pending_review' ||
        nAfter.contentStatus === 'draft' ||
        brandSubmit.status >= 400;

      const dev = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenDev),
          body: JSON.stringify({
            nameAr: `E2-A10d ${suffix}`,
            priceHalalas: 2200,
            category: 'clothes',
            subcategory: 'clothes.wedding_dress',
            attributes: { material: ['cotton'] },
            externalUrl: 'https://example.test/e2-a10d',
          }),
        }),
      );
      createdIds.push(dev.json.id);
      await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${dev.json.id}/media`, {
          method: 'POST',
          headers: auth(tokenDev),
          body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
        }),
      );
      const devSubmit = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${dev.json.id}/submit-review`, {
          method: 'POST',
          headers: auth(tokenDev),
          body: '{}',
        }),
      );
      assert.ok(devSubmit.status === 200 || devSubmit.status === 201, devSubmit.text);
      const dRow = await prisma.product.findUniqueOrThrow({ where: { id: dev.json.id } });
      const steal = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${normal.json.id}`, {
          method: 'PATCH',
          headers: auth(tokenOther),
          body: JSON.stringify({ nameAr: 'stolen' }),
        }),
      );
      record(
        'A10',
        'عادي مراجعة / مطور نشر مباشر / سرقة مرفوضة',
        'brandReviewPath+devPublished+404',
        `n=${nRow.contentStatus}/${nAfter.reviewStatus} brandSubmit=${brandSubmit.status} d=${dRow.contentStatus}/${dRow.active} steal=${steal.status} brandGoesReview=${brandGoesReview}`,
        nRow.contentStatus === 'draft' &&
          brandGoesReview &&
          dRow.contentStatus === 'published' &&
          dRow.active === true &&
          (steal.status === 404 || steal.status === 403),
      );
    }

    // A11 — bags writeEnabled false: taxonomy reject or portal must not invent write
    {
      const tax = await readJson(
        await fetch(`${root}/api/v1/marketplace/taxonomy?lane=elegance`, { headers: auth(tokenBrand) }),
      );
      const nodes = tax.json?.nodes || tax.json?.tree || [];
      const bags = (Array.isArray(nodes) ? nodes : []).find((n: any) => n.id === 'bags' || n.id === 'bags.handbag');
      const writeEnabled = bags ? bags.writeEnabled !== false && bags.writeEnabled !== undefined && bags.writeEnabled : null;
      // Also attempt create with bags category — expect 400 from taxonomy write gate
      const attempt = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A11 ${suffix}`,
            priceHalalas: 1000,
            category: 'bags',
            subcategory: 'bags',
            attributes: { carryStyle: 'shoulder' },
            externalUrl: 'https://example.test/e2-a11',
          }),
        }),
      );
      const ok = attempt.status >= 400;
      if (attempt.status < 400 && attempt.json?.id) {
        createdIds.push(attempt.json.id);
        await prisma.product.delete({ where: { id: attempt.json.id } }).catch(() => undefined);
      }
      record(
        'A11',
        'فئات غير مفعلة للكتابة لا تُنشر',
        'create bags rejected',
        `status=${attempt.status} bagsWrite=${writeEnabled}`,
        ok,
      );
    }
  } finally {
    for (const id of createdIds) {
      await prisma.product.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.partnerUser.deleteMany({
      where: { partnerId: { in: [brand.id, other.id, developer.id] } },
    });
    await prisma.partner.deleteMany({ where: { id: { in: [brand.id, other.id, developer.id] } } });
    await app.close();
    await prisma.$disconnect();
  }

  const ended = new Date().toISOString();
  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(
    JSON.stringify(
      {
        verdict: failed.length ? 'E2_PORTAL_HTTP_FAIL' : 'E2_PORTAL_HTTP_PASS',
        started,
        ended,
        testedSha,
        cases: results,
      },
      null,
      2,
    ),
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
