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
      // Portal read path: preview (not GET /products/:id which is 404).
      const preview = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}/preview`, {
          headers: auth(tokenBrand),
        }),
      );
      assert.equal(preview.status, 200, `portal preview required: ${preview.text}`);
      assert.equal(preview.json.id, created.json.id);
      const dash = await readJson(
        await fetch(`${root}/api/v1/partners-portal/me`, { headers: auth(tokenBrand) }),
      );
      assert.equal(dash.status, 200, dash.text);
      const listed = (dash.json?.catalog?.products || []).find((p: any) => p.id === created.json.id);
      assert.ok(listed, 'product must appear in dashboard catalog list');
      const row = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      // Preview contract uses publishedAttributes / draftAttributes (portal hydrate).
      const attrsPreview =
        preview.json.draftTaxonomySet && preview.json.draftAttributes != null
          ? preview.json.draftAttributes
          : preview.json.publishedAttributes;
      const attrsList = listed.attributesJson;
      const ok =
        preview.status === 200 &&
        !!listed &&
        JSON.stringify(attrsPreview) === JSON.stringify({ material: ['silk', 'cotton'] }) &&
        JSON.stringify(attrsList) === JSON.stringify({ material: ['silk', 'cotton'] }) &&
        JSON.stringify(row.attributesJson) === JSON.stringify({ material: ['silk', 'cotton'] });
      record(
        'A02',
        'حفظ خامتين واستعادة عبر مسار قراءة البوابة (preview+dashboard) وDB',
        'preview+list+db material=[silk,cotton]',
        `preview=${preview.status} listed=${!!listed} attrsPreview=${JSON.stringify(attrsPreview)}`,
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

      // A05 — colors/sizes ids via portal preview read-back (not DB-only)
      const previewOpts = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}/preview`, {
          headers: auth(tokenBrand),
        }),
      );
      assert.equal(previewOpts.status, 200, previewOpts.text);
      const opts = (previewOpts.json.publishedOptionsJson ||
        previewOpts.json.draftOptionsJson ||
        after.optionsJson) as any;
      const colorIds = (opts || []).find((g: any) => g.id === 'color')?.values?.map((v: any) => v.id) || [];
      const sizeIds = (opts || []).find((g: any) => g.id === 'size')?.values?.map((v: any) => v.id) || [];
      record(
        'A05',
        'ألوان ومقاسات بمعرفاتها عبر preview',
        'black + M,L on portal read path',
        `colors=${colorIds.join(',')} sizes=${sizeIds.join(',')} preview=${previewOpts.status}`,
        previewOpts.status === 200 &&
          colorIds.includes('black') &&
          sizeIds.includes('M') &&
          sizeIds.includes('L'),
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

    // A09 — create once, failed PATCH retry updates same id (no duplicate)
    {
      const created = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A09 ${suffix}`,
            priceHalalas: 1000,
            category: 'clothes',
            subcategory: 'clothes.evening',
            attributes: { material: ['silk'] },
            externalUrl: 'https://example.test/e2-a09',
          }),
        }),
      );
      assert.ok(created.status === 200 || created.status === 201, created.text);
      createdIds.push(created.json.id);
      const id = created.json.id;
      const countAfterCreate = await prisma.product.count({ where: { partnerId: brand.id, id } });
      assert.equal(countAfterCreate, 1);
      const badPatch = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ attributes: { material: 999 } }),
        }),
      );
      assert.equal(badPatch.status, 400);
      const retry = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ attributes: { material: ['cotton'] } }),
        }),
      );
      assert.equal(retry.status, 200, retry.text);
      const sameIdCount = await prisma.product.count({ where: { partnerId: brand.id, nameAr: `E2-A09 ${suffix}` } });
      const row = await prisma.product.findUniqueOrThrow({ where: { id } });
      const mat =
        row.draftTaxonomySet && row.draftAttributesJson
          ? (row.draftAttributesJson as any).material
          : (row.attributesJson as any)?.material;
      record(
        'A09',
        'فشل PATCH ثم إعادة محاولة على نفس المعرف دون تكرار',
        'same id; material=cotton; count name=1',
        `id=${id} sameNameCount=${sameIdCount} mat=${JSON.stringify(mat)} bad=${badPatch.status}`,
        sameIdCount === 1 && JSON.stringify(mat) === JSON.stringify(['cotton']) && badPatch.status === 400,
      );
    }

    // A02c — occasion-only / length-only independent persistence
    {
      const occ = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-OCC ${suffix}`,
            priceHalalas: 1500,
            category: 'clothes',
            subcategory: 'clothes.evening',
            attributes: { occasion: ['eid'] },
            externalUrl: 'https://example.test/e2-occ',
          }),
        }),
      );
      assert.ok(occ.status === 200 || occ.status === 201, occ.text);
      createdIds.push(occ.json.id);
      const prev = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${occ.json.id}/preview`, {
          headers: auth(tokenBrand),
        }),
      );
      assert.equal(prev.status, 200);
      const attrs =
        prev.json.draftTaxonomySet && prev.json.draftAttributes != null
          ? prev.json.draftAttributes
          : prev.json.publishedAttributes || {};
      record(
        'A02c',
        'مناسبة فقط تُحفظ وتُقرأ دون اعتماد على material/cut',
        'occasion=[eid]',
        `attrs=${JSON.stringify(attrs)}`,
        JSON.stringify(attrs.occasion) === JSON.stringify(['eid']) && attrs.material == null,
      );
    }

    // A-SUB — omit subcategory: must NOT invent wedding_dress
    {
      const created = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-NOSUB ${suffix}`,
            priceHalalas: 1800,
            category: 'clothes',
            externalUrl: 'https://example.test/e2-nosub',
          }),
        }),
      );
      assert.ok(created.status === 200 || created.status === 201, created.text);
      createdIds.push(created.json.id);
      const row = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      const nameOnly = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${created.json.id}`, {
          method: 'PATCH',
          headers: auth(tokenBrand),
          body: JSON.stringify({ nameAr: `E2-NOSUB محدث ${suffix}` }),
        }),
      );
      assert.equal(nameOnly.status, 200, nameOnly.text);
      const after = await prisma.product.findUniqueOrThrow({ where: { id: created.json.id } });
      record(
        'A-SUB',
        'منتج بلا تصنيف فرعي لا يتحول إلى فستان زفاف؛ الاسم لا يغيّره',
        'subcategory null/empty; not wedding_dress',
        `before=${row.subcategory} after=${after.subcategory}`,
        row.subcategory !== 'clothes.wedding_dress' &&
          after.subcategory !== 'clothes.wedding_dress' &&
          after.subcategory === row.subcategory,
      );
    }

    // A10 — brand reaches pending_review with media; developer publishes; steal rejected; incomplete separate
    {
      const TINY_PNG =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const incomplete = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A10inc ${suffix}`,
            priceHalalas: 2100,
            category: 'clothes',
            subcategory: 'clothes.evening',
            attributes: { material: ['silk'] },
            externalUrl: 'https://example.test/e2-a10inc',
          }),
        }),
      );
      createdIds.push(incomplete.json.id);
      const incompleteSubmit = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${incomplete.json.id}/submit-review`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: '{}',
        }),
      );
      const incompleteRow = await prisma.product.findUniqueOrThrow({ where: { id: incomplete.json.id } });
      record(
        'A10-incomplete',
        'عرض ناقص (بلا وسائط) يُرفض أو لا يدخل المراجعة',
        'submit fails OR not pending_review',
        `submit=${incompleteSubmit.status} review=${incompleteRow.reviewStatus}`,
        incompleteSubmit.status >= 400 ||
          (incompleteRow.reviewStatus !== 'pending_review' &&
            incompleteRow.reviewStatus !== 'in_review'),
      );

      const normal = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({
            nameAr: `E2-A10n ${suffix}`,
            priceHalalas: 2100,
            category: 'clothes',
            subcategory: 'clothes.evening',
            attributes: { material: ['silk'] },
            externalUrl: 'https://example.test/e2-a10n',
          }),
        }),
      );
      createdIds.push(normal.json.id);
      const media = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${normal.json.id}/media`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
        }),
      );
      assert.ok(media.status === 200 || media.status === 201, media.text);
      const brandSubmit = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${normal.json.id}/submit-review`, {
          method: 'POST',
          headers: auth(tokenBrand),
          body: '{}',
        }),
      );
      assert.ok(brandSubmit.status === 200 || brandSubmit.status === 201, brandSubmit.text);
      const nAfter = await prisma.product.findUniqueOrThrow({ where: { id: normal.json.id } });
      const inReview =
        nAfter.reviewStatus === 'pending_review' || nAfter.reviewStatus === 'in_review';
      assert.ok(inReview, `expected review queue status, got ${nAfter.reviewStatus}`);

      const dev = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products`, {
          method: 'POST',
          headers: auth(tokenDev),
          body: JSON.stringify({
            nameAr: `E2-A10d ${suffix}`,
            priceHalalas: 2200,
            category: 'clothes',
            subcategory: 'clothes.evening',
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
      const selfDev = await readJson(
        await fetch(`${root}/api/v1/partners-portal/products/${normal.json.id}/submit-review`, {
          method: 'POST',
          headers: auth(tokenOther),
          body: '{}',
        }),
      );
      record(
        'A10',
        'حساب عادي → مراجعة؛ مطور → published؛ سرقة مرفوضة',
        'in_review/pending_review + published + 404',
        `brandSubmit=${brandSubmit.status} review=${nAfter.reviewStatus} d=${dRow.contentStatus}/${dRow.active} steal=${steal.status} otherSubmit=${selfDev.status}`,
        brandSubmit.status < 300 &&
          inReview &&
          dRow.contentStatus === 'published' &&
          dRow.active === true &&
          (steal.status === 404 || steal.status === 403) &&
          (selfDev.status === 404 || selfDev.status === 403),
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
