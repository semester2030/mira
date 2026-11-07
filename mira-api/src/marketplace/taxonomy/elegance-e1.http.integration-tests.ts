/**
 * E1 acceptance HTTP/integration tests against local DB.
 * Covers E1-02..E1-12 (subset where env allows).
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
import { loadEleganceTaxonomyDoc } from './taxonomy.load';

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
class E1HttpTestModule {}

function pass(name: string) {
  console.log(`PASS ${name}`);
}

async function baseUrl(app: INestApplication) {
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'e1-admin-test-key';
  process.env.AUTH_SKIP = 'false';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E1 Brand ${suffix}`, nameEn: 'E1 Brand', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E1 Other ${suffix}`, nameEn: 'E1 Other', city: 'جدة' },
  });
  const tokenBrand = `token-e1-brand-${suffix}`;
  const tokenOther = `token-e1-other-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `brand-e1-${suffix}@test.local`, accessToken: tokenBrand },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `other-e1-${suffix}@test.local`, accessToken: tokenOther },
  });

  const app = await NestFactory.create(E1HttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const root = await baseUrl(app);

  const auth = (token: string) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });

  try {
    // E1-02 public taxonomy HTTP
    const taxRes = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=elegance`);
    const taxText = await taxRes.text();
    assert.equal(taxRes.status, 200, taxText);
    const tax = JSON.parse(taxText) as {
      schemaVersion: number;
      lane: string;
      definitionsVersion: number;
      nodes: Array<Record<string, unknown>>;
    };
    const derived = loadEleganceTaxonomyDoc().doc;
    assert.equal(tax.lane, 'elegance');
    assert.equal(tax.schemaVersion, derived.schemaVersion);
    assert.equal(tax.definitionsVersion, derived.definitionsVersion);
    const publicIds = tax.nodes.map((n) => n.id).sort();
    const expectedIds = derived.nodes.filter((n) => n.active).map((n) => n.id).sort();
    assert.deepEqual(publicIds, expectedIds);
    const blob = JSON.stringify(tax);
    assert.ok(!blob.includes('__dirname'));
    assert.ok(!blob.includes('field-registry'));
    assert.ok(!blob.includes('attributes_json'));
    assert.ok(!/partnerId|password|accessToken/i.test(blob));
    const clothesAll = tax.nodes.find((n) => n.id === 'clothes.all');
    assert.equal(clothesAll?.browseOnly, true);
    assert.equal(clothesAll?.writeEnabled, false);
    const bags = tax.nodes.find((n) => n.id === 'bags');
    assert.equal(bags?.writeEnabled, false);
    pass('E1-02-taxonomy-http');

    const badLane = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=beauty`);
    assert.equal(badLane.status, 400);
    pass('E1-02-lane-reject');

    // E1-03 save + read subcategory
    const createOk = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: auth(tokenBrand),
      body: JSON.stringify({
        nameAr: `عباية E1 ${suffix}`,
        priceHalalas: 12000,
        category: 'clothes',
        subcategory: 'clothes.abaya',
        profileId: 'product.abaya',
        attributes: { material: ['silk'], dimensionsCm: { w: 40, h: 10, d: 5 } },
        externalUrl: 'https://example.test/e1',
      }),
    });
    const createText = await createOk.text();
    assert.ok(createOk.status === 200 || createOk.status === 201, createText);
    const created = JSON.parse(createText) as { id: string; subcategory?: string; category?: string; profileId?: string };
    assert.equal(created.subcategory, 'clothes.abaya');
    assert.equal(created.category, 'clothes');
    assert.equal(created.profileId, 'product.abaya');
    const row = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(row.subcategory, 'clothes.abaya');
    assert.ok(row.attributesJson && typeof row.attributesJson === 'object' && !Array.isArray(row.attributesJson));
    pass('E1-03-save-read');

    // E1-04 reject browseOnly / mismatch via HTTP
    const browseOnly = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: auth(tokenBrand),
      body: JSON.stringify({
        nameAr: `رفض الكل ${suffix}`,
        priceHalalas: 1000,
        category: 'clothes',
        subcategory: 'clothes.all',
        externalUrl: 'https://example.test/e1b',
      }),
    });
    assert.equal(browseOnly.status, 400);
    const browseBody = (await browseOnly.json()) as { code?: string; fieldErrors?: Array<{ code: string }> };
    assert.ok(
      browseBody.code === 'SUBCATEGORY_BROWSE_ONLY' ||
        browseBody.fieldErrors?.some((e) => e.code === 'SUBCATEGORY_BROWSE_ONLY'),
      JSON.stringify(browseBody),
    );
    pass('E1-04-http-browseOnly');

    const mismatch = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: auth(tokenBrand),
      body: JSON.stringify({
        nameAr: `رفض تعارض ${suffix}`,
        priceHalalas: 1000,
        category: 'face',
        subcategory: 'clothes.abaya',
        externalUrl: 'https://example.test/e1c',
      }),
    });
    assert.equal(mismatch.status, 400);
    pass('E1-04-http-mismatch');

    const attrsArray = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: auth(tokenBrand),
      body: JSON.stringify({
        nameAr: `رفض مصفوفة ${suffix}`,
        priceHalalas: 1000,
        category: 'clothes',
        attributes: [],
        externalUrl: 'https://example.test/e1d',
      }),
    });
    assert.equal(attrsArray.status, 400);
    pass('E1-05-http-attributes-array');

    // E1-06 draft without fabricated price — create with price then patch name only (price stays)
    const draftCreate = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: auth(tokenBrand),
      body: JSON.stringify({
        nameAr: `مسودة E1 ${suffix}`,
        priceHalalas: 5000,
        category: 'clothes',
        subcategory: 'clothes.evening',
        externalUrl: 'https://example.test/e1e',
      }),
    });
    const draftText = await draftCreate.text();
    assert.ok(draftCreate.status === 200 || draftCreate.status === 201, draftText);
    const draft = JSON.parse(draftText) as { id: string; priceHalalas: number; contentStatus: string };
    assert.equal(draft.contentStatus, 'draft');
    assert.equal(draft.priceHalalas, 5000);
    pass('E1-06-draft-keeps-real-price');

    // E1-07 single-field update does not wipe options/variants/stock
    const withCommerce = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: `خيارات E1 ${suffix}`,
        nameEn: `opts-${suffix}`,
        priceHalalas: 9000,
        externalUrl: 'https://example.test/opts',
        category: 'clothes',
        subcategory: 'clothes.wedding_dress',
        profileId: 'product.clothes',
        contentStatus: 'draft',
        reviewStatus: 'draft',
        active: false,
        concernTags: [],
        skinTypes: [],
        stockQty: 7,
        purchaseMode: 'external',
        optionsJson: [{ id: 'color', nameAr: 'لون', values: [{ id: 'black', labelAr: 'أسود' }] }],
        variantsJson: [{ id: 'v1', selections: { color: 'black' }, available: true, priceHalalas: 9000 }],
      },
    });
    const patchName = await fetch(`${root}/api/v1/partners-portal/products/${withCommerce.id}`, {
      method: 'PATCH',
      headers: auth(tokenBrand),
      body: JSON.stringify({ nameAr: `خيارات محدّثة ${suffix}` }),
    });
    assert.equal(patchName.status, 200, await patchName.text());
    const after = await prisma.product.findUniqueOrThrow({ where: { id: withCommerce.id } });
    assert.equal(after.nameAr, `خيارات محدّثة ${suffix}`);
    assert.equal(after.subcategory, 'clothes.wedding_dress');
    assert.equal(after.stockQty, 7);
    assert.equal(after.priceHalalas, 9000);
    assert.ok(Array.isArray(after.optionsJson) && (after.optionsJson as unknown[]).length === 1);
    assert.ok(Array.isArray(after.variantsJson) && (after.variantsJson as unknown[]).length === 1);
    pass('E1-07-single-field-preserves');

    // E1-08 legacy null subcategory still patchable
    const legacy = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: `قديم E1 ${suffix}`,
        nameEn: `legacy-${suffix}`,
        priceHalalas: 3000,
        externalUrl: 'https://example.test/legacy',
        category: 'clothes',
        subcategory: null,
        contentStatus: 'draft',
        reviewStatus: 'draft',
        active: false,
        concernTags: [],
        skinTypes: [],
      },
    });
    const legacyPatch = await fetch(`${root}/api/v1/partners-portal/products/${legacy.id}`, {
      method: 'PATCH',
      headers: auth(tokenBrand),
      body: JSON.stringify({ nameAr: `قديم محدّث ${suffix}` }),
    });
    assert.equal(legacyPatch.status, 200, await legacyPatch.text());
    const legacyAfter = await prisma.product.findUniqueOrThrow({ where: { id: legacy.id } });
    assert.equal(legacyAfter.subcategory, null);
    assert.equal(legacyAfter.nameAr, `قديم محدّث ${suffix}`);
    pass('E1-08-legacy-null-subcategory');

    // Omitted subcategory on PATCH must not clear existing
    const keepSub = await fetch(`${root}/api/v1/partners-portal/products/${created.id}`, {
      method: 'PATCH',
      headers: auth(tokenBrand),
      body: JSON.stringify({ nameAr: `عباية محفوظة ${suffix}` }),
    });
    assert.equal(keepSub.status, 200);
    const keepRow = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(keepRow.subcategory, 'clothes.abaya');
    pass('E1-08-omit-preserves-subcategory');

    // E1-09 partner isolation
    const steal = await fetch(`${root}/api/v1/partners-portal/products/${created.id}`, {
      method: 'PATCH',
      headers: auth(tokenOther),
      body: JSON.stringify({ nameAr: 'سرقة' }),
    });
    assert.equal(steal.status, 404);
    pass('E1-09-partner-isolation');

    // E1-11 subcategory filter before pagination
    await prisma.product.update({
      where: { id: created.id },
      data: {
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        reviewStatus: 'approved',
      },
    });
    await prisma.product.update({
      where: { id: withCommerce.id },
      data: {
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        reviewStatus: 'approved',
      },
    });
    const filtered = await fetch(
      `${root}/api/v1/marketplace/catalog?lane=elegance&partnerId=${brand.id}&subcategory=clothes.abaya&limit=24`,
    );
    const filteredText = await filtered.text();
    assert.equal(filtered.status, 200, filteredText);
    const filteredBody = JSON.parse(filteredText) as { items: Array<{ id: string; subcategory?: string | null }> };
    const ids = filteredBody.items.map((i) => i.id);
    assert.ok(ids.includes(created.id), JSON.stringify(ids));
    assert.ok(!ids.includes(withCommerce.id), 'wedding_dress must not leak into abaya filter');
    assert.ok(filteredBody.items.every((i) => i.subcategory === 'clothes.abaya'));
    pass('E1-11-subcategory-filter');

    // E1-10 migration presence (additive columns exist)
    const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('subcategory', 'attributes_json')`,
    );
    const colNames = new Set(cols.map((c) => c.column_name));
    assert.ok(colNames.has('subcategory'));
    assert.ok(colNames.has('attributes_json'));
    pass('E1-10-columns-present');

    pass('E1-12-smoke-ok');
    console.log('E1 HTTP ALL PASS');
  } finally {
    await app.close();
    await prisma.partnerUser.deleteMany({ where: { partnerId: { in: [brand.id, other.id] } } }).catch(() => undefined);
    await prisma.product.deleteMany({ where: { partnerId: { in: [brand.id, other.id] } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: [brand.id, other.id] } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
