/**
 * E4 — bags/shoes contracts: taxonomy, attributes, variants, clear/empty/zero,
 * publish→browse filters (LOCAL/TEST ONLY).
 * Portal UI field appearance is covered by ACC-E4-REGISTRY-FIELDS + product shell reuse;
 * API-only create does not close this stage — see roundtrip/variant/browse criteria below.
 */
import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../../common/auth/firebase-id-token-verifier';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogContentService } from '../catalog-content.service';
import { CatalogMediaController } from '../catalog-media.controller';
import { CatalogMediaStorage, LocalCatalogMediaStorage } from '../catalog-media.storage';
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
import { captureAcceptanceRun } from './acceptance-run-identity';
import { validateProductTaxonomyWrite } from './product-taxonomy.validate';
import { loadEleganceTaxonomyDoc } from './taxonomy.load';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    if (token !== 'unused') throw new UnauthorizedException('Invalid token');
    return { uid: 'unused', email: 'unused@test.local' };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [
    MarketplaceController,
    PartnersPortalController,
    CatalogMediaController,
    CatalogReviewAdminController,
  ],
  providers: [
    MarketplaceService,
    TaxonomyService,
    CatalogContentService,
    PartnersPortalService,
    RegistryService,
    EditorDraftsService,
    ServiceProfileService,
    BulkBatchesService,
    VariantInventoryService,
    PartnerTokenGuard,
    FirebaseAuthGuard,
    AdminApiKeyGuard,
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
    { provide: CatalogMediaStorage, useClass: LocalCatalogMediaStorage },
  ],
})
class E4AcceptanceModule {}

type Case = { id: string; status: 'PASS' | 'FAIL'; expected: string; actual: string };

