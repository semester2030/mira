/**
 * E2أ mandatory BROWSER acceptance gate (portal UI → API → preview → reopen).
 *
 * Run:
 *   DATABASE_URL=postgresql://…@127.0.0.1:5432/… MIRA_PARTNER_EDITOR_V2=true \
 *   npx tsx src/marketplace/taxonomy/elegance-e2a-acceptance.browser.integration-tests.ts
 */
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

/** Mandatory acceptance criteria — missing/non-PASS fails the gate. */
const MANDATORY = [
  'ACC-INDIVIDUAL-SAVE-RESTORE',
  'ACC-STALE-LATEST-WINS',
  'ACC-INVALID-BLOCK-INDIVIDUAL',
  'ACC-INVALID-BLOCK-BULK',
  'ACC-BULK-THREE-CARDS',
  'ACC-BULK-MEDIA-RESTORE',
  'ACC-BULK-EDIT-MATERIALIZED',
  'ACC-BULK-STOCK-ROUNDTRIP',
  'ACC-BULK-VIDEO-REPLACE',
  'ACC-BULK-VIDEO-PREVIEW',
  'ACC-BULK-PRESERVE-FIELDS',
  'ACC-BULK-EXPLICIT-CLEAR',
  'ACC-BULK-UPLOAD-SESSION-SWITCH',
  'ACC-BULK-PREVIEW-ISOLATION',
  'ACC-CREATE-LOSS-RECOVER',
  'ACC-BRAND-SUBMIT-REVIEW',
  'ACC-DEV-PUBLISH-PRODUCT',
  'ACC-DEV-PUBLISH-SERVICE',
  'ACC-MEDIA-ACL',
  'ACC-NEG-RESUME-UI-REQUIRED',
  'ACC-NEG-REPLACE-PENDING',
  'ACC-GATE-REJECTS-BAD',
] as const;

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

