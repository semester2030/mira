/**
 * E2 ب browser acceptance — shell + taxonomy sync + perms + gate.
 * Run after / with E2A on the same tested tree.
 */
import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { chromium, type Browser } from 'playwright';
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
import { UploadSessionsController } from '../../partners-portal/upload-sessions/upload-sessions.controller';
import { UploadSessionsService } from '../../partners-portal/upload-sessions/upload-sessions.service';
import { UploadFinalizeService } from '../../partners-portal/upload-sessions/upload-finalize.service';
import { UploadCleanupService } from '../../partners-portal/upload-sessions/upload-cleanup.service';
import {
  MemoryMultipartUploadStore,
  MultipartUploadStore,
} from '../../partners-portal/upload-sessions/multipart.store';
import { json as expressJson, raw as expressRaw, type Request, type Response, type NextFunction } from 'express';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    if (token !== 'unused') throw new UnauthorizedException('Invalid token');
    return { uid: 'unused', email: 'unused@test.local' };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [
    PartnersPortalController,
    CatalogMediaController,
    CatalogReviewAdminController,
    MarketplaceController,
    UploadSessionsController,
  ],
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
    UploadSessionsService,
    UploadFinalizeService,
    UploadCleanupService,
    { provide: MultipartUploadStore, useClass: MemoryMultipartUploadStore },
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class E2BAcceptanceModule {}

/** Individual closure gate — groups/bulk are DEFERRED_BY_OWNER and not required here. */
const MANDATORY = [
  'ACC-E2B-EDITOR-ENTRY',
  'ACC-E2B-LIST-SEPARATION',
  'ACC-E2B-CATEGORY-CIRCLES',
  'ACC-E2B-TAXONOMY-SOURCE',
  'ACC-E2B-CATEGORY-RACE',
  'ACC-E2B-ASSETS-NOT-FULL-REF',
  'ACC-E2B-LAYOUTS-DESKTOP',
  'ACC-E2B-LAYOUTS-PHONE',
  'ACC-E2B-LAYOUTS-TABLET',
  'ACC-E2B-VISUAL-COMPARE',
  'ACC-E2B-PERMS-BRAND',
  'ACC-E2B-STATUS-AR',
  'ACC-E2B-ACTIONS',
  'ACC-E2B-ACTIONS-NEG-DUP',
  'ACC-E2B-INDIVIDUAL-OFFER',
  'ACC-E2B-FIELDS-ROUNDTRIP',
  'ACC-E2B-JOURNEY-LINK-E2A',
  'ACC-E2B-GATE-REJECTS-BAD',
] as const;

type CriterionId = (typeof MANDATORY)[number];

type CaseResult = {
  id: string;
  criterion: CriterionId | null;
  scenario: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN' | 'SKIPPED';
  evidence: string[];
  evidenceMissing: string[];
};

const evidenceDir = path.resolve(__dirname, '../../../../../.e2b-acceptance-evidence');
const results: CaseResult[] = [];

function record(
  id: string,
  scenario: string,
  expected: string,
  actual: string,
  ok: boolean | CaseResult['status'],
  opts?: { criterion?: CriterionId; evidence?: string[] },
) {
  const evidence = opts?.evidence || [];
  const evidenceMissing = evidence.filter((f) => !fs.existsSync(path.join(evidenceDir, f)));
  let status: CaseResult['status'] = ok === true ? 'PASS' : ok === false ? 'FAIL' : ok;
  if (status === 'PASS' && opts?.criterion && (!evidence.length || evidenceMissing.length)) status = 'FAIL';
  results.push({
    id,
    criterion: opts?.criterion ?? null,
    scenario,
    expected,
    actual,
    status,
    evidence,
    evidenceMissing,
  });
  console.log(`${status} ${id} — ${scenario}`);
}

function evaluateGate(args: { cases: CaseResult[]; mandatory: readonly string[] }) {
  const byCriterion = new Map<string, CaseResult>();
  for (const c of args.cases) {
    if (c.criterion) byCriterion.set(c.criterion, c);
  }
  const missing: string[] = [];
  const bad: string[] = [];
  const evidenceGaps: string[] = [];
  for (const id of args.mandatory) {
    const hit = byCriterion.get(id);
    if (!hit) {
      missing.push(id);
      continue;
    }
    if (hit.status !== 'PASS') bad.push(`${id}=${hit.status}`);
    if (!hit.evidence.length || hit.evidenceMissing.length) {
      evidenceGaps.push(`${id}:${(hit.evidenceMissing.length ? hit.evidenceMissing : ['<empty>']).join(',')}`);
    }
  }
  return {
    ok: missing.length === 0 && bad.length === 0 && evidenceGaps.length === 0 && args.cases.length > 0,
    missing,
    bad,
    evidenceGaps,
  };
}