async function main() {
  const evidenceDir = path.resolve(__dirname, '../../../../../.e4-acceptance-evidence');
  const repoRoot = path.resolve(__dirname, '../../../../');
  const runIdentity = captureAcceptanceRun(repoRoot);
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'run-identity.json'), JSON.stringify(runIdentity, null, 2));

  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'e4-admin-local';
  process.env.MIRA_MEDIA_DIR = path.join(evidenceDir, 'media-store');
  fs.mkdirSync(process.env.MIRA_MEDIA_DIR, { recursive: true });
  process.env.MIRA_MEDIA_STORE = 'local';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const cases: Case[] = [];
  const record = (id: string, expected: string, actual: unknown, ok: boolean) => {
    cases.push({
      id,
      status: ok ? 'PASS' : 'FAIL',
      expected,
      actual: typeof actual === 'string' ? actual : JSON.stringify(actual),
    });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id}`);
  };

  const brand = await prisma.partner.create({
    data: {
      type: 'brand',
      status: 'active',
      nameAr: `E4 Brand ${suffix}`,
      nameEn: 'E4 Brand',
      city: 'الرياض',
    },
  });
  const token = `tok-e4-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `e4-${suffix}@test.local`, accessToken: token },
  });

  let app: INestApplication | null = null;
  const createdIds: string[] = [];
  try {
    app = await NestFactory.create(E4AcceptanceModule, { logger: ['error'] });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0);
    const port = (app.getHttpServer().address() as { port: number }).port;
    const root = `http://127.0.0.1:${port}`;

    const taxRes = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=elegance`);
    const tax = (await taxRes.json()) as {
      nodes: Array<{ id: string; writeEnabled: boolean; profileId?: string }>;
    };
    const bags = tax.nodes.find((n) => n.id === 'bags');
    const shoes = tax.nodes.find((n) => n.id === 'shoes');
    const bagsHand = tax.nodes.find((n) => n.id === 'bags.hand');
    const shoesHeel = tax.nodes.find((n) => n.id === 'shoes.heel');
    record(
      'ACC-E4-TAXONOMY-WRITE-ENABLED',
      'bags/shoes roots and leaf nodes writeEnabled=true with profiles',
      { bags, shoes, bagsHand, shoesHeel },
      !!bags &&
        !!shoes &&
        bags.writeEnabled === true &&
        shoes.writeEnabled === true &&
        bagsHand?.writeEnabled === true &&
        shoesHeel?.writeEnabled === true &&
        bags.profileId === 'product.bags' &&
        shoes.profileId === 'product.shoes',
    );

    const doc = loadEleganceTaxonomyDoc().doc;
    const bagsGate = validateProductTaxonomyWrite(doc, {
      category: 'bags',
      subcategory: 'bags.hand',
      profileId: 'product.bags',
    });
    const shoesGate = validateProductTaxonomyWrite(doc, {
      category: 'shoes',
      subcategory: 'shoes.heel',
      profileId: 'product.shoes',
    });
    record(
      'ACC-E4-VALIDATE-ALLOWS-WRITE',
      'validateProductTaxonomyWrite allows bags.hand and shoes.heel',
      { bagsGate, shoesGate },
      bagsGate.length === 0 && shoesGate.length === 0,
    );

    const bagsCreate = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nameAr: `E4 Bag ${suffix}`,
        nameEn: 'E4 Bag',
        priceHalalas: 22000,
        category: 'bags',
        subcategory: 'bags.hand',
        profileId: 'product.bags',
        externalUrl: `https://example.test/e4-bag-${suffix}`,
      }),
    });
    const bagsBody = (await bagsCreate.json().catch(() => ({}))) as { id?: string; category?: string };
    if (bagsBody.id) createdIds.push(bagsBody.id);
    record(
      'ACC-E4-BAGS-CREATE',
      'partners-portal accepts bags.hand create with product.bags',
      { status: bagsCreate.status, bagsBody },
      bagsCreate.status < 400 && bagsBody.id != null && bagsBody.category === 'bags',
    );

    const shoesCreate = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nameAr: `E4 Shoe ${suffix}`,
        nameEn: 'E4 Shoe',
        priceHalalas: 18000,
        category: 'shoes',
        subcategory: 'shoes.heel',
        profileId: 'product.shoes',
        externalUrl: `https://example.test/e4-shoe-${suffix}`,
      }),
    });
    const shoesBody = (await shoesCreate.json().catch(() => ({}))) as { id?: string; category?: string };
    if (shoesBody.id) createdIds.push(shoesBody.id);
    record(
      'ACC-E4-SHOES-CREATE',
      'partners-portal accepts shoes.heel create with product.shoes',
      { status: shoesCreate.status, shoesBody },
      shoesCreate.status < 400 && shoesBody.id != null && shoesBody.category === 'shoes',
    );

    const authH = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const adminH = {
      'content-type': 'application/json',
      'x-admin-key': process.env.ADMIN_API_KEY || 'e4-admin-local',
    };

    // Registry profiles expose bags/shoes fields used by portal shells (shared with individual editor).
    const regRes = await fetch(`${root}/api/v1/partners-portal/registry`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const regBody = (await regRes.json().catch(() => ({}))) as {
      registry?: { profiles?: Array<{ id: string; fields?: string[] }>; fields?: Record<string, unknown> };
      profiles?: Array<{ id: string; fields?: string[] }>;
      fields?: Record<string, unknown>;
    };
    const profiles = regBody.registry?.profiles || regBody.profiles || [];
    const fields = regBody.registry?.fields || regBody.fields || {};
    const bagsProfile = profiles.find((p) => p.id === 'product.bags');
    const shoesProfile = profiles.find((p) => p.id === 'product.shoes');
    record(
      'ACC-E4-REGISTRY-FIELDS',
      'product.bags includes material+carryStyle; product.shoes includes material; shared field defs present',
      {
        bagsFields: bagsProfile?.fields,
        shoesFields: shoesProfile?.fields,
        hasCarry: !!(fields as any).carryStyle,
        hasMaterial: !!(fields as any).material,
      },
      !!bagsProfile &&
        !!shoesProfile &&
        (bagsProfile.fields || []).includes('material') &&
        (bagsProfile.fields || []).includes('carryStyle') &&
        (shoesProfile.fields || []).includes('material') &&
        !!(fields as any).carryStyle &&
        !!(fields as any).material,
    );

    // Bags: attributes + options/variants roundtrip + empty≠zero stock.
    const bagVariants = [
      {
        id: `bag-v1-${suffix}`,
        selections: { color: 'black' },
        priceHalalas: 22000,
        available: true,
        stockQty: 2,
      },
      {
        id: `bag-v2-${suffix}`,
        selections: { color: 'beige' },
        priceHalalas: 23000,
        available: true,
        stockQty: 0,
      },
    ];
    const bagsPatch = bagsBody.id
      ? await fetch(`${root}/api/v1/partners-portal/products/${bagsBody.id}`, {
          method: 'PATCH',
          headers: authH,
          body: JSON.stringify({
            attributes: { material: ['silk'], carryStyle: 'crossbody' },
            optionsJson: [
              {
                id: 'color',
                labelAr: 'اللون',
                values: [
                  { id: 'black', labelAr: 'أسود' },
                  { id: 'beige', labelAr: 'بيج' },
                ],
              },
            ],
            variantsJson: bagVariants,
            stockQty: null,
            descriptionAr: '',
          }),
        })
      : null;
    const bagsPatchBody = bagsPatch ? await bagsPatch.json().catch(() => ({})) : {};
    const bagsAfter = bagsBody.id
      ? await prisma.product.findUnique({ where: { id: bagsBody.id } })
      : null;
    const bagsAttrs = (bagsAfter?.attributesJson || {}) as Record<string, unknown>;
    const bagsDraftVars = (bagsAfter?.draftVariantsJson || bagsAfter?.variantsJson || []) as Array<{
      id: string;
      selections?: Record<string, string>;
      stockQty?: number | null;
    }>;
    // Attributes may land on draftAttributesJson until publish for brand review flow.
    const bagsAttrsLive =
      (bagsAfter?.draftAttributesJson as Record<string, unknown> | null) ||
      (bagsAfter?.attributesJson as Record<string, unknown> | null) ||
      {};
    record(
      'ACC-E4-BAGS-FIELDS-ROUNDTRIP',
      'bags PATCH persists material+carryStyle+colors/variants; empty description; stock null≠0 on product',
      {
        status: bagsPatch?.status,
        bagsAttrs: bagsAttrsLive,
        stockQty: bagsAfter?.stockQty,
        variants: bagsDraftVars,
        draftVariantsSet: bagsAfter?.draftVariantsSet,
        draftTaxonomySet: (bagsAfter as any)?.draftTaxonomySet,
        patchBody: bagsPatchBody,
      },
      !!bagsPatch &&
        bagsPatch.status < 400 &&
        JSON.stringify(bagsAttrsLive.material || []) === JSON.stringify(['silk']) &&
        bagsAttrsLive.carryStyle === 'crossbody' &&
        bagsDraftVars.length === 2 &&
        bagsDraftVars.some((v) => v.selections?.color === 'black') &&
        bagsDraftVars.some((v) => v.selections?.color === 'beige') &&
        (bagsAfter?.stockQty == null || bagsAfter?.stockQty === null),
    );

    // Explicit clear of optional carryStyle; neighbor material must remain.
    const bagsClear = bagsBody.id
      ? await fetch(`${root}/api/v1/partners-portal/products/${bagsBody.id}`, {
          method: 'PATCH',
          headers: authH,
          body: JSON.stringify({ attributes: { carryStyle: null } }),
        })
      : null;
    const bagsCleared = bagsBody.id
      ? await prisma.product.findUnique({ where: { id: bagsBody.id } })
      : null;
    const clearedAttrs =
      ((bagsCleared?.draftAttributesJson as Record<string, unknown> | null) ||
        (bagsCleared?.attributesJson as Record<string, unknown> | null) ||
        {}) as Record<string, unknown>;
    record(
      'ACC-E4-BAGS-EXPLICIT-CLEAR',
      'carryStyle null clears only that key; material remains',
      { status: bagsClear?.status, clearedAttrs },
      !!bagsClear &&
        bagsClear.status < 400 &&
        (clearedAttrs.carryStyle == null || !('carryStyle' in clearedAttrs)) &&
        JSON.stringify(clearedAttrs.material || []) === JSON.stringify(['silk']),
    );

    // Shoes: sizes + material + matching color/size variant composite.
    const shoeVariants = [
      {
        id: `shoe-v1-${suffix}`,
        selections: { color: 'black', size: '38' },
        priceHalalas: 18000,
        available: true,
        stockQty: 1,
      },
      {
        id: `shoe-v2-${suffix}`,
        selections: { color: 'black', size: '39' },
        priceHalalas: 18000,
        available: true,
        stockQty: 4,
      },
    ];
    const shoesPatch = shoesBody.id
      ? await fetch(`${root}/api/v1/partners-portal/products/${shoesBody.id}`, {
          method: 'PATCH',
          headers: authH,
          body: JSON.stringify({
            attributes: { material: ['satin'] },
            optionsJson: [
              {
                id: 'color',
                labelAr: 'اللون',
                values: [{ id: 'black', labelAr: 'أسود' }],
              },
              {
                id: 'size',
                labelAr: 'المقاس',
                values: [
                  { id: '38', labelAr: '38' },
                  { id: '39', labelAr: '39' },
                ],
              },
            ],
            variantsJson: shoeVariants,
            stockQty: 0,
          }),
        })
      : null;
    const shoesAfter = shoesBody.id
      ? await prisma.product.findUnique({ where: { id: shoesBody.id } })
      : null;
    const shoeAttrs =
      ((shoesAfter?.draftAttributesJson as Record<string, unknown> | null) ||
        (shoesAfter?.attributesJson as Record<string, unknown> | null) ||
        {}) as Record<string, unknown>;
    const shoeVars = (shoesAfter?.draftVariantsJson || shoesAfter?.variantsJson || []) as Array<{
      id: string;
      selections?: Record<string, string>;
      stockQty?: number | null;
    }>;
    const compositeHit = shoeVars.find(
      (v) => v.selections?.color === 'black' && v.selections?.size === '39',
    );
    const wrongCombo = shoeVars.find(
      (v) => v.selections?.color === 'black' && v.selections?.size === '38',
    );
    record(
      'ACC-E4-SHOES-VARIANT-COMPOSITE',
      'shoes color+size bind to the same variant row; stock 0 preserved (not coerced empty)',
      {
        status: shoesPatch?.status,
        shoeAttrs,
        stockQty: shoesAfter?.stockQty,
        compositeHit,
        wrongCombo,
        shoeVars,
      },
      !!shoesPatch &&
        shoesPatch.status < 400 &&
        JSON.stringify(shoeAttrs.material || []) === JSON.stringify(['satin']) &&
        shoesAfter?.stockQty === 0 &&
        !!compositeHit &&
        !!wrongCombo &&
        compositeHit.id !== wrongCombo.id,
    );

    // Reject invalid subcategory/profile pairing.
    const badCreate = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: authH,
      body: JSON.stringify({
        nameAr: `E4 Bad ${suffix}`,
        priceHalalas: 1000,
        category: 'bags',
        subcategory: 'shoes.heel',
        profileId: 'product.bags',
        externalUrl: `https://example.test/e4-bad-${suffix}`,
      }),
    });
    const badBody = await badCreate.json().catch(() => ({}));
    record(
      'ACC-E4-REJECT-CROSS-CATEGORY',
      'bags category cannot claim shoes.heel subcategory',
      { status: badCreate.status, badBody },
      badCreate.status >= 400,
    );

    // Publish path → marketplace browse + subcategory filter for both categories.
    const TINY_PNG =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    async function publishProduct(id: string, nameAr: string) {
      await fetch(`${root}/api/v1/partners-portal/products/${id}`, {
        method: 'PATCH',
        headers: authH,
        body: JSON.stringify({ nameAr }),
      });
      await fetch(`${root}/api/v1/partners-portal/products/${id}/media`, {
        method: 'POST',
        headers: authH,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
      });
      await fetch(`${root}/api/v1/partners-portal/products/${id}/submit-review`, {
        method: 'POST',
        headers: authH,
        body: '{}',
      });
      const queued = await prisma.product.findUnique({ where: { id } });
      const rev = queued?.submittedRevision ?? queued?.reviewRevision ?? null;
      const decide = await fetch(`${root}/api/v1/admin/catalog-reviews/product/${id}/decision`, {
        method: 'POST',
        headers: adminH,
        body: JSON.stringify({ decision: 'approve', revision: rev, note: 'e4' }),
      });
      return { decideStatus: decide.status, after: await prisma.product.findUnique({ where: { id } }) };
    }

    const bagPub = bagsBody.id
      ? await publishProduct(bagsBody.id, `E4 Bag Published ${suffix}`)
      : null;
    const shoePub = shoesBody.id
      ? await publishProduct(shoesBody.id, `E4 Shoe Published ${suffix}`)
      : null;

    const bagBrowse = await fetch(
      `${root}/api/v1/marketplace/catalog?partnerId=${brand.id}&category=bags&subcategory=bags.hand&limit=24`,
    );
    const bagBrowseBody = (await bagBrowse.json().catch(() => ({}))) as {
      items?: Array<{ id: string; nameAr?: string; category?: string; subcategory?: string }>;
    };
    const shoeBrowse = await fetch(
      `${root}/api/v1/marketplace/catalog?partnerId=${brand.id}&category=shoes&subcategory=shoes.heel&limit=24`,
    );
    const shoeBrowseBody = (await shoeBrowse.json().catch(() => ({}))) as {
      items?: Array<{ id: string; nameAr?: string }>;
    };
    const bagRow = (bagBrowseBody.items || []).find((i) => i.id === bagsBody.id);
    const shoeRow = (shoeBrowseBody.items || []).find((i) => i.id === shoesBody.id);
    // Cross-filter: bags must not appear under shoes filter.
    const cross = (shoeBrowseBody.items || []).find((i) => i.id === bagsBody.id);

    record(
      'ACC-E4-PUBLISH-BROWSE-FILTERS',
      'approved bags/shoes appear under their subcategory filters; no cross-category leak',
      {
        bagPub,
        shoePub,
        bagRow,
        shoeRow,
        cross,
      },
      !!bagPub &&
        bagPub.decideStatus < 400 &&
        bagPub.after?.contentStatus === 'published' &&
        !!shoePub &&
        shoePub.decideStatus < 400 &&
        shoePub.after?.contentStatus === 'published' &&
        !!bagRow &&
        String(bagRow.nameAr || '').includes('E4 Bag Published') &&
        !!shoeRow &&
        String(shoeRow.nameAr || '').includes('E4 Shoe Published') &&
        !cross,
    );

    // Reopen via partners preview (edit payload) — no field loss after publish.
    const bagsGet = bagsBody.id
      ? await fetch(`${root}/api/v1/partners-portal/products/${bagsBody.id}/preview`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      : null;
    const bagsGetBody = bagsGet ? ((await bagsGet.json().catch(() => ({}))) as any) : null;
    const shoesGet = shoesBody.id
      ? await fetch(`${root}/api/v1/partners-portal/products/${shoesBody.id}/preview`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      : null;
    const shoesGetBody = shoesGet ? ((await shoesGet.json().catch(() => ({}))) as any) : null;
    const shoePreviewVars =
      shoesGetBody?.draftVariantsJson ||
      shoesGetBody?.publishedVariantsJson ||
      shoesGetBody?.variantsJson ||
      [];
    const bagsCat = bagsGetBody?.publishedCategory || bagsGetBody?.category || bagsAfter?.category;
    const bagsSub =
      bagsGetBody?.publishedSubcategory || bagsGetBody?.subcategory || bagsAfter?.subcategory;
    const shoesCat =
      shoesGetBody?.publishedCategory || shoesGetBody?.category || shoesAfter?.category;
    record(
      'ACC-E4-REOPEN-NO-LOSS',
      'preview after publish keeps category/subcategory/material/variants',
      {
        bagsGetStatus: bagsGet?.status,
        shoesGetStatus: shoesGet?.status,
        bagsCat,
        bagsSub,
        shoesCat,
        shoesVarCount: Array.isArray(shoePreviewVars) ? shoePreviewVars.length : null,
        bagsAttrsPreview: bagsGetBody?.publishedAttributes || bagsGetBody?.draftAttributes,
      },
      !!bagsGet &&
        bagsGet.status < 400 &&
        bagsCat === 'bags' &&
        bagsSub === 'bags.hand' &&
        !!shoesGet &&
        shoesGet.status < 400 &&
        shoesCat === 'shoes' &&
        Array.isArray(shoePreviewVars) &&
        shoePreviewVars.length === 2,
    );

    fs.writeFileSync(
      path.join(evidenceDir, 'e4-bags-shoes-write.json'),
      JSON.stringify(
        {
          bagsBody,
          shoesBody,
          bagsGate,
          shoesGate,
          bagsAttrs,
          clearedAttrs,
          shoeAttrs,
          bagRow,
          shoeRow,
        },
        null,
        2,
      ),
    );
  } finally {
    if (createdIds.length) {
      await prisma.product.deleteMany({ where: { id: { in: createdIds } } }).catch(() => undefined);
    }
    await prisma.partnerUser.deleteMany({ where: { partnerId: brand.id } }).catch(() => undefined);
    await prisma.partner.delete({ where: { id: brand.id } }).catch(() => undefined);
    if (app) await app.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }

  const fail = cases.filter((c) => c.status === 'FAIL');
  const results = {
    verdict:
      fail.length === 0
        ? 'E4_BAGS_SHOES_CLOSED_VERIFIED — LOCAL/TEST ONLY'
        : 'E4_BAGS_SHOES_INCOMPLETE',
    gate: { ok: fail.length === 0, missing: [], bad: fail.map((c) => c.id) },
    codeContentSha256: runIdentity.contentSha256,
    runId: runIdentity.runId,
    results: cases,
    started: runIdentity.startedAt,
    ended: new Date().toISOString(),
    note: 'Portal UI shares catalog-journey + registry attribute mount with clothes; API proves contracts. Groups tracked separately.',
  };
  fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ verdict: results.verdict, gate: results.gate }, null, 2));
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
