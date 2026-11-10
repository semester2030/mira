/**
 * Phase1 item3: stored description after subcategory change + event_planner canSellProducts with DB rows.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { FirebaseIdTokenVerifier } from '../common/auth/firebase-id-token-verifier';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogContentService } from '../marketplace/catalog-content.service';
import { CatalogMediaController } from '../marketplace/catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../marketplace/catalog-media.storage';
import { CatalogReviewAdminController } from '../marketplace/catalog-review.admin.controller';
import { MarketplaceController } from '../marketplace/marketplace.controller';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { TaxonomyService } from '../marketplace/taxonomy/taxonomy.service';
import { BulkBatchesService } from './bulk-batches/bulk-batches.service';
import { EditorDraftsService } from './editor-drafts/editor-drafts.service';
import { ServiceProfileService } from './editor-drafts/service-profile.service';
import { PartnerTokenGuard } from './guards/partner-token.guard';
import { PartnersPortalController } from './partners-portal.controller';
import { PartnersPortalService } from './partners-portal.service';
import { RegistryService } from './registry/registry.service';
import { VariantInventoryService } from './variant-inventory.service';
import { PARTNER_KIND_FORBIDDEN } from './partner-capabilities';

const MANUAL_DESC = 'وصف يدوي يبقى بعد تغيير الفرع — إثبات مخزّن';

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
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService, tax: TaxonomyService) => new MarketplaceService(prisma, tax),
      inject: [PrismaService, TaxonomyService],
    },
    { provide: FirebaseIdTokenVerifier, useValue: { verify: async () => ({ uid: 'x' }) } },
  ],
})
class Phase1PersistSellModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.AUTH_SKIP = 'false';
  const started = new Date().toISOString();
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const app = await NestFactory.create(Phase1PersistSellModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const root = `http://127.0.0.1:${port}`;

  const brandToken = `tok-brand-${suffix}`;
  const epToken = `tok-ep-${suffix}`;
  const cleanup = {
    partners: [] as string[],
    products: [] as string[],
    services: [] as string[],
  };

  try {
    const brand = await prisma.partner.create({
      data: {
        type: 'brand',
        status: 'active',
        nameAr: `علامة ${suffix}`,
        nameEn: `brand-${suffix}`,
        city: 'الرياض',
      },
    });
    cleanup.partners.push(brand.id);
    await prisma.partnerUser.create({
      data: { partnerId: brand.id, email: `brand-${suffix}@test.local`, accessToken: brandToken },
    });

    const ep = await prisma.partner.create({
      data: {
        type: 'event_planner',
        status: 'active',
        nameAr: `منسّق ${suffix}`,
        nameEn: `ep-${suffix}`,
        city: 'الرياض',
        canSellProducts: false,
        storeUrl: 'mira:canSellProducts=1',
      },
    });
    cleanup.partners.push(ep.id);
    await prisma.partnerUser.create({
      data: { partnerId: ep.id, email: `ep-${suffix}@test.local`, accessToken: epToken },
    });

    const auth = (token: string) => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    });

    // --- Description persist via create → patch subcategory → fresh GET from DB ---
    const createRes = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: auth(brandToken),
      body: JSON.stringify({
        nameAr: `مسودة وصف ${suffix}`,
        priceHalalas: 9000,
        externalUrl: 'https://example.com/p',
        category: 'jewelry',
        subcategory: 'jewelry.rings',
        profileId: 'product.jewelry',
        descriptionAr: MANUAL_DESC,
        attributes: { descriptionDirty: true, descriptionPhraseIds: ['jr1'] },
      }),
    });
    const createBody = await createRes.json();
    assert.ok(createRes.status < 300, JSON.stringify(createBody));
    const productId = createBody.id as string;
    assert.ok(productId);
    cleanup.products.push(productId);

    const patchRes = await fetch(`${root}/api/v1/partners-portal/products/${productId}`, {
      method: 'PATCH',
      headers: auth(brandToken),
      body: JSON.stringify({ subcategory: 'jewelry.necklaces' }),
    });
    const patchBody = await patchRes.json();
    assert.ok(patchRes.status < 300, JSON.stringify(patchBody));

    const reopened = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    assert.equal(reopened.subcategory, 'jewelry.necklaces');
    assert.equal(reopened.descriptionAr, MANUAL_DESC, 'description must survive subcategory change in DB');
    const attrs =
      reopened.attributesJson && typeof reopened.attributesJson === 'object' && !Array.isArray(reopened.attributesJson)
        ? (reopened.attributesJson as Record<string, unknown>)
        : {};
    assert.equal(attrs.descriptionDirty, true);

    // --- event_planner sell path ---
    const svcRes = await fetch(`${root}/api/v1/partners-portal/services`, {
      method: 'POST',
      headers: auth(epToken),
      body: JSON.stringify({
        nameAr: `تنسيق ${suffix}`,
        durationMin: 60,
        priceHalalas: 10000,
        category: 'occasions',
        profileId: 'service.occasions',
      }),
    });
    const svcBody = await svcRes.json();
    assert.ok(svcRes.status < 300, `service create must succeed: ${JSON.stringify(svcBody)}`);
    assert.ok(svcBody.id);
    cleanup.services.push(svcBody.id);
    const svcRow = await prisma.service.findUniqueOrThrow({ where: { id: svcBody.id } });
    assert.equal(svcRow.partnerId, ep.id);

    const beforeCount = await prisma.product.count({ where: { partnerId: ep.id } });
    const denied = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: auth(epToken),
      body: JSON.stringify({
        nameAr: `توزيعات قبل المنح ${suffix}`,
        priceHalalas: 1000,
        externalUrl: 'https://example.com/f',
        category: 'occasions',
        subcategory: 'occasions.favors',
        profileId: 'product.occasions_favors',
      }),
    });
    const deniedBody = await denied.json();
    assert.equal(denied.status, 403);
    assert.equal(deniedBody.code, PARTNER_KIND_FORBIDDEN);
    assert.equal(await prisma.product.count({ where: { partnerId: ep.id } }), beforeCount);

    await prisma.partner.update({
      where: { id: ep.id },
      data: { canSellProducts: true, storeUrl: null },
    });
    const granted = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: auth(epToken),
      body: JSON.stringify({
        nameAr: `توزيعات بعد المنح ${suffix}`,
        priceHalalas: 1000,
        externalUrl: 'https://example.com/f2',
        category: 'occasions',
        subcategory: 'occasions.favors',
        profileId: 'product.occasions_favors',
      }),
    });
    const grantedBody = await granted.json();
    assert.ok(granted.status < 300, JSON.stringify(grantedBody));
    assert.ok(grantedBody.id);
    cleanup.products.push(grantedBody.id);
    const sold = await prisma.product.findUniqueOrThrow({ where: { id: grantedBody.id } });
    assert.equal(sold.partnerId, ep.id);
    assert.equal(sold.nameAr, `توزيعات بعد المنح ${suffix}`);

    await prisma.partner.update({
      where: { id: ep.id },
      data: { canSellProducts: false, storeUrl: 'https://now-selling.example' },
    });
    const afterGrantCount = await prisma.product.count({ where: { partnerId: ep.id } });
    const revoked = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: auth(epToken),
      body: JSON.stringify({
        nameAr: `توزيعات بعد السحب ${suffix}`,
        priceHalalas: 1000,
        externalUrl: 'https://example.com/f3',
        category: 'occasions',
        subcategory: 'occasions.favors',
        profileId: 'product.occasions_favors',
      }),
    });
    const revokedBody = await revoked.json();
    assert.equal(revoked.status, 403);
    assert.equal(revokedBody.code, PARTNER_KIND_FORBIDDEN);
    assert.equal(await prisma.product.count({ where: { partnerId: ep.id } }), afterGrantCount);

    const evidence = {
      id: 'P1-PERSIST-SELL',
      ok: true,
      started,
      finished: new Date().toISOString(),
      root,
      description: {
        productId,
        subcategoryAfter: reopened.subcategory,
        descriptionAr: reopened.descriptionAr,
      },
      sell: {
        serviceId: svcBody.id,
        deniedCode: deniedBody.code,
        grantedProductId: grantedBody.id,
        grantedOwner: sold.partnerId,
        revokedCode: revokedBody.code,
        storeUrlAloneDoesNotGrant: true,
      },
    };
    console.log(JSON.stringify(evidence, null, 2));
    console.log('PASS P1-PERSIST-SELL');
  } finally {
    await prisma.product.deleteMany({ where: { id: { in: cleanup.products } } }).catch(() => undefined);
    await prisma.service.deleteMany({ where: { id: { in: cleanup.services } } }).catch(() => undefined);
    await prisma.partnerUser.deleteMany({ where: { partnerId: { in: cleanup.partners } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: cleanup.partners } } }).catch(() => undefined);
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