function servePortal(dir: string) {
  const server = http.createServer((req, res) => {
    const rel = (req.url || '/').split('?')[0];
    const filePath = path.join(dir, rel === '/' ? 'dashboard.html' : rel.replace(/^\//, ''));
    if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    const ext = path.extname(filePath);
    const type =
      ext === '.js'
        ? 'application/javascript'
        : ext === '.css'
          ? 'text/css'
          : ext === '.png'
            ? 'image/png'
            : 'text/html';
    res.writeHead(200, { 'content-type': type });
    res.end(fs.readFileSync(filePath));
  });
  return new Promise<{ server: http.Server; origin: string }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

async function main() {
  const started = new Date().toISOString();
  const testedSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const contentScopeFiles = [
    'partners-portal/web/js/bulk-group-journey.js',
    'partners-portal/web/js/bulk-group-journey.harness.js',
    'partners-portal/web/js/catalog-journey.js',
    'partners-portal/web/js/catalog-options-core.js',
    'partners-portal/web/js/e2b-product-shell.js',
    'partners-portal/web/js/product-commerce-fields.js',
    'partners-portal/web/js/registry-attribute-fields.js',
    'partners-portal/web/js/field-registry.v2.json',
    'mira-api/src/partners-portal/registry/field-registry.v2.json',
    'partners-portal/web/css/e2b-product-editor.css',
    'partners-portal/web/dashboard.html',
    'partners-portal/web/assets/e2b-ref',
    // Matrix is a delivery artifact that embeds the run fingerprint — excluded from self-hash (I-04).
    'mira-api/src/marketplace/taxonomy/elegance-e2a-acceptance.browser.integration-tests.ts',
    'mira-api/src/marketplace/taxonomy/elegance-e2b-acceptance.browser.integration-tests.ts',
  ];
  const codeContentSha256 = execSync(
    `find ${contentScopeFiles.join(' ')} -type f 2>/dev/null | sort | xargs shasum -a 256 | shasum -a 256 | awk '{print $1}'`,
    { cwd: path.resolve(__dirname, '../../../../'), encoding: 'utf8' },
  ).trim();
  const codeContentFiles = execSync(
    `find ${contentScopeFiles.join(' ')} -type f 2>/dev/null | sort`,
    { cwd: path.resolve(__dirname, '../../../../'), encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean);
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  fs.mkdirSync(evidenceDir, { recursive: true });

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E2B Br ${suffix}`, nameEn: 'E2B Br', city: 'الرياض' },
  });
  const tokenBrand = `tok-e2b-br-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `e2b-br-${suffix}@test.local`, accessToken: tokenBrand },
  });

  const app = await NestFactory.create(E2BAcceptanceModule, { bodyParser: false, logger: ['error'] });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const p = (req.originalUrl || req.url || '').split('?')[0];
    if (req.method === 'PUT' && /\/upload-sessions\/[^/]+\/direct-parts\/\d+$/.test(p)) {
      return expressRaw({ type: '*/*', limit: '64mb' })(req, res, next);
    }
    return expressJson({ limit: '4mb' })(req, res, next);
  });
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const apiRoot = `http://127.0.0.1:${port}`;
  const portalDir = path.resolve(__dirname, '../../../../partners-portal/web');
  const { server: portalServer, origin: portalOrigin } = await servePortal(portalDir);

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: 'ar-SA', viewport: { width: 1280, height: 900 } });
    // No harness flag — production surface.
    const page = await context.newPage();
    const apiBase = `${apiRoot}/api/v1`;
    await page.goto(`${portalOrigin}/login.html?api-base=${encodeURIComponent(apiBase)}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ email, token }) => {
        localStorage.setItem('mira_partner_email', email);
        localStorage.setItem('mira_partner_token', token);
      },
      { email: `e2b-br-${suffix}@test.local`, token: tokenBrand },
    );
    await page.goto(`${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#goProduct', { timeout: 20000 });

    await page.click('#goProduct');
    await page.waitForTimeout(900);
    const entry = await page.evaluate(() => {
      const mains = document.getElementById('e2bMainCircles');
      const mainCs = mains ? getComputedStyle(mains) : null;
      return {
        mode: document.body.classList.contains('e2b-product-mode'),
        focus: document.body.classList.contains('e2b-editor-focus'),
        rail: !!document.getElementById('e2bSideNav'),
        mainCircles: !!mains,
        mainHorizontal: !!(mainCs && mainCs.flexDirection === 'row'),
        form: !!document.getElementById('catalogForm'),
        listHidden: (() => {
          const lp = document.getElementById('e2bListPanel');
          if (!lp) return false;
          return getComputedStyle(lp).display === 'none';
        })(),
        listOpacityHack: (() => {
          const lp = document.getElementById('e2bListPanel');
          if (!lp) return false;
          const op = Number(getComputedStyle(lp).opacity);
          return op > 0 && op < 1;
        })(),
        logoSrc: (document.querySelector('.e2b-brand-mark') as HTMLImageElement | null)?.getAttribute('src') || '',
        navLinks: Array.from(document.querySelectorAll('#e2bSideNav .e2b-nav-link')).map((a) =>
          (a.textContent || '').trim(),
        ),
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-editor-entry.png'), fullPage: true });
    record(
      'ACC-E2B-EDITOR-ENTRY',
      'goProduct opens e2b editor: right nav + horizontal main circles + logo',
      'mode+focus+nav+horizontal circles+form+logo',
      JSON.stringify(entry),
      !!(
        entry.mode &&
        entry.focus &&
        entry.rail &&
        entry.mainCircles &&
        entry.mainHorizontal &&
        entry.form &&
        /mira-logo/.test(entry.logoSrc) &&
        entry.navLinks.length >= 3
      ),
      { criterion: 'ACC-E2B-EDITOR-ENTRY', evidence: ['e2b-editor-entry.png'] },
    );
    record(
      'ACC-E2B-LIST-SEPARATION',
      'editor focus hides list panel (not opacity fade)',
      'display:none; not translucent list',
      JSON.stringify({ listHidden: entry.listHidden, listOpacityHack: entry.listOpacityHack }),
      entry.listHidden === true && entry.listOpacityHack === false,
      { criterion: 'ACC-E2B-LIST-SEPARATION', evidence: ['e2b-editor-entry.png'] },
    );

    await page.waitForSelector('[data-testid="e2b-main-circle"]', { timeout: 20000 });
    const circles = await page.locator('[data-testid="e2b-main-circle"]').count();
    const orbSrcs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#e2bMainCircles .e2b-circle-orb')).map(
        (n) => getComputedStyle(n).backgroundImage,
      ),
    );
    const usesFullRefAsOrb = orbSrcs.some((s) => /ref-1\.png|ref-2\.png/.test(s) && !/orbs\//.test(s));
    const usesOrbAssets = orbSrcs.every((s) => /orbs\//.test(s));
    await page.locator('[data-testid="e2b-main-circle"][data-category-id="clothes"]').click();
    await page.waitForTimeout(800);
    const sub = await page.locator('[data-testid="e2b-sub-circle"]').count();
    const parentAfterClothes = await page.locator('#e2bSubCircles').getAttribute('data-parent-id');
    await page.locator('[data-testid="e2b-main-circle"][data-category-id="bags"]').click();
    await page.waitForTimeout(400);
    const deferred = await page.locator('[data-testid="e2b-deferred-e4"]').count();
    const bagsParent = await page.locator('#e2bSubCircles').getAttribute('data-parent-id');
    const bagsSubs = await page.locator('[data-testid="e2b-sub-circle"]').count();
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-circles.png'), fullPage: true });
    record(
      'ACC-E2B-CATEGORY-CIRCLES',
      'main circles + clothes subs + bags writable (E4 started)',
      'circles>=5; clothes subs>=1; bags not deferred; bags subs visible',
      JSON.stringify({ circles, sub, deferred, parentAfterClothes, bagsParent, bagsSubs }),
      circles >= 5 &&
        sub >= 1 &&
        deferred === 0 &&
        parentAfterClothes === 'clothes' &&
        bagsParent === 'bags' &&
        bagsSubs >= 1,
      { criterion: 'ACC-E2B-CATEGORY-CIRCLES', evidence: ['e2b-circles.png'] },
    );
    await page.locator('[data-testid="e2b-main-circle"][data-category-id="clothes"]').click();
    await page.waitForTimeout(700);
    const subOrbBindings = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#e2bSubCircles [data-testid="e2b-sub-circle"]')).map((b) => ({
        id: b.getAttribute('data-subcategory-id'),
        orbSrc: b.getAttribute('data-orb-src') || '',
      })),
    );
    const portalWeb = path.resolve(__dirname, '../../../../partners-portal/web');
    const shoeBytes = fs.readFileSync(path.join(portalWeb, 'assets/e2b-ref/orbs/shoes.png'));
    const sub0Bytes = fs.readFileSync(path.join(portalWeb, 'assets/e2b-ref/orbs/sub-0.png'));
    // Reject tiny/fragment crops and require shoes ≠ calendar-like tiny UI scrap.
    const assetsHealthy =
      shoeBytes.length > 8000 &&
      sub0Bytes.length > 8000 &&
      subOrbBindings.length >= 1 &&
      subOrbBindings.every(
        (b) =>
          !!b.id &&
          (/orbs\//.test(b.orbSrc) &&
            (b.orbSrc.includes(String(b.id).replace(/\./g, '_')) || /clothes_/.test(b.orbSrc))),
      );
    const idBound = subOrbBindings.some(
      (b) => b.id === 'clothes.wedding_dress' && /clothes_wedding_dress/.test(b.orbSrc),
    );
    record(
      'ACC-E2B-ASSETS-NOT-FULL-REF',
      'per-id orb assets; no full-ref screenshot; sub orbs bound by id',
      'orbs/*; shoes/sub healthy size; sub data-orb-src by id',
      JSON.stringify({
        usesFullRefAsOrb,
        usesOrbAssets,
        logoSrc: entry.logoSrc,
        shoeBytes: shoeBytes.length,
        sub0Bytes: sub0Bytes.length,
        subOrbBindings,
        assetsHealthy,
        idBound,
      }),
      usesOrbAssets && !usesFullRefAsOrb && /mira-logo/.test(entry.logoSrc) && assetsHealthy && idBound,
      { criterion: 'ACC-E2B-ASSETS-NOT-FULL-REF', evidence: ['e2b-circles.png'] },
    );

    const taxIds = await page.evaluate(async () => {
      const doc = await (window as any).PartnersApi.taxonomy({ lane: 'elegance' });
      const roots = (doc.nodes || [])
        .filter((n: any) => n && n.parentId == null && n.id !== 'elegance.all' && !n.browseOnly)
        .map((n: any) => n.id);
      const ui = Array.from(document.querySelectorAll('#e2bMainCircles [data-category-id]')).map((b) =>
        b.getAttribute('data-category-id'),
      );
      return { roots, ui };
    });
    const taxMatch =
      taxIds.roots.length === taxIds.ui.length && taxIds.roots.every((id: string, i: number) => id === taxIds.ui[i]);
    record(
      'ACC-E2B-TAXONOMY-SOURCE',
      'main circles derived from central taxonomy roots (order+ids)',
      'ui ids === taxonomy roots',
      JSON.stringify(taxIds),
      taxMatch,
      { criterion: 'ACC-E2B-TAXONOMY-SOURCE', evidence: ['e2b-circles.png'] },
    );

    // Race with REAL delayed taxonomy: bust cache so selectMain must fetch (hold), then face wins.
    let releaseTax: (() => void) | null = null;
    const holdTax = new Promise<void>((r) => {
      releaseTax = r;
    });
    let clothesTaxHeld = false;
    let heldCount = 0;
    await page.route('**/taxonomy**', async (route) => {
      if (!clothesTaxHeld) {
        clothesTaxHeld = true;
        heldCount += 1;
        await holdTax;
      }
      const res = await route.fetch();
      await route.fulfill({ status: res.status(), headers: res.headers(), body: await res.body() });
    });
    await page.evaluate(() => {
      const shell = (window as any).MiraE2BProductShell;
      if (shell && typeof shell.clearTaxonomyCache === 'function') shell.clearTaxonomyCache();
    });
    await page.locator('[data-testid="e2b-main-circle"][data-category-id="clothes"]').click();
    for (let i = 0; i < 50 && !clothesTaxHeld; i++) await page.waitForTimeout(100);
    await page.locator('[data-testid="e2b-main-circle"][data-category-id="face"]').click();
    await page.waitForTimeout(400);
    if (releaseTax) releaseTax();
    await page.waitForTimeout(1200);
    await page.unroute('**/taxonomy**').catch(() => undefined);
    const race = await page.evaluate(
      (held) => {
        const parent = document.getElementById('e2bSubCircles')?.getAttribute('data-parent-id');
        const selected = document.querySelector('#e2bMainCircles .e2b-circle.is-selected')?.getAttribute('data-category-id');
        const subIds = Array.from(document.querySelectorAll('#e2bSubCircles [data-subcategory-id]')).map((n) =>
          n.getAttribute('data-subcategory-id'),
        );
        const clothesLeak = subIds.some((id) => String(id || '').startsWith('clothes.'));
        return { parent, selected, subIds, clothesLeak, clothesTaxHeld: held };
      },
      clothesTaxHeld,
    );
    // Sync form → circles
    await page.selectOption('#catalogForm select[name="category"]', 'clothes');
    await page.waitForTimeout(900);
    const synced = await page.evaluate(() => {
      const selected = document.querySelector('#e2bMainCircles .e2b-circle.is-selected')?.getAttribute('data-category-id');
      const parent = document.getElementById('e2bSubCircles')?.getAttribute('data-parent-id');
      return { selected, parent };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-category-race.png'), fullPage: true });

    // Wedding dress → re-click clothes: subcategory must stay selected in circle + select.
    await page.locator('[data-testid="e2b-main-circle"][data-category-id="clothes"]').click();
    await page.waitForSelector('[data-testid="e2b-sub-circle"][data-subcategory-id="clothes.wedding_dress"]', {
      timeout: 15000,
    });
    await page.locator('[data-testid="e2b-sub-circle"][data-subcategory-id="clothes.wedding_dress"]').click();
    await page.waitForTimeout(400);
    await page.locator('[data-testid="e2b-main-circle"][data-category-id="clothes"]').click();
    await page.waitForTimeout(700);
    const subKeep = await page.evaluate(() => {
      const subSel = document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null;
      const circle = document.querySelector(
        '[data-testid="e2b-sub-circle"][data-subcategory-id="clothes.wedding_dress"]',
      );
      return {
        selectValue: subSel?.value || '',
        circleSelected: !!circle && circle.classList.contains('is-selected'),
        parent: document.getElementById('e2bSubCircles')?.getAttribute('data-parent-id') || '',
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-sub-preserve.png'), fullPage: true });
    // Late taxonomy restore: hold BEFORE opening a REAL saved draft (no DOM option injection).
    const draftProduct = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: `E2B-Draft-Wedding-${suffix}`,
        nameEn: `E2B-Draft-Wedding-${suffix}`,
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        priceHalalas: 25000,
        category: 'clothes',
        subcategory: 'clothes.wedding_dress',
        contentStatus: 'draft',
        reviewStatus: 'draft',
        purchaseMode: 'internal_cod',
        stockQty: 3,
        attributesJson: { material: ['silk', 'cotton'], cut: 'fitted', lengthCm: 150 } as any,
        optionsJson: [
          {
            id: 'color',
            labelAr: 'الألوان المتوفرة',
            kind: 'color',
            values: [
              { id: 'ivory', labelAr: 'سكري' },
              { id: 'champagne', labelAr: 'شامبانيا' },
            ],
          },
          {
            id: 'size',
            labelAr: 'المقاس',
            kind: 'size',
            values: [
              { id: 'M', labelAr: 'M' },
              { id: 'L', labelAr: 'L' },
            ],
          },
        ] as any,
      },
    });
    await page.evaluate(() => document.body.classList.remove('e2b-editor-focus'));
    await page.locator('#e2bShowList').click({ timeout: 3000 }).catch(() => undefined);
    await page.evaluate(async () => {
      if ((window as any).reloadPartnerDashboard) await (window as any).reloadPartnerDashboard({ preserveForms: false });
    });
    await page.waitForTimeout(700);
    let releaseLate: (() => void) | null = null;
    const holdLate = new Promise<void>((r) => {
      releaseLate = r;
    });
    let lateHeld = false;
    let lateRequestSeen = false;
    await page.route('**/taxonomy**', async (route) => {
      lateRequestSeen = true;
      if (!lateHeld) {
        lateHeld = true;
        await holdLate;
      }
      const res = await route.fetch();
      await route.fulfill({ status: res.status(), headers: res.headers(), body: await res.body() });
    });
    await page.evaluate(() => {
      const shell = (window as any).MiraE2BProductShell;
      if (shell && typeof shell.clearTaxonomyCache === 'function') shell.clearTaxonomyCache();
    });
    const openDraft = page
      .locator('#catalogList .list-item')
      .filter({ hasText: `E2B-Draft-Wedding-${suffix}` })
      .getByRole('button', { name: 'فتح في النموذج' });
    await openDraft.click({ timeout: 15000 });
    for (let i = 0; i < 80 && !lateHeld; i++) await page.waitForTimeout(100);
    const midLate = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const name = (form?.querySelector('input[name="nameAr"]') as HTMLInputElement | null)?.value || '';
      const cat = (document.querySelector('#catalogForm select[name="category"]') as HTMLSelectElement | null)?.value || '';
      const sub = (document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null)?.value || '';
      return {
        name,
        cat,
        sub,
        formPresent: !!form,
        heldPending: true,
      };
    });
    if (!lateHeld || !lateRequestSeen) {
      await page.unroute('**/taxonomy**').catch(() => undefined);
      throw new Error('CATEGORY-RACE late restore did not intercept a real taxonomy request before/while opening draft');
    }
    if (releaseLate) releaseLate();
    await page.waitForFunction(
      () => {
        const cat = (document.querySelector('#catalogForm select[name="category"]') as HTMLSelectElement | null)?.value;
        const sub = (document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null)?.value;
        return cat === 'clothes' && sub === 'clothes.wedding_dress';
      },
      undefined,
      { timeout: 25000 },
    );
    await page.unroute('**/taxonomy**').catch(() => undefined);
    const lateRestore = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const name = (form?.querySelector('input[name="nameAr"]') as HTMLInputElement | null)?.value || '';
      const price = (form?.querySelector('input[name="priceSar"]') as HTMLInputElement | null)?.value || '';
      const cat = (document.querySelector('#catalogForm select[name="category"]') as HTMLSelectElement | null)?.value || '';
      const sub = (document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null)?.value || '';
      const mainSel = document.querySelector('#e2bMainCircles .e2b-circle.is-selected')?.getAttribute('data-category-id');
      const subSel = document.querySelector(
        '#e2bSubCircles .e2b-circle.is-selected',
      )?.getAttribute('data-subcategory-id');
      const selectedColors = Array.from(document.querySelectorAll('.swatch-choice.is-selected .swatch-name')).map(
        (n) => n.textContent || '',
      );
      const selectedSizes = Array.from(document.querySelectorAll('.size-choice.is-selected')).map((n) =>
        (n.textContent || '').replace(/[✓\s]/g, '').trim(),
      );
      const mats = Array.from(
        document.querySelectorAll('[data-testid="registry-attribute-host"] .mira-attr-chip.is-selected'),
      ).map((n) => (n.textContent || '').replace(/[✓\s]/g, '').trim());
      const qty = (form?.querySelector('[data-testid="catalog-quantity"]') as HTMLInputElement | null)?.value || '';
      return { name, price, cat, sub, mainSel, subSel, selectedColors, selectedSizes, mats, qty };
    });
    // Taxonomy failure then real retry button — event-driven (not fixed delay alone).
    let taxFailSeen = false;
    let taxFailStatus = 0;
    await page.route('**/taxonomy**', async (route) => {
      taxFailSeen = true;
      taxFailStatus = 503;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'tax-down' }) });
    });
    const beforeTaxFail = await page.evaluate(() => {
      const name = (document.querySelector('#catalogForm input[name="nameAr"]') as HTMLInputElement | null)?.value || '';
      const sub = (document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null)?.value || '';
      const colors = Array.from(document.querySelectorAll('.swatch-choice.is-selected .swatch-name')).map(
        (n) => n.textContent || '',
      );
      return { name, sub, colors };
    });
    await page.evaluate(() => {
      const shell = (window as any).MiraE2BProductShell;
      if (shell && typeof shell.clearTaxonomyCache === 'function') shell.clearTaxonomyCache();
      if (shell && typeof shell.reloadTaxonomy === 'function') void shell.reloadTaxonomy({ force: true });
    });
    await page.waitForFunction(
      () => {
        const retry = document.querySelector('[data-testid="e2b-taxonomy-retry"]');
        const err = document.querySelector('[data-testid="e2b-taxonomy-load-error"]');
        return !!(retry || err);
      },
      undefined,
      { timeout: 15000 },
    ).catch(() => undefined);
    const duringFail = await page.evaluate(() => {
      const name = (document.querySelector('#catalogForm input[name="nameAr"]') as HTMLInputElement | null)?.value || '';
      const sub = (document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null)?.value || '';
      const retry = document.querySelector('[data-testid="e2b-taxonomy-retry"]') as HTMLButtonElement | null;
      const errText = document.querySelector('[data-testid="e2b-taxonomy-load-error"]')?.textContent || '';
      return { name, sub, retryVisible: !!(retry && retry.offsetParent !== null), errText };
    });
    if (!taxFailSeen || taxFailStatus !== 503) {
      await page.unroute('**/taxonomy**').catch(() => undefined);
      throw new Error('taxonomy fail route did not see a real 503 request');
    }
    if (!duringFail.retryVisible) {
      await page.unroute('**/taxonomy**').catch(() => undefined);
      throw new Error('taxonomy retry button missing after failure: ' + JSON.stringify(duringFail));
    }
    await page.unroute('**/taxonomy**').catch(() => undefined);
    let taxRetrySeen = false;
    let taxRetryStatus = 0;
    await page.route('**/taxonomy**', async (route) => {
      const res = await route.fetch();
      taxRetrySeen = true;
      taxRetryStatus = res.status();
      await route.fulfill({ status: res.status(), headers: res.headers(), body: await res.body() });
    });
    await page.locator('[data-testid="e2b-taxonomy-retry"]').click({ timeout: 10000 });
    await page.waitForFunction(
      () => {
        const retry = document.querySelector('[data-testid="e2b-taxonomy-retry"]');
        const circles = document.querySelectorAll('#e2bMainCircles .e2b-circle').length;
        return circles > 0 && (!retry || (retry as HTMLElement).offsetParent === null);
      },
      undefined,
      { timeout: 20000 },
    );
    await page.unroute('**/taxonomy**').catch(() => undefined);
    if (!taxRetrySeen || taxRetryStatus < 200 || taxRetryStatus >= 300) {
      throw new Error('taxonomy retry did not produce a successful request: ' + taxRetryStatus);
    }
    const afterTaxRetry = await page.evaluate(() => {
      const name = (document.querySelector('#catalogForm input[name="nameAr"]') as HTMLInputElement | null)?.value || '';
      const sub = (document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null)?.value || '';
      const colors = Array.from(document.querySelectorAll('.swatch-choice.is-selected .swatch-name')).map(
        (n) => n.textContent || '',
      );
      return { name, sub, colors };
    });
    fs.writeFileSync(
      path.join(evidenceDir, 'e2b-taxonomy-fail-retry.json'),
      JSON.stringify(
        {
          beforeTaxFail,
          duringFail,
          afterTaxRetry,
          taxFailSeen,
          taxFailStatus,
          taxRetrySeen,
          taxRetryStatus,
          valuesPreserved:
            beforeTaxFail.name === afterTaxRetry.name &&
            beforeTaxFail.sub === afterTaxRetry.sub,
        },
        null,
        2,
      ),
    );
    void duringFail;
    // Stale taxonomy must not overwrite a newer category choice.
    let releaseStale: (() => void) | null = null;
    const holdStale = new Promise<void>((r) => {
      releaseStale = r;
    });
    let staleGen = 0;
    await page.route('**/taxonomy**', async (route) => {
      const my = ++staleGen;
      if (my === 1) {
        await holdStale;
        const res = await route.fetch();
        await route.fulfill({ status: res.status(), headers: res.headers(), body: await res.body() });
      } else {
        const res = await route.fetch();
        await route.fulfill({ status: res.status(), headers: res.headers(), body: await res.body() });
      }
    });
    await page.evaluate(() => {
      const shell = (window as any).MiraE2BProductShell;
      if (shell && typeof shell.clearTaxonomyCache === 'function') shell.clearTaxonomyCache();
      if (shell && typeof shell.reloadTaxonomy === 'function') void shell.reloadTaxonomy({ force: true });
    });
    await page.waitForTimeout(200);
    await page.selectOption('#catalogForm select[name="category"]', 'face').catch(() => undefined);
    await page.waitForTimeout(300);
    if (releaseStale) releaseStale();
    await page.waitForTimeout(1000);
    await page.unroute('**/taxonomy**').catch(() => undefined);
    const afterStale = await page.evaluate(() => {
      const cat = (document.querySelector('#catalogForm select[name="category"]') as HTMLSelectElement | null)?.value || '';
      const name = (document.querySelector('#catalogForm input[name="nameAr"]') as HTMLInputElement | null)?.value || '';
      return { cat, name };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-tax-late-restore.png'), fullPage: true });
    record(
      'ACC-E2B-CATEGORY-RACE',
      'delayed taxonomy race + wedding_dress preserve + cold open of real draft under held taxonomy + fail/retry + stale guard',
      'held before open; values+circles restore; fail keeps inputs; stale does not clobber newer category',
      JSON.stringify({
        race,
        synced,
        subKeep,
        heldCount,
        lateHeld,
        lateRequestSeen,
        midLate,
        lateRestore,
        duringFail,
        afterStale,
        draftId: draftProduct.id,
      }),
      race.clothesTaxHeld === true &&
        heldCount >= 1 &&
        race.selected === 'face' &&
        race.parent === 'face' &&
        race.clothesLeak === false &&
        synced.selected === 'clothes' &&
        synced.parent === 'clothes' &&
        subKeep.selectValue === 'clothes.wedding_dress' &&
        subKeep.circleSelected === true &&
        subKeep.parent === 'clothes' &&
        lateHeld === true &&
        lateRequestSeen === true &&
        midLate.formPresent === true &&
        String(midLate.name).includes(`E2B-Draft-Wedding-${suffix}`) &&
        lateRestore.cat === 'clothes' &&
        lateRestore.sub === 'clothes.wedding_dress' &&
        lateRestore.mainSel === 'clothes' &&
        lateRestore.subSel === 'clothes.wedding_dress' &&
        String(lateRestore.name).includes(`E2B-Draft-Wedding-${suffix}`) &&
        String(lateRestore.price || '') === '250' &&
        Array.isArray(lateRestore.selectedColors) &&
        lateRestore.selectedColors.includes('سكري') &&
        lateRestore.selectedColors.includes('شامبانيا') &&
        Array.isArray(lateRestore.selectedSizes) &&
        lateRestore.selectedSizes.includes('M') &&
        lateRestore.selectedSizes.includes('L') &&
        Array.isArray(lateRestore.mats) &&
        lateRestore.mats.includes('حرير') &&
        lateRestore.mats.includes('قطن') &&
        String(lateRestore.qty || '') === '3' &&
        duringFail.sub === 'clothes.wedding_dress' &&
        String(duringFail.name).includes(`E2B-Draft-Wedding-${suffix}`) &&
        afterStale.cat === 'face' &&
        String(afterStale.name).includes(`E2B-Draft-Wedding-${suffix}`),
      {
        criterion: 'ACC-E2B-CATEGORY-RACE',
        evidence: [
          'e2b-category-race.png',
          'e2b-sub-preserve.png',
          'e2b-tax-late-restore.png',
          'e2b-taxonomy-fail-retry.json',
        ],
      },
    );
    await prisma.product.delete({ where: { id: draftProduct.id } }).catch(() => undefined);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-desktop.png'), fullPage: true });
    // String evaluate avoids tsx __name helpers leaking into Playwright serialization.
    const desktopLayout = await page.evaluate(`(() => {
      const form = document.getElementById('catalogForm');
      const mains = document.getElementById('e2bMainCircles');
      const nav = document.getElementById('e2bSideNav');
      const workspace = document.getElementById('e2bWorkspace') || document.getElementById('e2bMain');
      const compose = document.querySelector('[data-testid="e2b-editor-compose"]');
      const fields = document.querySelector('[data-testid="e2b-editor-fields"]');
      const media = document.querySelector('[data-testid="e2b-editor-media"]');
      const preview = document.querySelector('[data-testid="catalog-preview-panel"]');
      const formBox = form && form.getBoundingClientRect();
      const mainsBox = mains && mains.getBoundingClientRect();
      const navBox = nav && nav.getBoundingClientRect();
      const fieldsBox = fields && fields.getBoundingClientRect();
      const mediaBox = media && media.getBoundingClientRect();
      const previewBox = preview && preview.getBoundingClientRect();
      const save = document.getElementById('catalogForm-save');
      if (save) save.scrollIntoView({ block: 'nearest' });
      const saveBox = save && save.getBoundingClientRect();
      const docW = document.documentElement.clientWidth;
      const overflowX = document.documentElement.scrollWidth > docW + 2;
      let saveCutByAncestor = true;
      if (save && saveBox) {
        saveCutByAncestor = false;
        let el = save;
        while (el) {
          const cs = getComputedStyle(el);
          if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden') && el !== document.body && el !== document.documentElement) {
            const box = el.getBoundingClientRect();
            if (saveBox.right > box.right + 2 || saveBox.left < box.left - 2) { saveCutByAncestor = true; break; }
          }
          el = el.parentElement;
        }
      }
      const titleEls = Array.from(document.querySelectorAll('.e2b-rail-title, .e2b-cat-heading, #e2bEditorPanel h2, #e2bEditorPanel h3'));
      const textOverflow = titleEls.some((n) => n.scrollWidth > n.clientWidth + 2 && getComputedStyle(n).overflow === 'hidden');
      const fieldsRightOfMedia = !!(fieldsBox && mediaBox && fieldsBox.left + 8 >= mediaBox.left && fieldsBox.width > 40 && mediaBox.width > 40);
      const previewIsNotVideoStage = !!(preview && media && preview !== media && !media.contains(preview) && /المعاينة والنشر/.test(preview.textContent || ''));
      const roles = Array.from((form && form.querySelectorAll('[data-section-role]')) || []).map((n) => n.getAttribute('data-section-role'));
      const iBasics = roles.indexOf('basics');
      const iMain = roles.indexOf('main-media');
      const iDetail = roles.indexOf('detail-media');
      const iPreview = roles.indexOf('preview-publish');
      const sectionOrderOk = iBasics >= 0 && iMain >= 0 && iBasics < iDetail && iMain < iDetail && iBasics < iPreview && iMain < iPreview && (iDetail < 0 || iDetail < iPreview);
      const basicsInCompose = !!document.querySelector('[data-testid="e2b-editor-fields"] [data-section-role="basics"]');
      const detailMediaOutsideCompose = !document.querySelector('[data-testid="e2b-editor-compose"] [data-section-role="detail-media"]');
      return {
        hasNav: !!nav,
        hasHorizontalMains: !!(mains && getComputedStyle(mains).flexDirection === 'row'),
        mainsAboveForm: !!(mainsBox && formBox && mainsBox.bottom <= formBox.top + 80),
        saveVisible: !!(save && saveBox && saveBox.width > 0 && saveBox.height > 0),
        saveInViewport: !!(saveBox && saveBox.top < document.documentElement.clientHeight && saveBox.bottom > 0),
        overflowX: !!overflowX,
        saveCutByAncestor: !!saveCutByAncestor,
        textOverflow: !!textOverflow,
        hasWorkspace: !!workspace,
        navRightish: !!(navBox && formBox && navBox.left >= formBox.left - 20),
        hasCompose: !!compose,
        fieldsRightOfMedia: !!fieldsRightOfMedia,
        previewIsNotVideoStage: !!previewIsNotVideoStage,
        previewBelowCompose: !!(previewBox && fieldsBox && previewBox.top + 4 >= Math.min(fieldsBox.bottom, (mediaBox && mediaBox.bottom) || fieldsBox.bottom) - 40),
        roles,
        sectionOrderOk,
        basicsInCompose,
        detailMediaOutsideCompose,
      };
    })()`);
    record(
      'ACC-E2B-LAYOUTS-DESKTOP',
      'desktop composition: right nav, horizontal categories, fields↔video compose, CTA reachable',
      'nav+mains+compose fields-right-of-video; basics before detail-media; preview≠video',
      JSON.stringify(desktopLayout),
      desktopLayout.hasNav &&
        desktopLayout.hasHorizontalMains &&
        desktopLayout.mainsAboveForm &&
        desktopLayout.saveVisible &&
        desktopLayout.saveInViewport &&
        !desktopLayout.overflowX &&
        !desktopLayout.saveCutByAncestor &&
        !desktopLayout.textOverflow &&
        desktopLayout.navRightish &&
        desktopLayout.hasCompose &&
        desktopLayout.fieldsRightOfMedia &&
        desktopLayout.previewIsNotVideoStage &&
        desktopLayout.sectionOrderOk &&
        desktopLayout.basicsInCompose &&
        desktopLayout.detailMediaOutsideCompose,
      { criterion: 'ACC-E2B-LAYOUTS-DESKTOP', evidence: ['e2b-desktop.png'] },
    );

    // Settings must not open celebrity ads; منتجاتي restores list while editing.
    await page.locator('#e2bSideNav [data-nav="settings"]').click();
    await page.waitForTimeout(400);
    const settingsNav = await page.evaluate(() => {
      const settings = document.getElementById('partnerSettingsSection');
      const ads = document.getElementById('adsSection');
      const settingsBox = settings?.getBoundingClientRect();
      const adsBox = ads?.getBoundingClientRect();
      return {
        settingsVisible: !!settings && !!settingsBox && settingsBox.height > 40,
        settingsInView: !!settingsBox && settingsBox.top < window.innerHeight && settingsBox.bottom > 0,
        adsIsSettings: /الإعدادات/.test(ads?.querySelector('h2')?.textContent || ''),
        focusOff: !document.body.classList.contains('e2b-editor-focus'),
      };
    });
    await page.click('#goProduct');
    await page.waitForTimeout(500);
    await page.locator('#e2bSideNav [data-nav="products"]').click();
    await page.waitForTimeout(400);
    const productsNav = await page.evaluate(() => {
      const list = document.getElementById('e2bListPanel');
      const cs = list ? getComputedStyle(list) : null;
      return {
        listShown: !!list && cs?.display !== 'none',
        focusOff: !document.body.classList.contains('e2b-editor-focus'),
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-nav-settings.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-phone.png'), fullPage: true });
    const phone = await page.evaluate(() => {
      const circles = document.getElementById('e2bMainCircles');
      const overflowPage = document.documentElement.scrollWidth > document.documentElement.clientWidth + 8;
      const circleScrollOk = !!circles && circles.scrollWidth >= circles.clientWidth - 1;
      const editorVisible = !!(document.getElementById('catalogForm') || document.getElementById('e2bEditorPanel'));
      const save = document.getElementById('catalogForm-save') as HTMLButtonElement | null;
      if (save) save.scrollIntoView({ block: 'nearest' });
      const saveBox = save?.getBoundingClientRect();
      const saveReachable = !!saveBox && saveBox.width > 0 && saveBox.height > 0 && saveBox.top < window.innerHeight + 2;
      const basics = document.querySelector('[data-section-role="basics"]') as HTMLElement | null;
      const clippedBasics = !!basics && basics.scrollWidth > basics.clientWidth + 4 && getComputedStyle(basics).overflow === 'hidden';
      return { overflowPage, circleScrollOk, editorVisible, saveReachable, clippedBasics };
    });
    record(
      'ACC-E2B-LAYOUTS-PHONE',
      'phone 390: editor reachable; intentional circle scroll; no page X overflow; CTA reachable',
      'editor+CTA; page overflow false; circle row may scroll',
      JSON.stringify(phone),
      phone.editorVisible === true &&
        phone.overflowPage === false &&
        phone.saveReachable === true &&
        phone.clippedBasics === false,
      { criterion: 'ACC-E2B-LAYOUTS-PHONE', evidence: ['e2b-phone.png'] },
    );

    await page.setViewportSize({ width: 430, height: 932 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-phone-lg.png'), fullPage: true });
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-tablet.png'), fullPage: true });
    const tablet = await page.evaluate(`(() => {
      const rail = document.getElementById('e2bMainCircles');
      const save = document.getElementById('catalogForm-save');
      if (save) save.scrollIntoView({ block: 'nearest' });
      const saveBox = save && save.getBoundingClientRect();
      const basics = document.querySelector('[data-section-role="basics"]');
      const media = document.querySelector('[data-testid="e2b-editor-media"]');
      const basicsBox = basics && basics.getBoundingClientRect();
      const mediaBox = media && media.getBoundingClientRect();
      const overlap = !!(basicsBox && mediaBox && basicsBox.width > 40 && mediaBox.width > 40 &&
        !(basicsBox.right <= mediaBox.left + 2 || mediaBox.right <= basicsBox.left + 2 || basicsBox.bottom <= mediaBox.top + 2 || mediaBox.bottom <= basicsBox.top + 2));
      const overflowPage = document.documentElement.scrollWidth > document.documentElement.clientWidth + 8;
      const clippedBasics = !!(basics && basics.scrollWidth > basics.clientWidth + 4 && getComputedStyle(basics).overflow === 'hidden');
      return {
        rail: !!rail,
        mode: document.body.classList.contains('e2b-product-mode'),
        saveReachable: !!(saveBox && saveBox.width > 0 && saveBox.height > 0 && saveBox.top < window.innerHeight + 4),
        overflowPage,
        clippedBasics,
        fieldsMediaConflict: !!(overlap && basicsBox && mediaBox && basicsBox.left === mediaBox.left && Math.abs(basicsBox.top - mediaBox.top) < 8),
      };
    })()`);
    record(
      'ACC-E2B-LAYOUTS-TABLET',
      'tablet 834: rail/mode; no page X overflow; CTA reachable; no field clip',
      'rail+mode; overflow false; save reachable; basics not clipped',
      JSON.stringify(tablet),
      !!(
        tablet.rail &&
        tablet.mode &&
        tablet.overflowPage === false &&
        tablet.saveReachable === true &&
        tablet.clippedBasics === false &&
        tablet.fieldsMediaConflict === false
      ),
      { criterion: 'ACC-E2B-LAYOUTS-TABLET', evidence: ['e2b-tablet.png', 'e2b-phone-lg.png'] },
    );

    await page.setViewportSize({ width: 1280, height: 900 });
    const visual = await page.evaluate(() => {
      const cs = getComputedStyle(document.body);
      const bg = cs.backgroundImage + ' ' + cs.backgroundColor;
      const rail = document.getElementById('e2bSideNav');
      const compose = document.querySelector('[data-testid="e2b-editor-compose"]');
      const fields = document.querySelector('[data-testid="e2b-editor-fields"]');
      const media = document.querySelector('[data-testid="e2b-editor-media"]');
      const fieldsBox = fields?.getBoundingClientRect();
      const mediaBox = media?.getBoundingClientRect();
      return {
        hasGradient: /gradient/i.test(bg),
        rose: getComputedStyle(document.documentElement).getPropertyValue('--e2b-rose').trim(),
        lilac: getComputedStyle(document.documentElement).getPropertyValue('--e2b-lilac').trim(),
        pearl: getComputedStyle(document.documentElement).getPropertyValue('--e2b-pearl').trim(),
        brandMark: !!document.querySelector('.e2b-brand-mark'),
        circles: document.querySelectorAll('[data-testid="e2b-main-circle"]').length,
        hasRail: !!rail,
        hasCompose: !!compose,
        compositionFieldsRightOfMedia:
          !!fieldsBox && !!mediaBox && fieldsBox.left + 8 >= mediaBox.left && mediaBox.width > 40,
        selectedCircle: !!document.querySelector('#e2bMainCircles .e2b-circle.is-selected'),
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-compare-desktop.png'), fullPage: true });
    record(
      'ACC-E2B-VISUAL-COMPARE',
      'approved composition vs tokens: rail+circles+fields/video split + pearl/lilac/rose',
      'gradient+tokens+mark+circles>=5+compose RTL',
      JSON.stringify(visual),
      !!(
        visual.hasGradient &&
        visual.rose &&
        visual.lilac &&
        visual.pearl &&
        visual.brandMark &&
        visual.circles >= 5 &&
        visual.hasRail &&
        visual.hasCompose &&
        visual.compositionFieldsRightOfMedia
      ),
      { criterion: 'ACC-E2B-VISUAL-COMPARE', evidence: ['e2b-compare-desktop.png', 'e2b-circles.png', 'e2b-desktop.png'] },
    );

    const brandTools = await page.evaluate(() => {
      const text = (document.getElementById('e2bEditorPanel') || document.body).innerText || '';
      return {
        rawJsonDump: /"optionsJson"|__testHooks|sessionStorage\.editContexts/.test(text),
        advancedJsonToggle: !!document.querySelector('[data-testid="developer-advanced-json"]'),
        advancedJsonLabel: /تعديل متقدم بصيغة JSON/.test(text),
      };
    });
    record(
      'ACC-E2B-PERMS-BRAND',
      'brand account has no developer advanced JSON tools',
      'no advanced JSON toggle/label for brand',
      JSON.stringify(brandTools),
      brandTools.rawJsonDump === false && brandTools.advancedJsonToggle === false && brandTools.advancedJsonLabel === false,
      { criterion: 'ACC-E2B-PERMS-BRAND', evidence: ['e2b-editor-entry.png'] },
    );

    // UX03/04: Arabic status + one primary final CTA (no duplicate إرسال/نشر) + separate preview.
    await page.click('#goProduct');
    await page.waitForTimeout(600);
    // Fill a known individual state for visual evidence (not empty form).
    await page.fill('#catalogForm input[name="nameAr"]', `فردي-ممتلئ-${suffix}`).catch(() => undefined);
    await page.fill('#catalogForm input[name="priceSar"]', '1200').catch(() => undefined);
    await page.selectOption('#catalogForm select[name="category"]', 'clothes').catch(() => undefined);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const ivory = Array.from(document.querySelectorAll('.swatch-choice')).find((n) =>
        /سكري/.test(n.textContent || ''),
      ) as HTMLElement | null;
      const champagne = Array.from(document.querySelectorAll('.swatch-choice')).find((n) =>
        /شامبانيا/.test(n.textContent || ''),
      ) as HTMLElement | null;
      ivory?.click();
      champagne?.click();
      const m = Array.from(document.querySelectorAll('.size-choice')).find((n) =>
        (n.textContent || '').replace(/[✓\s]/g, '').trim() === 'M',
      );
      const l = Array.from(document.querySelectorAll('.size-choice')).find((n) =>
        (n.textContent || '').replace(/[✓\s]/g, '').trim() === 'L',
      );
      (m as HTMLElement | null)?.click();
      (l as HTMLElement | null)?.click();
      const silk = Array.from(document.querySelectorAll('.mira-attr-chip')).find((n) => /حرير/.test(n.textContent || ''));
      (silk as HTMLElement | null)?.click();
    });
    await page.waitForTimeout(400);
    // I-01 evaluator: geometry+computed style decide visibility; finals counted by meaning (not per-label).
    const actions = await page.evaluate(`(() => {
      function isVisiblyRendered(el) {
        if (!el || !(el instanceof Element)) return false;
        let node = el;
        while (node && node.nodeType === 1) {
          const cs = getComputedStyle(node);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
          node = node.parentElement;
        }
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return false;
        // Do NOT bail on aria-hidden / class / HTML hidden alone if geometry still draws the control.
        return true;
      }
      function finalKind(label) {
        const t = String(label || '').trim();
        if (/^نشر الآن$/.test(t)) return 'publish';
        if (/^استئناف النشر$|^استكمال النشر$/.test(t)) return 'resume';
        if (/استئناف الإرسال للمراجعة/.test(t)) return 'resume';
        if (/^إرسال للمراجعة$/.test(t) || /مراجعة الحفظ ثم النشر/.test(t)) return 'review';
        return null;
      }
      function countFinalCtas(root) {
        const buttons = Array.from(root.querySelectorAll('button'));
        const visible = buttons.filter(isVisiblyRendered);
        const labels = visible.map((b) => (b.textContent || '').trim());
        const finals = labels.map(finalKind).filter(Boolean);
        const finalReview = finals.filter((k) => k === 'review' || k === 'resume');
        const finalPublish = finals.filter((k) => k === 'publish');
        const finalTotal = finals.length;
        return {
          labels: labels.slice(0, 24),
          finals,
          finalTotal,
          finalReviewCount: finalReview.length,
          finalPublishCount: finalPublish.length,
          draftSaveCount: labels.filter((t) => /حفظ المسودة/.test(t)).length,
          // Exactly one final action allowed; zero finals is NOT success.
          noDuplicateFinal: finalTotal === 1,
          evaluateFinalCtas: true,
        };
      }
      const panel = document.getElementById('e2bEditorPanel') || document.getElementById('catalogForm') || document.body;
      const text = panel.innerText || '';
      const counted = countFinalCtas(panel);
      window.__MIRA_EVAL_FINAL_CTAS__ = countFinalCtas;
      const previewSeparate = !!document.querySelector('[data-testid="catalog-preview-panel"]') || /المعاينة والنشر/.test(text);
      const rawEnumLeak = /\\b(draft|in_review|published|none)\\b/.test(text) && !/مسودة|مراجعة|منشور/.test(text);
      const arabicStatus = /مسودة|مراجعة|منشور|إرسال|نشر/.test(text);
      const namePriceRow = !!document.querySelector('[data-testid="e2b-name-price-row"]');
      const colorPalette = !!document.querySelector('[data-testid="e2b-color-palette"]');
      const videoCard = !!document.querySelector('[data-testid="e2b-video-card"]');
      const actionsBar = !!document.querySelector('[data-testid="e2b-editor-actions"]');
      const coreOffer = !!document.querySelector('[data-testid="e2b-core-offer"]');
      const variantsDetails = !!document.querySelector('[data-testid="e2b-variants-details"]');
      const qtyInCore = !!document.querySelector('[data-testid="e2b-qty-host"] [data-testid="catalog-quantity"]');
      const fieldOrderOk = (() => {
        const roles = Array.from(document.querySelectorAll('#catalogForm [data-section-role]')).map((n) =>
          n.getAttribute('data-section-role'),
        );
        const oi = roles.indexOf('options');
        const ai = roles.indexOf('attributes');
        const pi = roles.indexOf('options-preview');
        const colorBlock = document.querySelector('[data-option-kind="color"], .option-group[data-option-kind="color"]');
        const sizeBlock = document.querySelector('[data-option-kind="size"], .option-group[data-option-kind="size"]');
        const mats = document.querySelector('[data-testid="registry-attribute-host"]');
        const qty = document.querySelector('[data-testid="e2b-qty-host"]');
        let colorsBeforeSizes = true;
        if (colorBlock && sizeBlock && colorBlock.compareDocumentPosition) {
          colorsBeforeSizes = !!(colorBlock.compareDocumentPosition(sizeBlock) & Node.DOCUMENT_POSITION_FOLLOWING);
        }
        let matsBeforeQty = true;
        if (mats && qty && mats.compareDocumentPosition) {
          matsBeforeQty = !!(mats.compareDocumentPosition(qty) & Node.DOCUMENT_POSITION_FOLLOWING) || mats.contains(qty);
        }
        return (
          oi >= 0 &&
          ai >= 0 &&
          oi < ai &&
          (pi < 0 || ai < pi) &&
          colorsBeforeSizes &&
          matsBeforeQty
        );
      })();
      const videoState = document.querySelector('[data-testid="e2b-video-card-status"]')?.getAttribute('data-state') || '';
      const account = document.querySelector('[data-testid="e2b-editor-actions"]')?.getAttribute('data-account') || '';
      const finalCta = document.querySelector('[data-testid="e2b-editor-actions"]')?.getAttribute('data-final-cta') || '';
      return {
        primaryFinal: counted.finalTotal === 1,
        previewSeparate,
        rawEnumLeak,
        arabicStatus,
        buttons: counted.labels,
        finals: counted.finals,
        finalTotal: counted.finalTotal,
        finalReviewCount: counted.finalReviewCount,
        finalPublishCount: counted.finalPublishCount,
        draftSaveCount: counted.draftSaveCount,
        noDuplicateFinal: counted.noDuplicateFinal,
        namePriceRow,
        colorPalette,
        videoCard,
        actionsBar,
        coreOffer,
        variantsDetails,
        qtyInCore,
        fieldOrderOk,
        videoState,
        account,
        finalCta,
      };
    })()`);
    await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="e2b-editor-actions"]');
      if (bar) bar.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-actions.png'), fullPage: false });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-actions-bar.png'), fullPage: false });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-individual-filled.png'), fullPage: false });
    // Viewport captures for I-04 (scroll-stable, not sticky-skewed fullPage as sole proof).
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-viewport-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-viewport-phone-390.png') });
    await page.setViewportSize({ width: 430, height: 932 });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-viewport-phone-430.png') });
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-viewport-tablet-834.png') });
    await page.setViewportSize({ width: 1280, height: 900 });
    record(
      'ACC-E2B-STATUS-AR',
      'Arabic status language on editor; no raw enum-only chrome',
      'arabic status cues; no enum-only leak',
      JSON.stringify(actions),
      actions.arabicStatus === true && actions.rawEnumLeak === false,
      { criterion: 'ACC-E2B-STATUS-AR', evidence: ['e2b-actions.png'] },
    );
    record(
      'ACC-E2B-ACTIONS',
      'one primary final CTA + draft/preview separate; individual chrome; settings≠ads; منتجاتي restores list',
      'exactly one geometry-visible final; field order; name+price/colors/video; settings+list restore',
      JSON.stringify({ actions, settingsNav, productsNav }),
      actions.primaryFinal === true &&
        actions.previewSeparate === true &&
        actions.noDuplicateFinal === true &&
        actions.finalTotal === 1 &&
        actions.fieldOrderOk === true &&
        actions.namePriceRow === true &&
        actions.colorPalette === true &&
        actions.videoCard === true &&
        actions.actionsBar === true &&
        settingsNav.settingsVisible &&
        settingsNav.settingsInView &&
        settingsNav.adsIsSettings === false &&
        productsNav.listShown === true &&
        productsNav.focusOff === true,
      {
        criterion: 'ACC-E2B-ACTIONS',
        evidence: [
          'e2b-actions.png',
          'e2b-nav-settings.png',
          'e2b-individual-filled.png',
          'e2b-viewport-desktop.png',
          'e2b-viewport-phone-390.png',
          'e2b-viewport-phone-430.png',
          'e2b-viewport-tablet-834.png',
        ],
      },
    );

    // I-01 negatives: dup review; publish+resume together; aria-hidden but still drawn.
    const negDup = await page.evaluate(`(() => {
      const bar = document.querySelector('[data-testid="e2b-editor-actions"]');
      const root = document.getElementById('e2bEditorPanel') || document.body;
      if (!bar || typeof window.__MIRA_EVAL_FINAL_CTAS__ !== 'function') {
        return { ok: false, reason: 'missing-evaluator-or-bar' };
      }
      const before = window.__MIRA_EVAL_FINAL_CTAS__(root);
      const clone = document.createElement('button');
      clone.type = 'button';
      clone.className = 'btn btn-primary';
      clone.setAttribute('data-testid', 'acc-injected-dup-review');
      clone.textContent = 'إرسال للمراجعة';
      bar.appendChild(clone);
      const afterDup = window.__MIRA_EVAL_FINAL_CTAS__(root);
      clone.remove();
      const pub = document.createElement('button');
      pub.type = 'button';
      pub.className = 'btn btn-primary';
      pub.textContent = 'نشر الآن';
      const res = document.createElement('button');
      res.type = 'button';
      res.className = 'btn btn-primary';
      res.textContent = 'استئناف الإرسال للمراجعة';
      bar.appendChild(pub);
      bar.appendChild(res);
      const afterPubResume = window.__MIRA_EVAL_FINAL_CTAS__(root);
      pub.remove();
      res.remove();
      const ghost = document.createElement('button');
      ghost.type = 'button';
      ghost.className = 'btn btn-primary hidden';
      ghost.textContent = 'إرسال للمراجعة';
      ghost.setAttribute('aria-hidden', 'true');
      // Intentionally drawn despite aria-hidden/class — evaluator must still count it.
      ghost.style.setProperty('display', 'inline-flex', 'important');
      ghost.style.setProperty('visibility', 'visible', 'important');
      ghost.style.setProperty('opacity', '1', 'important');
      ghost.style.width = '120px';
      ghost.style.height = '40px';
      bar.appendChild(ghost);
      void ghost.offsetWidth;
      const afterGhost = window.__MIRA_EVAL_FINAL_CTAS__(root);
      ghost.remove();
      return {
        ok:
          before.noDuplicateFinal === true &&
          before.finalTotal === 1 &&
          afterDup.noDuplicateFinal === false &&
          afterDup.finalTotal >= 2 &&
          afterPubResume.noDuplicateFinal === false &&
          afterPubResume.finalTotal >= 2 &&
          afterGhost.finalTotal >= 2,
        before,
        afterDup,
        afterPubResume,
        afterGhost,
      };
    })()`);
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-actions-neg-dup.png'), fullPage: false });
    record(
      'ACC-E2B-ACTIONS-NEG-DUP',
      'I-01 negatives: dup review; publish+resume; aria-hidden-but-drawn all rejected by aggregated evaluator',
      'before finalTotal=1; each sabotage finalTotal>=2 / noDuplicateFinal=false',
      JSON.stringify(negDup),
      !!(negDup && negDup.ok),
      { criterion: 'ACC-E2B-ACTIONS-NEG-DUP', evidence: ['e2b-actions-neg-dup.png'] },
    );

    // I-02/I-03 individual offer cluster + color search/remove + qty host.
    const offer = await page.evaluate(async () => {
      const search = document.querySelector('[data-testid="e2b-color-search"]') as HTMLInputElement | null;
      const more = document.querySelector('[data-testid="e2b-color-more"]') as HTMLButtonElement | null;
      if (more) more.click();
      if (search) {
        search.value = 'ذهبي';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const gold = Array.from(document.querySelectorAll('.swatch-choice')).find((n) => /ذهبي/.test(n.textContent || ''));
      (gold as HTMLElement | null)?.click();
      const removeIvory = Array.from(document.querySelectorAll('[data-testid="e2b-color-selected"] .e2b-color-chip')).find((n) =>
        /سكري/.test(n.textContent || ''),
      ) as HTMLButtonElement | null;
      if (removeIvory) removeIvory.click();
      const qty = document.querySelector('[data-testid="catalog-quantity"]') as HTMLInputElement | null;
      if (qty) {
        qty.value = '0';
        qty.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const selected = Array.from(document.querySelectorAll('.swatch-choice.is-selected .swatch-name')).map((n) => n.textContent || '');
      const videoState = document.querySelector('[data-testid="e2b-video-card-status"]')?.getAttribute('data-state') || '';
      return {
        coreOffer: !!document.querySelector('[data-testid="e2b-core-offer"]'),
        variantsDetails: !!document.querySelector('[data-testid="e2b-variants-details"]'),
        qtyInCore: !!document.querySelector('[data-testid="e2b-qty-host"] [data-testid="catalog-quantity"]'),
        qtyValue: qty?.value || '',
        selected,
        goldVisibleAfterSearch: !!gold,
        videoState,
        commerceDetails: !!document.querySelector('[data-testid="e2b-commerce-details"]'),
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-individual-offer.png'), fullPage: false });
    record(
      'ACC-E2B-INDIVIDUAL-OFFER',
      'I-02 core offer cluster: colors/sizes/materials/qty; variants+commerce collapsed; color search/remove; qty zero',
      'core+qty host; variants details; gold searchable; ivory removable; qty=0; video chrome present',
      JSON.stringify(offer),
      offer.coreOffer === true &&
        offer.variantsDetails === true &&
        offer.qtyInCore === true &&
        offer.qtyValue === '0' &&
        offer.goldVisibleAfterSearch === true &&
        offer.selected.indexOf('سكري') < 0 &&
        offer.commerceDetails === true &&
        !!offer.videoState,
      { criterion: 'ACC-E2B-INDIVIDUAL-OFFER', evidence: ['e2b-individual-offer.png', 'e2b-individual-filled.png'] },
    );

    // Individual fields/journey link: use E2A individualVerdict — never require full E2A_ACCEPTANCE_PASS (bulk deferred).
    const e2aResultsPath = path.resolve(__dirname, '../../../../../.e2a-acceptance-evidence/results.json');
    let e2aLink: any = { ok: false, reason: 'missing-e2a-results' };
    if (fs.existsSync(e2aResultsPath)) {
      const e2a = JSON.parse(fs.readFileSync(e2aResultsPath, 'utf8'));
      const need = [
        'ACC-INDIVIDUAL-SAVE-RESTORE',
        'ACC-INVALID-BLOCK-INDIVIDUAL',
        'ACC-BRAND-SUBMIT-REVIEW',
        'ACC-DEV-PUBLISH-PRODUCT',
        'ACC-STALE-LATEST-WINS',
      ];
      const byCrit = new Map((e2a.cases || []).filter((c: any) => c.criterion).map((c: any) => [c.criterion, c]));
      const missing = need.filter((id) => !byCrit.has(id) || byCrit.get(id).status !== 'PASS');
      const sameTree = e2a.testedSha === testedSha;
      const endedMs = e2a.ended ? Date.parse(e2a.ended) : 0;
      const freshEnough = endedMs > 0 && Date.now() - endedMs < 6 * 60 * 60 * 1000;
      const e2aContent = e2a.codeContentSha256 || e2a.contentSha256 || null;
      const contentMatch = typeof e2aContent === 'string' && e2aContent.length === 64 && e2aContent === codeContentSha256;
      const individualPass =
        e2a.individualVerdict === 'INDIVIDUAL_ACCEPTANCE_PASS' ||
        (e2a.individualGate && e2a.individualGate.ok === true);
      // Bulk/deferred failure must not poison individual close when individualPass+need PASS.
      const bulkDeferredOrFail =
        e2a.bulkStatus === 'DEFERRED_BY_OWNER' ||
        e2a.bulkVerdict === 'BULK_DEFERRED_OR_FAIL' ||
        e2a.verdict === 'E2A_ACCEPTANCE_FAIL' ||
        e2a.verdict === 'E2A_ACCEPTANCE_PASS';
      e2aLink = {
        ok: individualPass === true && missing.length === 0 && sameTree && freshEnough && contentMatch,
        individualVerdict: e2a.individualVerdict || null,
        individualPass,
        e2aVerdict: e2a.verdict,
        bulkStatus: e2a.bulkStatus || 'DEFERRED_BY_OWNER',
        bulkDeferredOrFail,
        separationHonored: individualPass && bulkDeferredOrFail,
        testedSha: e2a.testedSha,
        expectedSha: testedSha,
        sameTree,
        freshEnough,
        contentMatch,
        contentMissing: !e2aContent,
        e2aContent,
        e2bContent: codeContentSha256,
        codeContentFiles,
        missing,
        ended: e2a.ended,
        separationOk: e2a.separationOk,
      };
      fs.writeFileSync(path.join(evidenceDir, 'e2b-e2a-journey-link.json'), JSON.stringify(e2aLink, null, 2));
    } else {
      fs.writeFileSync(path.join(evidenceDir, 'e2b-e2a-journey-link.json'), JSON.stringify(e2aLink, null, 2));
    }
    record(
      'ACC-E2B-FIELDS-ROUNDTRIP',
      'individual field save/restore/invalid/stale covered by linked E2A ACC on same tree (groups deferred)',
      'INDIVIDUAL_ACCEPTANCE_PASS + SAVE-RESTORE + INVALID + STALE',
      JSON.stringify(e2aLink),
      !!(
        e2aLink.ok &&
        !(e2aLink.missing || []).includes('ACC-INDIVIDUAL-SAVE-RESTORE') &&
        !(e2aLink.missing || []).includes('ACC-INVALID-BLOCK-INDIVIDUAL') &&
        !(e2aLink.missing || []).includes('ACC-STALE-LATEST-WINS')
      ),
      { criterion: 'ACC-E2B-FIELDS-ROUNDTRIP', evidence: ['e2b-e2a-journey-link.json'] },
    );
    record(
      'ACC-E2B-JOURNEY-LINK-E2A',
      'E2B accepts E2A individual journeys on final tree — bulk DEFERRED_BY_OWNER is not a close gate',
      'individualVerdict PASS + contentMatch; full E2A_ACCEPTANCE_PASS not required',
      JSON.stringify(e2aLink),
      e2aLink.ok === true && e2aLink.individualPass === true,
      { criterion: 'ACC-E2B-JOURNEY-LINK-E2A', evidence: ['e2b-e2a-journey-link.json'] },
    );

    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find((x) => /إضافة مجموعة|مجموعة/.test(x.textContent || ''));
      if (b) (b as HTMLButtonElement).click();
    });
    await page.waitForTimeout(900);
    // Open a real group card (product group → clothes profile when shown).
    const clothesBtn = page.getByRole('button', { name: /مجموعة منتجات|منتجات/ });
    if (await clothesBtn.count()) await clothesBtn.first().click().catch(() => undefined);
    await page.waitForTimeout(500);
    const profileBtn = page.getByRole('button', { name: /الملابس|ملابس/ });
    if (await profileBtn.count()) await profileBtn.first().click().catch(() => undefined);
    await page.waitForTimeout(800);
    const bulkShell = await page.evaluate(() => {
      const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
      const offer = /العرض\s+\d+/.test(document.querySelector('.bulk-journey-shell h3')?.textContent || '');
      const video = !!document.querySelector('#journeyVideoInput');
      const fields = !!document.querySelector('.bulk-journey-fields, .bulk-journey-field, [data-testid="bulk-registry-attribute-host"]');
      const media = !!document.querySelector('.bulk-journey-media, [data-testid="journey-media"]');
      return {
        root: !!root,
        journey: !!(window as any).MiraGroupJourney,
        hooks: (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks,
        harness: !!(window as any).__MIRA_E2A_HARNESS__,
        offer,
        video,
        fields,
        media,
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2b-bulk-shell.png'), fullPage: true });
    // Groups DEFERRED_BY_OWNER — regression only; not part of individual close gate.
    record(
      'ACC-E2B-BULK-SHELL-REGRESSION',
      'DEFERRED_BY_OWNER regression: group journey still opens beside E2B shell',
      'root+journey+offer (not a gate for individual)',
      JSON.stringify({ ...bulkShell, deferredByOwner: true }),
      !!(bulkShell.root && bulkShell.journey && bulkShell.offer && bulkShell.video && bulkShell.fields),
      { evidence: ['e2b-bulk-shell.png'] },
    );
    record(
      'ACC-E2B-HOOKS-ISOLATED-REGRESSION',
      'DEFERRED_BY_OWNER regression: publishable portal does not expose mutating test hooks',
      '__testHooks null without harness',
      JSON.stringify({ hooks: bulkShell.hooks, harness: bulkShell.harness, deferredByOwner: true }),
      bulkShell.hooks == null && bulkShell.harness === false,
      { evidence: ['e2b-bulk-shell.png'] },
    );

    // Gate self-test
    const probeCases: CaseResult[] = [
      {
        id: 'x',
        criterion: 'ACC-E2B-EDITOR-ENTRY',
        scenario: 'x',
        expected: 'x',
        actual: 'x',
        status: 'FAIL',
        evidence: ['e2b-editor-entry.png'],
        evidenceMissing: [],
      },
      {
        id: 'y',
        criterion: 'ACC-E2B-LIST-SEPARATION',
        scenario: 'x',
        expected: 'x',
        actual: 'x',
        status: 'PASS',
        evidence: [],
        evidenceMissing: [],
      },
    ];
    const gateBad = evaluateGate({ cases: probeCases, mandatory: ['ACC-E2B-EDITOR-ENTRY', 'ACC-E2B-LIST-SEPARATION', 'ACC-E2B-CATEGORY-CIRCLES'] });
    fs.writeFileSync(path.join(evidenceDir, 'e2b-gate-probe.json'), JSON.stringify(gateBad, null, 2));
    record(
      'ACC-E2B-GATE-REJECTS-BAD',
      'E2B gate rejects FAIL / missing criterion / empty evidence',
      'ok=false with missing+bad+evidenceGaps',
      JSON.stringify(gateBad),
      gateBad.ok === false && gateBad.missing.includes('ACC-E2B-CATEGORY-CIRCLES') && gateBad.bad.length >= 1 && gateBad.evidenceGaps.length >= 1,
      { criterion: 'ACC-E2B-GATE-REJECTS-BAD', evidence: ['e2b-gate-probe.json'] },
    );
  } finally {
    if (browser) await browser.close();
    await prisma.partnerUser.deleteMany({ where: { partnerId: brand.id } });
    await prisma.partner.delete({ where: { id: brand.id } }).catch(() => undefined);
    await new Promise<void>((r) => portalServer.close(() => r()));
    await app.close();
    await prisma.$disconnect();
  }

  const ended = new Date().toISOString();
  const gate = evaluateGate({ cases: results, mandatory: MANDATORY });
  const ok = gate.ok;
  const out = {
    verdict: ok ? 'E2B_ACCEPTANCE_PASS' : 'E2B_ACCEPTANCE_FAIL',
    gate,
    mandatory: MANDATORY,
    testedSha,
    codeContentSha256,
    codeContentFiles,
    started,
    ended,
    evidenceDir,
    cases: results,
  };
  fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
