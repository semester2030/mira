import { captureAcceptanceRun, assertAcceptanceContentUnchanged } from './acceptance-run-identity';
import { evaluateOpenScreenRefreshResult } from './elegance-e3-acceptance-evaluators';
/**
 * E3 — ربط دوائر أناقتك والفلاتر بالمعرفات العامة للتصنيف.
 * LOCAL/TEST ONLY. لا يثبت الإنتاج.
 *
 * Run:
 *   DATABASE_URL=… npx tsx src/marketplace/taxonomy/elegance-e3-acceptance.http.integration-tests.ts
 */
import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
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
import { PrismaService } from '../../prisma/prisma.service';
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
    // Local disk so Flutter Discover NetworkImage can fetch the same bytes (no broad 404 swallow).
    { provide: CatalogMediaStorage, useClass: LocalCatalogMediaStorage },
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService) => new MarketplaceService(prisma),
      inject: [PrismaService],
    },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class E3AcceptanceModule {}

const MANDATORY = [
  'ACC-E3-TAXONOMY-ROOTS',
  'ACC-E3-BAGS-SHOES-BROWSE-ONLY',
  'ACC-E3-APP-PROJECTION-IDS',
  'ACC-E3-CLOTHES-CHILDREN',
  'ACC-E3-VARIANT-AND-SAME',
  'ACC-E3-VARIANT-AND-NEGATIVE',
  'ACC-E3-DRAFT-EXCLUDED',
  'ACC-E3-WITHDRAWN-EXCLUDED',
  'ACC-E3-CATEGORY-FILTER-CLEAR',
  'ACC-E3-SUBCATEGORY-FILTER',
  'ACC-E3-PORTAL-CREATE-BROWSE',
  'ACC-E3-DEFS-CACHE',
  'ACC-E3-APP-SCREEN',
  'ACC-E3-OPEN-SCREEN-REFRESH',
  'ACC-E3-FILTER-UI-TRANSITION',
  'ACC-E3-PAGINATION',
] as const;