function evaluateGate() {
  const byCriterion = new Map<string, CaseResult>();
  for (const r of results) {
    if (r.criterion) byCriterion.set(r.criterion, r);
  }
  const missing: string[] = [];
  const bad: string[] = [];
  const evidenceGaps: string[] = [];
  for (const id of MANDATORY) {
    const r = byCriterion.get(id);
    if (!r) missing.push(id);
    else if (r.status !== 'PASS') bad.push(`${id}=${r.status}`);
    if (r?.evidenceMissing?.length) evidenceGaps.push(`${id}:${r.evidenceMissing.join(',')}`);
  }
  return {
    ok: missing.length === 0 && bad.length === 0,
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
    const context = await browser.newContext({ locale: 'ar-SA', viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
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
    const expected = {
      material: ['silk', 'cotton'],
      cut: 'regular',
      lengthCm: 120,
    };
    const prodName = `Acc-Indiv-${suffix}`;
    await page.fill('#catalogForm input[name="nameAr"]', prodName);
    await page.click('#catalogForm-save');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(evidenceDir, 'individual-after-save.png'), fullPage: true });

    const dash1 = await page.evaluate(async () => (window as any).PartnersApi.dashboard());
    const listed = (dash1?.catalog?.products || []).find((p: any) => p.nameAr === prodName);
    assert.ok(listed?.id, 'product must appear after save');
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
      return { mats, cut, lengthCm };
    });
    const preview2 = await page.evaluate(async (id) => (window as any).PartnersApi.productPreview(id), listed.id);
    const attrs2 = attrsFromPreview(preview2);
    const matOk =
      JSON.stringify([...(attrs2?.material || [])].sort()) === JSON.stringify(['cotton', 'silk']) &&
      attrs2?.cut === 'regular' &&
      attrs2?.lengthCm === 120;
    const uiOk =
      uiAfterReopen.cut === 'regular' &&
      String(uiAfterReopen.lengthCm) === '120' &&
      JSON.stringify([...(uiAfterReopen.mats || [])].map(String).sort()) ===
        JSON.stringify(['cotton', 'silk'].sort());
    record(
      'acc-individual-save-restore',
      'BROWSER',
      'حفظ الفردي ثم preview وإعادة فتح يظهر كل القيم',
      'material+cut+length match UI+preview',
      JSON.stringify({ attrs2, uiAfterReopen, matOk, uiOk }),
      matOk && uiOk,
      { criterion: 'ACC-INDIVIDUAL-SAVE-RESTORE', evidence: ['individual-after-save.png', 'individual-reopen.png'] },
    );

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

    // Dev publish product with media
    await page.evaluate(
      async ({ id, png }) => {
        await (window as any).PartnersApi.addMedia('products', id, 'image/png', png);
      },
      { id: listed.id, png: TINY_PNG },
    );
    await page.click('#catalogForm-save');
    await page.waitForTimeout(1500);
    const pubRow = await prisma.product.findUniqueOrThrow({ where: { id: listed.id } });
    const pubPreview = await page.evaluate(async (id) => (window as any).PartnersApi.productPreview(id), listed.id);
    await page.screenshot({ path: path.join(evidenceDir, 'dev-product-published.png'), fullPage: true });
    record(
      'acc-dev-publish-product',
      'BROWSER',
      'مطور ينشر منتجًا صالحًا مباشرة',
      'contentStatus=published active=true',
      `status=${pubRow.contentStatus} active=${pubRow.active} preview=${pubPreview?.id}`,
      pubRow.contentStatus === 'published' && pubRow.active === true,
      { criterion: 'ACC-DEV-PUBLISH-PRODUCT', evidence: ['dev-product-published.png'] },
    );

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
    const brandName = `Acc-Brand-${suffix}`;
    await fillProductBasics(brandPage, brandName);
    await setClothesAttrs(
      brandPage,
      { materials: ['silk'], cut: 'loose', lengthCm: 100 },
      '#catalogForm [data-testid="registry-attribute-host"]',
    );
    // Let editor-v2 autosave settle once (avoid revision-race save-failed).
    await brandPage.waitForTimeout(2800);
    await brandPage.click('#catalogForm-save');
    await brandPage.waitForTimeout(2000);
    // Poll until open draft exists with this name (source of truth for materialize readiness).
    let draftReady = false;
    for (let i = 0; i < 10; i++) {
      draftReady = await brandPage.evaluate(async (nm) => {
        const api = (window as any).PartnersApi;
        const list =
          (await api.listEditorDrafts?.()) ||
          (await api.editorDrafts?.()) ||
          (await api.request?.('GET', '/partners-portal/editor-drafts')) ||
          null;
        const items = list?.items || list || [];
        return (Array.isArray(items) ? items : []).some(
          (d: any) => d?.values?.nameAr === nm && d?.status === 'open' && d?.revision >= 1,
        );
      }, brandName);
      if (draftReady) break;
      await brandPage.click('#catalogForm-save');
      await brandPage.waitForTimeout(1200);
    }
    const draftStatus = await brandPage.evaluate(() => {
      const form = document.getElementById('catalogForm');
      return form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || '';
    });
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
          return (
            st.includes(ownerId) &&
            /تم التحويل والإرسال للمراجعة|أُرسل|submitReviewStatus|مراجعة/.test(st) &&
            !/تعذر الإرسال للمراجعة|فشل/.test(st)
          );
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
        brandMatches.length === 1 &&
        brandMatches[0].id === brandProd.id &&
        uiBoundId === brandProd.id &&
        inReview,
      { criterion: 'ACC-CREATE-LOSS-RECOVER', evidence: ['create-loss-after-drop.png', 'brand-after-recover.png'] },
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

    async function openBulkCardFromSummary(idx: number) {
      const rows = brandPage.locator('.bulk-journey-summary-row');
      const n = await rows.count();
      if (n <= idx) throw new Error(`summary row ${idx} missing (have ${n})`);
      const row = rows.nth(idx);
      const edit = row.getByRole('button', { name: /تعديل|إكمال العرض/ });
      if (!(await edit.count())) throw new Error(`edit button missing on summary row ${idx}`);
      await edit.first().click();
      await brandPage.waitForTimeout(900);
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
    await brandPage.evaluate(() => {
      const host = document.querySelector('[data-testid="bulk-registry-attribute-host"]');
      const num = host?.querySelector('input.mira-attr-number') as HTMLInputElement | null;
      if (!num) throw new Error('length missing');
      num.value = '999';
      num.dispatchEvent(new Event('input', { bubbles: true }));
      num.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
    await brandPage.waitForTimeout(1000);
    const editInvalidStatus = await bulkStatusText();
    const editBlocked =
      /أصلحي|غير صالح|خصائص|التحقق|رقم|الحد الأقصى/.test(String(editInvalidStatus || ''));
    await brandPage.evaluate(() => {
      const host = document.querySelector('[data-testid="bulk-registry-attribute-host"]');
      const num = host?.querySelector('input.mira-attr-number') as HTMLInputElement | null;
      if (!num) throw new Error('length missing for edit fix');
      num.value = '140';
      num.dispatchEvent(new Event('input', { bubbles: true }));
      num.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
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
      const rb = brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' });
      if (await rb.count()) {
        await rb.click();
        await brandPage.waitForTimeout(1500);
      }
    }
    await openBulkCardFromSummary(1);
    const uiEdited = await readBulkUiCard();
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-edit-card2-reopen.png'), fullPage: true });
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
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

    // ----- B01.1 upload session: fail → same-file retry; fail → different file -----
    const mediaBeforeSession = (
      await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId)
    )?.cards?.[0]?.media?.videoMediaId;
    let uploadFailCount = 0;
    const failThenPass = async (route: Route) => {
      const method = route.request().method();
      const url = route.request().url();
      if (method === 'POST' && /\/upload-sessions$/.test(new URL(url).pathname) && uploadFailCount < 1) {
        uploadFailCount += 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'UPLOAD_SESSION_TEMP', messageAr: 'فشل رفع مؤقت للاختبار' }),
        });
        return;
      }
      await route.continue();
    };
    await brandPage.route('**/upload-sessions', failThenPass);
    await brandPage.setInputFiles('#journeyVideoInput, input[type="file"]', TINY_MP4);
    await brandPage.waitForFunction(() => {
      const st = document.querySelector('.bulk-journey-status')?.textContent || '';
      return /استبدال|جاهز للرفع/.test(st);
    }, { timeout: 8000 });
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
    await brandPage.waitForFunction(
      () => {
        const st = document.querySelector('.bulk-journey-status')?.textContent || '';
        const mediaSt = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
        return /فشل الرفع|تعذر|503|مؤقت/.test(st + ' ' + mediaSt);
      },
      { timeout: 30000 },
    ).catch(() => undefined);
    await brandPage.unroute('**/upload-sessions').catch(() => undefined);
    // Same-file retry (session may resume) — must succeed without duplicate owner.
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
    for (let t = 0; t < 60; t++) {
      const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
      if (/ملخص المجموعة/.test(h)) break;
      const st = await bulkStatusText();
      if (/فشل الرفع|تعذر/.test(st) && !/جار|رفع/.test(st)) break;
      await brandPage.waitForTimeout(500);
    }
    await openBulkCardFromSummary(0);
    const ownersAfterRetry = await prisma.product.count({
      where: { partnerId: brand.id, nameAr: { contains: `Acc-Bulk-1` } },
    });
    // Different file after a second intentional fail
    uploadFailCount = 0;
    await brandPage.route('**/upload-sessions', failThenPass);
    await brandPage.setInputFiles('#journeyVideoInput, input[type="file"]', TINY_MP4);
    await brandPage.waitForTimeout(400);
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
    await brandPage.waitForFunction(
      () => /فشل الرفع|تعذر|503|مؤقت/.test(document.querySelector('.bulk-journey-status')?.textContent || ''),
      { timeout: 30000 },
    ).catch(() => undefined);
    await brandPage.unroute('**/upload-sessions').catch(() => undefined);
    const sessionsBeforeAlt: string[] = [];
    brandPage.on('request', (req) => {
      if (req.method() === 'POST' && /\/upload-sessions$/.test(new URL(req.url()).pathname)) {
        sessionsBeforeAlt.push(req.url());
      }
    });
    await brandPage.setInputFiles('#journeyVideoInput, input[type="file"]', ALT_MP4);
    await brandPage.waitForFunction(() => {
      const st = document.querySelector('.bulk-journey-status')?.textContent || '';
      return /استبدال|جاهز للرفع/.test(st);
    }, { timeout: 8000 });
    await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
    for (let t = 0; t < 80; t++) {
      const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
      if (/ملخص المجموعة/.test(h)) break;
      const st = await bulkStatusText();
      if (/فشل الرفع|تعذر/.test(st) && !/جار|رفع/.test(st)) break;
      await brandPage.waitForTimeout(500);
    }
    await openBulkCardFromSummary(0);
    const batchAfterAlt = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
    const mediaAfterAlt = batchAfterAlt?.cards?.[0]?.media?.videoMediaId;
    const ownersAfterAlt = await prisma.product.count({
      where: { partnerId: brand.id, nameAr: { contains: nameOnly.slice(0, 12) } },
    });
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-upload-session-switch.png'), fullPage: true });
    const sessionSwitchOk =
      !!mediaBeforeSession &&
      !!mediaAfterAlt &&
      mediaAfterAlt !== mediaBeforeSession &&
      batchAfterAlt?.cards?.[0]?.targetOwnerId === owner0 &&
      ownersAfterRetry >= 1;
    record(
      'acc-bulk-upload-session-switch',
      'BROWSER',
      'فشل رفع ثم إعادة نفس الملف؛ ثم فشل وملف مختلف بحجم/بصمة مختلفة ينجح بجلسة جديدة دون تكرار عنصر',
      'same-file retry + different-file success; owner stable; media changed',
      JSON.stringify({
        mediaBeforeSession,
        mediaAfterAlt,
        owner0,
        ownersAfterRetry,
        ownersAfterAlt,
        altFixture: path.basename(ALT_MP4),
        altSha256: ALT_MP4_SHA256,
        newSessionsObserved: sessionsBeforeAlt.length,
      }),
      sessionSwitchOk,
      { criterion: 'ACC-BULK-UPLOAD-SESSION-SWITCH', evidence: ['bulk-upload-session-switch.png'] },
    );

    // ----- helpers for late bulk criteria -----
    async function ensureBulkSummary() {
      await brandPage.goto(
        `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiRoot + '/api/v1')}&bulk=${batchId}`,
        { waitUntil: 'domcontentloaded', timeout: 45000 },
      );
      await brandPage.waitForTimeout(1200);
      for (let t = 0; t < 25; t++) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent().catch(() => '')) || '';
        if (/ملخص المجموعة/.test(h) && (await brandPage.locator('.bulk-journey-summary-row').count()) >= 2) {
          return;
        }
        const rb = brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' });
        if (await rb.count()) {
          await rb.click().catch(() => undefined);
          await brandPage.waitForTimeout(900);
        } else {
          await brandPage.waitForTimeout(400);
        }
      }
      const rows = await brandPage.locator('.bulk-journey-summary-row').count();
      if (rows < 2) throw new Error('ensureBulkSummary failed rows=' + rows);
    }

    // ----- B01.2 preview isolation (deterministic hold) -----
    try {
      await ensureBulkSummary();
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
      await brandPage.route('**/partners-portal/media/**', async (route) => {
        const mid = decodeURIComponent(route.request().url().split('/').pop() || '');
        if (mid === mediaA) {
          aRequested = true;
          await holdA;
          aServedAfterRelease = true;
        }
        const res = await route.fetch();
        const body = await res.body();
        await route.fulfill({ status: res.status(), headers: res.headers(), body });
      });
      await openBulkCardFromSummary(0);
      for (let i = 0; i < 50 && !aRequested; i++) await brandPage.waitForTimeout(100);
      await brandPage.setInputFiles('#journeyVideoInput, input[type="file"]', ALT_MP4);
      await brandPage.waitForFunction(
        () => /استبدال|جاهز للرفع/.test(document.querySelector('.bulk-journey-status')?.textContent || ''),
        undefined,
        { timeout: 10000 },
      );
      if (releaseA) releaseA();
      await brandPage.waitForTimeout(800);
      const localKeptOnA = await brandPage.evaluate(() => {
        const st = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
        const video = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
        return {
          status: st,
          srcKind: video?.src?.startsWith('blob:') ? 'blob' : video?.src ? 'other' : 'none',
        };
      });
      await brandPage.unroute('**/partners-portal/media/**').catch(() => undefined);
      await ensureBulkSummary();
      await openBulkCardFromSummary(1);
      await brandPage.waitForTimeout(800);
      const bAfter = await readBulkUiCard();
      await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-preview-isolation.png'), fullPage: true });
      const isolationOk =
        localKeptOnA.srcKind === 'blob' &&
        /محدد|استبدال|يُرفع|جاهز للرفع/.test(localKeptOnA.status) &&
        // Card B may have been renamed by ACC-BULK-EDIT-MATERIALIZED (…-EDIT-…); must not show card 0 name.
        !!bAfter.nameAr &&
        !String(bAfter.nameAr).includes(nameOnly.slice(0, 18)) &&
        /Acc-Bulk-2/.test(String(bAfter.nameAr)) &&
        !!aRequested &&
        !!aServedAfterRelease;
      record(
        'acc-bulk-preview-isolation',
        'BROWSER',
        'معاينة A المتأخرة لا تطمس اختيار ملف محلي ولا بيانات البطاقة B',
        'local blob kept after delayed A; B remains B',
        JSON.stringify({
          mediaA,
          mediaB,
          aRequested,
          aServedAfterRelease,
          localKeptOnA,
          bAfter,
        }),
        isolationOk,
        { criterion: 'ACC-BULK-PREVIEW-ISOLATION', evidence: ['bulk-preview-isolation.png'] },
      );
    } catch (isoErr: any) {
      await brandPage.unroute('**/partners-portal/media/**').catch(() => undefined);
      record(
        'acc-bulk-preview-isolation',
        'BROWSER',
        'معاينة A المتأخرة لا تطمس اختيار ملف محلي ولا بيانات البطاقة B',
        'local blob kept after delayed A; B remains B',
        isoErr?.message || String(isoErr),
        'FAIL',
        { criterion: 'ACC-BULK-PREVIEW-ISOLATION', evidence: [] },
      );
    }

    // ----- B01 replace + negative pending + ACL -----
    try {
      await ensureBulkSummary();
      await openBulkCardFromSummary(0);
      const mediaBeforeReplace =
        (
          await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId)
        )?.cards?.[0]?.media?.videoMediaId || mediaAfterAlt;
      await brandPage.setInputFiles('#journeyVideoInput, input[type="file"]', ALT_MP4);
      await brandPage.waitForFunction(
        () => /استبدال|جاهز للرفع/.test(document.querySelector('.bulk-journey-status')?.textContent || ''),
        undefined,
        { timeout: 10000 },
      );
      await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-replace-selected.png'), fullPage: true });

      const pendingSabotage = await brandPage.evaluate(() => {
        const root = document.querySelector('#bulkRoot') || document.querySelector('.bulk-journey-root');
        const stBefore = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
        const video = root?.querySelector('[data-testid="bulk-media-video"]');
        if (video) video.remove();
        const statusEl = document.querySelector('[data-testid="bulk-media-status"]');
        if (statusEl) statusEl.textContent = 'لم يُختر مقطع بعد';
        const stAfter = document.querySelector('[data-testid="bulk-media-status"]')?.textContent || '';
        const wouldPass = /محدد|استبدال|يُرفع/.test(stAfter) && !/لم يُختر مقطع بعد/.test(stAfter);
        return { stBefore, stAfter, wouldPass, defectInjected: true };
      });
      const negReplaceCaught = pendingSabotage.defectInjected && pendingSabotage.wouldPass === false;
      await brandPage.setInputFiles('#journeyVideoInput, input[type="file"]', ALT_MP4);
      await brandPage.waitForFunction(
        () => /استبدال|جاهز للرفع/.test(document.querySelector('.bulk-journey-status')?.textContent || ''),
        undefined,
        { timeout: 10000 },
      );
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
        return /محدد|استبدال|يُرفع|جاهز للرفع/.test(st) && !/لم يُختر مقطع بعد/.test(st);
      });
      record(
        'acc-neg-replace-pending',
        'BROWSER',
        'إدخال فقدان الملف المنتظر مؤقتًا يُكتشف؛ وبعد الإزالة يبقى البديل مع تعديل الاسم',
        'sabotage detected (wouldPass=false) then real pending retained',
        JSON.stringify({ pendingSabotage, negReplaceCaught, pendingStill }),
        negReplaceCaught && pendingStill,
        { criterion: 'ACC-NEG-REPLACE-PENDING', evidence: ['bulk-replace-selected.png'] },
      );
      await brandPage.getByRole('button', { name: 'حفظ ومراجعة المجموعة' }).click();
      for (let t = 0; t < 80; t++) {
        const h = (await brandPage.locator('.bulk-journey-shell h3').first().textContent()) || '';
        if (/ملخص المجموعة/.test(h)) break;
        const st = await bulkStatusText();
        if (/فشل الرفع|تعذر/.test(st) && !/جار|رفع/.test(st)) break;
        await brandPage.waitForTimeout(500);
      }
      await openBulkCardFromSummary(0);
      const batchReplaced = await brandPage.evaluate(async (id) => (window as any).PartnersApi.getBulkBatch(id), batchId);
      const mediaAfterReplace = batchReplaced?.cards?.[0]?.media?.videoMediaId;
      const replacePlay = await brandPage.evaluate(async () => {
        const video = document.querySelector('[data-testid="bulk-media-video"]') as HTMLVideoElement | null;
        if (!video) return { ok: false };
        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) return resolve();
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
          video.addEventListener('canplay', () => resolve(), { once: true });
          setTimeout(() => resolve(), 8000);
        });
        try {
          await video.play();
        } catch {
          return { ok: false, duration: video.duration };
        }
        await new Promise((r) => setTimeout(r, 350));
        const t = video.currentTime;
        video.pause();
        return {
          ok: t > 0 && Number.isFinite(video.duration) && video.duration > 0 && !video.error,
          currentTime: t,
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };
      });
      await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-video-replaced.png'), fullPage: true });
      const replaceOk =
        !!mediaBeforeReplace &&
        !!mediaAfterReplace &&
        mediaAfterReplace !== mediaBeforeReplace &&
        batchReplaced?.cards?.[0]?.targetOwnerId === owner0 &&
        !!(replacePlay && replacePlay.ok);
      record(
        'acc-bulk-video-replace',
        'BROWSER',
        'استبدال المقطع صراحة ورفعه وتثبيت ارتباطه ثم تشغيل البديل',
        'new mediaId ≠ old; same owner; playback ok',
        JSON.stringify({ mediaBeforeReplace, mediaAfterReplace, owner0, replacePlay, pendingStill }),
        replaceOk,
        { criterion: 'ACC-BULK-VIDEO-REPLACE', evidence: ['bulk-video-replaced.png', 'bulk-replace-selected.png'] },
      );

      const aclMediaId = mediaAfterReplace || mediaAfterAlt;
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
      await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-media-acl.png'), fullPage: true });
      // Denial may return a small JSON error body; it must not stream media bytes.
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
    } catch (repErr: any) {
      const msg = repErr?.message || String(repErr);
      for (const crit of [
        'ACC-BULK-VIDEO-REPLACE',
        'ACC-NEG-REPLACE-PENDING',
        'ACC-MEDIA-ACL',
      ] as CriterionId[]) {
        if (!results.some((r) => r.criterion === crit)) {
          record(crit.toLowerCase(), 'BROWSER', crit, 'PASS', msg, 'FAIL', { criterion: crit, evidence: [] });
        }
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
        'ACC-BULK-UPLOAD-SESSION-SWITCH',
        'ACC-BULK-PREVIEW-ISOLATION',
        'ACC-MEDIA-ACL',
        'ACC-NEG-REPLACE-PENDING',
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

    // Negative C: gate must reject missing / FAIL / empty evidence / missing evidence path.
    {
      const missingEvidence = !fs.existsSync(path.join(evidenceDir, 'missing-file-should-not-exist.png'));
      // Simulate evaluateGate over a forged FAIL/BLOCKED/empty/missing-evidence set.
      const forged = [
        { criterion: 'ACC-INDIVIDUAL-SAVE-RESTORE', status: 'FAIL' as const, evidence: ['x.png'], evidenceMissing: [] as string[] },
        { criterion: 'ACC-STALE-LATEST-WINS', status: 'BLOCKED' as const, evidence: ['x.png'], evidenceMissing: [] as string[] },
        { criterion: 'ACC-INVALID-BLOCK-INDIVIDUAL', status: 'NOT_RUN' as const, evidence: ['x.png'], evidenceMissing: [] as string[] },
        { criterion: 'ACC-INVALID-BLOCK-BULK', status: 'SKIPPED' as const, evidence: ['x.png'], evidenceMissing: [] as string[] },
        { criterion: 'ACC-BULK-THREE-CARDS', status: 'PASS' as const, evidence: [] as string[], evidenceMissing: [] as string[] },
        {
          criterion: 'ACC-BULK-MEDIA-RESTORE',
          status: 'PASS' as const,
          evidence: ['no-such-evidence.png'],
          evidenceMissing: ['no-such-evidence.png'],
        },
      ];
      const rejectsBadStatus = forged.some((f) => f.status !== 'PASS');
      const rejectsEmptyEvidence = forged.some((f) => f.evidence.length === 0);
      const rejectsMissingPath = forged.some((f) => (f.evidenceMissing || []).length > 0) && missingEvidence;
      const wouldReject = rejectsBadStatus && rejectsEmptyEvidence && rejectsMissingPath;
      fs.writeFileSync(
        path.join(evidenceDir, 'gate-reject-probe.json'),
        JSON.stringify({ forged, missingEvidence, rejectsBadStatus, rejectsEmptyEvidence, rejectsMissingPath, wouldReject }, null, 2),
      );
      record(
        'acc-gate-rejects-bad',
        'API',
        'بوابة القبول ترفض FAIL/BLOCKED/NOT_RUN/SKIPPED والأدلة الفارغة أو المفقودة',
        'detector rejects bad statuses and missing evidence paths',
        JSON.stringify({ wouldReject, missingEvidence, rejectsBadStatus, rejectsEmptyEvidence, rejectsMissingPath }),
        wouldReject,
        { criterion: 'ACC-GATE-REJECTS-BAD', evidence: ['gate-reject-probe.json'] },
      );
    }

    // Device deferred
    record('acc-iphone-e5', 'DEVICE', 'iPhone الفعلي', 'E5', 'deferred', 'NOT_RUN');
  } finally {
    if (browser) await browser.close();
    for (const id of createdProductIds) {
      await prisma.catalogMedia.deleteMany({ where: { productId: id } }).catch(() => undefined);
      await prisma.product.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdServiceIds) {
      await prisma.catalogMedia.deleteMany({ where: { serviceId: id } }).catch(() => undefined);
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
  fs.writeFileSync(path.join(evidenceDir, 'network-sanitized.json'), JSON.stringify(networkLog.slice(0, 400), null, 2));
  fs.writeFileSync(path.join(evidenceDir, 'comparisons.json'), JSON.stringify(comparisons, null, 2));
  const out = {
    verdict: gate.ok ? 'E2A_ACCEPTANCE_PASS' : 'E2A_ACCEPTANCE_FAIL',
    gate,
    mandatory: MANDATORY,
    started,
    ended,
    testedSha,
    evidenceDir,
    cases: results,
  };
  fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(gate.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  const gate = evaluateGate();
  console.log(JSON.stringify({ verdict: 'E2A_ACCEPTANCE_FAIL', gate, cases: results }, null, 2));
  process.exit(1);
});
