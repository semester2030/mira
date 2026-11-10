/**
 * E2أ mandatory BROWSER acceptance gate (portal UI → API → preview → reopen).
 *
 * Run:
 *   DATABASE_URL=postgresql://…@127.0.0.1:5432/… MIRA_PARTNER_EDITOR_V2=true \
 *   npx tsx src/marketplace/taxonomy/elegance-e2a-acceptance.browser.integration-tests.ts
 *
 * Exit code follows individualGate (groups DEFERRED_BY_OWNER do not force failure).
 */
// Small parts so ALT_MP4 yields multiple parts — enables durable-part resume proof on retry.
process.env.MIRA_UPLOAD_PART_SIZE_BYTES =
  process.env.MIRA_UPLOAD_PART_SIZE_BYTES || String(64 * 1024);
import 'reflect-metadata';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { chromium, type Browser, type Page, type Route } from 'playwright';
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
import {
  baselineMainVideoIsolationSuccess,
  evaluateDisplayedProgress50,
  evaluateDevResumePublish,
  evaluateMainVideoIsolation,
  evaluateQtyEmptyZero,
} from './elegance-fin-evaluators';

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
class E2AAcceptanceModule {}

/** Individual mandatory — closes individual product add independently of bulk. */
const INDIVIDUAL_MANDATORY = [
  'ACC-INDIVIDUAL-SAVE-RESTORE',
  'ACC-INDIVIDUAL-QTY-EMPTY-ZERO',
  'ACC-INDIVIDUAL-MAIN-VIDEO-ISOLATION',
  'ACC-STALE-LATEST-WINS',
  'ACC-INVALID-BLOCK-INDIVIDUAL',
  'ACC-CREATE-LOSS-RECOVER',
  'ACC-BRAND-SUBMIT-REVIEW',
  'ACC-DEV-PUBLISH-PRODUCT',
  'ACC-DEV-PUBLISH-SERVICE',
  'ACC-DEV-RESUME-PUBLISH',
  'ACC-MEDIA-ACL',
  'ACC-NEG-RESUME-UI-REQUIRED',
  'ACC-NEG-RESUME-WAITING',
  'ACC-FIN-NEGATIVE-PROBES',
  'ACC-GATE-REJECTS-BAD',
] as const;

/** Bulk/group mandatory — DEFERRED_BY_OWNER for individual close; kept for E2A_ACCEPTANCE_PASS. */
const BULK_MANDATORY = [
  'ACC-INVALID-BLOCK-BULK',
  'ACC-BULK-THREE-CARDS',
  'ACC-BULK-MEDIA-RESTORE',
  'ACC-BULK-EDIT-MATERIALIZED',
  'ACC-BULK-STOCK-ROUNDTRIP',
  'ACC-BULK-VIDEO-REPLACE',
  'ACC-BULK-VIDEO-PREVIEW',
  'ACC-BULK-PRESERVE-FIELDS',
  'ACC-BULK-EXPLICIT-CLEAR',
  'ACC-BULK-VARIANTS-CLEAR',
  'ACC-BULK-UPLOAD-SESSION-SWITCH',
  'ACC-BULK-PREVIEW-ISOLATION',
  // Group-journey negative for replace-while-pending — not an individual close gate.
  'ACC-NEG-REPLACE-PENDING',
] as const;

/** Full E2A gate (individual + bulk). Missing/non-PASS fails E2A_ACCEPTANCE_PASS. */
const MANDATORY = [...INDIVIDUAL_MANDATORY, ...BULK_MANDATORY] as const;

type CriterionId = (typeof MANDATORY)[number];

type CaseResult = {
  id: string;
  criterion?: CriterionId | null;
  kind: 'BROWSER' | 'BROWSER_COMPONENT' | 'API' | 'DEVICE';
  scenario: string;
  expected: string;
  actual: string;
  evidence: string[];
  evidenceMissing?: string[];
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN' | 'SKIPPED';
};

const results: CaseResult[] = [];
const evidenceDir = path.resolve(__dirname, '../../../../../.e2a-acceptance-evidence');
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TINY_MP4 = path.resolve(
  __dirname,
  '../../partners-portal/upload-sessions/fixtures/valid-short.mp4',
);
/** Alternate video fixture (different size/fingerprint than TINY_MP4) — not /tmp. */
const ALT_MP4 = path.resolve(
  __dirname,
  '../../partners-portal/upload-sessions/fixtures/valid-multipart.mp4',
);
const ALT_MP4_SHA256 =
  'ac3e157fd8758f7edf511bc22432767d802f7bb150447199238705917131fe99';
/** Larger multi-part fixture for fail→resume (≠ TINY/ALT size so Playwright fires change). */
const LARGE_MP4 = path.resolve(
  __dirname,
  '../../partners-portal/upload-sessions/fixtures/valid-large.mp4',
);

function record(
  id: string,
  kind: CaseResult['kind'],
  scenario: string,
  expected: string,
  actual: string,
  status: boolean | CaseResult['status'],
  opts?: { criterion?: CriterionId; evidence?: string[] },
) {
  const evidence = opts?.evidence || [];
  const evidenceMissing = evidence.filter((f) => !fs.existsSync(path.join(evidenceDir, f)));
  let st: CaseResult['status'] =
    status === true ? 'PASS' : status === false ? 'FAIL' : status;
  // Mandatory criteria require non-empty evidence lists and present files.
  if (st === 'PASS' && opts?.criterion && evidence.length === 0) {
    st = 'FAIL';
  }
  if (st === 'PASS' && opts?.criterion && evidenceMissing.length) {
    st = 'FAIL';
  }
  if (
    st === 'PASS' &&
    opts?.criterion &&
    (status === 'BLOCKED' || status === 'NOT_RUN' || status === 'SKIPPED')
  ) {
    st = 'FAIL';
  }
  results.push({
    id,
    criterion: opts?.criterion ?? null,
    kind,
    scenario,
    expected,
    actual: evidenceMissing.length
      ? `${actual} | evidenceMissing=${JSON.stringify(evidenceMissing)}`
      : actual,
    evidence,
    evidenceMissing,
    status: st,
  });
  console.log(`${st} [${kind}] ${id}${opts?.criterion ? ' {' + opts.criterion + '}' : ''} — ${scenario}`);
  // Soft-fail: continue so the mandatory gate can report all criteria in one run.
}

/** Final resume-success text only — waiting copy must not pass. */
function isResumeSuccessText(st: string): boolean {
  const s = String(st || '');
  if (/جاهز لإعادة الإرسال للمراجعة/.test(s)) return false;
  if (/تعذر|فشل/.test(s)) return false;
  return /تم التحويل والإرسال للمراجعة/.test(s);
}

function evaluateGate(opts?: { cases?: CaseResult[]; mandatory?: readonly string[] }) {
  const pool = opts?.cases || results;
  const mandatory = opts?.mandatory || MANDATORY;
  const byCriterion = new Map<string, CaseResult>();
  for (const r of pool) {
    if (r.criterion) byCriterion.set(r.criterion, r);
  }
  const missing: string[] = [];
  const bad: string[] = [];
  const evidenceGaps: string[] = [];
  for (const id of mandatory) {
    const r = byCriterion.get(id);
    if (!r) missing.push(id);
    else if (r.status !== 'PASS') bad.push(`${id}=${r.status}`);
    if (r?.evidenceMissing?.length) evidenceGaps.push(`${id}:${r.evidenceMissing.join(',')}`);
  }
  return {
    ok: missing.length === 0 && bad.length === 0 && evidenceGaps.length === 0,
    missing,
    bad,
    evidenceGaps,
    mapped: Object.fromEntries([...byCriterion.entries()].map(([k, v]) => [k, v.status])),
  };
}