type Case = {
  id: string;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
};

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function main() {
  const evidenceDir = path.resolve(__dirname, '../../../../../.e3-acceptance-evidence');
  const repoRoot = path.resolve(__dirname, '../../../../');
  const runIdentity = captureAcceptanceRun(repoRoot);
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'run-identity.json'), JSON.stringify(runIdentity, null, 2));

  const started = new Date().toISOString();
  fs.mkdirSync(evidenceDir, { recursive: true });
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'e3-admin-local';
  // Keep portal media bytes on disk for Discover requireVisual + NetworkImage in Flutter.
  const mediaDir = path.join(evidenceDir, 'media-store');
  fs.mkdirSync(mediaDir, { recursive: true });
  process.env.MIRA_MEDIA_DIR = mediaDir;
  process.env.MIRA_MEDIA_STORE = process.env.MIRA_MEDIA_STORE || 'local';

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const cases: Case[] = [];
  const record = (id: (typeof MANDATORY)[number], expected: string, actual: unknown, ok: boolean) => {
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
      nameAr: `E3 Brand ${suffix}`,
      nameEn: 'E3 Brand',
      city: 'الرياض',
    },
  });
  const token = `tok-e3-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `e3-${suffix}@test.local`, accessToken: token },
  });

  let app: INestApplication | null = null;
  const createdIds: string[] = [];
  try {
    app = await NestFactory.create(E3AcceptanceModule, { logger: ['error'] });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0);
    const port = (app.getHttpServer().address() as { port: number }).port;
    const root = `http://127.0.0.1:${port}`;

    const taxRes = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=elegance`);
    const tax = (await taxRes.json()) as {
      lane: string;
      definitionsVersion: number;
      nodes: Array<{
        id: string;
        parentId: string | null;
        labelAr: string;
        sort: number;
        writeEnabled: boolean;
        browseOnly: boolean;
      }>;
    };
    const roots = tax.nodes.filter((n) => n.parentId == null).sort((a, b) => a.sort - b.sort);
    const rootIds = roots.map((n) => (n.id === 'elegance.all' ? 'all' : n.id));
    const expectedOrder = ['all', 'clothes', 'bags', 'shoes', 'face', 'body', 'hair', 'accessories'];
    record(
      'ACC-E3-TAXONOMY-ROOTS',
      'roots order matches Notes أناقتك',
      { rootIds, lane: tax.lane },
      taxRes.status === 200 &&
        tax.lane === 'elegance' &&
        JSON.stringify(rootIds) === JSON.stringify(expectedOrder),
    );

    const bags = tax.nodes.find((n) => n.id === 'bags');
    const shoes = tax.nodes.find((n) => n.id === 'shoes');
    record(
      'ACC-E3-BAGS-SHOES-BROWSE-ONLY',
      'bags/shoes present for browse with writeEnabled=true (E4 write started)',
      { bags, shoes },
      !!bags && !!shoes && bags.writeEnabled === true && shoes.writeEnabled === true,
    );

    // App projection contract (same mapping as EleganceTaxonomySource.eleganceRoots).
    const appProjection = roots.map((n) => ({
      id: n.id === 'elegance.all' ? 'all' : n.id,
      label: n.labelAr,
      writeEnabled: n.writeEnabled,
      browseOnly: n.browseOnly || n.id === 'elegance.all',
      storedKey: n.browseOnly || n.id === 'elegance.all' ? '' : n.id,
    }));
    const doc = loadEleganceTaxonomyDoc().doc;
    const docRootIds = doc.nodes
      .filter((n) => n.parentId == null && n.active)
      .sort((a, b) => a.sort - b.sort)
      .map((n) => (n.id === 'elegance.all' ? 'all' : n.id));
    record(
      'ACC-E3-APP-PROJECTION-IDS',
      'app projection ids == API roots == taxonomy doc',
      { appIds: appProjection.map((p) => p.id), docRootIds },
      JSON.stringify(appProjection.map((p) => p.id)) === JSON.stringify(docRootIds) &&
        appProjection.some((p) => p.id === 'bags' && p.writeEnabled === true),
    );
    fs.writeFileSync(
      path.join(evidenceDir, 'e3-taxonomy-projection.json'),
      JSON.stringify({ tax, appProjection }, null, 2),
    );

    const clothesNode = tax.nodes.find((n) => n.id === 'clothes');
    const clothesChildren = tax.nodes
      .filter((n) => n.parentId === 'clothes')
      .sort((a, b) => a.sort - b.sort)
      .map((n) => n.id);
    const expectedClothesKids = [
      'clothes.all',
      'clothes.wedding_dress',
      'clothes.abaya',
      'clothes.evening',
      'clothes.casual',
      'clothes.skirt',
      'clothes.blouse',
      'clothes.shirt',
      'clothes.pants',
      'clothes.jeans',
      'clothes.set',
      'clothes.jacket',
      'clothes.sportswear',
      'clothes.loungewear',
    ];
    record(
      'ACC-E3-CLOTHES-CHILDREN',
      'clothes children match Notes drill-down ids',
      { clothesChildren, clothesNode },
      !!clothesNode &&
        expectedClothesKids.every((id) => clothesChildren.includes(id)) &&
        clothesChildren.includes('clothes.abaya') &&
        clothesChildren.includes('clothes.wedding_dress'),
    );

    // Publish product with split variants: black/S and white/M — no black/M.
    const published = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: `E3 Dress ${suffix}`,
        nameEn: 'E3 Dress',
        priceHalalas: 10000,
        category: 'clothes',
        subcategory: 'clothes.evening',
        profileId: 'product.clothes',
        externalUrl: `https://example.test/e3-${suffix}`,
        contentStatus: 'published',
        reviewStatus: 'approved',
        active: true,
        variantsJson: [
          { id: `e3-${suffix}-bs`, selections: { color: 'black', size: 's' }, priceHalalas: 10000, available: true },
          { id: `e3-${suffix}-wm`, selections: { color: 'white', size: 'm' }, priceHalalas: 12000, available: true },
        ],
      },
    });
    createdIds.push(published.id);
    await prisma.productVariantInventory.createMany({
      data: [
        {
          productId: published.id,
          variantId: `e3-${suffix}-bs`,
          variantKey: 'color=black|size=s',
          stockMode: 'tracked',
          stockQty: 3,
          reservedQty: 0,
        },
        {
          productId: published.id,
          variantId: `e3-${suffix}-wm`,
          variantKey: 'color=white|size=m',
          stockMode: 'tracked',
          stockQty: 3,
          reservedQty: 0,
        },
      ],
    });

    const draft = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: `E3 Draft ${suffix}`,
        nameEn: 'E3 Draft',
        priceHalalas: 9000,
        category: 'clothes',
        externalUrl: `https://example.test/e3-draft-${suffix}`,
        contentStatus: 'draft',
        reviewStatus: 'draft',
        active: false,
      },
    });
    createdIds.push(draft.id);

    const marketplace = app.get(MarketplaceService);
    const andHit = await marketplace.browse({
      partnerId: brand.id,
      'variant.color': 'black',
      'variant.size': 's',
      inStock: '1',
      facets: '1',
      limit: '24',
    });
    const hitRow = andHit.items.find((i: { id: string }) => i.id === published.id) as
      | { matchedVariantIds?: string[] }
      | undefined;
    record(
      'ACC-E3-VARIANT-AND-SAME',
      'color+size match only when same variant',
      { hitRow, total: andHit.totalMatched },
      !!hitRow &&
        Array.isArray(hitRow.matchedVariantIds) &&
        hitRow.matchedVariantIds!.length === 1 &&
        hitRow.matchedVariantIds![0] === `e3-${suffix}-bs`,
    );

    const andMiss = await marketplace.browse({
      partnerId: brand.id,
      'variant.color': 'black',
      'variant.size': 'm',
      inStock: '1',
      limit: '24',
    });
    record(
      'ACC-E3-VARIANT-AND-NEGATIVE',
      'black+M must NOT hit via cross-variant false match',
      { ids: andMiss.items.map((i: { id: string }) => i.id) },
      !andMiss.items.some((i: { id: string }) => i.id === published.id),
    );

    record(
      'ACC-E3-DRAFT-EXCLUDED',
      'draft products never appear in browse',
      { ids: andHit.items.map((i: { id: string }) => i.id) },
      !andHit.items.some((i: { id: string }) => i.id === draft.id),
    );

    const withdrawn = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: `E3 Withdrawn ${suffix}`,
        nameEn: 'E3 Withdrawn',
        priceHalalas: 8000,
        category: 'clothes',
        subcategory: 'clothes.evening',
        profileId: 'product.clothes',
        externalUrl: `https://example.test/e3-wd-${suffix}`,
        contentStatus: 'withdrawn',
        reviewStatus: 'approved',
        active: false,
        variantsJson: [
          { id: `e3-${suffix}-wd`, selections: { color: 'black', size: 's' }, priceHalalas: 8000, available: true },
        ],
      },
    });
    createdIds.push(withdrawn.id);
    const wdBrowse = await marketplace.browse({
      partnerId: brand.id,
      category: 'clothes',
      'variant.color': 'black',
      limit: '24',
    });
    record(
      'ACC-E3-WITHDRAWN-EXCLUDED',
      'withdrawn never appears in browse even when facets would match',
      { ids: wdBrowse.items.map((i: { id: string }) => i.id), withdrawnId: withdrawn.id },
      !wdBrowse.items.some((i: { id: string }) => i.id === withdrawn.id),
    );

    // Category switch clears incompatible facet selections (server facet staleSelections).
    const clothesFacets = await marketplace.browse({
      partnerId: brand.id,
      category: 'clothes',
      'variant.color': 'black',
      facets: '1',
      limit: '24',
    });
    const faceFacets = await marketplace.browse({
      partnerId: brand.id,
      category: 'face',
      'variant.color': 'black',
      facets: '1',
      limit: '24',
    });
    const clothesHasColor =
      Array.isArray((clothesFacets as any).facets?.['variant.color']) &&
      (clothesFacets as any).facets['variant.color'].some((b: { id?: string }) => b.id === 'black');
    const faceStaleList =
      (faceFacets as any).facets?.staleSelections ?? (faceFacets as any).staleSelections ?? [];
    const faceStale =
      Array.isArray(faceStaleList) &&
      faceStaleList.some(
        (s: { field?: string; value?: string }) => s.field === 'variant.color' && s.value === 'black',
      );
    // Even without staleSelections field, face+black must not invent cross-category hits from clothes.
    const faceHitClothes = faceFacets.items.some((i: { id: string }) => i.id === published.id);
    record(
      'ACC-E3-CATEGORY-FILTER-CLEAR',
      'category change drops incompatible filter results; no false clothes hit under face',
      { clothesHasColor, faceStale, faceHitClothes, faceTotal: faceFacets.totalMatched },
      clothesHasColor === true && faceHitClothes === false && faceStale === true,
    );

    const subHit = await marketplace.browse({
      partnerId: brand.id,
      category: 'clothes',
      subcategory: 'clothes.evening',
      facets: '1',
      limit: '24',
    });
    const subMiss = await marketplace.browse({
      partnerId: brand.id,
      category: 'clothes',
      subcategory: 'clothes.abaya',
      facets: '1',
      limit: '24',
    });
    record(
      'ACC-E3-SUBCATEGORY-FILTER',
      'subcategory id filters exact node; wrong sub does not invent hits',
      {
        eveningIds: subHit.items.map((i: { id: string }) => i.id),
        abayaIds: subMiss.items.map((i: { id: string }) => i.id),
      },
      subHit.items.some((i: { id: string }) => i.id === published.id) &&
        !subMiss.items.some((i: { id: string }) => i.id === published.id),
    );

    // Portal create → edit → media → submit-review → admin approve → browse (no DB publish/name force).
    const authH = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    const adminH = {
      'content-type': 'application/json',
      'x-admin-key': process.env.ADMIN_API_KEY || 'e3-admin-local',
    };
    const portalCreate = await fetch(`${root}/api/v1/partners-portal/products`, {
      method: 'POST',
      headers: authH,
      body: JSON.stringify({
        nameAr: `E3 Portal ${suffix}`,
        nameEn: 'E3 Portal',
        priceHalalas: 15000,
        category: 'clothes',
        subcategory: 'clothes.evening',
        externalUrl: `https://example.test/e3-portal-${suffix}`,
      }),
    });
    const portalBody = (await portalCreate.json().catch(() => ({}))) as {
      id?: string;
      nameAr?: string;
      messageAr?: string;
      code?: string;
    };
    if (portalBody.id) createdIds.push(portalBody.id);
    let portalJourney: Record<string, unknown> = {
      createStatus: portalCreate.status,
      portalBody,
    };
    if (portalBody.id) {
      const portalPatch = await fetch(`${root}/api/v1/partners-portal/products/${portalBody.id}`, {
        method: 'PATCH',
        headers: authH,
        body: JSON.stringify({ nameAr: `E3 Portal Edited ${suffix}` }),
      });
      const patchBody = await portalPatch.json().catch(() => ({}));
      const mediaRes = await fetch(`${root}/api/v1/partners-portal/products/${portalBody.id}/media`, {
        method: 'POST',
        headers: authH,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: TINY_PNG }),
      });
      const mediaBody = await mediaRes.json().catch(() => ({}));
      const submitRes = await fetch(
        `${root}/api/v1/partners-portal/products/${portalBody.id}/submit-review`,
        { method: 'POST', headers: authH, body: '{}' },
      );
      const submitBody = await submitRes.json().catch(() => ({}));
      const queued = await prisma.product.findUnique({ where: { id: portalBody.id } });
      const rev = queued?.submittedRevision ?? queued?.reviewRevision ?? null;
      const decideRes = await fetch(
        `${root}/api/v1/admin/catalog-reviews/product/${portalBody.id}/decision`,
        {
          method: 'POST',
          headers: adminH,
          body: JSON.stringify({ decision: 'approve', revision: rev, note: 'e3-portal' }),
        },
      );
      const decideBody = await decideRes.json().catch(() => ({}));
      const afterDecide = await prisma.product.findUnique({ where: { id: portalBody.id } });
      const portalBrowse = await marketplace.browse({
        partnerId: brand.id,
        category: 'clothes',
        subcategory: 'clothes.evening',
        limit: '24',
      });
      const portalRow = portalBrowse.items.find((i: { id: string }) => i.id === portalBody.id) as
        | { id: string; nameAr?: string }
        | undefined;
      portalJourney = {
        createStatus: portalCreate.status,
        patchStatus: portalPatch.status,
        patchBody,
        mediaStatus: mediaRes.status,
        mediaBody,
        submitStatus: submitRes.status,
        submitBody,
        reviewStatusQueued: queued?.reviewStatus ?? null,
        revision: rev,
        decideStatus: decideRes.status,
        decideBody,
        afterDecide: {
          contentStatus: afterDecide?.contentStatus,
          active: afterDecide?.active,
          nameAr: afterDecide?.nameAr,
        },
        portalRow,
      };
      fs.writeFileSync(
        path.join(evidenceDir, 'e3-portal-create-browse.json'),
        JSON.stringify(portalJourney, null, 2),
      );
      record(
        'ACC-E3-PORTAL-CREATE-BROWSE',
        'إنشاء/تعديل/مراجعة/اعتماد عبر المسار الحقيقي ثم ظهوره في browse',
        portalJourney,
        portalCreate.status < 400 &&
          portalPatch.status < 400 &&
          mediaRes.status < 400 &&
          submitRes.status < 400 &&
          decideRes.status < 400 &&
          afterDecide?.contentStatus === 'published' &&
          afterDecide?.active === true &&
          !!portalRow &&
          String(portalRow.nameAr || '').includes('E3 Portal Edited') &&
          // Prove name came from portal path, not a forced DB write during the measured journey.
          String(afterDecide?.nameAr || '').includes('E3 Portal Edited'),
      );
    } else {
      fs.writeFileSync(
        path.join(evidenceDir, 'e3-portal-create-browse.json'),
        JSON.stringify(portalJourney, null, 2),
      );
      record(
        'ACC-E3-PORTAL-CREATE-BROWSE',
        'إنشاء/تعديل/مراجعة/اعتماد عبر المسار الحقيقي ثم ظهوره في browse',
        portalJourney,
        false,
      );
    }

    // Defs: same version while unchanged; then real bump → clients must refresh.
    const tax2 = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=elegance`);
    const tax2Body = (await tax2.json()) as { definitionsVersion?: number; nodes?: unknown[] };
    const taxStable =
      typeof tax.definitionsVersion === 'number' &&
      tax.definitionsVersion === tax2Body.definitionsVersion;
    const defsBefore = tax.definitionsVersion;
    const clothesLabelAfter = `ملابس-${suffix}`;
    const taxonomy = app.get(TaxonomyService);
    const defsAfter = taxonomy.bumpDefinitionsForTest({
      nodeId: 'clothes',
      labelAr: clothesLabelAfter,
    });
    const tax3 = await fetch(`${root}/api/v1/marketplace/taxonomy?lane=elegance`);
    const tax3Body = (await tax3.json()) as {
      definitionsVersion?: number;
      nodes?: Array<{ id: string; labelAr?: string }>;
    };
    const afterTaxBrowse = await marketplace.browse({
      partnerId: brand.id,
      category: 'clothes',
      'variant.color': 'black',
      facets: '1',
      limit: '24',
    });
    const stillHasPublished = afterTaxBrowse.items.some((i: { id: string }) => i.id === published.id);
    const afterTaxFace = await marketplace.browse({
      partnerId: brand.id,
      category: 'face',
      'variant.color': 'black',
      facets: '1',
      limit: '24',
    });
    // Data update after portal journey: evening browse must include edited portal product when published.
    const eveningAfterPortal = await marketplace.browse({
      partnerId: brand.id,
      category: 'clothes',
      subcategory: 'clothes.evening',
      limit: '24',
    });
    const portalVisibleAfterEdit =
      !!portalBody.id &&
      eveningAfterPortal.items.some(
        (i: { id: string; nameAr?: string }) =>
          i.id === portalBody.id && String(i.nameAr || '').includes('E3 Portal Edited'),
      );
    // Draft matching same category filter must stay excluded (publish-state gate).
    const matchingDraft = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: `E3 Matching Draft ${suffix}`,
        nameEn: 'E3 Matching Draft',
        priceHalalas: 10000,
        category: 'clothes',
        subcategory: 'clothes.evening',
        profileId: 'product.clothes',
        externalUrl: `https://example.test/e3-match-draft-${suffix}`,
        contentStatus: 'draft',
        reviewStatus: 'draft',
        active: false,
        variantsJson: [
          {
            id: `e3-${suffix}-md`,
            selections: { color: 'black', size: 's' },
            priceHalalas: 10000,
            available: true,
          },
        ],
      },
    });
    createdIds.push(matchingDraft.id);
    const draftStillOut = await marketplace.browse({
      partnerId: brand.id,
      category: 'clothes',
      subcategory: 'clothes.evening',
      'variant.color': 'black',
      limit: '24',
    });
    const clothesNodeAfter = (tax3Body.nodes || []).find((n) => n.id === 'clothes');
    record(
      'ACC-E3-DEFS-CACHE',
      'تعريفات مستقرة ثم bump فعلي؛ browse يتحدث؛ فلاتر متوافقة/غير متوافقة؛ مسودة مطابقة تُستبعد',
      {
        defsBefore,
        defsAfter,
        tax3: tax3Body.definitionsVersion,
        taxStable,
        clothesLabelAfter: clothesNodeAfter?.labelAr,
        stillHasPublished,
        faceHitClothes: afterTaxFace.items.some((i: { id: string }) => i.id === published.id),
        portalVisibleAfterEdit,
        matchingDraftExcluded: !draftStillOut.items.some((i: { id: string }) => i.id === matchingDraft.id),
      },
      taxStable &&
        Number(defsAfter) === Number(tax3Body.definitionsVersion) &&
        Number(defsAfter) > Number(defsBefore) &&
        clothesNodeAfter?.labelAr === clothesLabelAfter &&
        stillHasPublished &&
        !afterTaxFace.items.some((i: { id: string }) => i.id === published.id) &&
        portalVisibleAfterEdit &&
        !draftStillOut.items.some((i: { id: string }) => i.id === matchingDraft.id),
    );

    // App screen journey: open at current defs, UI filters, mid-session bump, resume refresh.
    let appScreen: Record<string, unknown> = { ok: false };
    const clothesLabelRefresh = `ملابس-refresh-${suffix}`;
    const nameArOpen = `E3 Portal Edited ${suffix}`;
    const nameArAfter = `E3 Portal Live ${suffix}`;
    if (portalBody.id && portalVisibleAfterEdit) {
      const seedPath = path.join(evidenceDir, 'e3-app-screen-seed.json');
      const resultPath = path.join(evidenceDir, 'e3-app-screen-result.json');
      const refreshMarkerPath = path.join(evidenceDir, 'e3-refresh-marker.json');
      const refreshDonePath = path.join(evidenceDir, 'e3-refresh-done.json');
      for (const p of [resultPath, refreshMarkerPath, refreshDonePath]) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      const defsAtOpen = Number(defsAfter);
      const defsAfterRefreshExpected = defsAtOpen + 1;
      fs.writeFileSync(
        seedPath,
        JSON.stringify(
          {
            apiRoot: root,
            partnerId: brand.id,
            productId: portalBody.id,
            nameAr: nameArOpen,
            nameArAfter,
            definitionsVersionAtOpen: defsAtOpen,
            definitionsVersionAfterRefresh: defsAfterRefreshExpected,
            clothesLabelAtOpen: clothesLabelAfter,
            clothesLabelAfterRefresh: clothesLabelRefresh,
            deactivateSubId: 'clothes.evening',
            refreshMarkerPath,
            refreshDonePath,
            resultPath,
          },
          null,
          2,
        ),
      );

      // Isolate Discover feed: only this portal product stays active/visual for clothes.evening,
      // and deactivate published media whose bytes are missing from the local media store.
      await prisma.product.updateMany({
        where: {
          subcategory: 'clothes.evening',
          contentStatus: 'published',
          active: true,
          id: { not: portalBody.id },
        },
        data: { active: false },
      });
      const publishedMedia = await prisma.catalogMedia.findMany({
        where: { active: true, publication: 'published', kind: { in: ['image', 'video'] } },
        select: { id: true, storageKey: true },
      });
      const orphanMediaIds = publishedMedia
        .filter((m) => !!m.storageKey && !fs.existsSync(path.join(mediaDir, m.storageKey)))
        .map((m) => m.id);
      if (orphanMediaIds.length) {
        await prisma.catalogMedia.updateMany({
          where: { id: { in: orphanMediaIds } },
          data: { active: false },
        });
      }

      try {
        const apiBase = root.endsWith('/api/v1') ? root : `${root}/api/v1`;
        const flutterBin =
          process.env.FLUTTER_BIN ||
          '/Users/fayez/flutter/bin/flutter';
        const flutterCwd = path.resolve(__dirname, '../../../../');

        // Preflight: ensure objective_c native-assets hook.dill exists (Flutter 3.38 race).
        try {
          const hookDir = path.resolve(
            flutterCwd,
            '.dart_tool/hooks_runner/objective_c',
          );
          const hookHashDirs = fs.existsSync(hookDir)
            ? fs.readdirSync(hookDir).filter((n) => fs.statSync(path.join(hookDir, n)).isDirectory())
            : [];
          const needCompile = hookHashDirs.every(
            (d) => !fs.existsSync(path.join(hookDir, d, 'hook.dill')),
          );
          if (needCompile) {
            const dartBin = path.join(path.dirname(flutterBin), 'cache/dart-sdk/bin/dart');
            const objRoot = path.join(
              process.env.HOME || '',
              '.pub-cache/hosted/pub.dev',
            );
            let buildDart = '';
            if (fs.existsSync(objRoot)) {
              const cand = fs
                .readdirSync(objRoot)
                .filter((n) => n.startsWith('objective_c-'))
                .sort()
                .reverse();
              for (const c of cand) {
                const b = path.join(objRoot, c, 'hook/build.dart');
                if (fs.existsSync(b)) {
                  buildDart = b;
                  break;
                }
              }
            }
            if (fs.existsSync(dartBin) && buildDart) {
              const outDir = path.join(
                hookDir,
                hookHashDirs[0] || 'preflight',
              );
              fs.mkdirSync(outDir, { recursive: true });
              const { spawnSync } = require('child_process') as typeof import('child_process');
              spawnSync(
                dartBin,
                [
                  'compile',
                  'kernel',
                  `--packages=${path.join(flutterCwd, '.dart_tool/package_config.json')}`,
                  `--output=${path.join(outDir, 'hook.dill')}`,
                  `--depfile=${path.join(outDir, 'hook.dill.d')}`,
                  buildDart,
                ],
                { cwd: flutterCwd, encoding: 'utf8' },
              );
            }
          }
        } catch {
          /* best-effort preflight */
        }
        const child = spawn(
          flutterBin,
          [
            'test',
            '--reporter',
            'expanded',
            `--dart-define=MIRA_API_BASE_URL=${apiBase}`,
            '--dart-define=USE_MIRA_API=true',
            '--dart-define=MIRA_DISCOVER_VISUAL_PREVIEW=false',
            'test/features/marketplace/elegance_e3_app_screen_journey_test.dart',
          ],
          {
            cwd: flutterCwd,
            env: {
              ...process.env,
              PATH: `/Users/fayez/flutter/bin:${process.env.PATH || ''}`,
              E3_APP_SCREEN_SEED: seedPath,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        let stdout = '';
        let stderr = '';
        child.on('error', (err) => {
          stderr += `\nSPAWN_ERROR:${String(err)}\n`;
        });
        child.stdout.on('data', (b) => {
          stdout += String(b);
        });
        child.stderr.on('data', (b) => {
          stderr += String(b);
        });
        const flutterDone = new Promise<{ code: number | null }>((resolve) => {
          const timer = setTimeout(() => {
            child.kill('SIGTERM');
            resolve({ code: -1 });
            stderr += '\nTIMEOUT';
          }, 240_000);
          child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code });
          });
        });
        // While Flutter keeps the screen open, mutate taxonomy + catalog on the live Nest process.
        const bumpDeadline = Date.now() + 180_000;
        let flutterClosedEarly = false;
        child.once('close', () => {
          flutterClosedEarly = true;
        });
        while (
          !fs.existsSync(refreshMarkerPath) &&
          Date.now() < bumpDeadline &&
          !flutterClosedEarly
        ) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (fs.existsSync(refreshMarkerPath)) {
          const refreshedVersion = taxonomy.bumpDefinitionsForTest({
            nodeId: 'clothes',
            labelAr: clothesLabelRefresh,
            deactivateNodeId: 'clothes.evening',
          });
          await prisma.product.update({
            where: { id: portalBody.id },
            data: { nameAr: nameArAfter },
          });
          fs.writeFileSync(
            refreshDonePath,
            JSON.stringify(
              {
                definitionsVersion: refreshedVersion,
                clothesLabelAfterRefresh: clothesLabelRefresh,
                nameArAfter,
                deactivated: 'clothes.evening',
              },
              null,
              2,
            ),
          );
        }
        const flutterOut = await flutterDone;
        if (flutterOut.code === 0 && fs.existsSync(resultPath)) {
          appScreen = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
        } else {
          appScreen = {
            ok: false,
            reason: 'flutter-test-failed',
            code: flutterOut.code,
            stdout: stdout.slice(-2000),
            stderr: stderr.slice(-2000),
            markerSeen: fs.existsSync(refreshMarkerPath),
            bumpDone: fs.existsSync(refreshDonePath),
          };
        }
      } catch (e) {
        appScreen = {
          ok: false,
          reason: 'flutter-test-failed',
          detail: String((e as { message?: string })?.message || e).slice(0, 800),
        };
      }
    }
    fs.writeFileSync(path.join(evidenceDir, 'e3-app-screen.json'), JSON.stringify(appScreen, null, 2));
    const openScreenEval = evaluateOpenScreenRefreshResult({
      ...appScreen,
      nameArAfter: appScreen.nameArAfter || nameArAfter,
      unexpectedError: appScreen.unexpectedError || null,
      oldNameAcceptedAlone: appScreen.oldNameAcceptedAlone === true,
      cancelledFilterStillSelected: appScreen.cancelledFilterStillSelected === true,
    });
    fs.writeFileSync(
      path.join(evidenceDir, 'e3-open-screen-evaluator.json'),
      JSON.stringify({ openScreenEval, appScreen }, null, 2),
    );
    record(
      'ACC-E3-APP-SCREEN',
      'فتح الشاشة بإصدار أول وظهور عنصر البوابة عبر HTTP الحقيقي',
      appScreen,
      appScreen.ok === true &&
        appScreen.screenSawProduct === true &&
        appScreen.initialDefinitionsLoaded === true &&
        appScreen.productId === portalBody.id &&
        appScreen.catalogSource === 'live-http-marketplace-repository' &&
        appScreen.replaceForTestUsed === false &&
        appScreen.cacheCleared === false &&
        appScreen.appRelaunched === false &&
        appScreen.debugRefreshUsed === false &&
        appScreen.searchFallbackUsed === false,
    );
    record(
      'ACC-E3-OPEN-SCREEN-REFRESH',
      'تحديث التعريفات والنتائج والشاشة ما زالت مفتوحة عبر دورة الحياة الفعلية',
      { appScreen, openScreenEval },
      openScreenEval.ok === true &&
        appScreen.taxonomySource === 'live-http-ensureLoaded+lifecycle-resume-reload' &&
        appScreen.cacheCleared === false &&
        appScreen.replaceForTestUsed === false &&
        appScreen.appRelaunched === false &&
        appScreen.debugRefreshUsed === false &&
        appScreen.searchFallbackUsed === false,
    );
    record(
      'ACC-E3-FILTER-UI-TRANSITION',
      'بقاء فلتر الملابس المتوافق ومسح النوع الفرعي غير المتوافق في الطلب والواجهة',
      { appScreen, openScreenEval },
      openScreenEval.ok === true && appScreen.filterUiTransitionVerified === true,
    );

    // Pagination: next page via nextCursor must not repeat page-1 ids.
    const pageSeedIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const p = await prisma.product.create({
        data: {
          partnerId: brand.id,
          nameAr: `E3 Page ${suffix}-${i}`,
          nameEn: `E3 Page ${i}`,
          priceHalalas: 11000 + i,
          category: 'clothes',
          subcategory: 'clothes.evening',
          profileId: 'product.clothes',
          externalUrl: `https://example.test/e3-page-${suffix}-${i}`,
          contentStatus: 'published',
          reviewStatus: 'approved',
          active: true,
        },
      });
      createdIds.push(p.id);
      pageSeedIds.push(p.id);
    }
    const page1 = await marketplace.browse({
      partnerId: brand.id,
      category: 'clothes',
      subcategory: 'clothes.evening',
      limit: '2',
    });
    const page2 = page1.nextCursor
      ? await marketplace.browse({
          partnerId: brand.id,
          category: 'clothes',
          subcategory: 'clothes.evening',
          limit: '2',
          cursor: page1.nextCursor,
        })
      : { items: [], nextCursor: null };
    const page1Ids = page1.items.map((i: { id: string }) => i.id);
    const page2Ids = page2.items.map((i: { id: string }) => i.id);
    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
    fs.writeFileSync(
      path.join(evidenceDir, 'e3-pagination.json'),
      JSON.stringify({ page1Ids, page2Ids, nextCursor: page1.nextCursor, pageSeedIds, overlap }, null, 2),
    );
    record(
      'ACC-E3-PAGINATION',
      'الصفحة التالية عبر nextCursor بلا تكرار معرفات الصفحة الأولى',
      { page1Ids, page2Ids, nextCursor: page1.nextCursor, overlap },
      !!page1.nextCursor &&
        page1Ids.length === 2 &&
        page2Ids.length >= 1 &&
        overlap.length === 0,
    );

    fs.writeFileSync(
      path.join(evidenceDir, 'e3-filter-matrix.json'),
      JSON.stringify(
        { andHit, andMiss, clothesFacets, faceFacets, subHit, subMiss, wdBrowse, afterTaxBrowse },
        null,
        2,
      ),
    );

    const mapped = Object.fromEntries(cases.map((c) => [c.id, c.status]));
    const missing = MANDATORY.filter((m) => !mapped[m]);
    const bad = MANDATORY.filter((m) => mapped[m] !== 'PASS');
    const ok = missing.length === 0 && bad.length === 0;
    assertAcceptanceContentUnchanged(runIdentity, repoRoot);
    const ended = new Date().toISOString();
    const testedTree = runIdentity.commit;
    const results = {
      verdict: ok
        ? 'E3_ELEGANCE_TAXONOMY_FILTERS_CLOSED_VERIFIED — LOCAL/TEST ONLY'
        : 'E3_OPEN',
      gate: { ok, missing, bad },
      started,
      ended,
      testedTree,
      runId: runIdentity.runId,
      codeContentSha256: runIdentity.contentSha256,
      cases,
    };
    fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ verdict: results.verdict, gate: results.gate, started, ended }, null, 2));
    process.exit(ok ? 0 : 1);
  } finally {
    if (createdIds.length) {
      await prisma.productVariantInventory.deleteMany({ where: { productId: { in: createdIds } } }).catch(() => undefined);
      await prisma.product.deleteMany({ where: { id: { in: createdIds } } }).catch(() => undefined);
    }
    await prisma.partnerUser.deleteMany({ where: { partnerId: brand.id } }).catch(() => undefined);
    await prisma.partner.delete({ where: { id: brand.id } }).catch(() => undefined);
    if (app) await app.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
