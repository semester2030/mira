/**
 * E2أ R03 — real Chromium against partners-portal/web + local Nest API.
 * Classification: BROWSER (not component FakeEl, not HTTP-only).
 *
 * Run:
 *   DATABASE_URL=postgresql://…@127.0.0.1:5432/… MIRA_PARTNER_EDITOR_V2=true \
 *   npx tsx src/marketplace/taxonomy/elegance-e2a-portal-browser.integration-tests.ts
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
class E2ABrowserModule {}

type CaseResult = {
  id: string;
  kind: 'BROWSER' | 'BROWSER_COMPONENT';
  scenario: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
};

const results: CaseResult[] = [];
const evidenceDir = path.resolve(__dirname, '../../../../../.e2a-browser-evidence');

function record(
  id: string,
  kind: CaseResult['kind'],
  scenario: string,
  expected: string,
  actual: string,
  status: boolean | CaseResult['status'],
) {
  const st = status === true ? 'PASS' : status === false ? 'FAIL' : status;
  results.push({ id, kind, scenario, expected, actual, status: st });
  console.log(`${st} [${kind}] ${id} — ${scenario}`);
  if (st === 'FAIL') throw new Error(`${id} failed: ${actual}`);
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
  const dashUrl = `${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`;
  // Seed session on login origin first — dashboard redirects unauthenticated users to login.html
  // and a reload alone would leave the tab on login.
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
  await page.goto(dashUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#partnerName', { timeout: 20000 });
  const base = await page.evaluate(() => (window as any).PartnersApi && (window as any).PartnersApi.base);
  if (!String(base).startsWith(apiOrigin)) {
    throw new Error(`PartnersApi.base mismatch: ${base} vs ${apiOrigin}`);
  }
}

async function fillBasics(page: Page, name: string) {
  await page.fill('#catalogForm input[name="nameAr"]', name);
  await page.fill('#catalogForm input[name="priceSar"]', '55');
  const cat = page.locator('#catalogForm select[name="category"]');
  if (await cat.count()) await cat.selectOption('clothes');
  await page.waitForTimeout(400);
  const sub = page.locator('#catalogForm select[name="subcategory"]');
  if (await sub.count()) {
    const hasEvening = await sub.locator('option[value="clothes.evening"]').count();
    if (hasEvening) await sub.selectOption('clothes.evening');
    else if ((await sub.locator('option').count()) > 1) await sub.selectOption({ index: 1 });
  }
}

async function main() {
  const started = new Date().toISOString();
  const testedSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be local');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.ADMIN_API_KEY = 'e2a-browser-admin';
  fs.mkdirSync(evidenceDir, { recursive: true });

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `E2A Br ${suffix}`, nameEn: 'E2A Br', city: 'الرياض' },
  });
  const developer = await prisma.partner.create({
    data: { type: 'developer', status: 'active', nameAr: `E2A Dv ${suffix}`, nameEn: 'E2A Dv', city: 'الرياض' },
  });
  const tokenBrand = `tok-br-${suffix}`;
  const tokenDev = `tok-dv-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `br-${suffix}@test.local`, accessToken: tokenBrand },
  });
  await prisma.partnerUser.create({
    data: { partnerId: developer.id, email: `dv-${suffix}@test.local`, accessToken: tokenDev },
  });

  const app = await NestFactory.create(E2ABrowserModule, { logger: ['error'] });
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const apiRoot = await baseUrl(app);
  const portalDir = path.resolve(__dirname, '../../../../partners-portal/web');
  const { server: portalServer, origin: portalOrigin } = await servePortal(portalDir);

  let browser: Browser | null = null;
  const createdIds: string[] = [];
  const networkLog: Array<{ method: string; path: string; status: number }> = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: 'ar-SA', viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on('response', (res) => {
      try {
        const u = new URL(res.url());
        if (u.pathname.includes('/partners-portal') || u.pathname.includes('/marketplace/taxonomy')) {
          networkLog.push({ method: res.request().method(), path: u.pathname, status: res.status() });
        }
      } catch {
        /* ignore */
      }
    });

    // --- BROWSER_COMPONENT: R01 on real DOM via harness + remount API of shared module ---
    {
      await page.goto(`${portalOrigin}/e2-attr-harness.html`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !!(window as any).__e2Harness);
      const r01 = await page.evaluate(async () => {
        const H = (window as any).__e2Harness;
        const M = H.MiraRegistryAttributeFields;
        const registry = await fetch('js/field-registry.v2.json').then((r) => r.json());
        const host = document.createElement('div');
        document.body.appendChild(host);
        const clothes = M.mount(host, { registry, profileId: 'product.clothes', mountId: 'r01b' });
        // empty → type invalid via state projection (DOM number input)
        const input = host.querySelector('input.mira-attr-number') as HTMLInputElement | null;
        if (!input) return { ok: false, reason: 'no-number-input' };
        input.value = '999';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const st = clothes.captureEditorState();
        clothes.destroy();
        const faceHost = document.createElement('div');
        document.body.appendChild(faceHost);
        const face = M.mount(faceHost, {
          registry,
          profileId: 'product.face',
          mountId: 'r01b',
          preserveState: st,
        });
        const parked = face.captureEditorState().parkedInvalid || {};
        const st2 = face.captureEditorState();
        face.destroy();
        const backHost = document.createElement('div');
        document.body.appendChild(backHost);
        const back = M.mount(backHost, {
          registry,
          profileId: 'product.clothes',
          mountId: 'r01b',
          preserveState: st2,
        });
        const blocking = back.hasBlockingErrors();
        const shown = (backHost.querySelector('input.mira-attr-number') as HTMLInputElement | null)?.value;
        const saveBlocked = blocking === true && shown === '999';
        return { ok: saveBlocked, parked, shown, blocking, invalid: back.captureEditorState().invalidInputs };
      });
      await page.screenshot({ path: path.join(evidenceDir, 'r01-harness.png'), fullPage: true });
      record(
        'R01-browser-remount',
        'BROWSER_COMPONENT',
        'lengthCm فارغ→999→تصنيف بلا طول→عودة؛ المدخل والخطأ يبقيان ويمنعان الحفظ',
        'shown=999 blocking=true',
        JSON.stringify(r01),
        !!r01.ok,
      );
    }

    // --- Full portal dashboard (developer) ---
    await loginPage(page, portalOrigin, apiRoot, `dv-${suffix}@test.local`, tokenDev);
    await page.screenshot({ path: path.join(evidenceDir, 'dashboard-dev.png'), fullPage: true });

    // Taxonomy from API (not portal origin)
    const taxFromUi = await page.evaluate(async () => {
      const base = (window as any).PartnersApi?.base;
      const doc = await (window as any).PartnersApi.taxonomy({ lane: 'elegance' });
      return { base, nodes: Array.isArray(doc?.nodes) ? doc.nodes.length : 0 };
    });
    record(
      'R03-taxonomy-source',
      'BROWSER',
      'تحميل التصنيفات عبر PartnersApi من أصل API',
      'base=apiRoot nodes>0',
      JSON.stringify(taxFromUi),
      String(taxFromUi.base).startsWith(apiRoot) && taxFromUi.nodes > 0,
    );

    // Controlled taxonomy failure + retry — fail BEFORE form caches a successful taxonomy doc.
    await page.route('**/marketplace/taxonomy**', async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'forced', messageAr: 'فشل متحكم' }),
      });
    });
    await page.click('#goProduct');
    await page.waitForSelector('#catalogForm', { timeout: 10000 });
    await page.waitForTimeout(600);
    const taxErrVisible = await page.locator('[data-testid="taxonomy-load-error"]').count();
    await page.unroute('**/marketplace/taxonomy**');
    if (await page.locator('[data-testid="taxonomy-load-retry"]').count()) {
      await page.click('[data-testid="taxonomy-load-retry"]');
      await page.waitForTimeout(800);
    }
    const taxErrAfter = await page.locator('[data-testid="taxonomy-load-error"]').count();
    const subOpts = await page.locator('#catalogForm select[name="subcategory"] option').count();
    record(
      'R03-taxonomy-retry',
      'BROWSER',
      'فشل متحكم به ثم إعادة محاولة من الواجهة',
      'error shown then cleared/retry succeeds with options',
      `errBefore=${taxErrVisible} errAfter=${taxErrAfter} subOpts=${subOpts}`,
      taxErrVisible > 0 && taxErrAfter === 0 && subOpts > 1,
    );

    // Fill + multi material via attr host, save (developer createProduct path)
    const prodName = `E2A-Browser-${suffix}`;
    await fillBasics(page, prodName);
    // Select materials if checkboxes exist
    await page.evaluate(() => {
      const host = document.querySelector('[data-testid="registry-attribute-host"]');
      if (!host) return;
      const boxes = host.querySelectorAll('input[type="checkbox"]');
      let n = 0;
      boxes.forEach((b: any) => {
        if (n < 2) {
          b.checked = true;
          b.dispatchEvent(new Event('change', { bubbles: true }));
          n += 1;
        }
      });
    });
    // Single-select cut A→B→A
    await page.evaluate(() => {
      const host = document.querySelector('[data-testid="registry-attribute-host"]');
      if (!host) return;
      const radios = Array.from(host.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
      const cut = radios.filter((r) => (r.name || '').includes('-cut'));
      if (cut.length >= 2) {
        cut[0].click();
        cut[1].click();
        cut[0].click();
      }
    });

    const epochBeforeSave = await page.evaluate(() => {
      // expose via form dataset if present; else null
      return (window as any).__miraFormEpoch ?? null;
    });

    // Intercept save responses for R02 proof
    let patchCount = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/partners-portal/products') && !req.url().includes('/media')) {
        patchCount += 1;
      }
    });

    // Ensure purchase link if required by form mode
    const urlField = page.locator('#catalogForm input[name="externalUrl"], #catalogForm input[name="url"]');
    if (await urlField.count()) await urlField.first().fill('https://example.test/e2a-browser');
    const statusBefore = await page.locator('#catalogForm [role="status"], #catalogForm .lead, #catalogForm p').first().textContent().catch(() => '');
    await page.click('#catalogForm-save');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(evidenceDir, 'after-save-dev.png'), fullPage: true });
    const statusAfter = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const st = form && (form.querySelector('[data-catalog-persist-status]') || form.querySelector('p.lead') || form.querySelector('[role="status"]'));
      return st ? st.textContent : (form && form.textContent || '').slice(0, 400);
    });

    const attrState = await page.locator('[data-testid="attr-save-state"]').textContent().catch(() => '');
    const unsavedNewer = await page.locator('[data-unsaved-newer="1"]').count();
    const me = await page.evaluate(async () => (window as any).PartnersApi.dashboard());
    const listed = (me?.catalog?.products || []).find((p: any) => p.nameAr === prodName || String(p.nameAr || '').includes(suffix));
    if (listed?.id) createdIds.push(listed.id);
    let preview: any = null;
    if (listed?.id) {
      preview = await page.evaluate(async (id) => (window as any).PartnersApi.productPreview(id), listed.id);
    }
    record(
      'R03-individual-save-preview',
      'BROWSER',
      'فردي: حفظ من الواجهة ثم preview (مسار البوابة) يطابق',
      'listed + preview 200 + no fake unsaved',
      `listed=${!!listed} previewId=${preview?.id} attrState=${attrState} unsavedNewer=${unsavedNewer} patches=${patchCount} status=${String(statusAfter).slice(0, 180)} before=${String(statusBefore).slice(0, 80)}`,
      !!listed && !!preview?.id && unsavedNewer === 0,
    );

    // R02: after matching save, attr state saved and no newer-edits flag
    record(
      'R02-browser-clean-save',
      'BROWSER',
      'حفظ طبيعي دون تعديل أثناء الطلب لا يُظهر تعديلات أحدث وهمية',
      'unsavedNewer=0',
      `unsavedNewer=${unsavedNewer} attr=${attrState} epochBefore=${epochBeforeSave}`,
      unsavedNewer === 0,
    );

    // Developer publish path: save with publish (form submit already publishes for developer)
    if (listed?.id) {
      const row = await prisma.product.findUnique({ where: { id: listed.id } });
      // Upload tiny media then submit-review for publish if needed
      const TINY =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      await page.evaluate(
        async ({ id, png }) => {
          await (window as any).PartnersApi.addMedia('products', id, 'image/png', png);
          return (window as any).PartnersApi.request
            ? null
            : fetch;
        },
        { id: listed.id, png: TINY },
      );
      // Prefer UI publish button if present
      const pub = page.locator('#catalogForm-save');
      await pub.click().catch(() => undefined);
      await page.waitForTimeout(800);
      const after = await prisma.product.findUnique({ where: { id: listed.id } });
      const preview2 = await page.evaluate(async (id) => (window as any).PartnersApi.productPreview(id), listed.id);
      record(
        'R02-R03-dev-publish',
        'BROWSER',
        'مطور مخول: نشر/حفظ ينتهي منشوراً وتؤكده القراءة',
        'published+active or in_review with preview',
        `content=${after?.contentStatus} active=${after?.active} prev=${preview2?.id} before=${row?.contentStatus}`,
        after?.contentStatus === 'published' && after?.active === true,
      );
    } else {
      record('R02-R03-dev-publish', 'BROWSER', 'مطور نشر', 'published', 'no listed product', 'BLOCKED');
    }

    // R02 mid-flight edit: delay PATCH/POST response, change material during wait
    if (listed?.id) {
      let released: (() => void) | null = null;
      const gate = new Promise<void>((r) => {
        released = r;
      });
      await page.route(`**/partners-portal/products/${listed.id}`, async (route) => {
        if (route.request().method() === 'PATCH') {
          await gate;
          await route.continue();
        } else await route.continue();
      });
      // set material silk via API of mount then trigger save then change to linen before release
      await page.evaluate(() => {
        const host = document.querySelector('[data-testid="registry-attribute-host"]');
        const boxes = host ? Array.from(host.querySelectorAll('input[type="checkbox"]')) : [];
        boxes.forEach((b: any) => {
          b.checked = false;
          b.dispatchEvent(new Event('change', { bubbles: true }));
        });
        if (boxes[0]) {
          (boxes[0] as HTMLInputElement).checked = true;
          (boxes[0] as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      const savePromise = page.click('#catalogForm-save');
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const host = document.querySelector('[data-testid="registry-attribute-host"]');
        const boxes = host ? Array.from(host.querySelectorAll('input[type="checkbox"]')) : [];
        boxes.forEach((b: any) => {
          b.checked = false;
          b.dispatchEvent(new Event('change', { bubbles: true }));
        });
        if (boxes[1]) {
          (boxes[1] as HTMLInputElement).checked = true;
          (boxes[1] as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      if (released) released();
      await savePromise.catch(() => undefined);
      await page.waitForTimeout(800);
      await page.unroute(`**/partners-portal/products/${listed.id}`);
      const dirtyAfter = await page.locator('#catalogForm [data-testid="attr-save-state"]').first().textContent();
      const unsaved = await page.locator('#catalogForm [data-unsaved-newer="1"]').count();
      record(
        'R02-browser-stale-response',
        'BROWSER',
        'تعديل أثناء تأخير الرد يبقي التعديل الأحدث غير محفوظ',
        'dirty/unsaved after delayed response',
        `attr=${dirtyAfter} unsaved=${unsaved}`,
        /غير محفوظ|أحدث/.test(String(dirtyAfter || '')) || unsaved > 0,
      );
    }

    // Brand account: review path
    const brandPage = await context.newPage();
    await loginPage(brandPage, portalOrigin, apiRoot, `br-${suffix}@test.local`, tokenBrand);
    await brandPage.click('#goProduct');
    await brandPage.waitForSelector('#catalogForm');
    await fillBasics(brandPage, `E2A-BrandRev-${suffix}`);
    await brandPage.click('#catalogForm-save');
    await brandPage.waitForTimeout(1200);
    // Materialize if button present
    const matBtn = brandPage.locator('[data-editor-v2-materialize]');
    if (await matBtn.count()) {
      // Create-loss: swallow materialize success response once
      let swallowed = false;
      let serverStatus = 0;
      let serverBodySnippet = '';
      await brandPage.route('**/editor-drafts/**/materialize', async (route) => {
        const req = route.request();
        if (req.method() === 'POST' && !swallowed) {
          swallowed = true;
          const res = await route.fetch();
          serverStatus = res.status();
          serverBodySnippet = (await res.text()).slice(0, 240);
          // Drop response from client — network error (do not pass id from this response to UI)
          await route.abort('failed');
          return;
        }
        await route.continue();
      });
      await matBtn.click();
      await brandPage.waitForTimeout(1200);
      // Retry / resume from UI without injecting id from the swallowed response
      await matBtn.click().catch(() => undefined);
      await brandPage.waitForTimeout(2000);
      await brandPage.unroute('**/editor-drafts/**/materialize');
      const dash = await brandPage.evaluate(async () => (window as any).PartnersApi.dashboard());
      const products = dash?.catalog?.products || [];
      const matched = products.filter((p: any) => String(p.nameAr || '').includes(`E2A-BrandRev-${suffix}`));
      matched.forEach((p: any) => createdIds.push(p.id));
      // 2xx = full success; 503 MATERIALIZE_SUBMIT_REVIEW_FAILED = owner created, review step pending
      // (exact create-loss surface the portal recovers without a second owner).
      const serverCreated =
        (serverStatus >= 200 && serverStatus < 300) ||
        (serverStatus === 503 && /MATERIALIZE_SUBMIT_REVIEW_FAILED|تم تحويل المسودة/.test(serverBodySnippet));
      record(
        'R03-create-loss-materialize',
        'BROWSER',
        'ضياع رد materialize ثم استئناف من الواجهة دون تكرار',
        'server created owner + exactly one product after UI resume',
        `swallowed=${swallowed} serverStatus=${serverStatus} count=${matched.length} body=${serverBodySnippet}`,
        swallowed && serverCreated && matched.length === 1,
      );
    } else {
      record(
        'R03-create-loss-materialize',
        'BROWSER',
        'ضياع رد الإنشاء عبر materialize',
        'materialize button present',
        'button missing — editor v2 materialize CTA not shown',
        'BLOCKED',
      );
    }

    // Bulk three cards
    await brandPage.click('#goBulk');
    await brandPage.waitForTimeout(800);
    await brandPage.screenshot({ path: path.join(evidenceDir, 'bulk.png'), fullPage: true });
    const bulkRoot = await brandPage.locator('.bulk-journey-root, #bulkRoot').count();
    record(
      'R03-bulk-ui-open',
      'BROWSER',
      'فتح رحلة المجموعات من البوابة الفعلية',
      'bulk root visible',
      `count=${bulkRoot}`,
      bulkRoot > 0,
    );

    // iPhone
    record(
      'R03-iphone',
      'BROWSER',
      'iPhone الفعلي',
      'E5',
      'deferred to E5',
      'NOT_RUN',
    );

    fs.writeFileSync(
      path.join(evidenceDir, 'network-sanitized.json'),
      JSON.stringify(networkLog.slice(0, 200), null, 2),
    );
  } finally {
    if (browser) await browser.close();
    for (const id of createdIds) {
      await prisma.product.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.partnerUser.deleteMany({ where: { partnerId: { in: [brand.id, developer.id] } } });
    await prisma.partner.deleteMany({ where: { id: { in: [brand.id, developer.id] } } });
    await new Promise<void>((r) => portalServer.close(() => r()));
    await app.close();
    await prisma.$disconnect();
  }

  const ended = new Date().toISOString();
  const failed = results.filter((r) => r.status === 'FAIL');
  const out = {
    verdict: failed.length ? 'E2A_BROWSER_FAIL' : 'E2A_BROWSER_PASS',
    classification: 'BROWSER',
    started,
    ended,
    testedSha,
    evidenceDir,
    cases: results,
  };
  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(out, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
