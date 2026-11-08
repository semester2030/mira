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
  'ACC-CREATE-LOSS-RECOVER',
  'ACC-BRAND-SUBMIT-REVIEW',
  'ACC-DEV-PUBLISH-PRODUCT',
  'ACC-DEV-PUBLISH-SERVICE',
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

function record(
  id: string,
  kind: CaseResult['kind'],
  scenario: string,
  expected: string,
  actual: string,
  status: boolean | CaseResult['status'],
  opts?: { criterion?: CriterionId; evidence?: string[] },
) {
  const st = status === true ? 'PASS' : status === false ? 'FAIL' : status;
  results.push({
    id,
    criterion: opts?.criterion ?? null,
    kind,
    scenario,
    expected,
    actual,
    evidence: opts?.evidence || [],
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
  for (const id of MANDATORY) {
    const r = byCriterion.get(id);
    if (!r) missing.push(id);
    else if (r.status !== 'PASS') bad.push(`${id}=${r.status}`);
  }
  return {
    ok: missing.length === 0 && bad.length === 0,
    missing,
    bad,
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
    comparisons.push({ id: 'stale-B', midUi, midState, attrsB });
    await page.screenshot({ path: path.join(evidenceDir, 'stale-B-saved.png'), fullPage: true });
    record(
      'acc-stale-latest-wins',
      'BROWSER',
      'استجابة متأخرة لـA لا تستبدل B؛ حفظ B يثبت في القراءة',
      'UI shows B dirty then preview B',
      JSON.stringify({ midUi, midState, attrsB }),
      midUi.cut === 'fitted' &&
        String(midUi.lengthCm) === '150' &&
        /غير محفوظ|أحدث/.test(String(midState || '')) &&
        attrsB?.cut === 'fitted' &&
        attrsB?.lengthCm === 150 &&
        JSON.stringify(attrsB?.material) === JSON.stringify(['cotton']),
      { criterion: 'ACC-STALE-LATEST-WINS', evidence: ['stale-B-saved.png'] },
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
    // Attach media then lose successful submit/rematerialize response
    await brandPage.evaluate(
      async ({ id, png }) => {
        await (window as any).PartnersApi.addMedia('products', id, 'image/png', png);
      },
      { id: brandProd.id, png: TINY_PNG },
    );

    let lostServerStatus = 0;
    let lostBody = '';
    let swallowed = false;
    await brandPage.route('**/editor-drafts/**/materialize', async (route: Route) => {
      if (route.request().method() === 'POST' && !swallowed) {
        swallowed = true;
        const res = await route.fetch();
        lostServerStatus = res.status();
        lostBody = (await res.text()).slice(0, 300);
        await route.abort('failed');
        return;
      }
      await route.continue();
    });
    await brandPage.route('**/submit-review', async (route: Route) => {
      if (route.request().method() === 'POST' && !swallowed) {
        swallowed = true;
        const res = await route.fetch();
        lostServerStatus = res.status();
        lostBody = (await res.text()).slice(0, 300);
        await route.abort('failed');
        return;
      }
      await route.continue();
    });
    await matBtn.click();
    await brandPage.waitForTimeout(1500);
    await brandPage.screenshot({ path: path.join(evidenceDir, 'create-loss-after-drop.png'), fullPage: true });
    // Resume without injecting id
    await matBtn.click();
    await brandPage.waitForTimeout(2500);
    await brandPage.unroute('**/editor-drafts/**/materialize');
    await brandPage.unroute('**/submit-review');
    const dashBr2 = await brandPage.evaluate(async () => (window as any).PartnersApi.dashboard());
    const brandMatches = (dashBr2?.catalog?.products || []).filter((p: any) =>
      String(p.nameAr || '').includes(`Acc-Brand-${suffix}`),
    );
    const brandRow = await prisma.product.findUniqueOrThrow({ where: { id: brandProd.id } });
    const inReview =
      brandRow.reviewStatus === 'in_review' ||
      brandRow.reviewStatus === 'pending_review' ||
      brandRow.contentStatus === 'in_review';
    await brandPage.screenshot({ path: path.join(evidenceDir, 'brand-after-recover.png'), fullPage: true });
    record(
      'acc-create-loss-recover',
      'BROWSER',
      'فقد استجابة ناجحة ثم استئناف من الواجهة دون تكرار',
      'server 2xx/503-created + count=1 + review queued',
      JSON.stringify({
        swallowed,
        lostServerStatus,
        lostBody,
        count: brandMatches.length,
        reviewStatus: brandRow.reviewStatus,
        contentStatus: brandRow.contentStatus,
        boundId: brandProd.id,
      }),
      swallowed &&
        brandMatches.length === 1 &&
        brandMatches[0].id === brandProd.id &&
        (lostServerStatus >= 200 || /MATERIALIZE_SUBMIT_REVIEW_FAILED|تم تحويل/.test(lostBody)) &&
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

    async function fillBulkFields(name: string, mats: string[], cut: string, length: number) {
      await brandPage.evaluate(
        ({ name: nm, mats: materials, cut: cutVal, length: len }) => {
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
        { name, mats, cut, length },
      );
    }

    async function fillBulkCard(name: string, mats: string[], cut: string, length: number) {
      await attachBulkVideo();
      await fillBulkFields(name, mats, cut, length);
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
      { name: `Acc-Bulk-1-${suffix}`, mats: ['silk'], cut: 'regular', length: 110 },
      { name: `Acc-Bulk-2-${suffix}`, mats: ['cotton'], cut: 'fitted', length: 120 },
      { name: `Acc-Bulk-3-${suffix}`, mats: ['linen', 'silk'], cut: 'loose', length: 130 },
    ];

    // Card 1 invalid then fix (shared validation) — video first so remount does not wipe invalidInputs.
    await attachBulkVideo();
    await fillBulkFields(cardSpecs[0].name, cardSpecs[0].mats, cardSpecs[0].cut, 999);
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
    record(
      'acc-invalid-bulk',
      'BROWSER',
      'مجموعة: قيمة غير صالحة تمنع الحفظ ثم التصحيح يكمل',
      'blocked then fixable',
      `status=${bulkInvalidStatus} errBefore=${JSON.stringify(errBefore)} blocked=${blockedInvalid}`,
      blockedInvalid,
      { criterion: 'ACC-INVALID-BLOCK-BULK', evidence: [] },
    );

    for (let i = 0; i < 3; i++) {
      const spec = cardSpecs[i];
      await fillBulkCard(spec.name, spec.mats, spec.cut, spec.length);
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
    // Leave and reopen
    await brandPage.goto(
      `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiRoot + '/api/v1')}&bulk=${batchId}`,
      { waitUntil: 'networkidle' },
    );
    await brandPage.waitForTimeout(1500);
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk-reopen.png'), fullPage: true });
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
        owner: c.targetOwnerId,
      };
    });
    comparisons.push({ id: 'bulk-three', vals, batchId });
    const independent =
      cardsRe.length === 3 &&
      vals[0]?.nameAr === cardSpecs[0].name &&
      vals[1]?.nameAr === cardSpecs[1].name &&
      vals[2]?.nameAr === cardSpecs[2].name &&
      JSON.stringify(vals[0]?.material) === JSON.stringify(['silk']) &&
      JSON.stringify(vals[1]?.material) === JSON.stringify(['cotton']) &&
      vals[0]?.cut === 'regular' &&
      vals[1]?.cut === 'fitted' &&
      vals[2]?.cut === 'loose' &&
      vals[0]?.lengthCm === 110 &&
      vals[1]?.lengthCm === 120 &&
      vals[2]?.lengthCm === 130 &&
      new Set(vals.map((v: any) => v.cardId)).size === 3;
    record(
      'acc-bulk-three-cards',
      'BROWSER',
      'ثلاث بطاقات مستقلة تُحفظ وتُعاد فتحها بقيمها',
      '3 cards distinct attrs/ids',
      JSON.stringify({ batchId, vals, cardCount: cards.length }),
      independent,
      { criterion: 'ACC-BULK-THREE-CARDS', evidence: ['bulk-summary.png', 'bulk-reopen.png'] },
    );
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
          'ثلاث بطاقات مستقلة تُحفظ وتُعاد فتحها بقيمها',
          '3 cards distinct attrs/ids',
          msg,
          'FAIL',
          { criterion: 'ACC-BULK-THREE-CARDS', evidence: [] },
        );
      }
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