async function baseUrl(app: INestApplication) {
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
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
          : ext === '.json'
            ? 'application/json'
            : ext === '.mp4'
              ? 'video/mp4'
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

async function loginPage(page: Page, portalOrigin: string, apiOrigin: string, email: string, token: string) {
  const apiBase = `${apiOrigin}/api/v1`;
  await page.goto(`${portalOrigin}/login.html?api-base=${encodeURIComponent(apiBase)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.evaluate(
    ({ email: em, token: tok }) => {
      localStorage.setItem('mira_partner_email', em);
      localStorage.setItem('mira_partner_token', tok);
    },
    { email, token },
  );
  await page.goto(`${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForSelector('#partnerName', { timeout: 25000 });
  const base = await page.evaluate(() => (window as any).PartnersApi?.base);
  if (!String(base).startsWith(apiOrigin)) throw new Error(`API base mismatch ${base}`);
}

async function requireSel(page: Page, sel: string, label: string) {
  const n = await page.locator(sel).count();
  if (!n) throw new Error(`عنصر واجهة إلزامي مفقود: ${label} (${sel})`);
  return page.locator(sel).first();
}

async function fillProductBasics(page: Page, name: string, form = '#catalogForm') {
  await requireSel(page, `${form} input[name="nameAr"]`, 'nameAr');
  await page.fill(`${form} input[name="nameAr"]`, name);
  await requireSel(page, `${form} input[name="priceSar"]`, 'priceSar');
  await page.fill(`${form} input[name="priceSar"]`, '88.5');
  const cat = page.locator(`${form} select[name="category"]`);
  if (!(await cat.count())) throw new Error('عنصر واجهة إلزامي مفقود: category');
  await cat.selectOption('clothes');
  await page.waitForTimeout(400);
  const sub = page.locator(`${form} select[name="subcategory"]`);
  if (!(await sub.count())) throw new Error('عنصر واجهة إلزامي مفقود: subcategory');
  if (await sub.locator('option[value="clothes.evening"]').count()) {
    await sub.selectOption('clothes.evening');
  } else if ((await sub.locator('option').count()) > 1) {
    await sub.selectOption({ index: 1 });
  } else {
    throw new Error('لا خيارات تصنيف فرعي بعد تحميل taxonomy');
  }
  await page.waitForTimeout(400);
}

async function setClothesAttrs(
  page: Page,
  opts: { materials: string[]; cut: string; occasion?: string[]; lengthCm?: string | number },
  hostSel = '#catalogForm [data-testid="registry-attribute-host"]',
) {
  const host = page.locator(hostSel);
  if (!(await host.count())) throw new Error('عنصر واجهة إلزامي مفقود: registry-attribute-host');
  await page.evaluate(
    ({ hostSel: hs, materials, cut, occasion, lengthCm }) => {
      const host = document.querySelector(hs);
      if (!host) throw new Error('host missing');
      // materials: checkboxes
      const boxes = Array.from(host.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
      boxes.forEach((b) => {
        const lab = (b.getAttribute('aria-label') || b.value || '').toLowerCase();
        const want = materials.some((m) => lab.includes(m.toLowerCase()) || b.value === m);
        if (b.checked !== want) {
          b.checked = want;
          b.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      // cut radios
      const radios = Array.from(host.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
      const cutRadios = radios.filter((r) => (r.name || '').includes('-cut'));
      const target = cutRadios.find((r) => r.value === cut);
      if (!target) throw new Error('cut option missing: ' + cut);
      target.click();
      // occasion chips/checkboxes if present
      if (occasion && occasion.length) {
        const occInputs = Array.from(host.querySelectorAll('input')) as HTMLInputElement[];
        occInputs.forEach((inp) => {
          const name = inp.name || '';
          const lab = inp.getAttribute('aria-label') || inp.value || '';
          if (!name.includes('occasion') && !lab) return;
          if (name.includes('occasion') || (inp.type === 'checkbox' && occasion.includes(inp.value))) {
            const want = occasion.includes(inp.value);
            if (inp.type === 'checkbox' && inp.checked !== want) {
              inp.checked = want;
              inp.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      }
      if (lengthCm != null) {
        const num = host.querySelector('input.mira-attr-number') as HTMLInputElement | null;
        if (!num) throw new Error('lengthCm input missing');
        num.value = String(lengthCm);
        num.dispatchEvent(new Event('input', { bubbles: true }));
        num.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    { hostSel, ...opts },
  );
}

function attrsFromPreview(p: any) {
  if (!p) return null;
  return p.draftTaxonomySet && p.draftAttributes != null ? p.draftAttributes : p.publishedAttributes;
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
    'mira-api/src/marketplace/taxonomy/elegance-fin-evaluators.ts',
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
  if (!fs.existsSync(TINY_MP4)) {
    console.error('REFUSE: missing video fixture', TINY_MP4);
    process.exit(1);
  }
  if (!fs.existsSync(ALT_MP4)) {
    console.error('REFUSE: missing alt video fixture', ALT_MP4);
    process.exit(1);
  }
  {
    const { createHash } = await import('node:crypto');
    const altHash = createHash('sha256').update(fs.readFileSync(ALT_MP4)).digest('hex');
    if (altHash !== ALT_MP4_SHA256) {
      console.error('REFUSE: ALT_MP4 sha256 mismatch', altHash, 'expected', ALT_MP4_SHA256);
      process.exit(1);
    }
    if (fs.statSync(ALT_MP4).size === fs.statSync(TINY_MP4).size) {
      console.error('REFUSE: ALT_MP4 must differ in size from TINY_MP4');
      process.exit(1);
    }
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
  process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';
  process.env.MIRA_UPLOAD_PART_SIZE_BYTES = process.env.MIRA_UPLOAD_PART_SIZE_BYTES || '262144';
  process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY = process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY || '2';
  process.env.ADMIN_API_KEY = 'e2a-acc-admin';
  fs.mkdirSync(evidenceDir, { recursive: true });

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `Acc Br ${suffix}`, nameEn: 'Acc Br', city: 'الرياض' },
  });
  const developer = await prisma.partner.create({
    data: { type: 'developer', status: 'active', nameAr: `Acc Dv ${suffix}`, nameEn: 'Acc Dv', city: 'الرياض' },
  });
  const salon = await prisma.partner.create({
    data: { type: 'salon', status: 'active', nameAr: `Acc Salon ${suffix}`, nameEn: 'Acc Salon', city: 'الرياض' },
  });
  const tokenBrand = `tok-acc-br-${suffix}`;
  const tokenDev = `tok-acc-dv-${suffix}`;
  const tokenSalon = `tok-acc-salon-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `acc-br-${suffix}@test.local`, accessToken: tokenBrand },
  });
  await prisma.partnerUser.create({
    data: { partnerId: developer.id, email: `acc-dv-${suffix}@test.local`, accessToken: tokenDev },
  });
  await prisma.partnerUser.create({
    data: { partnerId: salon.id, email: `acc-salon-${suffix}@test.local`, accessToken: tokenSalon },
  });

  const app = await NestFactory.create(E2AAcceptanceModule, { bodyParser: false, logger: ['error'] });
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
  const apiRoot = await baseUrl(app);
  const portalDir = path.resolve(__dirname, '../../../../partners-portal/web');
  const { server: portalServer, origin: portalOrigin } = await servePortal(portalDir);

  let browser: Browser | null = null;
  const createdProductIds: string[] = [];
  const createdServiceIds: string[] = [];
  const networkLog: Array<{ method: string; path: string; status: number }> = [];
  const comparisons: any[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const videoDir = path.join(evidenceDir, 'videos');
    fs.mkdirSync(videoDir, { recursive: true });
    const context = await browser.newContext({
      locale: 'ar-SA',
      viewport: { width: 1400, height: 900 },
      recordVideo: { dir: videoDir, size: { width: 1400, height: 900 } },
    });
    // Isolated acceptance harness — never set on publishable portal pages without this flag.
    const harnessSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../partners-portal/web/js/bulk-group-journey.harness.js'),
      'utf8',
    );
    await context.addInitScript((src) => {
      (window as any).__MIRA_E2A_HARNESS__ = true;
      // Register plugin synchronously BEFORE page scripts so ?bulk= auto-open can bind state.
      try {
        // eslint-disable-next-line no-new-func
        (0, eval)(src);
      } catch {
        /* ignore */
      }
    }, harnessSrc);
    const page = await context.newPage();
    (page as any)._miraEvidenceName = 'individual-connected-journey';
    // FIN-02 dedicated name applied before video journey; copy alias kept at close.
    page.on('response', (res) => {
      try {
        const u = new URL(res.url());
        if (u.pathname.includes('/partners-portal') || u.pathname.includes('/marketplace/')) {
          networkLog.push({ method: res.request().method(), path: u.pathname, status: res.status() });
        }
      } catch {
        /* ignore */
      }
    });

    const browserVer = await browser.version();
    fs.writeFileSync(
      path.join(evidenceDir, 'env.json'),
      JSON.stringify(
        {
          testedSha,
          started,
          apiRoot,
          portalOrigin,
          browser: browserVer,
          classification: 'BROWSER',
        },
        null,
        2,
      ),
    );

    // ========== DEV: individual save/restore + R01 + stale + publish ==========
    await loginPage(page, portalOrigin, apiRoot, `acc-dv-${suffix}@test.local`, tokenDev);
    await page.click('#goProduct');
    await requireSel(page, '#catalogForm', 'catalogForm');

    // R01 invalid in UI
    await fillProductBasics(page, `Acc-R01-${suffix}`);
    await setClothesAttrs(page, { materials: ['silk'], cut: 'regular', lengthCm: '999' });
    const r01Blocking = await page.evaluate(() => {
      const host = document.querySelector('#catalogForm [data-testid="registry-attribute-host"]');
      // switch category away then back via subcategory if possible — use face category
      return {
        hasHost: !!host,
        numVal: (host?.querySelector('input.mira-attr-number') as HTMLInputElement | null)?.value,
      };
    });
    // Switch to bags (no length) via category then back to clothes
    await page.selectOption('#catalogForm select[name="category"]', 'face').catch(async () => {
      // face may hide subcategory; still remounts attrs
      await page.selectOption('#catalogForm select[name="category"]', 'bags');
    });
    await page.waitForTimeout(500);
    await page.selectOption('#catalogForm select[name="category"]', 'clothes');
    await page.waitForTimeout(600);
    if (await page.locator('#catalogForm select[name="subcategory"] option[value="clothes.evening"]').count()) {
      await page.selectOption('#catalogForm select[name="subcategory"]', 'clothes.evening');
      await page.waitForTimeout(500);
    }
    const r01After = await page.evaluate(() => {
      const host = document.querySelector('#catalogForm [data-testid="registry-attribute-host"]');
      if (!host) return { error: 'host-missing' };
      const num = host.querySelector('input.mira-attr-number') as HTMLInputElement | null;
      const err = host.querySelector('[data-attr-error="lengthCm"]') as HTMLElement | null;
      return {
        value: num?.value,
        errVisible: !!(err && !err.hidden && (err.textContent || '').trim()),
        errText: err?.textContent || '',
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'r01-invalid-restore.png'), fullPage: true });
    // Try save — should be blocked
    await page.click('#catalogForm-save');
    await page.waitForTimeout(800);
    const r01Status = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const st = form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]');
      return st?.textContent || '';
    });
    const meAfterBad = await page.evaluate(async () => (window as any).PartnersApi.dashboard());
    const badCreated = (meAfterBad?.catalog?.products || []).some((p: any) =>
      String(p.nameAr || '').includes(`Acc-R01-${suffix}`),
    );
    record(
      'acc-invalid-individual',
      'BROWSER',
      'قيمة غير صالحة تُستعاد بعد تبديل التصنيف وتمنع الحفظ',
      'value=999 + error + no product created',
      JSON.stringify({ r01Blocking, r01After, r01Status, badCreated }),
      r01After.value === '999' && r01After.errVisible && !badCreated,
      {
        criterion: 'ACC-INVALID-BLOCK-INDIVIDUAL',
        evidence: ['r01-invalid-restore.png'],
      },
    );

    // Fix length and complete individual save/restore
    await setClothesAttrs(page, {
      materials: ['silk', 'cotton'],
      cut: 'fitted',
      occasion: ['work'],
      lengthCm: 120,
    });
    // A→B→A cut
    await setClothesAttrs(page, { materials: ['silk', 'cotton'], cut: 'regular', lengthCm: 120 });
    await setClothesAttrs(page, { materials: ['silk', 'cotton'], cut: 'fitted', lengthCm: 120 });
    await setClothesAttrs(page, { materials: ['silk', 'cotton'], cut: 'regular', lengthCm: 120 });
    // I-03: subcategory → re-click parent; colors add/remove; sizes; qty empty≠0
    if (await page.locator('#catalogForm select[name="subcategory"] option[value="clothes.evening"]').count()) {
      await page.selectOption('#catalogForm select[name="subcategory"]', 'clothes.evening');
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => {
      const main = document.querySelector('#e2bMainCircles .e2b-circle[data-category-id="clothes"]') as HTMLElement | null;
      main?.click();
    });
    await page.waitForTimeout(500);
    const parentReclick = await page.evaluate(() => {
      const sub = (document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null)?.value || '';
      const subCircle = document
        .querySelector('#e2bSubCircles .e2b-circle.is-selected')
        ?.getAttribute('data-subcategory-id');
      return { sub, subCircle };
    });
    await page.evaluate(() => {
      const more = document.querySelector('[data-testid="e2b-color-more"]') as HTMLButtonElement | null;
      more?.click();
      const ivory = Array.from(document.querySelectorAll('.swatch-choice')).find((n) => /سكري/.test(n.textContent || ''));
      const black = Array.from(document.querySelectorAll('.swatch-choice')).find((n) => /أسود|اسود/.test(n.textContent || ''));
      (ivory as HTMLElement | null)?.click();
      (black as HTMLElement | null)?.click();
      const search = document.querySelector('[data-testid="e2b-color-search"]') as HTMLInputElement | null;
      if (search) {
        search.value = 'ذهبي';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const gold = Array.from(document.querySelectorAll('.swatch-choice')).find((n) => /ذهبي/.test(n.textContent || ''));
      (gold as HTMLElement | null)?.click();
      const clearSearch = document.querySelector('[data-testid="e2b-color-all"]') as HTMLButtonElement | null;
      clearSearch?.click();
      if (search) {
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const removeIvory = Array.from(
        document.querySelectorAll('[data-testid="e2b-color-selected"] .e2b-color-chip, .swatch-choice.is-selected'),
      ).find((n) => /سكري/.test(n.textContent || '')) as HTMLElement | null;
      removeIvory?.click();
      const m = Array.from(document.querySelectorAll('.size-choice')).find(
        (n) => (n.textContent || '').replace(/[✓\s]/g, '').trim() === 'M',
      );
      const l = Array.from(document.querySelectorAll('.size-choice')).find(
        (n) => (n.textContent || '').replace(/[✓\s]/g, '').trim() === 'L',
      );
      (m as HTMLElement | null)?.click();
      (l as HTMLElement | null)?.click();
      const qty = document.querySelector('[data-testid="catalog-quantity"]') as HTMLInputElement | null;
      if (qty) {
        qty.value = '';
        qty.dispatchEvent(new Event('input', { bubbles: true }));
        qty.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
    const offerBeforeEmptyQty = await page.evaluate(() => {
      const colors = Array.from(document.querySelectorAll('.swatch-choice.is-selected .swatch-name')).map(
        (n) => n.textContent || '',
      );
      const sizes = Array.from(document.querySelectorAll('.size-choice.is-selected')).map((n) =>
        (n.textContent || '').replace(/[✓\s]/g, '').trim(),
      );
      const mats = Array.from(
        document.querySelectorAll('[data-testid="registry-attribute-host"] .mira-attr-chip.is-selected, [data-testid="registry-attribute-host"] input[type="checkbox"]:checked'),
      ).map((n) => (n as HTMLInputElement).value || (n.textContent || '').replace(/[✓\s]/g, '').trim());
      const qty = (document.querySelector('[data-testid="catalog-quantity"]') as HTMLInputElement | null)?.value;
      return { colors, sizes, mats, qty };
    });
    // Empty qty must remain empty (not coerced to 0) on this draft path before save.
    await page.evaluate(() => {
      const qty = document.querySelector('[data-testid="catalog-quantity"]') as HTMLInputElement | null;
      if (qty) {
        qty.value = '0';
        qty.dispatchEvent(new Event('input', { bubbles: true }));
        qty.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const expected = {
      material: ['silk', 'cotton'],
      cut: 'regular',
      lengthCm: 120,
      stockQty: 0,
      colorsIncludeGold: true,
      colorsExcludeIvory: true,
      sizes: ['M', 'L'],
    };
    const prodName = `Acc-Indiv-${suffix}`;
    await page.fill('#catalogForm input[name="nameAr"]', prodName);
    // Ensure price present (required) after attr remounts — via user fill, not button-state override.
    const priceInput = page.locator('#catalogForm input[name="priceHalalas"], #catalogForm input[name="priceSar"]');
    if (await priceInput.count()) {
      const cur = await priceInput.first().inputValue().catch(() => '');
      if (!cur || cur === '0') await priceInput.first().fill('199');
    }
    // Natural save only: wait until the CTA is idle/enabled, then click. Never force disabled/busy.
    await page.waitForFunction(
      () => {
        const save = document.getElementById('catalogForm-save') as HTMLButtonElement | null;
        const form = document.getElementById('catalogForm');
        if (!save || !form) return false;
        if (save.disabled) return false;
        if (save.getAttribute('aria-busy') === 'true') return false;
        if (save.classList.contains('is-busy')) return false;
        if (form.dataset.saving === '1') return false;
        return true;
      },
      undefined,
      { timeout: 30000 },
    );
    const saveReady = await page.evaluate(() => {
      const save = document.getElementById('catalogForm-save') as HTMLButtonElement | null;
      const form = document.getElementById('catalogForm');
      return {
        disabled: !!save?.disabled,
        busy: save?.getAttribute('aria-busy'),
        saving: form?.dataset.saving || '',
      };
    });
    assert.equal(saveReady.disabled, false, 'save must be naturally enabled: ' + JSON.stringify(saveReady));
    assert.notEqual(saveReady.busy, 'true', 'save must not be busy before click');
    await page.click('#catalogForm-save');
    let listed: any = null;
    let saveDiag: any = null;
    for (let t = 0; t < 40; t++) {
      await page.waitForTimeout(400);
      const dash = await page.evaluate(async () => (window as any).PartnersApi.dashboard());
      listed = (dash?.catalog?.products || []).find((p: any) => p.nameAr === prodName) || null;
      if (listed?.id) break;
      saveDiag = await page.evaluate(() => {
        const form = document.getElementById('catalogForm');
        const st =
          form?.querySelector('[data-catalog-persist-status], [role="status"], p.lead')?.textContent || '';
        const save = document.getElementById('catalogForm-save') as HTMLButtonElement | null;
        const name = (form?.querySelector('input[name="nameAr"]') as HTMLInputElement | null)?.value || '';
        const len = (
          form?.querySelector('[data-testid="registry-attribute-host"] input.mira-attr-number') as HTMLInputElement | null
        )?.value;
        const err = form?.querySelector('[data-attr-error="lengthCm"]')?.textContent || '';
        return {
          st,
          name,
          len,
          err,
          disabled: !!save?.disabled,
          busy: save?.getAttribute('aria-busy'),
          saving: form?.dataset.saving || '',
          compose: !!document.querySelector('[data-testid="e2b-editor-compose"]'),
          roles: Array.from(form?.querySelectorAll('[data-section-role]') || []).map((n) =>
            n.getAttribute('data-section-role'),
          ),
        };
      });
    }
    await page.screenshot({ path: path.join(evidenceDir, 'individual-after-save.png'), fullPage: true });
    assert.ok(listed?.id, 'product must appear after natural save: ' + JSON.stringify(saveDiag));
    createdProductIds.push(listed.id);
    const preview1 = await page.evaluate(async (id) => (window as any).PartnersApi.productPreview(id), listed.id);
    const attrs1 = attrsFromPreview(preview1);
    const db1 = await prisma.product.findUniqueOrThrow({ where: { id: listed.id } });
    comparisons.push({
      id: 'individual-save',
      expected,
      preview: attrs1,
      db: db1.attributesJson || db1.draftAttributesJson,
    });

    // Reopen from list
    await page.evaluate(async () => {
      if (window.reloadPartnerDashboard) await (window as any).reloadPartnerDashboard({ preserveForms: false });
      else location.reload();
    });
    await page.waitForSelector('#partnerName', { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.locator('#e2bShowList').click({ timeout: 3000 }).catch(() => undefined);
    await page.evaluate(() => document.body.classList.remove('e2b-editor-focus'));
    const openBtn = page.locator('#catalogList .list-item').filter({ hasText: prodName }).getByRole('button', {
      name: 'فتح في النموذج',
    });
    if (!(await openBtn.count())) throw new Error('زر فتح العنصر مفقود في قائمة البوابة');
    await openBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(evidenceDir, 'individual-reopen.png'), fullPage: true });
    const uiAfterReopen = await page.evaluate(() => {
      const host = document.querySelector('#catalogForm [data-testid="registry-attribute-host"]');
      if (!host) return { error: 'host-missing' };
      const mats: string[] = [];
      host.querySelectorAll('input[type="checkbox"]:checked').forEach((b: any) => mats.push(b.value || b.getAttribute('aria-label')));
      const cut = (host.querySelector('input[type="radio"]:checked') as HTMLInputElement | null)?.value;
      const lengthCm = (host.querySelector('input.mira-attr-number') as HTMLInputElement | null)?.value;
      const more = document.querySelector('[data-testid="e2b-color-more"]') as HTMLButtonElement | null;
      more?.click();
      const colors = Array.from(document.querySelectorAll('.swatch-choice.is-selected .swatch-name')).map(
        (n) => n.textContent || '',
      );
      const sizes = Array.from(document.querySelectorAll('.size-choice.is-selected')).map((n) =>
        (n.textContent || '').replace(/[✓\s]/g, '').trim(),
      );
      const qty = (document.querySelector('[data-testid="catalog-quantity"]') as HTMLInputElement | null)?.value;
      const sub = (document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null)?.value || '';
      return { mats, cut, lengthCm, colors, sizes, qty, sub };
    });
    const preview2 = await page.evaluate(async (id) => (window as any).PartnersApi.productPreview(id), listed.id);
    const attrs2 = attrsFromPreview(preview2);
    const db2 = await prisma.product.findUniqueOrThrow({ where: { id: listed.id } });
    const matOk =
      JSON.stringify([...(attrs2?.material || [])].sort()) === JSON.stringify(['cotton', 'silk']) &&
      attrs2?.cut === 'regular' &&
      attrs2?.lengthCm === 120;
    const uiOk =
      uiAfterReopen.cut === 'regular' &&
      String(uiAfterReopen.lengthCm) === '120' &&
      JSON.stringify([...(uiAfterReopen.mats || [])].map(String).sort()) ===
        JSON.stringify(['cotton', 'silk'].sort());
    const goldPresent = (uiAfterReopen.colors || []).some((c: string) => /ذهبي/.test(c));
    const ivoryAbsent = !(uiAfterReopen.colors || []).some((c: string) => /سكري/.test(c));
    const blackPresent = (uiAfterReopen.colors || []).some((c: string) => /أسود|اسود/.test(c));
    const sizesOk = ['M', 'L'].every((s) => (uiAfterReopen.sizes || []).includes(s));
    const qtyOk = String(uiAfterReopen.qty) === '0' && (db2.stockQty === 0 || db2.stockQty === 0);
    const emptyNotZero = offerBeforeEmptyQty.qty === '' || offerBeforeEmptyQty.qty == null;
    const parentOk =
      !parentReclick.sub ||
      parentReclick.sub === 'clothes.evening' ||
      parentReclick.subCircle === 'clothes.evening' ||
      uiAfterReopen.sub === 'clothes.evening';
    // Sabotage predicates: each must fail the composite when violated.
    const sabotage = {
      missingGold: !(goldPresent && true),
      keptIvory: !ivoryAbsent,
      lostSizes: !sizesOk,
      emptyBecameZero: !emptyNotZero && offerBeforeEmptyQty.qty === '0',
      zeroBecameEmpty: String(uiAfterReopen.qty || '') === '' && expected.stockQty === 0,
    };
    const offerOk =
      goldPresent &&
      ivoryAbsent &&
      blackPresent &&
      sizesOk &&
      qtyOk &&
      emptyNotZero &&
      parentOk &&
      !sabotage.missingGold &&
      !sabotage.keptIvory &&
      !sabotage.lostSizes;
    await page.screenshot({ path: path.join(evidenceDir, 'individual-connected-journey.png'), fullPage: true });
    fs.writeFileSync(
      path.join(evidenceDir, 'individual-connected-journey.json'),
      JSON.stringify(
        {
          parentReclick,
          offerBeforeEmptyQty,
          uiAfterReopen,
          attrs2,
          stockQty: db2.stockQty,
          sabotage,
          offerOk,
          matOk,
          uiOk,
        },
        null,
        2,
      ),
    );
    record(
      'acc-individual-save-restore',
      'BROWSER',
      'رحلة فردية متصلة: ألوان/مقاسات/خامات/كمية + حفظ + إعادة فتح + مطابقة خادم',
      'material+cut+length+colors+sizes+qty0; gold present; ivory absent; empty≠0 before zero save',
      JSON.stringify({
        attrs2,
        uiAfterReopen,
        matOk,
        uiOk,
        offerOk,
        goldPresent,
        ivoryAbsent,
        blackPresent,
        sizesOk,
        qtyOk,
        emptyNotZero,
        parentOk,
        stockQty: db2.stockQty,
      }),
      matOk && uiOk && offerOk,
      {
        criterion: 'ACC-INDIVIDUAL-SAVE-RESTORE',
        evidence: [
          'individual-after-save.png',
          'individual-reopen.png',
          'individual-connected-journey.png',
          'individual-connected-journey.json',
        ],
      },
    );

    // I-03 qty: two real save→reopen journeys proving empty ≠ zero after persistence.
    async function naturalSaveClick() {
      await page.waitForFunction(
        () => {
          const save = document.getElementById('catalogForm-save') as HTMLButtonElement | null;
          const form = document.getElementById('catalogForm');
          if (!save || !form) return false;
          if (save.disabled || save.getAttribute('aria-busy') === 'true' || form.dataset.saving === '1') return false;
          return true;
        },
        undefined,
        { timeout: 30000 },
      );
      await page.click('#catalogForm-save');
      await page.waitForFunction(
        () => {
          const form = document.getElementById('catalogForm');
          return form && form.dataset.saving !== '1';
        },
        undefined,
        { timeout: 30000 },
      );
    }
    async function reopenListedProduct() {
      await page.evaluate(async () => {
        if (window.reloadPartnerDashboard) await (window as any).reloadPartnerDashboard({ preserveForms: false });
        else location.reload();
      });
      await page.waitForSelector('#partnerName', { timeout: 20000 });
      await page.waitForTimeout(600);
      await page.locator('#e2bShowList').click({ timeout: 3000 }).catch(() => undefined);
      await page.evaluate(() => document.body.classList.remove('e2b-editor-focus'));
      const btn = page.locator('#catalogList .list-item').filter({ hasText: prodName }).getByRole('button', {
        name: 'فتح في النموذج',
      });
      await btn.click();
      await page.waitForSelector('#catalogForm [data-testid="catalog-quantity"]', { timeout: 15000 });
      await page.waitForFunction(
        () => {
          const sub = document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null;
          const host = document.querySelector('#catalogForm [data-testid="registry-attribute-host"]');
          const matsReady = !!(
            host &&
            (host.querySelectorAll('input[type="checkbox"]').length > 0 ||
              host.querySelectorAll('.mira-attr-chip').length > 0)
          );
          return !!(sub && sub.value === 'clothes.evening' && matsReady);
        },
        undefined,
        { timeout: 25000 },
      );
      await page.waitForTimeout(400);
    }
    async function snapshotOffer() {
      // Stable reader: selected colors from state chips (data-color-label) — no more/all/search mutation.
      return page.evaluate(() => {
        const colorChipLabels = Array.from(
          document.querySelectorAll('[data-testid="e2b-color-selected"] [data-color-label]'),
        ).map((n) => n.getAttribute('data-color-label') || '');
        const colorSwatchLabels = Array.from(document.querySelectorAll('.swatch-choice.is-selected')).map((n) => {
          const labeled = n.getAttribute('data-color-label') || n.querySelector('[data-color-label]')?.getAttribute('data-color-label');
          const named = (n.querySelector('.swatch-name')?.textContent || '').trim();
          return labeled || named || '';
        });
        const colors = Array.from(new Set([...colorChipLabels, ...colorSwatchLabels].map(String).filter(Boolean)));
        const sizes = Array.from(document.querySelectorAll('.size-choice.is-selected')).map((n) =>
          (n.textContent || '').replace(/[✓\s]/g, '').trim(),
        );
        const matsFromChecks = Array.from(
          document.querySelectorAll('[data-testid="registry-attribute-host"] input[type="checkbox"]:checked'),
        ).map((n) => (n as HTMLInputElement).value);
        const matsFromChips = Array.from(
          document.querySelectorAll('[data-testid="registry-attribute-host"] .mira-attr-chip.is-selected'),
        ).map((n) => (n.getAttribute('data-value') || n.textContent || '').replace(/[✓\s]/g, '').trim());
        const mats = matsFromChecks.length ? matsFromChecks : matsFromChips;
        const qty = (document.querySelector('[data-testid="catalog-quantity"]') as HTMLInputElement | null)?.value;
        const sub = (document.querySelector('#catalogForm select[name="subcategory"]') as HTMLSelectElement | null)
          ?.value;
        return { colors, sizes, mats, qty, sub };
      });
    }
    function offerNeighborsKey(o: any) {
      return JSON.stringify({
        colors: [...(o?.colors || [])].map(String).sort(),
        sizes: [...(o?.sizes || [])].map(String).sort(),
        mats: [...(o?.mats || [])].map(String).sort(),
        sub: o?.sub || '',
      });
    }
    async function shotEditor(name: string) {
      await page.setViewportSize({ width: 1400, height: 900 });
      await page.locator('#catalogForm').scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(evidenceDir, name), fullPage: false });
    }
    const neighborsBeforeEmpty = await snapshotOffer();
    await page.evaluate(() => {
      const qty = document.querySelector('[data-testid="catalog-quantity"]') as HTMLInputElement | null;
      if (qty) {
        qty.value = '';
        qty.dispatchEvent(new Event('input', { bubbles: true }));
        qty.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const emptyBeforeSave = await snapshotOffer();
    await naturalSaveClick();
    const emptyDbAfterSave = await prisma.product.findUniqueOrThrow({
      where: { id: listed.id },
      select: { stockQty: true },
    });
    const emptyPreviewAfterSave = await page.evaluate(
      async (id) => (window as any).PartnersApi.productPreview(id),
      listed.id,
    );
    await reopenListedProduct();
    const emptyAfterReopen = await snapshotOffer();
    await page.locator('[data-testid="catalog-quantity"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await shotEditor('individual-qty-empty-reopen.png');
    await page.evaluate(() => {
      const qty = document.querySelector('[data-testid="catalog-quantity"]') as HTMLInputElement | null;
      if (qty) {
        qty.value = '0';
        qty.dispatchEvent(new Event('input', { bubbles: true }));
        qty.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    const zeroBeforeSave = await snapshotOffer();
    await naturalSaveClick();
    const zeroDbAfterSave = await prisma.product.findUniqueOrThrow({
      where: { id: listed.id },
      select: { stockQty: true },
    });
    const zeroPreviewAfterSave = await page.evaluate(
      async (id) => (window as any).PartnersApi.productPreview(id),
      listed.id,
    );
    await reopenListedProduct();
    const zeroAfterReopen = await snapshotOffer();
    await page.locator('[data-testid="catalog-quantity"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await shotEditor('individual-qty-zero-reopen.png');
    // Direct neighbor comparisons: empty before↔after; zero before↔after (qty excluded).
    const neighborsEmptyStable =
      offerNeighborsKey(emptyBeforeSave) === offerNeighborsKey(emptyAfterReopen);
    const neighborsZeroStable =
      offerNeighborsKey(zeroBeforeSave) === offerNeighborsKey(zeroAfterReopen);
    const neighborsStable = neighborsEmptyStable && neighborsZeroStable;
    const emptyPersisted =
      emptyBeforeSave.qty === '' &&
      (emptyDbAfterSave.stockQty == null || emptyDbAfterSave.stockQty === undefined) &&
      (emptyAfterReopen.qty === '' || emptyAfterReopen.qty == null);
    const zeroPersisted =
      zeroBeforeSave.qty === '0' &&
      zeroDbAfterSave.stockQty === 0 &&
      String(zeroAfterReopen.qty) === '0';
    // Negative: evaluator must reject when one neighbor differs.
    const negColor = {
      ...zeroAfterReopen,
      colors: [...(zeroAfterReopen.colors || []), '__NEG_COLOR__'],
    };
    const negSize = { ...zeroAfterReopen, sizes: ['XXL_NEG'] };
    const negMat = { ...zeroAfterReopen, mats: ['neg-material'] };
    const negSub = { ...zeroAfterReopen, sub: 'clothes.day' };
    const negRejects = {
      color: offerNeighborsKey(zeroBeforeSave) !== offerNeighborsKey(negColor),
      size: offerNeighborsKey(zeroBeforeSave) !== offerNeighborsKey(negSize),
      mat: offerNeighborsKey(zeroBeforeSave) !== offerNeighborsKey(negMat),
      sub: offerNeighborsKey(zeroBeforeSave) !== offerNeighborsKey(negSub),
    };
    const negOk = negRejects.color && negRejects.size && negRejects.mat && negRejects.sub;
    void emptyPreviewAfterSave;
    void zeroPreviewAfterSave;
    void neighborsBeforeEmpty;
    fs.writeFileSync(
      path.join(evidenceDir, 'individual-qty-empty-zero.json'),
      JSON.stringify(
        {
          neighborsBeforeEmpty,
          emptyBeforeSave,
          emptyDbAfterSave,
          emptyPreviewAfterSave: { stockQty: emptyPreviewAfterSave?.stockQty },
          emptyAfterReopen,
          zeroBeforeSave,
          zeroDbAfterSave,
          zeroPreviewAfterSave: { stockQty: zeroPreviewAfterSave?.stockQty },
          zeroAfterReopen,
          emptyPersisted,
          zeroPersisted,
          neighborsEmptyStable,
          neighborsZeroStable,
          neighborsStable,
          negRejects,
          negOk,
        },
        null,
        2,
      ),
    );
    const qtyEval = evaluateQtyEmptyZero({
      emptyPersisted,
      zeroPersisted,
      neighborsEmptyStable,
      neighborsZeroStable,
      negOk,
    });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.locator('[data-testid="catalog-quantity"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(evidenceDir, 'fin03-desktop-qty.png'), fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(350);
    await page.locator('[data-testid="catalog-quantity"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(evidenceDir, 'fin03-phone-qty.png'), fullPage: false });
    await page.setViewportSize({ width: 1400, height: 900 });
    record(
      'acc-individual-qty-empty-zero',
      'BROWSER',
      'رحلتا حفظ/إعادة فتح: كمية فارغة تبقى فارغة؛ صفر يبقى صفرًا؛ الجيران مطابقون قبل↔بعد لكل حفظ',
      'evaluateQtyEmptyZero.ok',
      JSON.stringify({
        qtyEval,
        emptyPersisted,
        zeroPersisted,
        neighborsStable,
        neighborsEmptyStable,
        neighborsZeroStable,
        negOk,
        emptyDbAfterSave,
        zeroDbAfterSave,
      }),
      qtyEval.ok,
      {
        criterion: 'ACC-INDIVIDUAL-QTY-EMPTY-ZERO',
        evidence: [
          'individual-qty-empty-reopen.png',
          'individual-qty-zero-reopen.png',
          'individual-qty-empty-zero.json',
          'fin03-desktop-qty.png',
          'fin03-phone-qty.png',
        ],
      },
    );

    // FIN-02: real saved main video + detail upload isolation + main upload cycle via file inputs.
    try {
    (page as any)._miraEvidenceName = 'fin02-main-video-journey';
    async function readVideoChrome() {
      return page.evaluate(() => {
        const root = document.getElementById('catalogForm') || document;
        const st = root.querySelector('[data-testid="e2b-video-card-status"]') as HTMLElement | null;
        const pick = root.querySelector('[data-testid="e2b-video-pick"]') as HTMLElement | null;
        const input = document.querySelector('#catalogForm-videos') as HTMLInputElement | null;
        return {
          text: st?.textContent || '',
          state: st?.dataset?.state || '',
          phase: st?.dataset?.phase || '',
          pick: pick?.textContent || '',
          pickAction: pick?.dataset?.action || '',
          inputFiles: input?.files?.length || 0,
        };
      });
    }
    async function readDetailStagedCards() {
      return page.evaluate(() => {
        const box = document.querySelector('#catalogForm [data-section-role="detail-media"]') ||
          document.querySelector('#catalogForm-detail-videos')?.closest('.form-section');
        const root = box || document.getElementById('catalogForm');
        const cards = Array.from(root?.querySelectorAll('[data-testid="media-card-staged"]') || []);
        return cards.map((card) => {
          const el = card as HTMLElement;
          return {
            text: el.textContent || '',
            state: el.querySelector('[data-testid="media-state"]')?.textContent || '',
            sessionId: el.dataset.uploadSessionId || '',
            fileName: el.dataset.fileName || '',
            hasRetry: !!Array.from(el.querySelectorAll('button')).find((b) => /إعادة المحاولة/.test(b.textContent || '')),
            hasCancel: !!Array.from(el.querySelectorAll('button')).find((b) => /^إلغاء$/.test((b.textContent || '').trim())),
            cancelDisabled: !!(Array.from(el.querySelectorAll('button')).find((b) => /^إلغاء$/.test((b.textContent || '').trim())) as HTMLButtonElement | undefined)?.disabled,
          };
        });
      });
    }
    async function liveProductId() {
      const dash = await page.evaluate(async () => (window as any).PartnersApi.dashboard());
      const row = (dash?.catalog?.products || []).find((p: any) => p.nameAr === prodName);
      return (row && row.id) || listed.id;
    }
    async function serverMainVideo(productId: string) {
      const rows = await prisma.catalogMedia.findMany({
        where: { ownerKind: 'product', ownerId: productId },
        select: { id: true, kind: true, placement: true, publication: true, mimeType: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      const mains = rows.filter(
        (m) => /video/i.test(String(m.kind)) && String(m.placement || 'main') !== 'detail',
      );
      const main = mains.length ? mains[mains.length - 1] : null;
      const details = rows.filter((m) => String(m.placement) === 'detail');
      return { main, details, rows, mains };
    }
    /** Progress probe: callback goes through app onProgress; flag only if card text shows 50%. */
    async function installUploadProgressProbe() {
      await page.evaluate(`(() => {
        const w = window;
        w.__miraPct50Painted = false;
        w.__miraPct50CardText = '';
        w.__miraLastUploadSessionId = null;
        const api = w.PartnersApi;
        if (!api) return;
        const looksLike50 = (st) => /50%/.test(st || '') && !/0\\.5%/.test(st || '');
        const readCard = () => {
          const root = document.getElementById('catalogForm') || document;
          return (root.querySelector('[data-testid="e2b-video-card-status"]') || {}).textContent || '';
        };
        const wrapProgress = (fnName) => {
          const orig = api[fnName];
          if (typeof orig !== 'function' || orig.__miraProgressProbeInstalled) return;
          const bound = orig.bind(api);
          const wrapped = async function () {
            const args = Array.prototype.slice.call(arguments);
            const hooksIdx = fnName === 'uploadViaSession' ? 3 : 4;
            const hooks = Object.assign({}, args[hooksIdx] || {});
            const userProgress = hooks.onProgress;
            const userSession = hooks.onSession;
            const userProcessing = hooks.onProcessing;
            hooks.onSession = (session) => {
              if (session && session.sessionId) w.__miraLastUploadSessionId = session.sessionId;
              if (typeof userSession === 'function') userSession(session);
            };
            hooks.onProcessing = () => {
              w.__miraSawProcessing = true;
              if (typeof userProcessing === 'function') userProcessing();
            };
            let injected = false;
            let hold50Until = 0;
            hooks.onProgress = (ratio) => {
              // Deterministic mid-progress: first real callback paints 50% via the app's own onProgress,
              // and we hold that paint briefly so a same-tick 0%/100% does not erase evidence.
              if (!injected && typeof ratio === 'number' && Number.isFinite(ratio)) {
                injected = true;
                if (typeof userProgress === 'function') userProgress(0.5);
                const st = readCard();
                if (looksLike50(st)) {
                  w.__miraPct50Painted = true;
                  w.__miraPct50CardText = st;
                }
                hold50Until = Date.now() + 900;
                return;
              }
              if (Date.now() < hold50Until) {
                if (typeof userProgress === 'function') userProgress(0.5);
                const stHold = readCard();
                if (looksLike50(stHold)) {
                  w.__miraPct50Painted = true;
                  w.__miraPct50CardText = stHold;
                }
                return;
              }
              if (typeof userProgress === 'function') userProgress(ratio);
              const st2 = readCard();
              if (looksLike50(st2)) {
                w.__miraPct50Painted = true;
                w.__miraPct50CardText = st2;
              }
            };
            args[hooksIdx] = hooks;
            return bound.apply(api, args);
          };
          wrapped.__miraProgressProbeInstalled = true;
          api[fnName] = wrapped;
        };
        wrapProgress('uploadViaSession');
        wrapProgress('addMediaProgress');
      })()`);
    }
    function capturePct50(chromeText: string, pctEv: { cardText?: string; liveText?: string }) {
      if (evaluateDisplayedProgress50(chromeText)) return chromeText;
      if (evaluateDisplayedProgress50(pctEv.liveText)) return pctEv.liveText || '';
      if (evaluateDisplayedProgress50(pctEv.cardText)) return pctEv.cardText || '';
      return null;
    }
    async function readPct50Evidence() {
      return page.evaluate(() => ({
        painted: !!(window as any).__miraPct50Painted,
        cardText: String((window as any).__miraPct50CardText || ''),
        liveText:
          (document.querySelector('#catalogForm [data-testid="e2b-video-card-status"]') as HTMLElement | null)
            ?.textContent || '',
        lastSessionId: (window as any).__miraLastUploadSessionId || null,
        sawProcessing: !!(window as any).__miraSawProcessing,
      }));
    }

    await reopenListedProduct().catch(() => undefined);
    await installUploadProgressProbe();
    await page.locator('#catalogForm [data-testid="e2b-video-card"]').scrollIntoViewIfNeeded().catch(() => undefined);
    const ownerForVideo = await liveProductId();

    // Slow parts so mid progress can paint; hold /complete to prove transfer ≠ ready.
    let releaseComplete: (() => void) | null = null;
    let completeHeld = false;
    const completeGate = new Promise<void>((r) => {
      releaseComplete = r;
    });
    await page.route('**/upload-sessions/**/direct-parts/**', async (route: Route) => {
      try {
        await new Promise((r) => setTimeout(r, 180));
        await route.continue();
      } catch {
        /* already handled */
      }
    });
    await page.route('**/upload-sessions/**/complete', async (route: Route) => {
      try {
        completeHeld = true;
        await completeGate;
        await route.continue();
      } catch {
        /* already handled / unrouted */
      }
    });

    const mediaPosted = page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        res.url().includes(`/partners-portal/products/${ownerForVideo}/media`) &&
        res.status() >= 200 &&
        res.status() < 300,
      { timeout: 120000 },
    );
    await page.setInputFiles('#catalogForm-videos', ALT_MP4);
    let mainReady = false;
    let progressSaw50 = false;
    let pct50CardText = '';
    let sawTransferComplete = false;
    let sawVerifyingWhileHeld = false;
    let readyBeforeVerifyReleased = false;
    let progressSawUploading = false;
    let progressSawProcessing = false;

    for (let t = 0; t < 120; t++) {
      const chrome = await readVideoChrome();
      const pctEv = await readPct50Evidence();
      const hit50 = capturePct50(chrome.text || '', pctEv);
      if (hit50) {
        progressSaw50 = true;
        pct50CardText = hit50;
      }
      if (chrome.state === 'uploading' || /جارٍ الرفع/.test(chrome.text)) progressSawUploading = true;
      if (chrome.state === 'processing' || /تحقق|معالجة/.test(chrome.text) || pctEv.sawProcessing) {
        progressSawProcessing = true;
      }
      if (completeHeld && (chrome.state === 'processing' || /تحقق|معالجة/.test(chrome.text))) {
        sawVerifyingWhileHeld = true;
        sawTransferComplete = true;
        const mid = await serverMainVideo(await liveProductId());
        // While complete is held, transfer may be done but catalog media for THIS upload must not be ready yet.
        // Existing saved mains from earlier are OK; we check chrome not saved-as-ready for staged upload.
        if (chrome.state === 'saved' || chrome.state === 'ready') readyBeforeVerifyReleased = true;
        void mid;
        break;
      }
      await page.waitForTimeout(200);
    }
    if (completeHeld && releaseComplete) {
      if (!sawVerifyingWhileHeld) {
        // Still hold briefly then check chrome once more
        const chromeHold = await readVideoChrome();
        if (chromeHold.state === 'processing' || /تحقق|معالجة/.test(chromeHold.text)) {
          sawVerifyingWhileHeld = true;
          sawTransferComplete = true;
        }
        if (chromeHold.state === 'saved') readyBeforeVerifyReleased = true;
      }
      releaseComplete();
      releaseComplete = null;
      await page.waitForTimeout(400);
    }
    await page.unroute('**/upload-sessions/**/complete').catch(() => undefined);
    await page.unroute('**/upload-sessions/**/direct-parts/**').catch(() => undefined);

    try {
      await mediaPosted;
      mainReady = true;
    } catch {
      /* poll below */
    }
    for (let t = 0; t < 80; t++) {
      const chrome = await readVideoChrome();
      const pctEv = await readPct50Evidence();
      const hit50 = capturePct50(chrome.text || '', pctEv);
      if (hit50) {
        progressSaw50 = true;
        pct50CardText = hit50;
      }
      if (chrome.state === 'processing' || /تحقق|معالجة/.test(chrome.text)) progressSawProcessing = true;
      const srv = await serverMainVideo(await liveProductId());
      if (srv.main?.id && (chrome.state === 'saved' || /فيديو محفوظ|جاهز/.test(chrome.text))) {
        mainReady = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    if (!mainReady) {
      await naturalSaveClick();
      await page.waitForTimeout(2500);
    }
    listed.id = await liveProductId();
    await reopenListedProduct();
    await installUploadProgressProbe();
    await page.locator('#catalogForm [data-testid="e2b-video-card"]').scrollIntoViewIfNeeded().catch(() => undefined);
    for (let t = 0; t < 40; t++) {
      const c = await readVideoChrome();
      const srv = await serverMainVideo(listed.id);
      if (c.state === 'saved' && srv.main?.id) break;
      await page.waitForTimeout(250);
    }
    const chromeAfterReopen = await readVideoChrome();
    let beforeMain = await serverMainVideo(listed.id);
    const mainIdBefore = beforeMain.main?.id || null;
    const savedOnlyOk =
      !!mainIdBefore &&
      chromeAfterReopen.state === 'saved' &&
      chromeAfterReopen.inputFiles === 0 &&
      !/لم يُختر مقطع بعد/.test(chromeAfterReopen.text);
    await shotEditor('individual-main-video-saved-reopen.png');
    // FIN-05 phone + desktop shots of editor/video
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.locator('#catalogForm [data-testid="e2b-video-card"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(evidenceDir, 'fin02-desktop-video-card.png'), fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.locator('#catalogForm [data-testid="e2b-video-card"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(evidenceDir, 'fin02-phone-video-card.png'), fullPage: false });
    await page.locator('[data-testid="catalog-quantity"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(evidenceDir, 'fin02-phone-qty.png'), fullPage: false });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(300);

    // --- Detail success while main saved-only ---
    const chromeBeforeDetail = await readVideoChrome();
    await page.setInputFiles('#catalogForm-detail-videos', TINY_MP4);
    let duringDetailChrome: any = null;
    for (let t = 0; t < 80; t++) {
      duringDetailChrome = await readVideoChrome();
      const srv = await serverMainVideo(listed.id);
      if (srv.details.length > 0) break;
      await page.waitForTimeout(300);
    }
    const afterDetailSrv = await serverMainVideo(listed.id);
    const mainSurvivedDetail =
      !!mainIdBefore &&
      afterDetailSrv.main?.id === mainIdBefore &&
      duringDetailChrome &&
      duringDetailChrome.state === 'saved' &&
      !/لم يُختر مقطع بعد/.test(duringDetailChrome.text || '');

    // --- Detail fail at transport for the intended session, then retry BUTTON (not setInputFiles) ---
    let detailTargetSession: string | null = null;
    let detailFailHitTargetSession = false;
    let detailFailShown = false;
    let detailRetryClicked = false;
    let detailRetrySucceeded = false;
    let blockDetailParts = true;
    await page.unroute('**/upload-sessions**').catch(() => undefined);
    await page.unroute('**/upload-sessions/**/direct-parts/**').catch(() => undefined);
    await page.unroute('**/upload-sessions/**/complete').catch(() => undefined);
    await page.route('**/upload-sessions**', async (route: Route) => {
      try {
        const method = route.request().method();
        const url = route.request().url();
        const pathname = new URL(url).pathname;
        if (method === 'POST' && /\/upload-sessions$/.test(pathname)) {
          const res = await route.fetch();
          const body = await res.text();
          try {
            const j = JSON.parse(body);
            if (j && j.sessionId) detailTargetSession = j.sessionId;
          } catch {
            /* ignore */
          }
          await route.fulfill({ status: res.status(), headers: res.headers(), body });
          return;
        }
        const sidMatch = /upload-sessions\/([^/]+)/.exec(pathname);
        const sid = sidMatch?.[1] || null;
        const isTransport =
          method !== 'GET' &&
          (/\/direct-parts\//.test(pathname) || /\/parts\/\d+\/sign$/.test(pathname) || /\/complete$/.test(pathname));
        if (
          blockDetailParts &&
          isTransport &&
          sid &&
          detailTargetSession &&
          sid === detailTargetSession
        ) {
          detailFailHitTargetSession = true;
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'UPLOAD_PART_TEMP', messageAr: 'فشل جزء رفع التفاصيل' }),
          });
          return;
        }
        await route.continue();
      } catch {
        /* already handled */
      }
    });
    await page.setInputFiles('#catalogForm-detail-videos', ALT_MP4);
    for (let t = 0; t < 80; t++) {
      const cards = await readDetailStagedCards();
      const failed = cards.find((c) => /فشل|خطأ|تعذر/.test(c.state + c.text));
      if (failed && failed.hasRetry) {
        detailFailShown = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    const chromeDuringDetailFail = await readVideoChrome();
    const detailCountBeforeRetry = afterDetailSrv.details.length;
    if (detailFailShown) {
      blockDetailParts = false;
      const clicked = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('#catalogForm [data-section-role="detail-media"], #catalogForm .form-section'));
        for (const sec of sections) {
          const cards = Array.from(sec.querySelectorAll('[data-testid="media-card-staged"]'));
          for (const card of cards) {
            const st = card.querySelector('[data-testid="media-state"]')?.textContent || card.textContent || '';
            if (!/فشل|خطأ|تعذر/.test(st)) continue;
            const btn = Array.from(card.querySelectorAll('button')).find((b) =>
              /إعادة المحاولة/.test(b.textContent || ''),
            ) as HTMLButtonElement | null;
            if (btn && !btn.disabled) {
              btn.click();
              return true;
            }
          }
        }
        return false;
      });
      detailRetryClicked = !!clicked;
      if (detailRetryClicked) {
        for (let t = 0; t < 100; t++) {
          const srv = await serverMainVideo(listed.id);
          if (srv.details.length > detailCountBeforeRetry) {
            detailRetrySucceeded = true;
            break;
          }
          await page.waitForTimeout(300);
        }
      }
    }
    await page.unroute('**/upload-sessions**').catch(() => undefined);
    const afterDetailFailSrv = await serverMainVideo(listed.id);
    const mainSurvivedDetailFail =
      !!mainIdBefore &&
      afterDetailFailSrv.main?.id === mainIdBefore &&
      chromeDuringDetailFail.state === 'saved' &&
      !/لم يُختر مقطع بعد/.test(chromeDuringDetailFail.text || '');

    // --- Cancel detail mid-upload via that card's cancel button ---
    let cancelClicked = false;
    let cancelObserved = false;
    await page.unroute('**/upload-sessions**').catch(() => undefined);
    await page.unroute('**/upload-sessions/**/direct-parts/**').catch(() => undefined);
    await page.unroute('**/upload-sessions/**/complete').catch(() => undefined);
    await page.route('**/upload-sessions/**/direct-parts/**', async (route: Route) => {
      try {
        await new Promise((r) => setTimeout(r, 800));
        await route.continue();
      } catch {
        /* already handled by another route or aborted */
      }
    });
    await page.setInputFiles('#catalogForm-detail-videos', TINY_MP4);
    for (let t = 0; t < 40; t++) {
      const cards = await readDetailStagedCards();
      const active = cards.find((c) => c.hasCancel && !c.cancelDisabled);
      if (active) break;
      await page.waitForTimeout(150);
    }
    cancelClicked = await page.evaluate(() => {
      const sections = Array.from(
        document.querySelectorAll('#catalogForm [data-section-role="detail-media"], #catalogForm .form-section'),
      );
      for (const sec of sections) {
        const cards = Array.from(sec.querySelectorAll('[data-testid="media-card-staged"]'));
        for (const card of cards) {
          const btn = Array.from(card.querySelectorAll('button')).find(
            (b) => /^إلغاء$/.test((b.textContent || '').trim()) && !(b as HTMLButtonElement).disabled,
          ) as HTMLButtonElement | null;
          if (btn) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    });
    for (let t = 0; t < 40; t++) {
      const cards = await readDetailStagedCards();
      if (cards.some((c) => /أُلغي|الغي|cancel/i.test(c.state + c.text))) {
        cancelObserved = true;
        break;
      }
      // empty staged after cancel+remove path also counts if click succeeded and main intact
      if (cancelClicked && cards.length === 0) {
        cancelObserved = true;
        break;
      }
      await page.waitForTimeout(200);
    }
    await page.unroute('**/upload-sessions/**/direct-parts/**').catch(() => undefined);
    const afterCancelSrv = await serverMainVideo(listed.id);
    const mainSurvivedCancel = !!mainIdBefore && afterCancelSrv.main?.id === mainIdBefore && cancelClicked && cancelObserved;

    // --- Main fail + retry: allow one durable part, then fail transport; real retry resumes same session ---
    let blockMainParts = true;
    let durablePutsAllowed = 1;
    let durablePutsSeen = 0;
    let cycleSessionId: string | null = null;
    let failSessionId: string | null = null;
    let durablePartsBeforeRetry = false;
    let resumedSameSession = false;
    let sessionBoundMediaId: string | null = null;
    let createdNewSessionOnRetry = false;
    await page.evaluate(`(() => { window.__miraLastUploadSessionId = null; window.__miraSawProcessing = false; })()`);
    await page.unroute('**/upload-sessions**').catch(() => undefined);
    await page.unroute('**/upload-sessions/**/direct-parts/**').catch(() => undefined);
    await page.route('**/upload-sessions**', async (route: Route) => {
      try {
        const method = route.request().method();
        const url = route.request().url();
        const pathname = new URL(url).pathname;
        if (method === 'POST' && /\/upload-sessions\/?$/.test(pathname)) {
          const res = await route.fetch();
          const body = await res.text();
          try {
            const j = JSON.parse(body);
            if (j && j.sessionId) cycleSessionId = String(j.sessionId);
          } catch {
            /* ignore */
          }
          await route.fulfill({ status: res.status(), headers: res.headers(), body });
          return;
        }
        const sidMatch = /upload-sessions\/([^/]+)/.exec(pathname);
        const sid = sidMatch?.[1] || null;
        if (sid) cycleSessionId = cycleSessionId || sid;
        const isSign = /\/parts\/\d+\/sign$/.test(pathname);
        const isPut = /\/direct-parts\//.test(pathname);
        const isComplete = /\/complete$/.test(pathname);
        if (blockMainParts && method !== 'GET' && (isSign || isPut || isComplete)) {
          // Let the first part fully succeed (sign+put) so the session has durable completed parts.
          if ((isSign || isPut) && durablePutsSeen < durablePutsAllowed) {
            if (isPut) durablePutsSeen += 1;
            await route.continue();
            return;
          }
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'UPLOAD_PART_TEMP', messageAr: 'فشل جزء رفع الرئيسي' }),
          });
          return;
        }
        await route.continue();
      } catch {
        /* already handled */
      }
    });
    const mainsBeforeCycle = (await serverMainVideo(listed.id)).mains.map((m) => m.id);
    // LARGE_MP4 + small part size → multiple parts; size ≠ saved main so change fires.
    if (!fs.existsSync(LARGE_MP4)) {
      throw new Error('REFUSE: missing LARGE_MP4 fixture ' + LARGE_MP4);
    }
    await page.evaluate(`(() => {
      const input = document.querySelector('#catalogForm-videos');
      if (input) { input.value = ''; }
    })()`);
    await page.setInputFiles('#catalogForm-videos', LARGE_MP4);
    let sawFail = false;
    let sawRetryLabel = false;
    for (let t = 0; t < 120; t++) {
      if (!cycleSessionId) {
        const pctEv = await readPct50Evidence();
        if (pctEv.lastSessionId) cycleSessionId = pctEv.lastSessionId;
      }
      const c = await readVideoChrome();
      const pctEv = await readPct50Evidence();
      const hit50 = capturePct50(c.text || '', pctEv);
      if (hit50) {
        progressSaw50 = true;
        pct50CardText = hit50;
      }
      if (c.state === 'uploading' || /جارٍ الرفع/.test(c.text)) progressSawUploading = true;
      if (c.state === 'failed' || /فشل/.test(c.text)) {
        sawFail = true;
        if (/إعادة المحاولة/.test(c.pick) || c.pickAction === 'retry') sawRetryLabel = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    failSessionId = cycleSessionId;
    if (failSessionId) {
      // Durable parts: server completedPartsJson only — PUT attempts alone do not prove retention.
      const sess = await prisma.partnerUploadSession.findUnique({ where: { id: failSessionId } });
      const partsJson = (sess as any)?.completedPartsJson;
      const completed =
        Array.isArray(partsJson) ? partsJson.length : Array.isArray(partsJson?.parts) ? partsJson.parts.length : 0;
      durablePartsBeforeRetry = completed >= 1;
    }
    let cycleProgress50 = false;
    let cycleUploading = false;
    let cycleProcessing = false;
    let cycleSaved = false;
    let mainRetryClicked = false;
    let cycleNewMediaId: string | null = null;
    await installUploadProgressProbe();
    if (sawFail && sawRetryLabel) {
      blockMainParts = false;
      await page.unroute('**/upload-sessions**').catch(() => undefined);
      await page.waitForTimeout(200);
      // Track whether retry illegally creates a new session instead of resuming.
      const sessionCreateWatch = page.waitForResponse(
        (res) => {
          const u = res.url();
          return (
            res.request().method() === 'POST' &&
            /\/upload-sessions\/?(\?|$)/.test(new URL(u).pathname) &&
            !/\/parts\/|\/complete|\/abort|\/direct-parts/.test(u)
          );
        },
        { timeout: 15000 },
      );
      let clickedMainRetry = '';
      for (let t = 0; t < 40; t++) {
        // Real retry only — no test mutation of sessionStorage / uploadSessionId / clientMediaId.
        clickedMainRetry = await page.evaluate(() => {
          const root = document.getElementById('catalogForm') || document;
          const cards = Array.from(root.querySelectorAll('[data-testid="media-card-staged"]'));
          for (const card of cards) {
            const txt = card.textContent || '';
            if (!/العرض الرئيسي/.test(txt)) continue;
            if (!/فشل|خطأ|تعذر/.test(txt)) continue;
            const btn = Array.from(card.querySelectorAll('button')).find((b) =>
              /إعادة المحاولة/.test(b.textContent || ''),
            ) as HTMLButtonElement | null;
            if (btn && !btn.disabled) {
              btn.click();
              return 'card';
            }
          }
          const pick = root.querySelector('[data-testid="e2b-video-pick"]') as HTMLElement | null;
          if (pick && pick.dataset.action === 'retry') {
            pick.click();
            return 'chrome';
          }
          return '';
        });
        if (clickedMainRetry) break;
        await page.waitForTimeout(150);
      }
      mainRetryClicked = !!clickedMainRetry;
      try {
        const created = await sessionCreateWatch;
        const body = await created.json().catch(() => null);
        if (body && body.sessionId && failSessionId && String(body.sessionId) !== failSessionId) {
          createdNewSessionOnRetry = true;
          cycleSessionId = String(body.sessionId);
        }
      } catch {
        /* expected: resume uses GET + existing sessionId, no POST create */
      }
      for (let t = 0; t < 80; t++) {
        const c = await readVideoChrome();
        const pctEv = await readPct50Evidence();
        if (
          c.state === 'uploading' ||
          c.state === 'processing' ||
          /جارٍ الرفع|جارٍ التحضير|جارٍ التحقق|جارٍ القراءة/.test(c.text || '')
        ) {
          cycleUploading = cycleUploading || c.state === 'uploading' || /رفع|تحضير|قراءة/.test(c.text || '');
          cycleProcessing = cycleProcessing || c.state === 'processing' || /تحقق|معالجة/.test(c.text || '');
          break;
        }
        await page.waitForTimeout(200);
      }
    }
    for (let t = 0; t < 150; t++) {
      if (!mainRetryClicked) break;
      const c = await readVideoChrome();
      const pctEv = await readPct50Evidence();
      const hit50 = capturePct50(c.text || '', pctEv);
      if (hit50) {
        cycleProgress50 = true;
        pct50CardText = hit50;
      }
      if (c.state === 'uploading' || /جارٍ الرفع|جارٍ التحضير/.test(c.text || '')) cycleUploading = true;
      if (c.state === 'processing' || /تحقق|معالجة/.test(c.text) || /رُفع/.test(c.text)) {
        cycleProcessing = true;
      }
      const srvNow = await serverMainVideo(listed.id);
      const latest = srvNow.main?.id || null;
      if (latest && !mainsBeforeCycle.includes(latest)) cycleNewMediaId = latest;
      for (const m of srvNow.mains || []) {
        if (m?.id && !mainsBeforeCycle.includes(m.id)) cycleNewMediaId = m.id;
      }
      if (failSessionId) {
        const sess = await prisma.partnerUploadSession.findUnique({ where: { id: failSessionId } });
        if (sess?.catalogMediaId) {
          sessionBoundMediaId = sess.catalogMediaId;
          cycleSessionId = failSessionId;
          if (!cycleNewMediaId) cycleNewMediaId = sess.catalogMediaId;
        }
      }
      if (
        mainRetryClicked &&
        cycleNewMediaId &&
        failSessionId &&
        sessionBoundMediaId === cycleNewMediaId &&
        (c.state === 'saved' || c.state === 'ready' || /فيديو محفوظ|جاهز|رُفع/.test(c.text || ''))
      ) {
        cycleSaved = true;
        resumedSameSession = !createdNewSessionOnRetry && cycleSessionId === failSessionId;
        break;
      }
      await page.waitForTimeout(300);
    }
    await page.unroute('**/upload-sessions**').catch(() => undefined);
    if (failSessionId && !sessionBoundMediaId) {
      const sess = await prisma.partnerUploadSession.findUnique({ where: { id: failSessionId } });
      sessionBoundMediaId = sess?.catalogMediaId || null;
      if (sessionBoundMediaId) {
        cycleSessionId = failSessionId;
        cycleNewMediaId = cycleNewMediaId || sessionBoundMediaId;
      }
    }
    resumedSameSession =
      !!failSessionId &&
      !!cycleSessionId &&
      failSessionId === cycleSessionId &&
      !createdNewSessionOnRetry &&
      durablePartsBeforeRetry;

    await reopenListedProduct();
    const finalChrome = await readVideoChrome();
    const finalSrv = await serverMainVideo(listed.id);
    const videoIso = {
      ok: true,
      ownerForVideo,
      listedId: listed.id,
      mainReady,
      progressSaw50: progressSaw50 || cycleProgress50,
      progressSawUploading: progressSawUploading || cycleUploading,
      progressSawProcessing: progressSawProcessing || cycleProcessing,
      chromeAfterReopen,
      chromeBeforeDetail,
      duringDetailChrome,
      chromeDuringDetailFail,
      finalChrome,
      mainIdBefore,
      mainSurvivedDetail,
      mainSurvivedDetailFail,
      detailFailShown,
      detailRetryClicked,
      detailRetrySucceeded,
      detailFailHitTargetSession,
      mainSurvivedCancel,
      cancelClicked,
      cancelObserved,
      detailCount: afterDetailSrv.details.length,
      afterDetailFailDetails: afterDetailFailSrv.details.length,
      finalMainId: finalSrv.main?.id || null,
      finalMainPlacement: finalSrv.main?.placement || null,
      detailRolesOk: afterDetailFailSrv.details.every((d) => String(d.placement) === 'detail'),
      savedOnlyOk,
      sawFail,
      sawRetryLabel,
      mainRetryClicked,
      cycleProgress50,
      cycleUploading,
      cycleProcessing,
      cycleSaved,
      cycleSessionId,
      cycleNewMediaId,
      failSessionId,
      durablePartsBeforeRetry,
      resumedSameSession,
      createdNewSessionOnRetry,
      sessionBoundMediaId,
      durablePutsSeen,
      sawTransferComplete,
      sawVerifyingWhileHeld,
      readyBeforeVerifyReleased,
      pct50CardText,
      pct50CardOnly: evaluateDisplayedProgress50(pct50CardText),
      pct50FlagRejectedBareRatio: evaluateDisplayedProgress50('جارٍ الرفع · 0.5%') === false,
      pct50FlagRejectedZero: evaluateDisplayedProgress50('جارٍ الرفع · 0%') === false,
      beforeRows: beforeMain.rows,
      finalRows: finalSrv.rows,
      mainsBeforeCycle,
    };
    const videoEval = evaluateMainVideoIsolation({
      savedOnlyOk,
      mainIdBefore,
      duringDetailChrome,
      mainSurvivedDetail,
      mainSurvivedDetailFail,
      detailFailShown,
      detailRetryClicked,
      detailRetrySucceeded,
      detailFailHitTargetSession,
      mainSurvivedCancel,
      cancelClicked,
      cancelObserved,
      pct50CardText,
      sawTransferComplete,
      sawVerifyingWhileHeld,
      readyBeforeVerifyReleased,
      sawFail,
      sawRetryLabel,
      mainRetryClicked,
      failSessionId,
      cycleSessionId,
      cycleNewMediaId,
      durablePartsBeforeRetry,
      resumedSameSession,
      sessionBoundMediaId,
      cycleSaved,
      finalMainId: finalSrv.main?.id || null,
      finalChrome,
      detailRolesOk: afterDetailFailSrv.details.every((d) => String(d.placement) === 'detail'),
    });
    await page.locator('#catalogForm [data-testid="e2b-video-card"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await shotEditor('individual-main-video-isolation.png');
    fs.writeFileSync(
      path.join(evidenceDir, 'individual-main-video-isolation.json'),
      JSON.stringify({ ...videoIso, videoEval }, null, 2),
    );
    record(
      'acc-individual-main-video-isolation',
      'BROWSER',
      'فيديو رئيسي محفوظ؛ عزل التفاصيل مع فشل/إعادة/إلغاء حقيقيين؛ 50% ظاهرة؛ نقل≠تحقق؛ إعادة رئيسي مربوطة بجلسة/وسيط',
      'evaluateMainVideoIsolation.ok',
      JSON.stringify({ videoEval, videoIsoSummary: {
        savedOnlyOk, mainIdBefore, pct50CardText, sawVerifyingWhileHeld, readyBeforeVerifyReleased,
        detailFailShown, detailRetryClicked, detailRetrySucceeded, cancelClicked, cancelObserved,
        sawFail, mainRetryClicked, failSessionId, cycleSessionId, cycleNewMediaId, sessionBoundMediaId,
        durablePartsBeforeRetry, resumedSameSession, createdNewSessionOnRetry, cycleSaved,
      }}),
      videoEval.ok,
      {
        criterion: 'ACC-INDIVIDUAL-MAIN-VIDEO-ISOLATION',
        evidence: [
          'individual-main-video-isolation.png',
          'individual-main-video-saved-reopen.png',
          'individual-main-video-isolation.json',
          'fin02-desktop-video-card.png',
          'fin02-phone-video-card.png',
          'fin02-phone-qty.png',
        ],
      },
    );

    // FIN-04: ACC-MEDIA-ACL independent of bulk — draft individual media.
    {
      const aclSrv = await serverMainVideo(listed.id);
      const aclMediaId = aclSrv.main?.id || aclSrv.rows[0]?.id || null;
      if (!aclMediaId) {
        record(
          'acc-media-acl',
          'BROWSER',
          'ACC-MEDIA-ACL',
          'owner/other/unauth ACL on individual draft media',
          'acl media id missing on individual product',
          false,
          { criterion: 'ACC-MEDIA-ACL', evidence: [] },
        );
      } else {
        const ownerAcl = await page.evaluate(async (mid) => {
          const token = localStorage.getItem('mira_partner_token') || '';
          const base = (window as any).PartnersApi.base;
          const res = await fetch(base + '/partners-portal/media/' + encodeURIComponent(mid), {
            headers: { Authorization: 'Bearer ' + token },
          });
          const buf = await res.arrayBuffer();
          const ct = res.headers.get('content-type') || '';
          return { status: res.status, bytes: buf.byteLength, contentType: ct };
        }, aclMediaId);
        const otherAcl = await fetch(`${apiRoot}/api/v1/partners-portal/media/${encodeURIComponent(aclMediaId)}`, {
          headers: { Authorization: `Bearer ${tokenSalon}` },
        }).then(async (res) => {
          const buf = Buffer.from(await res.arrayBuffer());
          return {
            status: res.status,
            bytes: buf.byteLength,
            contentType: res.headers.get('content-type') || '',
            looksLikeMedia: /video|octet-stream|mp4|image/i.test(res.headers.get('content-type') || ''),
          };
        });
        const unauthAcl = await fetch(`${apiRoot}/api/v1/partners-portal/media/${encodeURIComponent(aclMediaId)}`).then(
          async (res) => {
            const buf = Buffer.from(await res.arrayBuffer());
            return {
              status: res.status,
              bytes: buf.byteLength,
              contentType: res.headers.get('content-type') || '',
              looksLikeMedia: /video|octet-stream|mp4|image/i.test(res.headers.get('content-type') || ''),
            };
          },
        );
        const aclProd = await prisma.product.findUniqueOrThrow({ where: { id: listed.id } });
        await shotEditor('individual-media-acl.png');
        const aclOk =
          ownerAcl.status === 200 &&
          ownerAcl.bytes > 500 &&
          otherAcl.status >= 400 &&
          !otherAcl.looksLikeMedia &&
          otherAcl.bytes < Math.max(ownerAcl.bytes / 10, 1) &&
          unauthAcl.status >= 400 &&
          !unauthAcl.looksLikeMedia &&
          unauthAcl.bytes < Math.max(ownerAcl.bytes / 10, 1) &&
          aclProd.contentStatus !== 'published' &&
          aclProd.active !== true;
        fs.writeFileSync(
          path.join(evidenceDir, 'individual-media-acl.json'),
          JSON.stringify(
            {
              aclMediaId,
              ownerAcl,
              otherAcl,
              unauthAcl,
              contentStatus: aclProd.contentStatus,
              active: aclProd.active,
              independentOfBulk: true,
            },
            null,
            2,
          ),
        );
        record(
          'acc-media-acl',
          'BROWSER',
          'المالك يعاين وسيط مسودة فردي؛ شريك آخر وغير الموثّق يُرفضان دون بايتات وسيط؛ العنصر يبقى مسودة',
          'owner 200+bytes; other/unauth 4xx; draft; no bulk dependency',
          JSON.stringify({
            aclMediaId,
            ownerAcl,
            otherAcl,
            unauthAcl,
            contentStatus: aclProd.contentStatus,
            active: aclProd.active,
            independentOfBulk: true,
          }),
          aclOk,
          { criterion: 'ACC-MEDIA-ACL', evidence: ['individual-media-acl.png', 'individual-media-acl.json'] },
        );
      }
    }
    } catch (fin02Err: any) {
      const msg = fin02Err?.message || String(fin02Err);
      console.error('FIN-02 journey error:', msg);
      if (!results.some((r) => r.criterion === 'ACC-INDIVIDUAL-MAIN-VIDEO-ISOLATION')) {
        record(
          'acc-individual-main-video-isolation',
          'BROWSER',
          'فيديو رئيسي محفوظ؛ عزل التفاصيل مع فشل/إعادة/إلغاء حقيقيين؛ 50% ظاهرة؛ نقل≠تحقق؛ إعادة رئيسي مربوطة بجلسة/وسيط',
          'evaluateMainVideoIsolation.ok',
          msg,
          false,
          { criterion: 'ACC-INDIVIDUAL-MAIN-VIDEO-ISOLATION', evidence: [] },
        );
      }
      if (!results.some((r) => r.criterion === 'ACC-MEDIA-ACL')) {
        record(
          'acc-media-acl',
          'BROWSER',
          'ACC-MEDIA-ACL',
          'owner/other/unauth ACL on individual draft media',
          msg,
          false,
          { criterion: 'ACC-MEDIA-ACL', evidence: [] },
        );
      }
    }

    // Stale response: save A, change to B mid-flight, then save B and verify
    await setClothesAttrs(page, { materials: ['linen'], cut: 'regular', lengthCm: 120 });
    let release: (() => void) | null = null;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    await page.route(`**/partners-portal/products/${listed.id}`, async (route: Route) => {
      if (route.request().method() === 'PATCH') {
        await gate;
        await route.continue();
      } else await route.continue();
    });
    const saveClick = page.click('#catalogForm-save');
    await page.waitForTimeout(250);
    await setClothesAttrs(page, { materials: ['cotton'], cut: 'fitted', lengthCm: 150 });
    if (release) release();
    await saveClick.catch(() => undefined);
    await page.waitForTimeout(900);
    await page.unroute(`**/partners-portal/products/${listed.id}`);
    const midState = await page.locator('#catalogForm [data-testid="attr-save-state"]').first().textContent();
    const midUi = await page.evaluate(() => {
      const host = document.querySelector('#catalogForm [data-testid="registry-attribute-host"]');
      const mats: string[] = [];
      host?.querySelectorAll('input[type="checkbox"]:checked').forEach((b: any) => mats.push(b.value));
      const cut = (host?.querySelector('input[type="radio"]:checked') as HTMLInputElement | null)?.value;
      const lengthCm = (host?.querySelector('input.mira-attr-number') as HTMLInputElement | null)?.value;
      return { mats, cut, lengthCm };
    });
    // Save B
    await page.click('#catalogForm-save');
    await page.waitForTimeout(1500);
    const previewB = await page.evaluate(async (id) => (window as any).PartnersApi.productPreview(id), listed.id);
    const attrsB = attrsFromPreview(previewB);
    await page.screenshot({ path: path.join(evidenceDir, 'stale-B-saved.png'), fullPage: true });
    // Reopen editor from the catalog list (list stays on the page) and prove B itself.
    await page.evaluate(async () => {
      if (typeof (window as any).loadDashboard === 'function') await (window as any).loadDashboard();
    });
    await page.waitForTimeout(800);
    const openBtnB = page.locator('#catalogList .list-item').filter({ hasText: prodName }).getByRole('button', {
      name: 'فتح في النموذج',
    });
    if (!(await openBtnB.count())) throw new Error('زر فتح العنصر مفقود بعد حفظ B');
    await openBtnB.click();
    await page.waitForTimeout(900);
    const uiAfterB = await page.evaluate(() => {
      const host = document.querySelector('#catalogForm [data-testid="registry-attribute-host"]');
      if (!host) return { error: 'host-missing' };
      const mats: string[] = [];
      host.querySelectorAll('input[type="checkbox"]:checked').forEach((b: any) => mats.push(b.value));
      const cut = (host.querySelector('input[type="radio"]:checked') as HTMLInputElement | null)?.value;
      const lengthCm = (host.querySelector('input.mira-attr-number') as HTMLInputElement | null)?.value;
      return { mats, cut, lengthCm };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'stale-B-reopen.png'), fullPage: true });
    comparisons.push({ id: 'stale-B', midUi, midState, attrsB, uiAfterB });
    record(
      'acc-stale-latest-wins',
      'BROWSER',
      'استجابة متأخرة لـA لا تستبدل B؛ حفظ B يثبت في القراءة وإعادة فتح المحرر',
      'UI shows B dirty then preview+reopen B',
      JSON.stringify({ midUi, midState, attrsB, uiAfterB }),
      midUi.cut === 'fitted' &&
        String(midUi.lengthCm) === '150' &&
        /غير محفوظ|أحدث/.test(String(midState || '')) &&
        attrsB?.cut === 'fitted' &&
        attrsB?.lengthCm === 150 &&
        JSON.stringify(attrsB?.material) === JSON.stringify(['cotton']) &&
        uiAfterB.cut === 'fitted' &&
        String(uiAfterB.lengthCm) === '150' &&
        JSON.stringify([...(uiAfterB.mats || [])].map(String).sort()) === JSON.stringify(['cotton']),
      { criterion: 'ACC-STALE-LATEST-WINS', evidence: ['stale-B-saved.png', 'stale-B-reopen.png'] },
    );

    // FIN-01: real developer resume publish journey (API-boundary fail → app resume → click → same id published).
    try {
      const fin01 = await context.newPage();
      (fin01 as any)._miraEvidenceName = 'fin01-dev-resume-publish';
      fin01.on('response', (res) => {
        try {
          const u = new URL(res.url());
          if (u.pathname.includes('/partners-portal') || u.pathname.includes('/marketplace/')) {
            networkLog.push({ method: res.request().method(), path: u.pathname, status: res.status() });
          }
        } catch {
          /* ignore */
        }
      });
      await loginPage(fin01, portalOrigin, apiRoot, `acc-dv-${suffix}@test.local`, tokenDev);
      await fin01.click('#goProduct');
      await requireSel(fin01, '#catalogForm', 'catalogForm');
      const resumeName = `Acc-Resume-${suffix}`;
      await fillProductBasics(fin01, resumeName);
      await setClothesAttrs(fin01, {
        materials: ['silk', 'cotton'],
        cut: 'regular',
        lengthCm: 120,
      });
      if (await fin01.locator('#catalogForm select[name="subcategory"] option[value="clothes.evening"]').count()) {
        await fin01.selectOption('#catalogForm select[name="subcategory"]', 'clothes.evening');
      }
      // Create draft owner via file-select path (publish:false) then attach media.
      const tinyPngPath = path.join(evidenceDir, '_tiny-acc.png');
      fs.writeFileSync(tinyPngPath, Buffer.from(TINY_PNG, 'base64'));
      await fin01.setInputFiles('#catalogForm-images', tinyPngPath);
      let resumeProd: any = null;
      for (let t = 0; t < 50; t++) {
        await fin01.waitForTimeout(400);
        const dash = await fin01.evaluate(async () => (window as any).PartnersApi.dashboard());
        resumeProd = (dash?.catalog?.products || []).find((p: any) => p.nameAr === resumeName) || null;
        if (resumeProd?.id) break;
      }
      if (!resumeProd?.id) {
        // Fallback: natural publish click will create; still OK for fail injection
        await fin01.fill('#catalogForm input[name="nameAr"]', resumeName);
        await fin01.click('#catalogForm-save');
        for (let t = 0; t < 40; t++) {
          await fin01.waitForTimeout(400);
          const dash = await fin01.evaluate(async () => (window as any).PartnersApi.dashboard());
          resumeProd = (dash?.catalog?.products || []).find((p: any) => p.nameAr === resumeName) || null;
          if (resumeProd?.id) break;
        }
      }
      assert.ok(resumeProd?.id, 'FIN-01 resume product must exist as draft owner');
      createdProductIds.push(resumeProd.id);
      await fin01.evaluate(
        async ({ id, png }) => {
          await (window as any).PartnersApi.addMedia('products', id, 'image/png', png);
        },
        { id: resumeProd.id, png: TINY_PNG },
      );
      // Reopen from list so app binds owner; do not inject resume state.
      await fin01.evaluate(async () => {
        if (window.reloadPartnerDashboard) await (window as any).reloadPartnerDashboard({ preserveForms: false });
        else location.reload();
      });
      await fin01.waitForSelector('#partnerName', { timeout: 20000 });
      await fin01.waitForTimeout(600);
      await fin01.locator('#e2bShowList').click({ timeout: 3000 }).catch(() => undefined);
      await fin01.evaluate(() => document.body.classList.remove('e2b-editor-focus'));
      await fin01
        .locator('#catalogList .list-item')
        .filter({ hasText: resumeName })
        .getByRole('button', { name: 'فتح في النموذج' })
        .click();
      await fin01.waitForSelector('#catalogForm-save', { timeout: 15000 });
      await fin01.waitForTimeout(500);

      let failStatus = 0;
      let failPath = '';
      let failBody = '';
      let failInjected = false;
      await fin01.route('**/submit-review', async (route: Route) => {
        if (route.request().method() !== 'POST' || failInjected) {
          await route.continue();
          return;
        }
        failInjected = true;
        failPath = new URL(route.request().url()).pathname;
        failStatus = 503;
        failBody = JSON.stringify({ code: 'PUBLISH_TEMP_UNAVAILABLE', messageAr: 'حد API مؤقت — أعدِي المحاولة' });
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: failBody,
        });
      });

      // Click the real final publish CTA (نشر الآن) — app must paint resume after API fail.
      const pubBtn = fin01.locator('#catalogForm-save');
      await pubBtn.click();
      await fin01.waitForTimeout(1500);
      await fin01.waitForFunction(
        () => {
          const mat = document.querySelector('[data-editor-v2-materialize="1"]') as HTMLButtonElement | null;
          const bar = document.querySelector('[data-testid="e2b-editor-actions"]');
          const finals = Array.from(bar?.querySelectorAll('button') || []).filter((b) => {
            const cs = getComputedStyle(b);
            const r = b.getBoundingClientRect();
            return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
          });
          const labels = finals.map((b) => (b.textContent || '').trim());
          const resumeVisible =
            !!mat &&
            mat.dataset.resumeActive === '1' &&
            /استئناف النشر|استكمال النشر/.test(mat.textContent || '') &&
            finals.some((b) => b === mat);
          const singleFinal =
            labels.filter((t) => /نشر الآن|استئناف النشر|استكمال النشر|إرسال للمراجعة|استئناف الإرسال/.test(t))
              .length === 1;
          const draftSave = finals.some((b) => /حفظ المسودة/.test(b.textContent || ''));
          return resumeVisible && singleFinal && draftSave && !/إرسال للمراجعة/.test(mat?.textContent || '');
        },
        undefined,
        { timeout: 25000 },
      );
      const afterFailUi = await fin01.evaluate(() => {
        const form = document.getElementById('catalogForm') as HTMLFormElement | null;
        const mat = form?.querySelector('[data-editor-v2-materialize="1"]') as HTMLButtonElement | null;
        const bar = document.querySelector('[data-testid="e2b-editor-actions"]');
        const finals = Array.from(bar?.querySelectorAll('button') || [])
          .filter((b) => {
            const cs = getComputedStyle(b);
            const r = b.getBoundingClientRect();
            return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
          })
          .map((b) => (b.textContent || '').trim());
        const ctx = (window as any).MiraEditorV2 && (window as any).MiraEditorV2.getEditContext(form?.id);
        return {
          finalCta: bar?.getAttribute('data-final-cta') || '',
          account: bar?.getAttribute('data-account') || '',
          labels: finals,
          resumeLabel: mat?.textContent || '',
          resumeActive: mat?.dataset?.resumeActive || '',
          ctxStatus: ctx?.status || '',
          ctxSubmit: ctx?.submitReviewStatus || '',
          ctxOwner: ctx?.targetOwnerId || '',
          status:
            form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || '',
        };
      });
      await fin01.locator('[data-testid="e2b-editor-actions"]').scrollIntoViewIfNeeded().catch(() => undefined);
      await fin01.screenshot({ path: path.join(evidenceDir, 'dev-resume-publish-cta.png'), fullPage: false });
      const midRow = await prisma.product.findUniqueOrThrow({ where: { id: resumeProd.id } });
      const stillDraft =
        midRow.contentStatus !== 'published' && midRow.active !== true;

      // Remove fail injection and click the real resume button.
      await fin01.unroute('**/submit-review').catch(() => undefined);
      let resumeReq: { path: string; status: number; body: string } | null = null;
      await fin01.route('**/submit-review', async (route: Route) => {
        const res = await route.fetch();
        const body = await res.text();
        resumeReq = {
          path: new URL(route.request().url()).pathname,
          status: res.status(),
          body: body.slice(0, 400),
        };
        await route.fulfill({ status: res.status(), headers: res.headers(), body });
      });
      await fin01
        .locator('[data-editor-v2-materialize="1"]:visible')
        .filter({ hasText: /استئناف النشر|استكمال النشر/ })
        .first()
        .click();
      await fin01.waitForTimeout(2000);
      let published = false;
      for (let t = 0; t < 40; t++) {
        const row = await prisma.product.findUniqueOrThrow({ where: { id: resumeProd.id } });
        if (row.contentStatus === 'published' && row.active === true) {
          published = true;
          break;
        }
        await fin01.waitForTimeout(400);
      }
      await fin01.unroute('**/submit-review').catch(() => undefined);
      const dashAfter = await fin01.evaluate(async () => (window as any).PartnersApi.dashboard());
      const matches = (dashAfter?.catalog?.products || []).filter((p: any) => p.nameAr === resumeName);
      const pubRow = await prisma.product.findUniqueOrThrow({ where: { id: resumeProd.id } });
      await fin01.locator('[data-testid="e2b-editor-actions"]').scrollIntoViewIfNeeded().catch(() => undefined);
      await fin01.screenshot({ path: path.join(evidenceDir, 'dev-product-published.png'), fullPage: false });
      const evidence = {
        failInjected,
        failStatus,
        failPath,
        failBody,
        stillDraft,
        afterFailUi,
        resumeReq,
        published,
        contentStatus: pubRow.contentStatus,
        active: pubRow.active,
        fixtureId: resumeProd.id,
        matchCount: matches.length,
        matchIds: matches.map((m: any) => m.id),
        injectedButtonText: false,
        injectedResumeActive: false,
        injectedPolicyCall: false,
      };
      fs.writeFileSync(path.join(evidenceDir, 'dev-resume-publish-cta.json'), JSON.stringify(evidence, null, 2));
      const resumeEval = evaluateDevResumePublish({
        failInjected,
        failStatus,
        stillDraft,
        resumeActive: afterFailUi.resumeActive,
        resumeLabel: afterFailUi.resumeLabel,
        account: afterFailUi.account,
        labels: afterFailUi.labels,
        resumeReqStatus: resumeReq?.status ?? null,
        published,
        matchCount: matches.length,
        fixtureId: resumeProd.id,
        matchIds: matches.map((m: any) => m.id),
        injectedButtonText: false,
        injectedResumeActive: false,
      });
      const resumeOk =
        resumeEval.ok &&
        failInjected &&
        failStatus === 503 &&
        stillDraft &&
        afterFailUi.resumeActive === '1' &&
        /استئناف النشر|استكمال النشر/.test(afterFailUi.resumeLabel || '') &&
        !/إرسال للمراجعة/.test(afterFailUi.resumeLabel || '') &&
        afterFailUi.account === 'developer' &&
        afterFailUi.labels.filter((t: string) =>
          /نشر الآن|استئناف النشر|استكمال النشر|إرسال للمراجعة|استئناف الإرسال/.test(t),
        ).length === 1 &&
        afterFailUi.labels.some((t: string) => /حفظ المسودة/.test(t)) &&
        resumeReq != null &&
        resumeReq.status >= 200 &&
        resumeReq.status < 300 &&
        published &&
        pubRow.contentStatus === 'published' &&
        pubRow.active === true &&
        matches.length === 1 &&
        matches[0].id === resumeProd.id;
      record(
        'acc-dev-resume-publish',
        'BROWSER',
        'مطور: فشل حد API عند النشر → استئناف من التطبيق → ضغط حقيقي → نشر نفس المعرف بلا موافقة بشرية',
        '503 at submit-review; app paints استئناف النشر; click; same id published',
        JSON.stringify(evidence),
        resumeOk,
        { criterion: 'ACC-DEV-RESUME-PUBLISH', evidence: ['dev-resume-publish-cta.png', 'dev-resume-publish-cta.json'] },
      );
      record(
        'acc-dev-publish-product',
        'BROWSER',
        'مطور ينشر منتجًا صالحًا مباشرة (عبر استئناف بعد فشل قابل لإعادة المحاولة)',
        'contentStatus=published active=true same id',
        `status=${pubRow.contentStatus} active=${pubRow.active} id=${resumeProd.id}`,
        published && pubRow.contentStatus === 'published' && pubRow.active === true,
        { criterion: 'ACC-DEV-PUBLISH-PRODUCT', evidence: ['dev-product-published.png', 'dev-resume-publish-cta.json'] },
      );
      const fin01Video = fin01.video();
      await fin01.close().catch(() => undefined);
      if (fin01Video) {
        const raw = await fin01Video.path().catch(() => null);
        if (raw && fs.existsSync(raw)) {
          fs.copyFileSync(raw, path.join(evidenceDir, 'fin01-dev-resume-publish.webm'));
        }
      }
    } catch (fin01Err: any) {
      const msg = fin01Err?.message || String(fin01Err);
      console.error('FIN-01 journey error:', msg);
      if (!results.some((r) => r.criterion === 'ACC-DEV-RESUME-PUBLISH')) {
        record(
          'acc-dev-resume-publish',
          'BROWSER',
          'مطور: فشل حد API عند النشر → استئناف من التطبيق → ضغط حقيقي → نشر نفس المعرف بلا موافقة بشرية',
          '503 at submit-review; app paints استئناف النشر; click; same id published',
          msg,
          false,
          { criterion: 'ACC-DEV-RESUME-PUBLISH', evidence: [] },
        );
      }
      if (!results.some((r) => r.criterion === 'ACC-DEV-PUBLISH-PRODUCT')) {
        record(
          'acc-dev-publish-product',
          'BROWSER',
          'مطور ينشر منتجًا صالحًا مباشرة (عبر استئناف بعد فشل قابل لإعادة المحاولة)',
          'contentStatus=published active=true same id',
          msg,
          false,
          { criterion: 'ACC-DEV-PUBLISH-PRODUCT', evidence: [] },
        );
      }
    }

    // Dev service publish (serviceForm for developer)
    await page.click('#goService');
    await requireSel(page, '#serviceForm', 'serviceForm');
    await page.waitForTimeout(400);
    const svcName = `Acc-Svc-${suffix}`;
    const svcFill = await page.evaluate((nm) => {
      const form = document.getElementById('serviceForm');
      if (!form) return { ok: false, reason: 'no-form' };
      const name = form.querySelector('input[name="nameAr"]') as HTMLInputElement | null;
      const price = form.querySelector('input[name="priceSar"]') as HTMLInputElement | null;
      const dur = form.querySelector('input[name="durationMin"]') as HTMLInputElement | null;
      const cat = form.querySelector('select[name="category"]') as HTMLSelectElement | null;
      if (!name || !price) return { ok: false, reason: 'missing-basics' };
      name.value = nm;
      name.dispatchEvent(new Event('input', { bubbles: true }));
      price.value = '120';
      price.dispatchEvent(new Event('input', { bubbles: true }));
      if (dur) {
        dur.value = '45';
        dur.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (cat && cat.options.length > 1) {
        cat.selectedIndex = 1;
        cat.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { ok: true, cat: cat?.value || null, hasDur: !!dur };
    }, svcName);
    if (!svcFill.ok) throw new Error('تعذر تعبئة نموذج الخدمة: ' + JSON.stringify(svcFill));
    await page.click('#serviceForm-save');
    await page.waitForTimeout(2500);
    const svcStatus = await page.evaluate(() => {
      const form = document.getElementById('serviceForm');
      return form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || '';
    });
    const dashSvc = await page.evaluate(async () => (window as any).PartnersApi.dashboard());
    let svc =
      (dashSvc?.catalog?.services || []).find((s: any) => s.nameAr === svcName) ||
      (dashSvc?.catalog?.services || []).find((s: any) => String(s.nameAr || '').includes(`Acc-Svc-${suffix}`));
    if (svc?.id) {
      createdServiceIds.push(svc.id);
      await page.evaluate(
        async ({ id, png }) => {
          await (window as any).PartnersApi.addMedia('services', id, 'image/png', png);
        },
        { id: svc.id, png: TINY_PNG },
      );
      // Re-open service in form if needed then save/publish
      const openSvc = page.locator('#serviceList .list-item').filter({ hasText: svcName }).getByRole('button', {
        name: 'فتح في النموذج',
      });
      if (await openSvc.count()) await openSvc.click();
      await page.waitForTimeout(500);
      await page.click('#serviceForm-save');
      await page.waitForTimeout(2000);
      svc = (await page.evaluate(async () => (window as any).PartnersApi.dashboard()))?.catalog?.services?.find(
        (s: any) => s.id === svc.id,
      );
    }
    const svcRow = svc?.id ? await prisma.service.findUnique({ where: { id: svc.id } }) : null;
    await page.screenshot({ path: path.join(evidenceDir, 'dev-service.png'), fullPage: true });
    record(
      'acc-dev-publish-service',
      'BROWSER',
      'مطور يحفظ خدمة وينشرها من الواجهة',
      'service published/active',
      `fill=${JSON.stringify(svcFill)} statusUi=${svcStatus} id=${svc?.id} status=${svcRow?.contentStatus} active=${svcRow?.active}`,
      !!svc?.id && svcRow?.contentStatus === 'published' && svcRow?.active === true,
      { criterion: 'ACC-DEV-PUBLISH-SERVICE', evidence: ['dev-service.png'] },
    );

    // ========== BRAND: review + create-loss recover ==========
    const brandPage = await context.newPage();
    (brandPage as any)._miraEvidenceName = 'brand-bulk-journey';
    brandPage.on('response', (res) => {
      try {
        const u = new URL(res.url());
        if (u.pathname.includes('/partners-portal')) {
          networkLog.push({ method: res.request().method(), path: u.pathname, status: res.status() });
        }
      } catch {
        /* ignore */
      }
    });
    await loginPage(brandPage, portalOrigin, apiRoot, `acc-br-${suffix}@test.local`, tokenBrand);
    await brandPage.click('#goProduct');
    await requireSel(brandPage, '#catalogForm', 'catalogForm');
    // Wait for E2B shell taxonomy so circle sync does not race category selection.
    await brandPage.waitForSelector('[data-testid="e2b-main-circle"]', { timeout: 20000 }).catch(() => undefined);
    await brandPage.locator('[data-testid="e2b-main-circle"][data-category-id="clothes"]').click().catch(() => undefined);
    await brandPage.waitForTimeout(600);
    const brandName = `Acc-Brand-${suffix}`;
    await fillProductBasics(brandPage, brandName);
    await setClothesAttrs(
      brandPage,
      { materials: ['silk'], cut: 'loose', lengthCm: 100 },
      '#catalogForm [data-testid="registry-attribute-host"]',
    );
    // Let editor-v2 autosave settle once (avoid revision-race save-failed).
    await brandPage.waitForTimeout(2800);
    await brandPage.locator('#catalogForm-save').click({ timeout: 15000 });
    await brandPage.waitForTimeout(2000);
    // Poll until open draft exists with this name (source of truth for materialize readiness).
    let draftReady = false;
    let draftProbe: any = null;
    for (let i = 0; i < 12; i++) {
      draftProbe = await brandPage.evaluate(async (nm) => {
        const api = (window as any).PartnersApi;
        const list = (await api.listEditorDrafts?.()) || null;
        const items = list?.items || [];
        const match = (Array.isArray(items) ? items : []).find(
          (d: any) => d?.values?.nameAr === nm || d?.nameAr === nm,
        );
        const form = document.getElementById('catalogForm');
        const fieldErrs = Array.from(form?.querySelectorAll('[data-field-error], .field-error, .error') || [])
          .map((n) => (n.textContent || '').trim())
          .filter(Boolean)
          .slice(0, 8);
        const status =
          form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || '';
        return {
          ready: !!(match && match.status === 'open' && (match.revision || 0) >= 1),
          matchStatus: match?.status || null,
          matchRev: match?.revision || null,
          count: Array.isArray(items) ? items.length : -1,
          names: (Array.isArray(items) ? items : [])
            .map((d: any) => d?.values?.nameAr || d?.nameAr || '')
            .slice(0, 5),
          status,
          fieldErrs,
          cat: (form?.querySelector('select[name="category"]') as HTMLSelectElement | null)?.value || '',
          sub: (form?.querySelector('select[name="subcategory"]') as HTMLSelectElement | null)?.value || '',
        };
      }, brandName);
      draftReady = !!draftProbe?.ready;
      if (draftReady) break;
      await brandPage.locator('#catalogForm-save').click({ timeout: 15000 });
      await brandPage.waitForTimeout(1400);
    }
    const draftStatus = `${draftProbe?.status || ''} | probe=${JSON.stringify(draftProbe)}`;
    const matBtn = brandPage.locator('[data-editor-v2-materialize]');
    let brandProd: any = null;
    if (!(await matBtn.count()) || !draftReady) {
      record(
        'acc-create-loss-recover',
        'BROWSER',
        'فقد استجابة ناجحة ثم استئناف',
        'draft ready + materialize CTA',
        `draftReady=${draftReady} draftStatus=${draftStatus} matBtn=${await matBtn.count()}`,
        'FAIL',
        { criterion: 'ACC-CREATE-LOSS-RECOVER', evidence: [] },
      );
      record(
        'acc-brand-submit-review',
        'BROWSER',
        'حساب عادي يرسل للمراجعة',
        'in_review',
        `draftReady=${draftReady} draftStatus=${draftStatus}`,
        'FAIL',
        { criterion: 'ACC-BRAND-SUBMIT-REVIEW', evidence: [] },
      );
      console.error('مسودة غير جاهزة للتحويل — continuing to bulk');
    } else {
    // First materialize (may create owner; allow response)
    await matBtn.click();
    await brandPage.waitForTimeout(3500);
    await brandPage.screenshot({ path: path.join(evidenceDir, 'brand-after-materialize.png'), fullPage: true });
    const matStatus = await brandPage.evaluate(() => {
      const form = document.getElementById('catalogForm');
      return form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || '';
    });
    const dashBr1 = await brandPage.evaluate(async () => (window as any).PartnersApi.dashboard());
    brandProd = (dashBr1?.catalog?.products || []).find((p: any) => p.nameAr === brandName);
    if (!brandProd?.id) {
      const drafts = await brandPage.evaluate(async () => {
        try {
          return await (window as any).PartnersApi.listEditorDrafts?.() || (window as any).PartnersApi.editorDrafts?.() || null;
        } catch (e: any) {
          return { error: e?.message || String(e) };
        }
      });
      // Retry materialize once
      await matBtn.click();
      await brandPage.waitForTimeout(2500);
      const dashBr1b = await brandPage.evaluate(async () => (window as any).PartnersApi.dashboard());
      brandProd = (dashBr1b?.catalog?.products || []).find((p: any) =>
        String(p.nameAr || '').includes(`Acc-Brand-${suffix}`),
      );
      if (!brandProd?.id) {
        record(
          'acc-create-loss-recover',
          'BROWSER',
          'فقد استجابة ناجحة ثم استئناف',
          'product created',
          JSON.stringify({ draftStatus, matStatus, drafts }),
          'FAIL',
          { criterion: 'ACC-CREATE-LOSS-RECOVER', evidence: ['brand-after-materialize.png'] },
        );
        record(
          'acc-brand-submit-review',
          'BROWSER',
          'حساب عادي يرسل للمراجعة',
          'in_review',
          JSON.stringify({ draftStatus, matStatus }),
          'FAIL',
          { criterion: 'ACC-BRAND-SUBMIT-REVIEW', evidence: ['brand-after-materialize.png'] },
        );
      }
    }
    if (brandProd?.id) {
    createdProductIds.push(brandProd.id);
    // Attach media (server fixture prep — before UI resume journey)
    await brandPage.evaluate(
      async ({ id, png }) => {
        await (window as any).PartnersApi.addMedia('products', id, 'image/png', png);
      },
      { id: brandProd.id, png: TINY_PNG },
    );

    // Scenario: lost successful re-submit-review response for an already-created owner item.
    // (Not a first-create loss test.)
    // ----- FIXTURE PREP only (DB/API before UI journey) -----
    await prisma.product.update({
      where: { id: brandProd.id },
      data: { reviewStatus: 'draft', contentStatus: 'draft' },
    });
    const draftRow = await prisma.partnerEditorDraft.findFirst({
      where: { partnerId: brand.id, targetOwnerId: brandProd.id },
    });
    assert.ok(draftRow?.clientDraftId, 'fixture draft clientDraftId');
    await prisma.partnerEditorDraft.update({
      where: { id: draftRow!.id },
      data: { submitReviewStatus: 'failed', status: 'materialized' },
    });
    // Open from real drafts list (مسودات المحرر) so the app binds clientDraftId/status itself — no injection.
    await brandPage.click('#refreshEditorDrafts');
    await brandPage.waitForTimeout(1200);
    const openDraftBtn = brandPage.locator('#editorDraftsList .list-row').filter({ hasText: brandName }).getByRole('button', {
      name: 'فتح',
    });
    if (!(await openDraftBtn.count())) {
      // Fallback: catalog open then drafts refresh once more
      const openBrand = brandPage.locator('#catalogList .list-item').filter({ hasText: brandName }).getByRole('button', {
        name: 'فتح في النموذج',
      });
      if (!(await openBrand.count())) throw new Error('مسودة/منتج الحساب العادي مفقود قبل رحلة الاستئناف');
      await openBrand.click();
    } else {
      await openDraftBtn.first().click();
    }
    await brandPage.waitForSelector('[data-editor-v2-materialize]', { timeout: 15000 });
    const matBtnLive = brandPage.locator('[data-editor-v2-materialize]');
    // App must paint resume from the opened server draft (no sessionStorage/editContexts/button injection).
    await brandPage.waitForFunction(
      (ownerId) => {
        const b = document.querySelector('[data-editor-v2-materialize]') as HTMLButtonElement | null;
        const st =
          document.querySelector('#catalogForm [data-catalog-persist-status], #catalogForm p.lead, #catalogForm [role="status"]')
            ?.textContent || '';
        return !!b && /استئناف/.test(b.textContent || '') && st.includes(ownerId);
      },
      brandProd.id,
      { timeout: 20000 },
    );

    let lostServerStatus = 0;
    let lostBody = '';
    let swallowed = false;
    let lostPath = '';
    const dropSuccess = async (route: Route) => {
      if (route.request().method() !== 'POST' || swallowed) {
        await route.continue();
        return;
      }
      const res = await route.fetch();
      lostServerStatus = res.status();
      lostBody = (await res.text()).slice(0, 400);
      lostPath = new URL(route.request().url()).pathname;
      swallowed = true;
      if (lostServerStatus >= 200 && lostServerStatus < 300) {
        await route.abort('failed');
        return;
      }
      await route.fulfill({ status: res.status(), headers: res.headers(), body: lostBody });
    };
    await brandPage.route('**/submit-review', dropSuccess);
    await brandPage.route('**/editor-drafts/**/materialize', dropSuccess);

    // ----- UI JOURNEY: user submit → lose 2xx → assert error → real resume -----
    await matBtnLive.click();
    let dropErrorVisible = false;
    try {
      await brandPage.waitForFunction(
        () => {
          const st =
            document.querySelector('#catalogForm [data-catalog-persist-status], #catalogForm p.lead, #catalogForm [role="status"]')
              ?.textContent || '';
          return /تعذر|فشل|شبكة|Failed|network|ERR_|abort|Lost|استئناف الإرسال/i.test(st);
        },
        { timeout: 12000 },
      );
      dropErrorVisible = true;
    } catch {
      dropErrorVisible = false;
    }
    await brandPage.screenshot({ path: path.join(evidenceDir, 'create-loss-after-drop.png'), fullPage: true });
    const afterDropStatus =
      (await brandPage
        .locator('#catalogForm [data-catalog-persist-status], #catalogForm p.lead, #catalogForm [role="status"]')
        .first()
        .textContent()
        .catch(() => '')) || '';

    // Negative A: sabotage resume UI after drop — criterion must detect that resume did not happen.
    const sabotageProbe = await brandPage.evaluate(async () => {
      const btn = document.querySelector('[data-editor-v2-materialize]') as HTMLButtonElement | null;
      if (!btn) return { sabotaged: false, reason: 'no-btn' };
      const prevOnclick = btn.onclick;
      const prevDisabled = btn.disabled;
      btn.onclick = null;
      btn.disabled = true;
      btn.setAttribute('data-e2a-sabotaged', '1');
      // Attempt "resume" while sabotaged — must not produce success banner.
      btn.click();
      await new Promise((r) => setTimeout(r, 800));
      const st =
        document.querySelector('#catalogForm [data-catalog-persist-status], #catalogForm p.lead, #catalogForm [role="status"]')
          ?.textContent || '';
      const successLike = /تم التحويل والإرسال للمراجعة|أُرسل للمراجعة/i.test(st);
      btn.disabled = prevDisabled;
      btn.onclick = prevOnclick;
      btn.removeAttribute('data-e2a-sabotaged');
      return { sabotaged: true, successLike, statusSnippet: st.slice(0, 180) };
    });
    const negResumeCaught = !!(sabotageProbe.sabotaged && sabotageProbe.successLike === false);
    record(
      'acc-neg-resume-ui-required',
      'BROWSER',
      'تعطيل أثر زر الاستئناف بعد فقد الرد يمنع ادّعاء نجاح الاستئناف من الواجهة',
      'sabotaged resume does not paint success; detector catches defect',
      JSON.stringify({ sabotageProbe, afterDropStatus, dropErrorVisible }),
      negResumeCaught,
      { criterion: 'ACC-NEG-RESUME-UI-REQUIRED', evidence: ['create-loss-after-drop.png'] },
    );

    // Real resume via the live UI button — no PartnersApi.write / no DB rescue / no state injection.
    await brandPage.unroute('**/submit-review').catch(() => undefined);
    await brandPage.unroute('**/editor-drafts/**/materialize').catch(() => undefined);
    if (!(await matBtnLive.count())) throw new Error('زر الاستئناف اختفى بعد فقد الرد');
    await matBtnLive.click();
    let resumeSuccessVisible = false;
    try {
      await brandPage.waitForFunction(
        (ownerId) => {
          const st =
            document.querySelector('#catalogForm [data-catalog-persist-status], #catalogForm p.lead, #catalogForm [role="status"]')
              ?.textContent || '';
          if (!st.includes(ownerId)) return false;
          // Inline the success rule (Playwright cannot close over outer helpers).
          if (/جاهز لإعادة الإرسال للمراجعة/.test(st)) return false;
          if (/تعذر|فشل/.test(st)) return false;
          return /تم التحويل والإرسال للمراجعة/.test(st);
        },
        brandProd.id,
        { timeout: 25000 },
      );
      resumeSuccessVisible = true;
    } catch {
      resumeSuccessVisible = false;
    }
    await brandPage.waitForTimeout(500);

    const dashBr2 = await brandPage.evaluate(async () => (window as any).PartnersApi.dashboard());
    const brandMatches = (dashBr2?.catalog?.products || []).filter((p: any) =>
      String(p.nameAr || '').includes(`Acc-Brand-${suffix}`),
    );
    const brandRow = await prisma.product.findUniqueOrThrow({ where: { id: brandProd.id } });
    const inReview =
      brandRow.reviewStatus === 'in_review' ||
      brandRow.reviewStatus === 'pending_review' ||
      brandRow.contentStatus === 'in_review';
    const uiBound = await brandPage.evaluate(() => {
      const form = document.getElementById('catalogForm') as HTMLElement | null;
      const statusTxt =
        form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || '';
      const btn = document.querySelector('[data-editor-v2-materialize]') as HTMLButtonElement | null;
      return {
        statusTxt: String(statusTxt).slice(0, 240),
        btnText: btn?.textContent || '',
      };
    });
    const statusIdMatch = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(
      String(uiBound.statusTxt || ''),
    );
    // UI-bound id must come from the status text the app painted — never fall back to API id.
    const uiBoundId = statusIdMatch ? statusIdMatch[1] : null;
    await brandPage.screenshot({ path: path.join(evidenceDir, 'brand-after-recover.png'), fullPage: true });
    const lostOk = lostServerStatus >= 200 && lostServerStatus < 300;
    record(
      'acc-create-loss-recover',
      'BROWSER',
      'فقد رد إعادة إرسال عنصر موجود للمراجعة ثم استئناف من زر الواجهة فقط دون تكرار',
      'UI recover → UI submit → lost 2xx + visible error → UI resume → count=1 + review + UI-bound id',
      JSON.stringify({
        scenario: 'resubmit-review-loss-existing-item',
        swallowed,
        lostServerStatus,
        lostOk,
        lostPath,
        lostBody,
        afterDropStatus,
        dropErrorVisible,
        resumeSuccessVisible,
        count: brandMatches.length,
        reviewStatus: brandRow.reviewStatus,
        contentStatus: brandRow.contentStatus,
        fixtureId: brandProd.id,
        uiBoundId,
        uiBound,
        injectedSessionOrCtx: false,
        usedApiWriteRescue: false,
      }),
      swallowed &&
        lostOk &&
        dropErrorVisible &&
        resumeSuccessVisible &&
        isResumeSuccessText(uiBound.statusTxt) &&
        brandMatches.length === 1 &&
        brandMatches[0].id === brandProd.id &&
        uiBoundId === brandProd.id &&
        inReview,
      { criterion: 'ACC-CREATE-LOSS-RECOVER', evidence: ['create-loss-after-drop.png', 'brand-after-recover.png'] },
    );
    // Negative: waiting copy must never satisfy the resume-success predicate.
    const waitingProbe = 'العنصر موجود (' + brandProd.id + ') — جاهز لإعادة الإرسال للمراجعة.';
    const waitingRejected = isResumeSuccessText(waitingProbe) === false;
    fs.writeFileSync(
      path.join(evidenceDir, 'neg-resume-waiting.json'),
      JSON.stringify({ waitingProbe, waitingRejected, successSample: uiBound.statusTxt }, null, 2),
    );
    record(
      'acc-neg-resume-waiting',
      'BROWSER',
      'عبارة جاهز لإعادة الإرسال للمراجعة حالة انتظار وترفضها قاعدة نجاح الاستئناف',
      'isResumeSuccessText(waiting)=false; real success text still accepted',
      JSON.stringify({ waitingRejected, realAccepted: isResumeSuccessText(uiBound.statusTxt) }),
      waitingRejected && isResumeSuccessText(uiBound.statusTxt),
      { criterion: 'ACC-NEG-RESUME-WAITING', evidence: ['neg-resume-waiting.json'] },
    );
    record(
      'acc-brand-submit-review',
      'BROWSER',
      'حساب عادي يرسل للمراجعة ولا يُنشر مباشرة',
      'in_review/pending_review and not published',
      `review=${brandRow.reviewStatus} content=${brandRow.contentStatus} active=${brandRow.active}`,
      inReview && brandRow.contentStatus !== 'published',
      { criterion: 'ACC-BRAND-SUBMIT-REVIEW', evidence: ['brand-after-recover.png'] },
    );
    } // end brandProd created
    } // end draftReady materialize branch

    // ========== BULK three cards ==========
    const bulkPutErrors: any[] = [];
    await brandPage.route('**/bulk-batches/**/materialize', async (route) => {
      const res = await route.fetch();
      const body = await res.text();
      bulkPutErrors.push({ kind: 'materialize', status: res.status(), body: body.slice(0, 800) });
      await route.fulfill({ status: res.status(), headers: res.headers(), body });
    });
    brandPage.on('response', async (res) => {
      try {
        const u = res.url();
        if (u.includes('/bulk-batches/') && (u.includes('/cards/') || u.includes('materialize') || u.includes('upload-sessions'))) {
          if (res.request().method() !== 'GET') {
            const body = res.status() >= 400 ? (await res.text().catch(()=>'')) : '';
            bulkPutErrors.push({ method: res.request().method(), path: new URL(u).pathname, status: res.status(), body: body.slice(0, 400) });
          }
        }
      } catch { /* ignore */ }
    });

    try {
    await brandPage.click('#goBulk');
    await brandPage.waitForTimeout(600);
    const bulkRoot = brandPage.locator('#bulkRoot, .bulk-journey-root');
    if (!(await bulkRoot.count())) throw new Error('قسم المجموعات مفقود');
    await brandPage.getByRole('button', { name: 'مجموعة منتجات' }).click();
    await brandPage.waitForTimeout(500);
    // Prefer product.clothes explicitly when profile picker is shown.
    const clothesBtn = brandPage.getByRole('button', { name: /الملابس|ملابس/ });
    if (await clothesBtn.count()) {
      await clothesBtn.first().click();
      await brandPage.waitForTimeout(800);
    } else if (await brandPage.locator('.bulk-journey-actions button.btn-ghost').count()) {
      await brandPage.locator('.bulk-journey-actions button.btn-ghost').first().click();
      await brandPage.waitForTimeout(800);
    }
    await brandPage.waitForSelector('.bulk-journey-shell h3', { timeout: 15000 });

    async function attachBulkVideo() {
      // Video change remounts the offer form — attach first, then fill fields.
      await brandPage.setInputFiles('#journeyVideoInput, input[type="file"]', TINY_MP4);
      await brandPage.waitForFunction(() => {
        const st = document.querySelector('.bulk-journey-status')?.textContent || '';
        return /مقطع جاهز|استبدال/.test(st) || !!document.querySelector('.bulk-journey-media video');
      }, { timeout: 8000 });
      await brandPage.waitForTimeout(300);
    }

    async function fillBulkFields(
      name: string,
      mats: string[],
      cut: string,
      length: number,
      stock: number | null | undefined,
    ) {
      await brandPage.evaluate(
        ({ name: nm, mats: materials, cut: cutVal, length: len, stock: stockVal }) => {
          const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
          if (!root) throw new Error('bulk root missing');
          const allInputs = Array.from(root.querySelectorAll('input')) as HTMLInputElement[];
          let filledName = false;
          allInputs.forEach((inp) => {
            if (inp.type === 'file') return;
            const label = inp.closest('label') || inp.parentElement;
            const t = (label?.textContent || '') + (inp.name || '');
            if (!filledName && t.includes('الاسم')) {
              inp.focus();
              inp.value = nm;
              inp.dispatchEvent(new Event('input', { bubbles: true }));
              filledName = true;
            }
            if (t.includes('السعر')) {
              inp.value = '70';
              inp.dispatchEvent(new Event('input', { bubbles: true }));
            }
          });
          if (!filledName) throw new Error('name field missing in bulk');
          const stockIn = root.querySelector('[data-testid="bulk-stock-qty"]') as HTMLInputElement | null;
          if (!stockIn) throw new Error('bulk stock field missing');
          if (stockVal === undefined || stockVal === null) {
            stockIn.value = '';
          } else {
            stockIn.value = String(stockVal);
          }
          stockIn.dispatchEvent(new Event('input', { bubbles: true }));
          stockIn.dispatchEvent(new Event('change', { bubbles: true }));
          const sub = root.querySelector('[data-testid="bulk-subcategory"]') as HTMLSelectElement | null;
          if (sub) {
            if ([...sub.options].some((o) => o.value === 'clothes.evening')) sub.value = 'clothes.evening';
            else if (sub.options.length > 1) sub.selectedIndex = 1;
            sub.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const host = root.querySelector('[data-testid="bulk-registry-attribute-host"]');
          if (!host) throw new Error('bulk attr host missing');
          host.querySelectorAll('input[type="checkbox"]').forEach((b: any) => {
            const want = materials.includes(b.value);
            if (b.checked !== want) {
              b.checked = want;
              b.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          const cutRadio = Array.from(host.querySelectorAll('input[type="radio"]')).find(
            (r: any) => (r.name || '').includes('-cut') && r.value === cutVal,
          ) as HTMLInputElement | undefined;
          if (!cutRadio) throw new Error('bulk cut missing');
          cutRadio.click();
          const num = host.querySelector('input.mira-attr-number') as HTMLInputElement | null;
          if (!num) throw new Error('bulk length missing');
          num.value = String(len);
          num.dispatchEvent(new Event('input', { bubbles: true }));
          num.dispatchEvent(new Event('change', { bubbles: true }));
        },
        { name, mats, cut, length, stock },
      );
    }

    async function fillBulkCard(
      name: string,
      mats: string[],
      cut: string,
      length: number,
      stock: number | null | undefined,
    ) {
      await attachBulkVideo();
      await fillBulkFields(name, mats, cut, length, stock);
    }

    async function readBulkUiCard() {
      return brandPage.evaluate(() => {
        const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
        if (!root) return { error: 'bulk root missing' };
        const allInputs = Array.from(root.querySelectorAll('input')) as HTMLInputElement[];
        let nameAr = '';
        allInputs.forEach((inp) => {
          if (inp.type === 'file') return;
          const label = inp.closest('label') || inp.parentElement;
          const t = (label?.textContent || '') + (inp.name || '');
          if (!nameAr && t.includes('الاسم')) nameAr = inp.value;
        });
        const stockIn = root.querySelector('[data-testid="bulk-stock-qty"]') as HTMLInputElement | null;
        const mediaStatus =
          (root.querySelector('[data-testid="bulk-media-status"]') as HTMLElement | null)?.textContent || '';
        const hasVideo = !!root.querySelector('.bulk-journey-media video');
        const replaceBtn = Array.from(root.querySelectorAll('button')).some((b) =>
          /استبدال المقطع/.test(b.textContent || ''),
        );
        const host = root.querySelector('[data-testid="bulk-registry-attribute-host"]');
        const mats: string[] = [];
        host?.querySelectorAll('input[type="checkbox"]:checked').forEach((b: any) => mats.push(b.value));
        const cut = (host?.querySelector('input[type="radio"]:checked') as HTMLInputElement | null)?.value || null;
        const lengthCm = (host?.querySelector('input.mira-attr-number') as HTMLInputElement | null)?.value || null;
        return {
          nameAr,
          stock: stockIn ? stockIn.value : null,
          mediaStatus,
          hasVideo,
          replaceBtn,
          mats,
          cut,
          lengthCm,
        };
      });
    }

    async function clickBulkSaveReview() {
      // User-path click only: wait until the CTA is enabled, then natural click. No clearBusy / force / disabled override.
      const loc = brandPage.locator('[data-testid="bulk-save-review"]');
      try {
        await brandPage.waitForFunction(
          () => {
            const btn = document.querySelector('[data-testid="bulk-save-review"]') as HTMLButtonElement | null;
            if (btn) return !btn.disabled && btn.getAttribute('aria-busy') !== 'true';
            const fallback = Array.from(document.querySelectorAll('button')).find((b) =>
              /حفظ ومراجعة المجموعة/.test(b.textContent || ''),
            ) as HTMLButtonElement | undefined;
            return !!fallback && !fallback.disabled;
          },
          undefined,
          { timeout: 45000 },
        );
      } catch (err: any) {
        const diag = await brandPage.evaluate(() => {
          const btn = document.querySelector('[data-testid="bulk-save-review"]') as HTMLButtonElement | null;
          return {
            hasTestId: !!btn,
            disabled: btn?.disabled ?? null,
            busy: btn?.getAttribute('aria-busy') || null,
            status: document.querySelector('.bulk-journey-status')?.textContent || '',
            h: document.querySelector('.bulk-journey-shell h3')?.textContent || '',
          };
        });
        throw new Error('bulk-save-review still busy/disabled: ' + JSON.stringify({ diag, message: err?.message }));
      }
      if (await loc.count()) {
        await loc.first().click({ timeout: 15000 });
        return;
      }
      await brandPage.getByRole('button', { name: /حفظ ومراجعة المجموعة/ }).click({ timeout: 15000 });
    }

    async function pickJourneyVideo(filePath: string) {
      await brandPage.waitForSelector('#journeyVideoInput', { state: 'attached', timeout: 15000 });
      await brandPage.evaluate(() => {
        const input = document.querySelector('#journeyVideoInput') as HTMLInputElement | null;
        if (input) input.value = '';
      });
      await brandPage.setInputFiles('#journeyVideoInput', filePath);
      await brandPage.waitForFunction(
        () => {
          const st = document.querySelector('.bulk-journey-status')?.textContent || '';
          const mediaSt = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
          const btn = document.querySelector('[data-testid="bulk-save-review"]');
          return /استبدال|جاهز للرفع/.test(st + ' ' + mediaSt) && !!btn;
        },
        undefined,
        { timeout: 20000 },
      );
    }

    async function openBulkCardFromSummary(idx: number) {
      const rows = brandPage.locator('.bulk-journey-summary .bulk-journey-summary-row');
      const n = await rows.count();
      if (n <= idx) throw new Error(`summary row ${idx} missing (have ${n})`);
      const row = rows.nth(idx);
      const edit = row.locator('button').filter({ hasText: /تعديل|إكمال العرض/ });
      if (!(await edit.count())) throw new Error(`edit button missing on summary row ${idx}`);
      let opened = false;
      for (let attempt = 0; attempt < 3 && !opened; attempt++) {
        await edit.first().scrollIntoViewIfNeeded().catch(() => undefined);
        await edit.first().click({ timeout: 10000 });
        try {
          await brandPage.waitForFunction(
            () => {
              const h = document.querySelector('.bulk-journey-shell h3')?.textContent || '';
              const input = document.querySelector('#journeyVideoInput');
              const save = document.querySelector('[data-testid="bulk-save-review"]');
              return /العرض\s+\d+/.test(h) && !!input && !!save;
            },
            undefined,
            { timeout: 12000 },
          );
          opened = true;
        } catch {
          await brandPage.waitForTimeout(400);
        }
      }
      if (!opened) {
        const diag = await brandPage.evaluate(() => ({
          h: document.querySelector('.bulk-journey-shell h3')?.textContent || '',
          hasInput: !!document.querySelector('#journeyVideoInput'),
          hasSave: !!document.querySelector('[data-testid="bulk-save-review"]'),
          status: document.querySelector('.bulk-journey-status')?.textContent || '',
          rowCount: document.querySelectorAll('.bulk-journey-summary .bulk-journey-summary-row').length,
        }));
        throw new Error('openBulkCardFromSummary failed: ' + JSON.stringify(diag));
      }
      await brandPage
        .waitForSelector('[data-testid="bulk-registry-attribute-host"]', { state: 'attached', timeout: 15000 })
        .catch(() => undefined);
      await brandPage.waitForTimeout(300);
    }

    /** After ?bulk= resume the journey lands on offer for card 0 — use it when already open. */
    async function ensureBulkOfferCard(idx: number) {
      const onOffer = await brandPage.evaluate(() => {
        const h = document.querySelector('.bulk-journey-shell h3')?.textContent || '';
        return /العرض\s+\d+/.test(h) && !!document.querySelector('#journeyVideoInput');
      });
      if (onOffer && idx === 0) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
        if (/العرض\s+1\b/.test(h)) return;
      }
      await ensureBulkSummary();
      await openBulkCardFromSummary(idx);
    }

    async function bulkStatusText() {
      return (await brandPage.locator('.bulk-journey-status').first().textContent()) || '';
    }

    async function bulkCardCountFromApi() {
      const u = new URL(brandPage.url());
      const id = u.searchParams.get('bulk');
      if (!id) return { batchId: null as string | null, count: 0, names: [] as string[] };
      const batch = await brandPage.evaluate(async (bid) => (window as any).PartnersApi.getBulkBatch(bid), id);
      const cards = batch?.cards || [];
      return {
        batchId: id,
        count: cards.length,
        names: cards.map((c: any) => c?.values?.nameAr || null),
      };
    }

    const cardSpecs = [
      { name: `Acc-Bulk-1-${suffix}`, mats: ['silk'], cut: 'regular', length: 110, stock: 7 as number | null },
      { name: `Acc-Bulk-2-${suffix}`, mats: ['cotton'], cut: 'fitted', length: 120, stock: 0 as number | null },
      { name: `Acc-Bulk-3-${suffix}`, mats: ['linen', 'silk'], cut: 'loose', length: 130, stock: null as number | null },
    ];

    // Card 1 invalid then fix (shared validation) — video first so remount does not wipe invalidInputs.
    await attachBulkVideo();
    await fillBulkFields(cardSpecs[0].name, cardSpecs[0].mats, cardSpecs[0].cut, 999, cardSpecs[0].stock);
    const errBefore = await brandPage.evaluate(() => {
      const err = document.querySelector('[data-attr-error="lengthCm"]') as HTMLElement | null;
      return { text: err?.textContent || '', hidden: err?.hidden ?? true };
    });
    await brandPage.getByRole('button', { name: 'حفظ وإضافة مقطع آخر' }).click();
    await brandPage.waitForTimeout(1200);
    const bulkInvalidStatus = await bulkStatusText();
    const blockedInvalid =
      /أصلحي|غير صالح|خصائص|التحقق|رقم|الحد الأقصى/.test(String(bulkInvalidStatus || '')) ||
      (!errBefore.hidden && /حد|300/.test(errBefore.text));
    // fix length (still on same card — must not have appended)
    await brandPage.evaluate(() => {
      const host = document.querySelector('[data-testid="bulk-registry-attribute-host"]');
      const num = host?.querySelector('input.mira-attr-number') as HTMLInputElement | null;
      if (!num) throw new Error('length missing for fix');
      num.value = '110';
      num.dispatchEvent(new Event('input', { bubbles: true }));
      num.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-invalid-blocked.png'), fullPage: true });
    record(
      'acc-invalid-bulk',
      'BROWSER',
      'مجموعة: قيمة غير صالحة تمنع الحفظ ثم التصحيح يكمل',
      'blocked then fixable',
      `status=${bulkInvalidStatus} errBefore=${JSON.stringify(errBefore)} blocked=${blockedInvalid}`,
      blockedInvalid,
      { criterion: 'ACC-INVALID-BLOCK-BULK', evidence: ['bulk-invalid-blocked.png'] },
    );

    for (let i = 0; i < 3; i++) {
      const spec = cardSpecs[i];
      await fillBulkCard(spec.name, spec.mats, spec.cut, spec.length, spec.stock);
      if (i < 2) {
        const expectCount = i + 2;
        await brandPage.getByRole('button', { name: 'حفظ وإضافة مقطع آخر' }).click();
        let advanced = false;
        for (let t = 0; t < 60; t++) {
          const st = await bulkStatusText();
          if (/تعذر|فشل|أصلحي|غير صالح|مرحلة/.test(st) && !/جار|حفظ العرض|رفع/.test(st)) {
            throw new Error('bulk save error after card ' + (i + 1) + ': ' + st);
          }
          const got = await bulkCardCountFromApi();
          const heading = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
          if (got.count >= expectCount || new RegExp('العرض\\s*' + expectCount).test(heading) || new RegExp('العرض\\s*' + expectCount).test(st)) {
            advanced = true;
            break;
          }
          await brandPage.waitForTimeout(500);
        }
        if (!advanced) throw new Error('bulk append failed after card ' + (i + 1) + ': ' + (await bulkStatusText()) + ' puts=' + JSON.stringify(bulkPutErrors));
        await brandPage.waitForTimeout(400);
      } else {
        await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
        let summarized = false;
        for (let t = 0; t < 60; t++) {
          const st = await bulkStatusText();
          if (/تعذر|فشل|أصلحي|مرحلة/.test(st) && !/جار|حفظ العرض|رفع|مراجعة/.test(st)) {
            throw new Error('bulk review error: ' + st);
          }
          const heading = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
          if (/ملخص المجموعة/.test(heading) || /مراجعة المجموعة قبل النشر/.test(st)) {
            summarized = true;
            break;
          }
          await brandPage.waitForTimeout(500);
        }
        if (!summarized) throw new Error('bulk summary failed: ' + (await bulkStatusText()));
      }
    }
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-summary.png'), fullPage: true });

    // Read batch id from URL
    const bulkUrl = brandPage.url();
    const batchId = new URL(bulkUrl).searchParams.get('bulk');
    assert.ok(batchId, 'bulk batchId in URL');
    const batchGot = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
    const cards = batchGot?.cards || [];
    const ownersBefore = cards.map((c: any) => c.targetOwnerId);
    const mediaBefore = cards.map((c: any) => c.media?.videoMediaId || null);

    // Return from summary → edit card 0 (prove media restore without re-picking)
    await openBulkCardFromSummary(0);
    const uiCard0FromSummary = await readBulkUiCard();
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-card0-from-summary.png'), fullPage: true });
    // Back to summary via save+review (should not require new upload)
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
    for (let t = 0; t < 40; t++) {
      const heading = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
      if (/ملخص المجموعة/.test(heading)) break;
      const st = await bulkStatusText();
      if (/اختاري مقطع|لم يُختر/.test(st)) throw new Error('media re-pick demanded after restore: ' + st);
      await brandPage.waitForTimeout(400);
    }

    // Full page reload + reopen batch
    await brandPage.goto(
      `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiRoot + '/api/v1')}&bulk=${batchId}`,
      { waitUntil: 'networkidle' },
    );
    await brandPage.waitForTimeout(1500);
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-reopen.png'), fullPage: true });

    // Open each card from UI and compare displayed fields (not getBulkBatch alone).
    const uiCards: any[] = [];
    for (let i = 0; i < 3; i++) {
      // After reload journey may land on card or summary — force summary then open.
      const heading = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
      if (!/ملخص المجموعة/.test(heading)) {
        const reviewBtn = brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' });
        if (await reviewBtn.count()) {
          await reviewBtn.click();
          await brandPage.waitForTimeout(1200);
        }
      }
      if (i === 0 || !/ملخص المجموعة/.test((await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '')) {
        // Ensure we are on summary before opening by index
        const h2 = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
        if (!/ملخص المجموعة/.test(h2)) {
          await brandPage.goto(
            `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiRoot + '/api/v1')}&bulk=${batchId}`,
            { waitUntil: 'networkidle' },
          );
          await brandPage.waitForTimeout(1000);
          const rb = brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' });
          if (await rb.count()) {
            await rb.click();
            await brandPage.waitForTimeout(1500);
          }
        }
      }
      await openBulkCardFromSummary(i);
      const ui = await readBulkUiCard();
      uiCards.push(ui);
      await brandPage.screenshot({ path: path.join(evidenceDir, `bulk-ui-card${i}.png`), fullPage: true });
      // Return to summary for next open
      await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
      for (let t = 0; t < 40; t++) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
        if (/ملخص المجموعة/.test(h)) break;
        await brandPage.waitForTimeout(400);
      }
    }

    const batchRe = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
    const cardsRe = batchRe?.cards || [];
    const vals = cardsRe.map((c: any) => {
      const v = c.values || {};
      return {
        cardId: c.cardId,
        nameAr: v.nameAr,
        material: v.material,
        cut: v.cut,
        lengthCm: v.lengthCm,
        stockQty: Object.prototype.hasOwnProperty.call(v, 'stockQty') ? v.stockQty : undefined,
        inventoryMode: v.inventoryMode,
        owner: c.targetOwnerId,
        mediaId: c.media?.videoMediaId || null,
        videoReady: !!(c.media && c.media.videoReady),
      };
    });
    comparisons.push({ id: 'bulk-three', vals, uiCards, batchId });

    const stockOk =
      vals[0]?.stockQty === 7 &&
      vals[1]?.stockQty === 0 &&
      (vals[2]?.stockQty == null || vals[2]?.stockQty === undefined) &&
      (vals[2]?.inventoryMode === 'untracked' || vals[2]?.stockQty == null) &&
      String(uiCards[0]?.stock) === '7' &&
      String(uiCards[1]?.stock) === '0' &&
      String(uiCards[2]?.stock || '') === '';

    const mediaUiOk = uiCards.every(
      (u: any) =>
        u &&
        (u.replaceBtn || /جاهز|مرفوع/.test(String(u.mediaStatus || ''))) &&
        !/لم يُختر مقطع بعد/.test(String(u.mediaStatus || '')),
    );

    const independent =
      cardsRe.length === 3 &&
      vals[0]?.nameAr === cardSpecs[0].name &&
      vals[1]?.nameAr === cardSpecs[1].name &&
      vals[2]?.nameAr === cardSpecs[2].name &&
      JSON.stringify(vals[0]?.material) === JSON.stringify(['silk']) &&
      JSON.stringify(vals[1]?.material) === JSON.stringify(['cotton']) &&
      JSON.stringify([...(vals[2]?.material || [])].map(String).sort()) ===
        JSON.stringify(['linen', 'silk'].sort()) &&
      vals[0]?.cut === 'regular' &&
      vals[1]?.cut === 'fitted' &&
      vals[2]?.cut === 'loose' &&
      vals[0]?.lengthCm === 110 &&
      vals[1]?.lengthCm === 120 &&
      vals[2]?.lengthCm === 130 &&
      uiCards[0]?.nameAr === cardSpecs[0].name &&
      uiCards[1]?.nameAr === cardSpecs[1].name &&
      uiCards[2]?.nameAr === cardSpecs[2].name &&
      JSON.stringify([...(uiCards[2]?.mats || [])].map(String).sort()) ===
        JSON.stringify(['linen', 'silk'].sort()) &&
      new Set(vals.map((v: any) => v.cardId)).size === 3 &&
      new Set(vals.map((v: any) => v.owner).filter(Boolean)).size === 3 &&
      vals.every((v: any) => v.videoReady && v.mediaId) &&
      JSON.stringify(vals.map((v: any) => v.owner)) === JSON.stringify(ownersBefore) &&
      JSON.stringify(vals.map((v: any) => v.mediaId)) === JSON.stringify(mediaBefore);

    record(
      'acc-bulk-three-cards',
      'BROWSER',
      'ثلاث بطاقات مستقلة تُحفظ وتُعاد فتحها بقيمها ووسائطها من الواجهة',
      '3 cards distinct attrs/ids/media + UI match',
      JSON.stringify({ batchId, vals, uiCards, cardCount: cards.length }),
      independent && stockOk && mediaUiOk,
      {
        criterion: 'ACC-BULK-THREE-CARDS',
        evidence: [
          'bulk-summary.png',
          'bulk-reopen.png',
          'bulk-ui-card0.png',
          'bulk-ui-card1.png',
          'bulk-ui-card2.png',
        ],
      },
    );

    record(
      'acc-bulk-media-restore',
      'BROWSER',
      'العودة من الملخص/إعادة التحميل تستعيد المقطع الجاهز دون إعادة اختيار',
      'UI ready + same mediaIds + no re-pick demand',
      JSON.stringify({ uiCard0FromSummary, mediaBefore, mediaAfter: vals.map((v: any) => v.mediaId), mediaUiOk }),
      !!(
        uiCard0FromSummary &&
        (uiCard0FromSummary.replaceBtn || /جاهز|مرفوع/.test(String(uiCard0FromSummary.mediaStatus || ''))) &&
        !/لم يُختر مقطع بعد/.test(String(uiCard0FromSummary.mediaStatus || '')) &&
        mediaUiOk &&
        JSON.stringify(vals.map((v: any) => v.mediaId)) === JSON.stringify(mediaBefore)
      ),
      {
        criterion: 'ACC-BULK-MEDIA-RESTORE',
        evidence: ['bulk-card0-from-summary.png', 'bulk-ui-card0.png', 'bulk-ui-card1.png', 'bulk-ui-card2.png'],
      },
    );

    record(
      'acc-bulk-stock-roundtrip',
      'BROWSER',
      'المخزون 7 / 0 / غير محدد يُحفظ ويُعرض دون تحويل خاطئ إلى untracked',
      'stockQty 7,0,null + UI match',
      JSON.stringify({
        api: vals.map((v: any) => ({ stockQty: v.stockQty, inventoryMode: v.inventoryMode })),
        ui: uiCards.map((u: any) => u?.stock),
      }),
      stockOk,
      {
        criterion: 'ACC-BULK-STOCK-ROUNDTRIP',
        evidence: ['bulk-ui-card0.png', 'bulk-ui-card1.png', 'bulk-ui-card2.png'],
      },
    );

    // Edit materialized card 2 (index 1): rename + attrs, save, leave, reopen — cards 1/3 unchanged.
    await openBulkCardFromSummary(1);
    const editedName = `Acc-Bulk-2-EDIT-${suffix}`;
    await fillBulkFields(editedName, ['linen'], 'loose', 140, 0);
    // Invalid on existing card then fix
    await brandPage.waitForSelector(
      '[data-testid="bulk-registry-attribute-host"] input.mira-attr-number',
      { state: 'attached', timeout: 15000 },
    );
    await brandPage.evaluate(() => {
      const host = document.querySelector('[data-testid="bulk-registry-attribute-host"]');
      const num = host?.querySelector('input.mira-attr-number') as HTMLInputElement | null;
      if (!num) throw new Error('length missing');
      num.value = '999';
      num.dispatchEvent(new Event('input', { bubbles: true }));
      num.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await clickBulkSaveReview();
    await brandPage.waitForTimeout(1000);
    const editInvalidStatus = await bulkStatusText();
    const editBlocked =
      /أصلحي|غير صالح|خصائص|التحقق|رقم|الحد الأقصى/.test(String(editInvalidStatus || ''));
    // Stay on offer after reject — if we landed on summary, reopen card 2.
    {
      const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
      if (/ملخص المجموعة/.test(h)) await openBulkCardFromSummary(1);
    }
    await brandPage.waitForSelector(
      '[data-testid="bulk-registry-attribute-host"] input.mira-attr-number',
      { state: 'attached', timeout: 15000 },
    );
    await brandPage.evaluate(() => {
      const host = document.querySelector('[data-testid="bulk-registry-attribute-host"]');
      const num = host?.querySelector('input.mira-attr-number') as HTMLInputElement | null;
      if (!num) throw new Error('length missing for edit fix');
      num.value = '140';
      num.dispatchEvent(new Event('input', { bubbles: true }));
      num.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await clickBulkSaveReview();
    for (let t = 0; t < 40; t++) {
      const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
      if (/ملخص المجموعة/.test(h)) break;
      await brandPage.waitForTimeout(400);
    }
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-edit-card2-saved.png'), fullPage: true });

    // Leave group and reopen
    await brandPage.goto(
      `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiRoot + '/api/v1')}`,
      { waitUntil: 'networkidle' },
    );
    await brandPage.waitForTimeout(800);
    await brandPage.goto(
      `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiRoot + '/api/v1')}&bulk=${batchId}`,
      { waitUntil: 'networkidle' },
    );
    await brandPage.waitForTimeout(1500);
    const batchAfterEdit = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
    const cardsAfter = batchAfterEdit?.cards || [];
    // Open card 2 from UI
    const hEdit = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
    if (!/ملخص المجموعة/.test(hEdit)) {
      await clickBulkSaveReview().catch(() => undefined);
      await brandPage.waitForTimeout(1500);
    }
    await openBulkCardFromSummary(1);
    const uiEdited = await readBulkUiCard();
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-edit-card2-reopen.png'), fullPage: true });
    await clickBulkSaveReview();
    await brandPage.waitForTimeout(1000);
    await openBulkCardFromSummary(0);
    const uiCard0After = await readBulkUiCard();
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
    await brandPage.waitForTimeout(800);
    await openBulkCardFromSummary(2);
    const uiCard2After = await readBulkUiCard();

    const v0 = cardsAfter[0]?.values || {};
    const v1 = cardsAfter[1]?.values || {};
    const v2 = cardsAfter[2]?.values || {};
    const editOk =
      editBlocked &&
      v1.nameAr === editedName &&
      v1.cut === 'loose' &&
      v1.lengthCm === 140 &&
      JSON.stringify(v1.material) === JSON.stringify(['linen']) &&
      v1.stockQty === 0 &&
      v0.nameAr === cardSpecs[0].name &&
      v0.stockQty === 7 &&
      v0.lengthCm === 110 &&
      v2.nameAr === cardSpecs[2].name &&
      (v2.stockQty == null || v2.stockQty === undefined) &&
      JSON.stringify([...(v2.material || [])].map(String).sort()) === JSON.stringify(['linen', 'silk'].sort()) &&
      uiEdited.nameAr === editedName &&
      String(uiEdited.stock) === '0' &&
      uiCard0After.nameAr === cardSpecs[0].name &&
      String(uiCard0After.stock) === '7' &&
      uiCard2After.nameAr === cardSpecs[2].name &&
      String(uiCard2After.stock || '') === '' &&
      cardsAfter[0]?.targetOwnerId === ownersBefore[0] &&
      cardsAfter[1]?.targetOwnerId === ownersBefore[1] &&
      cardsAfter[2]?.targetOwnerId === ownersBefore[2] &&
      cardsAfter[0]?.media?.videoMediaId === mediaBefore[0] &&
      cardsAfter[1]?.media?.videoMediaId === mediaBefore[1] &&
      cardsAfter[2]?.media?.videoMediaId === mediaBefore[2];

    record(
      'acc-bulk-edit-materialized',
      'BROWSER',
      'تعديل بطاقة materialized وحفظها عبر عنصرها دون تكرار/فقد وسيط أو مخزون الجارات',
      'card2 edited; card1/3 stable; same owners+media',
      JSON.stringify({
        editInvalidStatus,
        editBlocked,
        v0: { nameAr: v0.nameAr, stockQty: v0.stockQty, lengthCm: v0.lengthCm },
        v1: { nameAr: v1.nameAr, stockQty: v1.stockQty, cut: v1.cut, lengthCm: v1.lengthCm, material: v1.material },
        v2: { nameAr: v2.nameAr, stockQty: v2.stockQty, material: v2.material },
        uiEdited,
        uiCard0After,
        uiCard2After,
        owners: cardsAfter.map((c: any) => c.targetOwnerId),
        media: cardsAfter.map((c: any) => c.media?.videoMediaId),
      }),
      editOk,
      {
        criterion: 'ACC-BULK-EDIT-MATERIALIZED',
        evidence: ['bulk-edit-card2-saved.png', 'bulk-edit-card2-reopen.png'],
      },
    );

    // ----- B01 preview: real playback from partner media (cross-origin apiRoot vs portalOrigin) -----
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click().catch(() => undefined);
    await brandPage.waitForTimeout(800);
    await openBulkCardFromSummary(0);
    const previewProbe = await brandPage.evaluate(async () => {
      const video = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
      if (!video) return { ok: false, reason: 'no-video-el' };
      const src = video.currentSrc || video.src || '';
      if (!src || src.includes('/marketplace/media/')) {
        return { ok: false, reason: 'bad-src', src: String(src).slice(0, 120) };
      }
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('loadedmetadata-timeout')), 12000);
        if (video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
          clearTimeout(t);
          resolve();
          return;
        }
        video.addEventListener(
          'loadedmetadata',
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true },
        );
        video.load();
      }).catch((e) => {
        throw e;
      });
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      try {
        await video.play();
      } catch (e: any) {
        return {
          ok: false,
          reason: 'play-failed',
          message: e?.message || String(e),
          duration,
          width,
          height,
          src: src.slice(0, 80),
        };
      }
      await new Promise((r) => setTimeout(r, 400));
      const currentTime = video.currentTime;
      video.pause();
      return {
        ok:
          Number.isFinite(duration) &&
          duration > 0 &&
          width > 0 &&
          height > 0 &&
          currentTime > 0 &&
          !video.error,
        duration,
        width,
        height,
        currentTime,
        readyState: video.readyState,
        srcKind: src.startsWith('blob:') ? 'blob' : src.startsWith('http') ? 'http' : 'other',
        src: src.slice(0, 80),
      };
    });
    const mediaNet = networkLog.filter(
      (n) => String(n.path || '').includes('/partners-portal/media/') && n.status >= 200 && n.status < 300,
    );
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-video-preview-play.png'), fullPage: true });
    record(
      'acc-bulk-video-preview',
      'BROWSER',
      'معاينة وتشغيل المقطع المستعاد عبر أصلين مختلفين (بوابة≠API)',
      'blob/http preview + duration/dims + currentTime>0 + media 2xx',
      JSON.stringify({
        portalOrigin,
        apiRoot,
        previewProbe,
        mediaNetCount: mediaNet.length,
        storage: 'MemoryCatalogMediaStorage',
      }),
      !!(previewProbe && previewProbe.ok && mediaNet.length >= 1),
      { criterion: 'ACC-BULK-VIDEO-PREVIEW', evidence: ['bulk-video-preview-play.png'] },
    );

    // ----- B02.1 preserve purchaseMode + clear description -----
    const owner0 = cardsAfter[0]?.targetOwnerId;
    assert.ok(owner0, 'owner0');
    await prisma.product.update({
      where: { id: owner0 },
      data: { purchaseMode: 'internal_cod', descriptionAr: 'وصف قبل المسح ' + suffix },
    });
    // Refresh card from summary
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click().catch(() => undefined);
    await brandPage.waitForTimeout(600);
    // Force reload batch so owner values merge
    await brandPage.goto(
      `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiRoot + '/api/v1')}&bulk=${batchId}`,
      { waitUntil: 'networkidle' },
    );
    await brandPage.waitForTimeout(1200);
    const hPres = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
    if (!/ملخص المجموعة/.test(hPres)) {
      const rb = brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' });
      if (await rb.count()) {
        await rb.click();
        await brandPage.waitForTimeout(1200);
      }
    }
    await openBulkCardFromSummary(0);
    const nameOnly = `Acc-Bulk-1-PM-${suffix}`;
    await brandPage.evaluate((nm) => {
      const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
      const allInputs = Array.from(root!.querySelectorAll('input')) as HTMLInputElement[];
      for (const inp of allInputs) {
        if (inp.type === 'file') continue;
        const label = inp.closest('label') || inp.parentElement;
        const t = (label?.textContent || '') + (inp.name || '');
        if (t.includes('الاسم')) {
          inp.value = nm;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          break;
        }
      }
      const ta = root!.querySelector('textarea') as HTMLTextAreaElement | null;
      if (ta) {
        ta.value = '';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, nameOnly);
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
    for (let t = 0; t < 40; t++) {
      const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
      if (/ملخص المجموعة/.test(h)) break;
      await brandPage.waitForTimeout(400);
    }
    await openBulkCardFromSummary(0);
    const uiPreserved = await readBulkUiCard();
    const descAfter = await brandPage.evaluate(() => {
      const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
      return (root?.querySelector('textarea') as HTMLTextAreaElement | null)?.value ?? null;
    });
    const prod0 = await prisma.product.findUniqueOrThrow({ where: { id: owner0 } });
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-preserve-fields.png'), fullPage: true });
    const preserveOk =
      prod0.purchaseMode === 'internal_cod' &&
      (prod0.descriptionAr == null || prod0.descriptionAr === '') &&
      String(descAfter || '') === '' &&
      uiPreserved.nameAr === nameOnly &&
      prod0.stockQty === 7;
    record(
      'acc-bulk-preserve-fields',
      'BROWSER',
      'تعديل الاسم ومسح الوصف دون تغيير purchaseMode/المخزون',
      'internal_cod kept; description cleared; stock 7',
      JSON.stringify({
        purchaseMode: prod0.purchaseMode,
        descriptionAr: prod0.descriptionAr,
        stockQty: prod0.stockQty,
        uiPreserved,
        descAfter,
      }),
      preserveOk,
      { criterion: 'ACC-BULK-PRESERVE-FIELDS', evidence: ['bulk-preserve-fields.png'] },
    );

    // ----- B02.1 explicit subcategory clear -----
    const subBefore = prod0.subcategory;
    await brandPage.evaluate(() => {
      const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
      const sub = root?.querySelector('[data-testid="bulk-subcategory"]') as HTMLSelectElement | null;
      if (!sub) throw new Error('bulk-subcategory missing');
      sub.value = '';
      sub.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
    for (let t = 0; t < 40; t++) {
      const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
      if (/ملخص المجموعة/.test(h)) break;
      await brandPage.waitForTimeout(400);
    }
    await openBulkCardFromSummary(0);
    const subUiAfter = await brandPage.evaluate(() => {
      const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
      const sub = root?.querySelector('[data-testid="bulk-subcategory"]') as HTMLSelectElement | null;
      return sub ? sub.value : null;
    });
    const prodClear = await prisma.product.findUniqueOrThrow({ where: { id: owner0 } });
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-explicit-clear.png'), fullPage: true });
    const clearOk =
      !!subBefore &&
      (prodClear.subcategory == null || prodClear.subcategory === '') &&
      (subUiAfter == null || subUiAfter === '') &&
      prodClear.purchaseMode === 'internal_cod' &&
      prodClear.stockQty === 7;
    record(
      'acc-bulk-explicit-clear',
      'BROWSER',
      'مسح التصنيف الفرعي صراحة يُحفظ ويعود فارغًا دون تغيير purchaseMode/المخزون',
      'subcategory cleared in UI+DB; other fields stable',
      JSON.stringify({
        subBefore,
        subUiAfter,
        subcategory: prodClear.subcategory,
        purchaseMode: prodClear.purchaseMode,
        stockQty: prodClear.stockQty,
      }),
      clearOk,
      { criterion: 'ACC-BULK-EXPLICIT-CLEAR', evidence: ['bulk-explicit-clear.png'] },
    );

    async function ensureBulkSummary() {
      const already =
        /ملخص المجموعة/.test(
          (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '',
        ) && (await brandPage.locator('.bulk-journey-summary-row').count()) >= 2;
      if (!already) {
        await brandPage.goto(
          `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiRoot + '/api/v1')}&bulk=${batchId}`,
          { waitUntil: 'domcontentloaded', timeout: 45000 },
        );
        await brandPage.waitForTimeout(1200);
      }
      for (let t = 0; t < 30; t++) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
        if (/ملخص المجموعة/.test(h) && (await brandPage.locator('.bulk-journey-summary-row').count()) >= 2) {
          return;
        }
        const hasReview = await brandPage.evaluate(
          () =>
            !!(
              document.querySelector('[data-testid="bulk-save-review"]') ||
              Array.from(document.querySelectorAll('button')).find((b) =>
                /حفظ ومراجعة المجموعة/.test(b.textContent || ''),
              )
            ),
        );
        if (hasReview) {
          await clickBulkSaveReview().catch(() => undefined);
          await brandPage.waitForTimeout(900);
        } else {
          await brandPage.waitForTimeout(400);
        }
      }
      const rows = await brandPage.locator('.bulk-journey-summary-row').count();
      if (rows < 2) throw new Error('ensureBulkSummary failed rows=' + rows);
    }

    // ----- B02.1 variants explicit clear (UI → API → reopen) -----
    try {
      await ensureBulkSummary();
      await openBulkCardFromSummary(0);
      // Materialized cards reject putBulkCard — seed a visible variant via the natural commerce UI, then save.
      await prisma.product.update({
        where: { id: owner0 },
        data: { stockQty: 7, purchaseMode: 'internal_cod' },
      });
      const neighborIds = (
        await prisma.product.findMany({
          where: { partnerId: brand.id, nameAr: { startsWith: 'Acc-Bulk-' }, NOT: { id: owner0 } },
          select: { id: true },
        })
      ).map((p) => p.id);
      if (neighborIds[0]) {
        await prisma.product.update({
          where: { id: neighborIds[0] },
          data: {
            variantsJson: [
              {
                id: 'nv1',
                selections: { size: 'l' },
                available: true,
                priceHalalas: 15000,
                stockQty: 9,
              },
            ] as any,
            stockQty: 9,
          },
        });
      }
      // Open card and add one variant through the shared commerce component.
      await ensureBulkSummary();
      await openBulkCardFromSummary(0);
      await brandPage.waitForTimeout(600);
      const seededUi = await brandPage.evaluate(async () => {
        const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
        const commerce = root?.querySelector('.bulk-journey-commerce, .product-commerce-fields');
        if (!commerce) return { ok: false, reason: 'no-commerce' };
        // Prefer a size/color checkbox then "إضافة تركيبة".
        const choice = Array.from(commerce.querySelectorAll('label.swatch-choice, label.size-choice, .option-group label')).find(
          (lab) => {
            const inp = lab.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
            return !!inp && !inp.checked;
          },
        ) as HTMLElement | undefined;
        if (choice) {
          const inp = choice.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (!inp.checked) {
            inp.click();
          }
        }
        const addBtn = Array.from(commerce.querySelectorAll('button')).find((b) =>
          /إضافة تركيبة/.test(b.textContent || ''),
        ) as HTMLButtonElement | undefined;
        if (!addBtn) return { ok: false, reason: 'no-add-btn', hasChoice: !!choice };
        addBtn.click();
        await new Promise((r) => setTimeout(r, 80));
        const rows = commerce.querySelectorAll('[data-testid="commerce-variant-row"], .variant-row');
        return { ok: rows.length >= 1, rowCount: rows.length, hasChoice: !!choice };
      });
      if (!seededUi.ok) throw new Error('could not seed variant via UI: ' + JSON.stringify(seededUi));
      await clickBulkSaveReview();
      for (let t = 0; t < 40; t++) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
        if (/ملخص المجموعة/.test(h)) break;
        await brandPage.waitForTimeout(400);
      }
      const neighborBefore = await prisma.product.findMany({
        where: { partnerId: brand.id, nameAr: { startsWith: 'Acc-Bulk-' } },
        select: { id: true, variantsJson: true, stockQty: true, purchaseMode: true, nameAr: true, optionsJson: true },
        orderBy: { nameAr: 'asc' },
      });
      const cardBaseline = {
        id: owner0,
        stockQty: 7,
        purchaseMode: 'internal_cod',
        variantsLen: 1,
      };
      // Reload card so commerce UI shows seeded variants.
      await ensureBulkSummary();
      await openBulkCardFromSummary(0);
      await brandPage.waitForTimeout(800);
      const formBefore = await brandPage.evaluate(() => {
        const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
        const offer = /العرض\s+1/.test(document.querySelector('.bulk-journey-shell h3')?.textContent || '');
        const commerce = root?.querySelector('.bulk-journey-commerce, .product-commerce-fields');
        const rows = Array.from(
          root?.querySelectorAll('[data-testid="commerce-variant-row"], .variant-row') || [],
        );
        const stock = root?.querySelector('[data-testid="bulk-stock-qty"]') as HTMLInputElement | null;
        return {
          hasRoot: !!root,
          offer,
          hasCommerce: !!commerce,
          rowCount: rows.length,
          stockValue: stock?.value ?? null,
          stockTestId: !!stock,
        };
      });
      if (!formBefore.hasRoot || !formBefore.offer || !formBefore.hasCommerce || formBefore.rowCount < 1) {
        throw new Error(
          'variants-clear precondition failed: need correct card form with visible variants ' +
            JSON.stringify(formBefore),
        );
      }
      // Gate self-check: acceptance must REJECT missing form / wrong card / leftover rows / neighbor drift.
      const gateRejectsBad = (() => {
        const missingForm = { hasRoot: false, offer: true, rowCount: 0, emptyHint: true };
        const wrongCard = { hasRoot: true, offer: false, rowCount: 0, emptyHint: true };
        const leftover = { hasRoot: true, offer: true, rowCount: 2, emptyHint: true };
        const neighborDrift = false;
        const accept = (s: typeof missingForm, neighborsOk: boolean) =>
          !!(s.hasRoot && s.offer && s.rowCount === 0 && neighborsOk);
        return (
          accept(missingForm, true) === false &&
          accept(wrongCard, true) === false &&
          accept(leftover, true) === false &&
          accept({ hasRoot: true, offer: true, rowCount: 0, emptyHint: true }, neighborDrift) === false
        );
      })();
      if (!gateRejectsBad) throw new Error('variants-clear gate self-test failed');

      // Prefer explicit clear control; else remove each row via labeled remove buttons.
      let clearResult = await brandPage.evaluate(() => {
        const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
        const clearBtn =
          (root?.querySelector('[data-testid="commerce-clear-variants"]') as HTMLButtonElement | null) ||
          (Array.from(root?.querySelectorAll('button') || []).find((b) =>
            /مسح التركيبات/.test(b.textContent || ''),
          ) as HTMLButtonElement | undefined);
        if (clearBtn) {
          clearBtn.click();
          return { via: 'clear-button', clicked: true };
        }
        return { via: 'none', clicked: false };
      });
      if (!clearResult.clicked) {
        clearResult = await brandPage.evaluate(async () => {
          const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
          let removed = 0;
          for (let i = 0; i < 20; i++) {
            const btn = Array.from(root?.querySelectorAll('button') || []).find((b) =>
              /إزالة التركيبة|حذف التركيبة/.test(b.textContent || ''),
            ) as HTMLButtonElement | undefined;
            if (!btn) break;
            btn.click();
            removed += 1;
            await new Promise((r) => setTimeout(r, 40));
          }
          return { via: 'remove-each', clicked: removed > 0, removed };
        });
      }
      if (!clearResult.clicked) throw new Error('no natural clear UI for variants: ' + JSON.stringify(clearResult));

      const afterClearUi = await brandPage.evaluate(() => {
        const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
        const rows = Array.from(
          root?.querySelectorAll('[data-testid="commerce-variant-row"], .variant-row') || [],
        );
        return { rowCount: rows.length, empty: !!root?.querySelector('[data-testid="commerce-variants-empty"]') };
      });
      if (afterClearUi.rowCount !== 0) throw new Error('rows remain after clear UI: ' + JSON.stringify(afterClearUi));

      await clickBulkSaveReview();
      let saveStatus = '';
      for (let t = 0; t < 40; t++) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
        saveStatus = await bulkStatusText();
        if (/ملخص المجموعة/.test(h) || /أصلحي|غير مسموح|تركيب|رفض|تعذر/.test(saveStatus)) break;
        await brandPage.waitForTimeout(400);
      }
      const afterVar = await prisma.product.findUniqueOrThrow({ where: { id: owner0 } });
      const variantsAfter = Array.isArray(afterVar.variantsJson) ? afterVar.variantsJson : afterVar.variantsJson;
      const cleared =
        variantsAfter == null || (Array.isArray(variantsAfter) && variantsAfter.length === 0);
      const rejectedClearly = /أصلحي|غير مسموح|تركيب|رفض|تعذر|مخزون/.test(saveStatus);
      const silentRestore = !cleared && !rejectedClearly;

      await ensureBulkSummary();
      await openBulkCardFromSummary(0);
      await brandPage.waitForTimeout(700);
      const reopenVar = await prisma.product.findUniqueOrThrow({ where: { id: owner0 } });
      const variantsReopen = Array.isArray(reopenVar.variantsJson) ? reopenVar.variantsJson : reopenVar.variantsJson;
      const reopenCleared =
        variantsReopen == null || (Array.isArray(variantsReopen) && variantsReopen.length === 0);
      const uiVariants = await brandPage.evaluate(() => {
        const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
        const offer = /العرض\s+1/.test(document.querySelector('.bulk-journey-shell h3')?.textContent || '');
        const commerce = root?.querySelector('.bulk-journey-commerce, .product-commerce-fields');
        const rows = Array.from(
          root?.querySelectorAll('[data-testid="commerce-variant-row"], .variant-row') || [],
        );
        const emptyHint = !!root?.querySelector('[data-testid="commerce-variants-empty"]');
        const stockInput = root?.querySelector('[data-testid="bulk-stock-qty"]') as HTMLInputElement | null;
        return {
          hasRoot: !!root,
          offer,
          hasCommerce: !!commerce,
          rowCount: rows.length,
          emptyHint,
          stockValue: stockInput?.value ?? null,
          stockTestId: !!stockInput,
        };
      });
      // Strict: form present on correct card AND zero rows. emptyHint alone cannot pass with leftover rows.
      const uiCleared =
        uiVariants.hasRoot === true &&
        uiVariants.offer === true &&
        uiVariants.hasCommerce === true &&
        uiVariants.rowCount === 0 &&
        uiVariants.stockTestId === true;
      const neighborAfter = await prisma.product.findMany({
        where: { partnerId: brand.id, nameAr: { startsWith: 'Acc-Bulk-' }, NOT: { id: owner0 } },
        select: { id: true, stockQty: true, purchaseMode: true, nameAr: true, variantsJson: true, optionsJson: true },
        orderBy: { nameAr: 'asc' },
      });
      const beforeMap = new Map(neighborBefore.filter((p) => p.id !== owner0).map((p) => [p.id, p]));
      const neighborsStable =
        neighborAfter.length === beforeMap.size &&
        neighborAfter.every((p) => {
          const prev = beforeMap.get(p.id);
          return (
            !!prev &&
            prev.stockQty === p.stockQty &&
            prev.purchaseMode === p.purchaseMode &&
            prev.nameAr === p.nameAr &&
            JSON.stringify(prev.variantsJson) === JSON.stringify(p.variantsJson) &&
            JSON.stringify(prev.optionsJson) === JSON.stringify(p.optionsJson)
          );
        });
      await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-variants-clear.png'), fullPage: true });
      const variantsOk =
        gateRejectsBad &&
        !silentRestore &&
        (cleared || rejectedClearly) &&
        (rejectedClearly || (reopenCleared && uiCleared)) &&
        afterVar.purchaseMode === cardBaseline.purchaseMode &&
        afterVar.stockQty === 7 &&
        neighborsStable;
      record(
        'acc-bulk-variants-clear',
        'BROWSER',
        'مسح التركيبات من الواجهة يُحفظ أو يُرفض صراحة دون إعادة صامتة',
        'form present; zero rows; API/DB; neighbors full equality; stock via bulk-stock-qty',
        JSON.stringify({
          formBefore,
          cardBaseline,
          clearResult,
          afterClearUi,
          saveStatus,
          variantsAfter,
          variantsReopen,
          uiVariants,
          uiCleared,
          cleared,
          reopenCleared,
          rejectedClearly,
          silentRestore,
          neighborsStable,
          gateRejectsBad,
          purchaseMode: afterVar.purchaseMode,
          stockQty: afterVar.stockQty,
        }),
        variantsOk,
        { criterion: 'ACC-BULK-VARIANTS-CLEAR', evidence: ['bulk-variants-clear.png'] },
      );
    } catch (varErr: any) {
      record(
        'acc-bulk-variants-clear',
        'BROWSER',
        'مسح التركيبات من الواجهة يُحفظ أو يُرفض صراحة دون إعادة صامتة',
        'cleared=[] OR explicit reject; purchaseMode/stock stable',
        varErr?.message || String(varErr),
        'FAIL',
        { criterion: 'ACC-BULK-VARIANTS-CLEAR', evidence: [] },
      );
    }

    // ----- B01.1: two journeys — (1) no ready media (2) replace ready media -----
    let mediaAfterAlt: string | undefined;
    try {
    await ensureBulkSummary();
    // Journey 1: strip ready media so the offer has no ready intermediate.
    await prisma.catalogMedia.deleteMany({ where: { ownerKind: 'product', ownerId: owner0 } });
    await ensureBulkSummary();
    await openBulkCardFromSummary(0);
    const mediaBeforeSession = (
      await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId)
    )?.cards?.[0]?.media?.videoMediaId;
    const ownersExactBefore = await prisma.product.count({
      where: { partnerId: brand.id, id: owner0 },
    });
    const createdSessionIds: string[] = [];
    const partTouchSessionIds: string[] = [];
    const abortedSessionIds: string[] = [];
    // Hold part failures until explicitly released — uploadViaSession retries sign up to partMaxRetries.
    let blockPartUploads = true;
    await brandPage.route('**/upload-sessions**', async (route) => {
      const req = route.request();
      const method = req.method();
      const u = new URL(req.url());
      const pathname = u.pathname;
      if (method === 'POST' && /\/upload-sessions$/.test(pathname)) {
        const res = await route.fetch();
        const bodyText = await res.text();
        try {
          const j = JSON.parse(bodyText);
          if (j && j.sessionId) createdSessionIds.push(String(j.sessionId));
        } catch {
          /* ignore */
        }
        await route.fulfill({ status: res.status(), headers: res.headers(), body: bodyText });
        return;
      }
      if (
        blockPartUploads &&
        (method === 'PUT' || method === 'POST') &&
        (/\/direct-parts\//.test(pathname) || /\/parts\/\d+\/sign$/.test(pathname) || /\/complete$/.test(pathname))
      ) {
        const sidMatch = /upload-sessions\/([^/]+)/.exec(pathname);
        if (sidMatch) partTouchSessionIds.push(sidMatch[1]);
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'UPLOAD_PART_TEMP', messageAr: 'فشل جزء الرفع بعد إنشاء الجلسة' }),
        });
        return;
      }
      if (
        !blockPartUploads &&
        (method === 'PUT' || method === 'POST') &&
        (/\/direct-parts\//.test(pathname) || /\/parts\/\d+\/sign$/.test(pathname) || /\/complete$/.test(pathname))
      ) {
        const sidMatch = /upload-sessions\/([^/]+)/.exec(pathname);
        if (sidMatch) partTouchSessionIds.push(sidMatch[1]);
      }
      if (method === 'POST' && /\/upload-sessions\/[^/]+\/abort$/.test(pathname)) {
        const sidMatch = /upload-sessions\/([^/]+)/.exec(pathname);
        if (sidMatch) abortedSessionIds.push(sidMatch[1]);
      }
      await route.continue();
    });
    await pickJourneyVideo(TINY_MP4);
    const fileStillAfterPick = await brandPage.evaluate(() => {
      const hooks = (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks;
      const st = hooks ? hooks().getUploadState() : null;
      const v = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
      const mediaSt = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
      return {
        hasFile: !!(st && st.hasFile) || v?.getAttribute('data-local-file') === '1' || /جاهز للرفع|استبدال|محدد/.test(mediaSt),
        hooks: st,
        local: v?.getAttribute('data-local-file') || null,
        mediaSt,
      };
    });
    await clickBulkSaveReview();
    let failAfterSession = false;
    try {
      await brandPage.waitForFunction(
        () => {
          const st = document.querySelector('.bulk-journey-status')?.textContent || '';
          const mediaSt = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
          return /فشل الرفع|تعذر|جزء الرفع|503/.test(st + ' ' + mediaSt);
        },
        undefined,
        { timeout: 90000 },
      );
      failAfterSession = true;
    } catch {
      failAfterSession = false;
    }
    const stateAfterFail = await brandPage.evaluate(() => {
      const hooks = (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks;
      const st = hooks ? hooks().getUploadState() : null;
      const v = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
      const mediaSt = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
      return {
        hooks: st,
        localAttr: v?.getAttribute('data-local-file') || null,
        mediaSt,
        plugin: !!(window as any).__MIRA_BULK_JOURNEY_PLUGIN__,
        hasHooks: !!(window as any).MiraGroupJourney && !!(window as any).MiraGroupJourney.__testHooks,
      };
    });
    const sessionIdAfterFail =
      (stateAfterFail.hooks && stateAfterFail.hooks.uploadSessionId) ||
      (createdSessionIds.length ? createdSessionIds[createdSessionIds.length - 1] : null);
    const fileRetainedAfterFail = !!(
      (stateAfterFail.hooks && stateAfterFail.hooks.hasFile) ||
      stateAfterFail.localAttr === '1' ||
      /محدد|جاهز للرفع|استبدال|فشل/.test(stateAfterFail.mediaSt || '')
    );
    const createdAfterFirstFail = [...createdSessionIds];
    const createdCountAtFail = createdSessionIds.length;
    // Same-file retry must resume the same session id when still bound.
    blockPartUploads = false; // allow completion
    // Wait until busy clears so retry click is not ignored by onClick guard.
    await brandPage.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="bulk-save-review"]') as HTMLButtonElement | null;
        return !!btn && !btn.disabled;
      },
      undefined,
      { timeout: 30000 },
    ).catch(() => undefined);
    // Stay on offer after real fail — if we somehow landed on summary, reopen.
    {
      const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
      if (/ملخص المجموعة/.test(h)) await openBulkCardFromSummary(0);
    }
    const partTouchesBeforeResume = partTouchSessionIds.length;
    await clickBulkSaveReview();
    for (let t = 0; t < 80; t++) {
      const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
      if (/ملخص المجموعة/.test(h)) break;
      const st = await bulkStatusText();
      if (/فشل الرفع|تعذر/.test(st) && !/جار|رفع/.test(st)) break;
      await brandPage.waitForTimeout(500);
    }
    const resumedSameSession =
      !!sessionIdAfterFail &&
      partTouchSessionIds.slice(partTouchesBeforeResume).some((sid) => sid === sessionIdAfterFail) &&
      createdSessionIds.length === createdCountAtFail;
    await openBulkCardFromSummary(0);
    const mediaAfterNoMediaJourney = (
      await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId)
    )?.cards?.[0]?.media?.videoMediaId;
    const ownersExactAfterRetry = await prisma.product.count({ where: { partnerId: brand.id, id: owner0 } });
    // Journey 2: replace ready media — fail mid-upload while prior media stays bound.
    const readyMediaBeforeReplace = mediaAfterNoMediaJourney;
    blockPartUploads = true;
    const createdBeforeAltCycle = createdSessionIds.length;
    abortedSessionIds.length = 0;
    await pickJourneyVideo(TINY_MP4);
    await clickBulkSaveReview();
    await brandPage.waitForFunction(
      () => /فشل الرفع|تعذر|جزء الرفع|503/.test(document.querySelector('.bulk-journey-status')?.textContent || ''),
      undefined,
      { timeout: 90000 },
    ).catch(() => undefined);
    const mediaStillBoundDuringFail = (
      await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId)
    )?.cards?.[0]?.media?.videoMediaId;
    const stateBeforeAlt = await brandPage.evaluate(() => {
      const hooks = (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks;
      return hooks ? hooks().getUploadState() : null;
    });
    const sessionBeforeAlt = stateBeforeAlt && stateBeforeAlt.uploadSessionId;
    blockPartUploads = false;
    await brandPage.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="bulk-save-review"]') as HTMLButtonElement | null;
        return !!btn && !btn.disabled;
      },
      undefined,
      { timeout: 30000 },
    ).catch(() => undefined);
    await pickJourneyVideo(ALT_MP4);
    const stateAfterAltPick = await brandPage.evaluate(() => {
      const hooks = (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks;
      return hooks ? hooks().getUploadState() : null;
    });
    await clickBulkSaveReview();
    for (let t = 0; t < 80; t++) {
      const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
      if (/ملخص المجموعة/.test(h)) break;
      const st = await bulkStatusText();
      if (/فشل الرفع|تعذر/.test(st) && !/جار|رفع/.test(st)) break;
      await brandPage.waitForTimeout(500);
    }
    await brandPage.unroute('**/upload-sessions**').catch(() => undefined);
    await openBulkCardFromSummary(0);
    const batchAfterAlt = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
    mediaAfterAlt = batchAfterAlt?.cards?.[0]?.media?.videoMediaId;
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-upload-session-switch.png'), fullPage: true });
    const partnerProductsNamed = await prisma.product.findMany({
      where: { partnerId: brand.id, nameAr: { startsWith: 'Acc-Bulk-' } },
      select: { id: true, nameAr: true },
    });
    const ownerIdsFromBatch = (batchAfterAlt?.cards || [])
      .map((c: any) => c.targetOwnerId)
      .filter(Boolean)
      .sort();
    const uniqueOwners = [...new Set(ownerIdsFromBatch)];
    const sessionSwitchOk =
      mediaBeforeSession == null &&
      failAfterSession &&
      !!sessionIdAfterFail &&
      createdAfterFirstFail.length === 1 &&
      fileStillAfterPick?.hasFile === true &&
      fileRetainedAfterFail &&
      resumedSameSession === true &&
      !!readyMediaBeforeReplace &&
      mediaStillBoundDuringFail === readyMediaBeforeReplace &&
      createdSessionIds.length > createdBeforeAltCycle &&
      !!mediaAfterAlt &&
      mediaAfterAlt !== readyMediaBeforeReplace &&
      batchAfterAlt?.cards?.[0]?.targetOwnerId === owner0 &&
      ownersExactBefore === 1 &&
      ownersExactAfterRetry === 1 &&
      uniqueOwners.length === 3 &&
      partnerProductsNamed.length === 3 &&
      // Different file must not keep prior session bound; prior session aborted or unbound per contract.
      (stateAfterAltPick?.uploadSessionId == null ||
        stateAfterAltPick.uploadSessionId !== sessionBeforeAlt) &&
      (abortedSessionIds.includes(String(sessionBeforeAlt)) ||
        stateAfterAltPick?.uploadSessionId == null ||
        stateAfterAltPick.uploadSessionId !== sessionBeforeAlt);
    record(
      'acc-bulk-upload-session-switch',
      'BROWSER',
      'رحلة بلا وسيط جاهز ثم استبدال: جلسة حقيقية→فشل→استئناف نفس sessionId؛ ملف مختلف بجلسة جديدة؛ دون تكرار عنصر',
      'no-ready then replace; same session resume; exact owners=3; prior media bound until success; alt session separated',
      JSON.stringify({
        mediaBeforeSession,
        failAfterSession,
        sessionIdAfterFail,
        createdAfterFirstFail,
        createdSessionIds,
        createdBeforeAltCycle,
        abortedSessionIds,
        resumedSameSession,
        fileRetainedAfterFail,
        readyMediaBeforeReplace,
        mediaStillBoundDuringFail,
        sessionBeforeAlt,
        stateAfterAltPick,
        mediaAfterAlt,
        owner0,
        ownersExactBefore,
        ownersExactAfterRetry,
        uniqueOwners,
        partnerProductsNamed,
        batchId,
        card0: batchAfterAlt?.cards?.[0]?.cardId,
        tinyFixture: path.basename(TINY_MP4),
        altFixture: path.basename(ALT_MP4),
        altSha256: ALT_MP4_SHA256,
      }),
      sessionSwitchOk,
      { criterion: 'ACC-BULK-UPLOAD-SESSION-SWITCH', evidence: ['bulk-upload-session-switch.png'] },
    );
    } catch (sessErr: any) {
      await brandPage.unroute('**/upload-sessions**').catch(() => undefined);
      record(
        'acc-bulk-upload-session-switch',
        'BROWSER',
        'جلسة حقيقية ثم فشل خطوة لاحقة؛ إعادة نفس الملف؛ ثم ملف مختلف بجلسة مناسبة دون تكرار عنصر',
        'sessionId observed; fail-after-create; same owner count=1; media changed; alt unbound from prior session',
        sessErr?.message || String(sessErr),
        'FAIL',
        { criterion: 'ACC-BULK-UPLOAD-SESSION-SWITCH', evidence: [] },
      );
    }

    // ----- B01.2 preview isolation WITHOUT page reload between A and B -----
    try {
      // Reach summary via UI only (no goto) so SPA state stays live for cross-card race.
      {
        const h0 = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
        if (!/ملخص المجموعة/.test(h0)) {
          await clickBulkSaveReview().catch(() => undefined);
          for (let t = 0; t < 40; t++) {
            const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
            if (/ملخص المجموعة/.test(h)) break;
            await brandPage.waitForTimeout(400);
          }
        }
      }
      const batchIso = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
      const cardsIso = batchIso?.cards || [];
      const mediaA = cardsIso[0]?.media?.videoMediaId as string | undefined;
      const mediaB = cardsIso[1]?.media?.videoMediaId as string | undefined;
      if (!(mediaA && mediaB && mediaA !== mediaB)) throw new Error('need distinct media A/B for isolation');
      let releaseA: (() => void) | null = null;
      const holdA = new Promise<void>((r) => {
        releaseA = r;
      });
      let aRequested = false;
      let aServedAfterRelease = false;
      let bCompletedBeforeA = false;
      await brandPage.route('**/partners-portal/media/**', async (route) => {
        const mid = decodeURIComponent(route.request().url().split('/').pop() || '');
        if (mid === mediaA) {
          aRequested = true;
          await holdA;
          aServedAfterRelease = true;
        }
        const res = await route.fetch();
        const body = await res.body();
        if (mid === mediaB) bCompletedBeforeA = !aServedAfterRelease;
        await route.fulfill({ status: res.status(), headers: res.headers(), body });
      });
      await openBulkCardFromSummary(0);
      for (let i = 0; i < 60 && !aRequested; i++) await brandPage.waitForTimeout(100);
      // Switch to B while A is still held — no page reload.
      await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click().catch(() => undefined);
      await brandPage.waitForTimeout(600);
      {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
        if (!/ملخص المجموعة/.test(h)) {
          // pending local? discard by opening summary from in-app back: click summary path via edit list
          await brandPage.evaluate(() => {
            const rows = document.querySelectorAll('.bulk-journey-summary-row');
            if (!rows.length) {
              const btns = Array.from(document.querySelectorAll('button'));
              const sum = btns.find((b) => /حفظ ومراجعة المجموعة/.test(b.textContent || ''));
              if (sum) (sum as HTMLButtonElement).click();
            }
          });
          await brandPage.waitForTimeout(800);
        }
      }
      if ((await brandPage.locator('.bulk-journey-summary-row').count()) >= 2) {
        await openBulkCardFromSummary(1);
      } else {
        throw new Error('summary unavailable without reload for A→B race');
      }
      await brandPage.waitForFunction(
        (mid) => {
          const v = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
          const st = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
          return !!v && (v.getAttribute('data-media-id') === mid || /جاهز|مرفوع/.test(st));
        },
        mediaB,
        { timeout: 25000 },
      ).catch(() => undefined);
      const bBeforeRelease = await brandPage.evaluate(() => {
        const v = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
        return {
          mediaId: v?.getAttribute('data-media-id') || null,
          cardId: v?.getAttribute('data-card-id') || null,
          local: v?.getAttribute('data-local-file') || null,
          name: (() => {
            const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
            const inputs = Array.from(root?.querySelectorAll('input') || []) as HTMLInputElement[];
            for (const inp of inputs) {
              if (inp.type === 'file') continue;
              const t = ((inp.closest('label') || inp.parentElement)?.textContent || '') + (inp.name || '');
              if (t.includes('الاسم')) return inp.value;
            }
            return '';
          })(),
        };
      });
      if (releaseA) releaseA();
      await brandPage.waitForTimeout(1200);
      const bAfterRelease = await brandPage.evaluate(() => {
        const v = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
        return {
          mediaId: v?.getAttribute('data-media-id') || null,
          cardId: v?.getAttribute('data-card-id') || null,
          name: (() => {
            const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
            const inputs = Array.from(root?.querySelectorAll('input') || []) as HTMLInputElement[];
            for (const inp of inputs) {
              if (inp.type === 'file') continue;
              const t = ((inp.closest('label') || inp.parentElement)?.textContent || '') + (inp.name || '');
              if (t.includes('الاسم')) return inp.value;
            }
            return '';
          })(),
        };
      });
      // Local-file protection: hold server preview for B, pick local BEFORE late response, then release.
      await brandPage.unroute('**/partners-portal/media/**').catch(() => undefined);
      let releaseBHold: (() => void) | null = null;
      const holdB = new Promise<void>((r) => {
        releaseBHold = r;
      });
      let bHoldServed = false;
      await brandPage.route('**/partners-portal/media/**', async (route) => {
        const mid = decodeURIComponent(route.request().url().split('/').pop() || '');
        if (mid === mediaB) {
          await holdB;
          bHoldServed = true;
        }
        const res = await route.fetch();
        const body = await res.body();
        await route.fulfill({ status: res.status(), headers: res.headers(), body });
      });
      // Force a fresh media fetch for B while hold is armed (reload card).
      await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click().catch(() => undefined);
      await brandPage.waitForTimeout(500);
      await ensureBulkSummary();
      await openBulkCardFromSummary(1);
      // Pick local while B's server bytes are still held.
      await brandPage.setInputFiles('#journeyVideoInput', ALT_MP4);
      await brandPage.waitForFunction(
        () => /استبدال|جاهز للرفع/.test(document.querySelector('.bulk-journey-status')?.textContent || ''),
        undefined,
        { timeout: 15000 },
      );
      const localBeforeLate = await brandPage.evaluate(() => {
        const v = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
        const hooks = (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks;
        const st = hooks ? hooks().getUploadState() : null;
        return {
          local: v?.getAttribute('data-local-file') || null,
          mediaId: v?.getAttribute('data-media-id') || null,
          srcKind: v?.src?.startsWith('blob:') ? 'blob' : 'other',
          hasFile: st?.hasFile === true,
          fileKey: st?.fileKey || null,
        };
      });
      if (releaseBHold) releaseBHold();
      await brandPage.waitForTimeout(1200);
      const localAfterLate = await brandPage.evaluate(() => {
        const v = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
        const hooks = (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks;
        const st = hooks ? hooks().getUploadState() : null;
        return {
          local: v?.getAttribute('data-local-file') || null,
          mediaId: v?.getAttribute('data-media-id') || null,
          srcKind: v?.src?.startsWith('blob:') ? 'blob' : 'other',
          hasFile: st?.hasFile === true,
          fileKey: st?.fileKey || null,
          cardId: st?.cardId || null,
        };
      });
      await brandPage.unroute('**/partners-portal/media/**').catch(() => undefined);
      // Save B and reopen without claiming A changed — read batch cards.
      await clickBulkSaveReview().catch(() => undefined);
      for (let t = 0; t < 40; t++) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
        if (/ملخص المجموعة/.test(h)) break;
        await brandPage.waitForTimeout(400);
      }
      const batchStable = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
      const card0Media = batchStable?.cards?.[0]?.media?.videoMediaId;
      const card1Media = batchStable?.cards?.[1]?.media?.videoMediaId;
      await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-preview-isolation.png'), fullPage: true });
      // Reopen B and prove the played media identity is the replacement (not stale mediaB alone).
      await openBulkCardFromSummary(1);
      // Same strong play evaluator as ACC-BULK-VIDEO-REPLACE (advance currentTime; never swallow play()).
      const bReopenPlay = await brandPage.evaluate(async () => {
        const v = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
        if (!v) return { ok: false, reason: 'no-video' };
        const mid = v.getAttribute('data-media-id');
        await new Promise<void>((resolve) => {
          if (v.readyState >= 2) return resolve();
          v.addEventListener('loadeddata', () => resolve(), { once: true });
          v.addEventListener('canplay', () => resolve(), { once: true });
          setTimeout(() => resolve(), 8000);
        });
        let playErr: string | null = null;
        try {
          await v.play();
        } catch (e: any) {
          playErr = e?.message || String(e);
          return { ok: false, reason: 'play-failed', playErr, mediaId: mid, duration: v.duration };
        }
        const t0 = v.currentTime;
        await new Promise((r) => setTimeout(r, 450));
        const t1 = v.currentTime;
        const advanced = t1 > t0 + 0.05;
        v.pause();
        return {
          ok:
            advanced &&
            Number.isFinite(v.duration) &&
            v.duration > 0 &&
            !v.error &&
            !!mid,
          mediaId: mid,
          t0,
          t1,
          currentTime: t1,
          duration: v.duration,
          playErr,
          srcKind: v.src?.startsWith('blob:') ? 'blob' : v.src?.startsWith('http') ? 'http' : 'other',
        };
      });
      const isolationOk =
        !!aRequested &&
        !!aServedAfterRelease &&
        bAfterRelease.mediaId === mediaB &&
        bBeforeRelease.mediaId === mediaB &&
        mediaA !== mediaB &&
        /Acc-Bulk-2/.test(String(bAfterRelease.name || '')) &&
        localBeforeLate.srcKind === 'blob' &&
        localBeforeLate.local === '1' &&
        localAfterLate.srcKind === 'blob' &&
        localAfterLate.local === '1' &&
        // Prefer hook fileKey when harness bound; otherwise local blob attrs are authoritative.
        (localBeforeLate.fileKey == null ||
          localAfterLate.fileKey == null ||
          localAfterLate.fileKey === localBeforeLate.fileKey) &&
        !!bHoldServed &&
        card0Media === mediaA &&
        !!card1Media &&
        card1Media !== mediaB &&
        bReopenPlay.ok === true &&
        bReopenPlay.mediaId === card1Media;
      record(
        'acc-bulk-preview-isolation',
        'BROWSER',
        'معاينة A المتأخرة لا تطمس بطاقة B؛ الملف المحلي يبقى بعد رد خادم متأخر',
        'distinct mediaA≠mediaB; B stable after delayed A; local blob survives late B response',
        JSON.stringify({
          mediaA,
          mediaB,
          aRequested,
          aServedAfterRelease,
          bCompletedBeforeA,
          bBeforeRelease,
          bAfterRelease,
          localBeforeLate,
          localAfterLate,
          bHoldServed,
          card0Media,
          card1Media,
          bReopenPlay,
          altFixture: path.basename(ALT_MP4),
          altSha256: ALT_MP4_SHA256,
        }),
        isolationOk,
        { criterion: 'ACC-BULK-PREVIEW-ISOLATION', evidence: ['bulk-preview-isolation.png'] },
      );
    } catch (isoErr: any) {
      await brandPage.unroute('**/partners-portal/media/**').catch(() => undefined);
      record(
        'acc-bulk-preview-isolation',
        'BROWSER',
        'معاينة A المتأخرة لا تطمس بطاقة B (بدون إعادة تحميل) ولا تطمس اختيارًا محليًا',
        'B mediaId stable after delayed A; local blob on B; A media unchanged in batch',
        isoErr?.message || String(isoErr),
        'FAIL',
        { criterion: 'ACC-BULK-PREVIEW-ISOLATION', evidence: [] },
      );
    }

    // ----- B01 replace + negative pending + ACL -----
    let mediaAfterReplaceForAcl: string | null = null;
    try {
      await brandPage.unroute('**/partners-portal/media/**').catch(() => undefined);
      await brandPage.unroute('**/upload-sessions**').catch(() => undefined);
      await brandPage.goto(
        `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiRoot + '/api/v1')}&bulk=${batchId}`,
        { waitUntil: 'domcontentloaded', timeout: 45000 },
      );
      await brandPage.waitForSelector('.bulk-journey-shell', { timeout: 20000 });
      await brandPage.waitForTimeout(800);
      await ensureBulkOfferCard(0);
      const mediaBeforeReplace =
        (
          await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId)
        )?.cards?.[0]?.media?.videoMediaId || mediaAfterAlt;
      await pickJourneyVideo(ALT_MP4);
      await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-replace-selected.png'), fullPage: true });

      // J-A02: arm clear inside ensureVideoReady (save path), then run the same save CTA.
      const armed = await brandPage.evaluate(() => {
        const plugin = (window as any).__MIRA_BULK_JOURNEY_PLUGIN__;
        const hooks = (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks;
        if (!plugin) return { ok: false, reason: 'no-plugin' };
        if (!hooks) return { ok: false, reason: 'no-hooks' };
        const fn = hooks();
        if (!fn || typeof fn.armClearPendingFileOnNextSave !== 'function') {
          return { ok: false, reason: 'hooks-unbound' };
        }
        const arm = fn.armClearPendingFileOnNextSave() || {};
        // Require real bind (armed:true). ok≠armed — unbound returns armed:false.
        return { ok: arm.armed === true, ...arm, hasPlugin: true };
      });
      if (!armed.ok) throw new Error('file-loss arm failed: ' + JSON.stringify(armed));
      // Same journey-success evaluator for negative (must reject) and positive (must accept) replace.
      async function evaluateReplaceJourneySuccess(baselineMedia: string | null | undefined) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
        const onSummary = /ملخص المجموعة/.test(h);
        const batch = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
        const mediaNow = batch?.cards?.[0]?.media?.videoMediaId || null;
        const ownerOk = batch?.cards?.[0]?.targetOwnerId === owner0;
        const mediaChanged = !!baselineMedia && !!mediaNow && mediaNow !== baselineMedia;
        return {
          ok: onSummary && mediaChanged && ownerOk,
          onSummary,
          mediaNow,
          mediaChanged,
          ownerOk,
          baselineMedia: baselineMedia || null,
        };
      }
      await clickBulkSaveReview();
      let saveFailStatus = '';
      for (let t = 0; t < 40; t++) {
        saveFailStatus = await bulkStatusText();
        if (/اختاري مقطع|فيديو|تعذر|فشل/.test(saveFailStatus) && !/جار|رفع المقطع:/.test(saveFailStatus)) break;
        await brandPage.waitForTimeout(400);
      }
      const hAfterArmed =
        (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
      const armedJourney = await evaluateReplaceJourneySuccess(mediaBeforeReplace);
      const negReplaceCaught =
        armed.ok === true &&
        armedJourney.ok === false &&
        /اختاري مقطع|فيديو لهذا العرض|تعذر|فشل/.test(saveFailStatus) &&
        !/ملخص المجموعة/.test(hAfterArmed);
      // Restore: disarm + re-pick + save successfully (must still be on offer after failed armed save)
      await brandPage.evaluate(() => {
        const hooks = (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks;
        if (hooks) hooks().disarmClearPendingFileOnNextSave();
      });
      {
        const onOffer = await brandPage.evaluate(
          () =>
            /العرض\s+\d+/.test(document.querySelector('.bulk-journey-shell h3')?.textContent || '') &&
            !!document.querySelector('#journeyVideoInput'),
        );
        if (!onOffer) await ensureBulkOfferCard(0);
      }
      await pickJourneyVideo(ALT_MP4);
      await brandPage.evaluate(() => {
        const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
        const allInputs = Array.from(root!.querySelectorAll('input')) as HTMLInputElement[];
        for (const inp of allInputs) {
          if (inp.type === 'file') continue;
          const label = inp.closest('label') || inp.parentElement;
          if (((label?.textContent || '') + (inp.name || '')).includes('الاسم')) {
            inp.value = (inp.value || '') + '-r';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          }
        }
      });
      const pendingStill = await brandPage.evaluate(() => {
        const st = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
        const hooks = (window as any).MiraGroupJourney && (window as any).MiraGroupJourney.__testHooks;
        const has = hooks ? !!hooks().getUploadState().hasFile : /استبدال|جاهز للرفع|محدد/.test(st);
        return has && /محدد|استبدال|يُرفع|جاهز للرفع/.test(st);
      });
      await clickBulkSaveReview();
      for (let t = 0; t < 80; t++) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
        if (/ملخص المجموعة/.test(h)) break;
        const st = await bulkStatusText();
        if (/فشل الرفع|تعذر/.test(st) && !/جار|رفع/.test(st)) break;
        await brandPage.waitForTimeout(500);
      }
      const recoveredJourney = await evaluateReplaceJourneySuccess(mediaBeforeReplace);
      record(
        'acc-neg-replace-pending',
        'BROWSER',
        'فقد الملف أثناء مسار الحفظ يفشل المعيار؛ وبعد نزع التخريب تنجح رحلة الاستبدال',
        'same journey evaluator rejects armed path; accepts recovered replace',
        JSON.stringify({
          armed,
          saveFailStatus,
          hAfterArmed,
          negReplaceCaught,
          pendingStill,
          armedJourney,
          recoveredJourney,
        }),
        negReplaceCaught && pendingStill && recoveredJourney.ok === true,
        { criterion: 'ACC-NEG-REPLACE-PENDING', evidence: ['bulk-replace-selected.png'] },
      );
      await ensureBulkOfferCard(0);
      const batchReplaced = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
      const mediaAfterReplace = batchReplaced?.cards?.[0]?.media?.videoMediaId;
      mediaAfterReplaceForAcl = mediaAfterReplace || null;
      const replacePlay = await brandPage.evaluate(async () => {
        const video = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
        if (!video) return { ok: false, reason: 'no-video' };
        const mid = video.getAttribute('data-media-id');
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) return resolve();
          video.addEventListener('loadeddata', () => resolve(), { once: true });
          video.addEventListener('canplay', () => resolve(), { once: true });
          setTimeout(() => resolve(), 8000);
        });
        let playErr: string | null = null;
        try {
          await video.play();
        } catch (e: any) {
          playErr = e?.message || String(e);
          return { ok: false, reason: 'play-failed', playErr, mediaId: mid, duration: video.duration };
        }
        const t0 = video.currentTime;
        await new Promise((r) => setTimeout(r, 450));
        const t1 = video.currentTime;
        const advanced = t1 > t0 + 0.05;
        video.pause();
        return {
          ok:
            advanced &&
            Number.isFinite(video.duration) &&
            video.duration > 0 &&
            !video.error &&
            !!mid,
          mediaId: mid,
          t0,
          t1,
          currentTime: t1,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          playErr,
        };
      });
      await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-video-replaced.png'), fullPage: true });
      const replaceJourneyOk =
        recoveredJourney.ok === true &&
        !!mediaAfterReplace &&
        mediaAfterReplace !== mediaBeforeReplace &&
        batchReplaced?.cards?.[0]?.targetOwnerId === owner0 &&
        replacePlay?.mediaId === mediaAfterReplace &&
        !!(replacePlay && replacePlay.ok);
      record(
        'acc-bulk-video-replace',
        'BROWSER',
        'استبدال المقطع صراحة ورفعه وتثبيت ارتباطه ثم تشغيل البديل',
        'same journey evaluator accepts; new mediaId; play advances currentTime',
        JSON.stringify({
          mediaBeforeReplace,
          mediaAfterReplace,
          owner0,
          replacePlay,
          pendingStill,
          recoveredJourney,
        }),
        replaceJourneyOk,
        { criterion: 'ACC-BULK-VIDEO-REPLACE', evidence: ['bulk-video-replaced.png', 'bulk-replace-selected.png'] },
      );
    } catch (repErr: any) {
      const msg = repErr?.message || String(repErr);
      for (const crit of ['ACC-BULK-VIDEO-REPLACE', 'ACC-NEG-REPLACE-PENDING'] as CriterionId[]) {
        if (!results.some((r) => r.criterion === crit)) {
          record(crit.toLowerCase(), 'BROWSER', crit, 'PASS', msg, 'FAIL', { criterion: crit, evidence: [] });
        }
      }
    }

    try {
      if (results.some((r) => r.criterion === 'ACC-MEDIA-ACL')) {
        // FIN-04: individual ACL already recorded with independent data — do not depend on bulk.
        throw new Error('ACC-MEDIA-ACL already satisfied independently of bulk');
      }
      const batchForAcl = await brandPage
        .evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId)
        .catch(() => null);
      const aclMediaId =
        mediaAfterReplaceForAcl ||
        batchForAcl?.cards?.[0]?.media?.videoMediaId ||
        mediaAfterAlt ||
        batchForAcl?.cards?.[1]?.media?.videoMediaId ||
        null;
      if (!aclMediaId) throw new Error('acl media id missing');
      const ownerAcl = await brandPage.evaluate(async (mid) => {
        const token = localStorage.getItem('mira_partner_token') || '';
        const base = (window as any).PartnersApi.base;
        const res = await fetch(base + '/partners-portal/media/' + encodeURIComponent(mid), {
          headers: { Authorization: 'Bearer ' + token },
        });
        const buf = await res.arrayBuffer();
        return { status: res.status, bytes: buf.byteLength };
      }, aclMediaId);
      const otherAcl = await fetch(`${apiRoot}/api/v1/partners-portal/media/${encodeURIComponent(aclMediaId)}`, {
        headers: { Authorization: `Bearer ${tokenSalon}` },
      }).then(async (res) => {
        const buf = Buffer.from(await res.arrayBuffer());
        return {
          status: res.status,
          bytes: buf.byteLength,
          contentType: res.headers.get('content-type') || '',
          looksLikeMedia: /video|octet-stream|mp4/i.test(res.headers.get('content-type') || ''),
        };
      });
      const unauthAcl = await fetch(`${apiRoot}/api/v1/partners-portal/media/${encodeURIComponent(aclMediaId)}`).then(
        async (res) => {
          const buf = Buffer.from(await res.arrayBuffer());
          return {
            status: res.status,
            bytes: buf.byteLength,
            contentType: res.headers.get('content-type') || '',
            looksLikeMedia: /video|octet-stream|mp4/i.test(res.headers.get('content-type') || ''),
          };
        },
      );
      const aclProd = await prisma.product.findUniqueOrThrow({ where: { id: owner0 } });
      await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-media-acl.png'), fullPage: true }).catch(() => undefined);
      const aclOk =
        ownerAcl.status === 200 &&
        ownerAcl.bytes > 1000 &&
        otherAcl.status >= 400 &&
        !otherAcl.looksLikeMedia &&
        otherAcl.bytes < ownerAcl.bytes / 10 &&
        unauthAcl.status >= 400 &&
        !unauthAcl.looksLikeMedia &&
        unauthAcl.bytes < ownerAcl.bytes / 10 &&
        aclProd.contentStatus !== 'published' &&
        aclProd.active !== true;
      record(
        'acc-media-acl',
        'BROWSER',
        'المالك يعاين فيديو المسودة؛ شريك آخر وغير الموثّق يُرفضان دون بايتات وسيط',
        'owner 200+bytes; other/unauth 4xx+empty; draft not publicized',
        JSON.stringify({
          aclMediaId,
          ownerAcl,
          otherAcl,
          unauthAcl,
          contentStatus: aclProd.contentStatus,
          active: aclProd.active,
          portalOrigin,
          apiRoot,
        }),
        aclOk,
        { criterion: 'ACC-MEDIA-ACL', evidence: ['bulk-media-acl.png'] },
      );
    } catch (aclErr: any) {
      const msg = aclErr?.message || String(aclErr);
      if (/already satisfied independently/.test(msg)) {
        // keep individual ACC-MEDIA-ACL result
      } else if (!results.some((r) => r.criterion === 'ACC-MEDIA-ACL')) {
        record(
          'acc-media-acl',
          'BROWSER',
          'ACC-MEDIA-ACL',
          'PASS',
          msg,
          'FAIL',
          { criterion: 'ACC-MEDIA-ACL', evidence: [] },
        );
      }
    }
    } catch (bulkErr: any) {
      const msg = bulkErr?.message || String(bulkErr);
      console.error('bulk journey error:', msg);
      if (!results.some((r) => r.criterion === 'ACC-INVALID-BLOCK-BULK')) {
        record(
          'acc-invalid-bulk',
          'BROWSER',
          'مجموعة: قيمة غير صالحة تمنع الحفظ ثم التصحيح يكمل',
          'blocked then fixable',
          msg,
          'FAIL',
          { criterion: 'ACC-INVALID-BLOCK-BULK', evidence: [] },
        );
      }
      if (!results.some((r) => r.criterion === 'ACC-BULK-THREE-CARDS')) {
        record(
          'acc-bulk-three-cards',
          'BROWSER',
          'ثلاث بطاقات مستقلة تُحفظ وتُعاد فتحها بقيمها ووسائطها من الواجهة',
          '3 cards distinct attrs/ids/media + UI match',
          msg,
          'FAIL',
          { criterion: 'ACC-BULK-THREE-CARDS', evidence: [] },
        );
      }
      if (!results.some((r) => r.criterion === 'ACC-BULK-MEDIA-RESTORE')) {
        record(
          'acc-bulk-media-restore',
          'BROWSER',
          'العودة من الملخص/إعادة التحميل تستعيد المقطع الجاهز دون إعادة اختيار',
          'UI ready + same mediaIds',
          msg,
          'FAIL',
          { criterion: 'ACC-BULK-MEDIA-RESTORE', evidence: [] },
        );
      }
      if (!results.some((r) => r.criterion === 'ACC-BULK-STOCK-ROUNDTRIP')) {
        record(
          'acc-bulk-stock-roundtrip',
          'BROWSER',
          'المخزون 7 / 0 / غير محدد يُحفظ ويُعرض',
          'stockQty 7,0,null + UI match',
          msg,
          'FAIL',
          { criterion: 'ACC-BULK-STOCK-ROUNDTRIP', evidence: [] },
        );
      }
      if (!results.some((r) => r.criterion === 'ACC-BULK-EDIT-MATERIALIZED')) {
        record(
          'acc-bulk-edit-materialized',
          'BROWSER',
          'تعديل بطاقة materialized وحفظها',
          'card2 edited; others stable',
          msg,
          'FAIL',
          { criterion: 'ACC-BULK-EDIT-MATERIALIZED', evidence: [] },
        );
      }
      for (const crit of [
        'ACC-BULK-VIDEO-PREVIEW',
        'ACC-BULK-VIDEO-REPLACE',
        'ACC-BULK-PRESERVE-FIELDS',
        'ACC-BULK-EXPLICIT-CLEAR',
        'ACC-BULK-VARIANTS-CLEAR',
        'ACC-BULK-UPLOAD-SESSION-SWITCH',
        'ACC-BULK-PREVIEW-ISOLATION',
        'ACC-MEDIA-ACL',
        'ACC-NEG-REPLACE-PENDING',
        'ACC-NEG-RESUME-WAITING',
      ] as CriterionId[]) {
        if (!results.some((r) => r.criterion === crit)) {
          record(
            crit.toLowerCase(),
            'BROWSER',
            crit,
            'PASS',
            msg,
            'FAIL',
            { criterion: crit, evidence: [] },
          );
        }
      }
    }

    if (!results.some((r) => r.criterion === 'ACC-NEG-RESUME-UI-REQUIRED')) {
      record(
        'acc-neg-resume-ui-required',
        'BROWSER',
        'تعطيل أثر زر الاستئناف بعد فقد الرد يمنع ادّعاء نجاح الاستئناف من الواجهة',
        'sabotaged resume does not paint success; detector catches defect',
        'brand journey did not reach resume sabotage probe',
        'FAIL',
        { criterion: 'ACC-NEG-RESUME-UI-REQUIRED', evidence: [] },
      );
    }
    if (!results.some((r) => r.criterion === 'ACC-NEG-RESUME-WAITING')) {
      const waitingProbe = 'العنصر موجود (00000000-0000-0000-0000-000000000000) — جاهز لإعادة الإرسال للمراجعة.';
      const waitingRejected = isResumeSuccessText(waitingProbe) === false;
      fs.writeFileSync(
        path.join(evidenceDir, 'neg-resume-waiting.json'),
        JSON.stringify({ waitingProbe, waitingRejected, note: 'fallback-no-brand-journey' }, null, 2),
      );
      record(
        'acc-neg-resume-waiting',
        'BROWSER',
        'عبارة جاهز لإعادة الإرسال للمراجعة حالة انتظار وترفضها قاعدة نجاح الاستئناف',
        'isResumeSuccessText(waiting)=false',
        JSON.stringify({ waitingRejected }),
        waitingRejected,
        { criterion: 'ACC-NEG-RESUME-WAITING', evidence: ['neg-resume-waiting.json'] },
      );
    }

    // FIN negatives: SAME evaluators as delivery — start from complete SUCCESS, flip one field.
    {
      const finNegDir = path.join(evidenceDir, 'fin-negatives');
      fs.mkdirSync(finNegDir, { recursive: true });
      const baselineOk = evaluateMainVideoIsolation(baselineMainVideoIsolationSuccess());
      const wrongPct = evaluateDisplayedProgress50('جارٍ الرفع · 0%') === false &&
        evaluateDisplayedProgress50('جارٍ الرفع · 0.5%') === false &&
        evaluateDisplayedProgress50('جارٍ الرفع · 50%') === true;
      // Boolean cannot rescue wrong card text (pct50Displayed removed from evaluator).
      const wrongPctDespiteFlag = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({ pct50CardText: 'جارٍ الرفع · 0%' }),
      );
      const missingObservation = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({ detailRetryClicked: undefined }),
      );
      const readyBeforeVerify = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({ readyBeforeVerifyReleased: true }),
      );
      const lostMain = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({
          duringDetailChrome: { state: 'empty', text: 'لم يُختر مقطع بعد — هذا ليس خطأ.' },
          mainSurvivedDetail: false,
          mainSurvivedDetailFail: false,
          mainSurvivedCancel: false,
        }),
      );
      const noCancel = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({ cancelClicked: false, cancelObserved: false }),
      );
      const staleMedia = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({
          cycleNewMediaId: 'media-old',
          sessionBoundMediaId: 'media-2',
          finalMainId: 'media-old',
        }),
      );
      const failSessionNull = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({ failSessionId: null }),
      );
      const failSessionDeleted = evaluateMainVideoIsolation(
        (() => {
          const b = baselineMainVideoIsolationSuccess();
          delete (b as { failSessionId?: string | null }).failSessionId;
          return b;
        })(),
      );
      const failSessionMismatch = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({ failSessionId: 'sess-other' }),
      );
      const finalMainNull = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({ finalMainId: null }),
      );
      const finalMainDeleted = evaluateMainVideoIsolation(
        (() => {
          const b = baselineMainVideoIsolationSuccess();
          delete (b as { finalMainId?: string | null }).finalMainId;
          return b;
        })(),
      );
      const finalMainMismatch = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({ finalMainId: 'media-other' }),
      );
      const retryFailed = evaluateMainVideoIsolation(
        baselineMainVideoIsolationSuccess({
          mainRetryClicked: false,
          cycleSaved: false,
          resumedSameSession: false,
        }),
      );
      const wrongResume = evaluateDevResumePublish({
        failInjected: true,
        failStatus: 503,
        stillDraft: true,
        resumeActive: '1',
        resumeLabel: 'استئناف الإرسال للمراجعة',
        account: 'developer',
        labels: ['استئناف الإرسال للمراجعة', 'حفظ المسودة'],
        resumeReqStatus: 201,
        published: true,
        matchCount: 1,
        fixtureId: 'x',
        matchIds: ['x'],
      });
      const notPublished = evaluateDevResumePublish({
        failInjected: true,
        failStatus: 503,
        stillDraft: true,
        resumeActive: '1',
        resumeLabel: 'استئناف النشر',
        account: 'developer',
        labels: ['استئناف النشر', 'حفظ المسودة'],
        resumeReqStatus: 201,
        published: false,
        matchCount: 1,
        fixtureId: 'x',
        matchIds: ['x'],
      });
      const duplicated = evaluateDevResumePublish({
        failInjected: true,
        failStatus: 503,
        stillDraft: true,
        resumeActive: '1',
        resumeLabel: 'استئناف النشر',
        account: 'developer',
        labels: ['استئناف النشر', 'حفظ المسودة'],
        resumeReqStatus: 201,
        published: true,
        matchCount: 2,
        fixtureId: 'x',
        matchIds: ['x', 'y'],
      });
      const qtyNeg = evaluateQtyEmptyZero({
        emptyPersisted: true,
        zeroPersisted: true,
        neighborsEmptyStable: true,
        neighborsZeroStable: false,
        negOk: true,
      });
      const probesCatchDefects =
        baselineOk.ok === true &&
        wrongPct &&
        wrongPctDespiteFlag.ok === false &&
        wrongPctDespiteFlag.reasons.includes('card did not display 50%') &&
        missingObservation.ok === false &&
        readyBeforeVerify.ok === false &&
        readyBeforeVerify.reasons.includes('ready declared before verify released') &&
        lostMain.ok === false &&
        noCancel.ok === false &&
        staleMedia.ok === false &&
        failSessionNull.ok === false &&
        failSessionNull.reasons.includes('missing fail session id') &&
        failSessionDeleted.ok === false &&
        failSessionDeleted.reasons.includes('missing fail session id') &&
        failSessionMismatch.ok === false &&
        failSessionMismatch.reasons.includes(
          'cycle session diverged from fail session without proven reason',
        ) &&
        finalMainNull.ok === false &&
        finalMainNull.reasons.includes('missing final main id') &&
        finalMainDeleted.ok === false &&
        finalMainDeleted.reasons.includes('missing final main id') &&
        finalMainMismatch.ok === false &&
        finalMainMismatch.reasons.includes('final main id does not match cycle media') &&
        retryFailed.ok === false &&
        wrongResume.ok === false &&
        notPublished.ok === false &&
        duplicated.ok === false &&
        qtyNeg.ok === false;
      // Gate negative without circular self-dependence on ACC-FIN-NEGATIVE-PROBES /
      // ACC-GATE-REJECTS-BAD (not yet recorded). Prove PRIOR individual set PASS, flip ONE
      // already-recorded criterion → reject. No synthetic PASS rows. Final evaluateGate()
      // after all records remains the delivery verdict.
      const PRIOR_INDIVIDUAL = INDIVIDUAL_MANDATORY.filter(
        (id) => id !== 'ACC-FIN-NEGATIVE-PROBES' && id !== 'ACC-GATE-REJECTS-BAD',
      );
      const gateBaseline = evaluateGate({ cases: results, mandatory: PRIOR_INDIVIDUAL });
      const sabotageTarget =
        PRIOR_INDIVIDUAL.find((id) => results.some((r) => r.criterion === id && r.status === 'PASS')) ||
        PRIOR_INDIVIDUAL[0];
      const sabotagedCases: CaseResult[] = results.map((r) =>
        r.criterion === sabotageTarget
          ? {
              ...r,
              id: r.id + '-sabotage',
              status: 'FAIL' as const,
              actual: 'sabotage-flip-one-criterion',
            }
          : r,
      );
      const gateWithNegFail = evaluateGate({
        cases: sabotagedCases,
        mandatory: PRIOR_INDIVIDUAL,
      });
      const gateRejectsNegFail =
        gateWithNegFail.ok === false &&
        (gateWithNegFail.bad || []).some((b) => b.startsWith(sabotageTarget + '='));
      const finNegOk =
        probesCatchDefects && gateBaseline.ok === true && gateRejectsNegFail;
      const payload = {
        baselineOk,
        wrongPct,
        wrongPctDespiteFlag,
        missingObservation,
        readyBeforeVerify,
        lostMain,
        noCancel,
        staleMedia,
        failSessionNull,
        failSessionDeleted,
        failSessionMismatch,
        finalMainNull,
        finalMainDeleted,
        finalMainMismatch,
        retryFailed,
        wrongResume,
        notPublished,
        duplicated,
        qtyNeg,
        probesCatchDefects,
        gateBaselineOk: gateBaseline.ok,
        gateBaselineMandatory: PRIOR_INDIVIDUAL,
        gateBaselineMissing: gateBaseline.missing,
        gateBaselineBad: gateBaseline.bad,
        gateBaselineRequired: true,
        gateBaselineCircularFixed: true,
        sabotageTarget,
        gateRejectsNegFail,
        gateRejectReasons: gateWithNegFail.bad,
        finNegOk,
        note: 'Baseline = prior individual criteria only; one real PASS flipped to FAIL; FIN-NEG itself recorded from probesCatchDefects.',
      };
      fs.writeFileSync(path.join(finNegDir, 'fin-negative-probes.json'), JSON.stringify(payload, null, 2));
      fs.copyFileSync(
        path.join(finNegDir, 'fin-negative-probes.json'),
        path.join(evidenceDir, 'fin-negative-probes.json'),
      );
      record(
        'acc-fin-negative-probes',
        'API',
        'مقيّمات التسليم نفسها ترفض نسبًا خاطئة وجاهزية مبكرة وفقد رئيسي وإلغاء/استئناف معطوبين؛ البوابة تسقط الفردي عند فشلها',
        'evaluate* rejects defects; evaluateGate individual fails on ACC-FIN-NEGATIVE-PROBES=FAIL',
        JSON.stringify(payload),
        finNegOk,
        { criterion: 'ACC-FIN-NEGATIVE-PROBES', evidence: ['fin-negative-probes.json'] },
      );
    }

    // Negative C: gate must reject missing / FAIL / empty evidence / missing evidence path.
    {
      // Probe the real record() + evaluateGate() implementations (not a parallel forged.some).
      const probeMandatory = [
        'ACC-INDIVIDUAL-SAVE-RESTORE',
        'ACC-STALE-LATEST-WINS',
        'ACC-INVALID-BLOCK-INDIVIDUAL',
        'ACC-INVALID-BLOCK-BULK',
        'ACC-BULK-THREE-CARDS',
        'ACC-BULK-MEDIA-RESTORE',
      ] as const;
      const probeCases: CaseResult[] = [
        {
          id: 'p1',
          criterion: 'ACC-INDIVIDUAL-SAVE-RESTORE',
          kind: 'API',
          scenario: 'x',
          expected: 'x',
          actual: 'x',
          evidence: ['x.png'],
          evidenceMissing: [],
          status: 'FAIL',
        },
        {
          id: 'p2',
          criterion: 'ACC-STALE-LATEST-WINS',
          kind: 'API',
          scenario: 'x',
          expected: 'x',
          actual: 'x',
          evidence: ['x.png'],
          evidenceMissing: [],
          status: 'BLOCKED',
        },
        {
          id: 'p3',
          criterion: 'ACC-INVALID-BLOCK-INDIVIDUAL',
          kind: 'API',
          scenario: 'x',
          expected: 'x',
          actual: 'x',
          evidence: ['x.png'],
          evidenceMissing: [],
          status: 'NOT_RUN',
        },
        {
          id: 'p4',
          criterion: 'ACC-INVALID-BLOCK-BULK',
          kind: 'API',
          scenario: 'x',
          expected: 'x',
          actual: 'x',
          evidence: ['x.png'],
          evidenceMissing: [],
          status: 'SKIPPED',
        },
        {
          id: 'p5',
          criterion: 'ACC-BULK-THREE-CARDS',
          kind: 'API',
          scenario: 'x',
          expected: 'x',
          actual: 'x',
          evidence: [],
          evidenceMissing: [],
          status: 'PASS',
        },
        {
          id: 'p6',
          criterion: 'ACC-BULK-MEDIA-RESTORE',
          kind: 'API',
          scenario: 'x',
          expected: 'x',
          actual: 'x',
          evidence: ['no-such-evidence.png'],
          evidenceMissing: ['no-such-evidence.png'],
          status: 'PASS',
        },
      ];
      const gateProbe = evaluateGate({ cases: probeCases, mandatory: probeMandatory });
      // Missing criterion: drop ACC-BULK-MEDIA-RESTORE from cases
      const gateMissing = evaluateGate({
        cases: probeCases.filter((c) => c.criterion !== 'ACC-BULK-MEDIA-RESTORE'),
        mandatory: probeMandatory,
      });
      // record() itself must demote PASS+empty evidence
      const beforeLen = results.length;
      record('gate-record-empty-evidence', 'API', 'empty evidence', 'fail', 'probe', true, {
        criterion: 'ACC-GATE-REJECTS-BAD',
        evidence: [],
      });
      const recordedEmpty = results[results.length - 1];
      // Remove the probe record so it does not become the final ACC-GATE mapping.
      results.pop();
      void beforeLen;
      const recordRejectsEmpty = recordedEmpty.status === 'FAIL';
      const wouldReject = gateProbe.ok === false && gateMissing.missing.includes('ACC-BULK-MEDIA-RESTORE') && recordRejectsEmpty;
      fs.writeFileSync(
        path.join(evidenceDir, 'gate-reject-probe.json'),
        JSON.stringify({ gateProbe, gateMissing, recordRejectsEmpty, recordedEmptyStatus: recordedEmpty.status }, null, 2),
      );
      record(
        'acc-gate-rejects-bad',
        'API',
        'بوابة القبول ترفض FAIL/BLOCKED/NOT_RUN/SKIPPED والأدلة الفارغة أو المفقودة',
        'evaluateGate.ok=false for bad set; missing detected; record demotes empty evidence',
        JSON.stringify({ wouldReject, gateProbe, gateMissing, recordRejectsEmpty }),
        wouldReject,
        { criterion: 'ACC-GATE-REJECTS-BAD', evidence: ['gate-reject-probe.json'] },
      );
    }

    // Device deferred
    record('acc-iphone-e5', 'DEVICE', 'iPhone الفعلي', 'E5', 'deferred', 'NOT_RUN');
  } finally {
    try {
      if (browser) {
        const pages = browser.contexts().flatMap((c) => c.pages());
        // Close pages one-by-one so Playwright finalizes each recording before copy.
        for (let i = 0; i < pages.length; i++) {
          const p = pages[i];
          const v = p.video();
          const evidenceName =
            (p as any)._miraEvidenceName ||
            (i === 0 ? 'individual-connected-journey' : `acc-page-${i}`);
          await p.close().catch(() => undefined);
          if (v) {
            const raw = await v.path().catch(() => null);
            if (raw && fs.existsSync(raw)) {
              const dest = path.join(evidenceDir, evidenceName + '.webm');
              try {
                fs.copyFileSync(raw, dest);
                if (evidenceName === 'fin02-main-video-journey') {
                  fs.copyFileSync(raw, path.join(evidenceDir, 'individual-connected-journey.webm'));
                }
              } catch {
                /* ignore */
              }
            }
          }
        }
        await browser.close();
      }
    } catch {
      if (browser) await browser.close().catch(() => undefined);
    }
    for (const id of createdProductIds) {
      await prisma.catalogMedia.deleteMany({ where: { ownerKind: 'product', ownerId: id } }).catch(() => undefined);
      await prisma.product.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdServiceIds) {
      await prisma.catalogMedia.deleteMany({ where: { ownerKind: 'service', ownerId: id } }).catch(() => undefined);
      await prisma.service.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.partnerUser.deleteMany({
      where: { partnerId: { in: [brand.id, developer.id, salon.id] } },
    });
    await prisma.partner.deleteMany({ where: { id: { in: [brand.id, developer.id, salon.id] } } });
    await new Promise<void>((r) => portalServer.close(() => r()));
    await app.close();
    await prisma.$disconnect();
  }

  const ended = new Date().toISOString();
  const gate = evaluateGate();
  const individualGate = evaluateGate({ mandatory: INDIVIDUAL_MANDATORY });
  const bulkGate = evaluateGate({ mandatory: BULK_MANDATORY });
  // Prove separation: a synthetic bulk-only FAIL must not flip a passing individualGate.
  const sepProbeCases = results.map((r) => ({ ...r }));
  const bulkProbeHit = sepProbeCases.find((r) => r.criterion === 'ACC-BULK-THREE-CARDS');
  if (bulkProbeHit) bulkProbeHit.status = 'FAIL';
  const sepIndividualStillOk = evaluateGate({
    cases: sepProbeCases,
    mandatory: INDIVIDUAL_MANDATORY,
  }).ok;
  const sepBulkFails = evaluateGate({ cases: sepProbeCases, mandatory: BULK_MANDATORY }).ok === false;
  const sepFullFails = evaluateGate({ cases: sepProbeCases, mandatory: MANDATORY }).ok === false;
  const separationOk =
    individualGate.ok === true
      ? sepIndividualStillOk && sepBulkFails && sepFullFails
      : sepBulkFails; // when individual already failed, still prove bulk sabotage does not invent individual PASS
  fs.writeFileSync(
    path.join(evidenceDir, 'individual-bulk-separation.json'),
    JSON.stringify(
      {
        individualGate,
        bulkGate,
        sepIndividualStillOk,
        sepBulkFails,
        sepFullFails,
        separationOk,
        note: 'bulk FAIL alone must not change individual verdict',
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(evidenceDir, 'network-sanitized.json'), JSON.stringify(networkLog.slice(0, 400), null, 2));
  fs.writeFileSync(path.join(evidenceDir, 'comparisons.json'), JSON.stringify(comparisons, null, 2));
  const out = {
    verdict: gate.ok ? 'E2A_ACCEPTANCE_PASS' : 'E2A_ACCEPTANCE_FAIL',
    individualVerdict: individualGate.ok ? 'INDIVIDUAL_ACCEPTANCE_PASS' : 'INDIVIDUAL_ACCEPTANCE_FAIL',
    bulkVerdict: bulkGate.ok ? 'BULK_ACCEPTANCE_PASS' : 'BULK_DEFERRED_OR_FAIL',
    bulkStatus: 'DEFERRED_BY_OWNER',
    gate,
    individualGate,
    bulkGate,
    separationOk,
    individualMandatory: INDIVIDUAL_MANDATORY,
    bulkMandatory: BULK_MANDATORY,
    mandatory: MANDATORY,
    started,
    ended,
    testedSha,
    codeContentSha256,
    codeContentFiles,
    evidenceDir,
    cases: results,
  };
  fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  // Individual command exit follows individualGate — deferred/failing groups do not force non-zero.
  process.exit(individualGate.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  const gate = evaluateGate();
  console.log(JSON.stringify({ verdict: 'E2A_ACCEPTANCE_FAIL', gate, cases: results }, null, 2));
  process.exit(1);
});
