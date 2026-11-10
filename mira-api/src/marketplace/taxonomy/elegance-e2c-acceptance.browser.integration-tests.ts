import { captureAcceptanceRun, assertAcceptanceContentUnchanged } from './acceptance-run-identity';
import {
  READ_AVAILABILITY_FROM_FORM_SOURCE,
  READ_FULL_SERVICE_LAYOUT_SOURCE,
} from './elegance-e2c-dom-snapshot';
import { evaluateComposeFieldOrder, evaluateDesktopGeometry, evaluateFullServiceLayout, compareAvailabilitySnapshot } from './elegance-e2c-acceptance-evaluators';
/**
 * E2 ج — محرر الخدمة: دوائر / موقع / تقويم / حفظ واستعادة.
 * مجموعات مؤجلة. لا يعيد تنفيذ E2أ/ب المقبولة؛ يثبت عدم تراجع صدفة المنتجات فقط.
 */
// Multi-part uploads for service video fail→retry (same contract as E2أ FIN-02).
// Must run before Nest/policy modules resolve UPLOAD_PART_SIZE_BYTES / session gate.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MIRA_PARTNER_UPLOAD_SESSION = process.env.MIRA_PARTNER_UPLOAD_SESSION || 'true';
process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS || 'true';
process.env.MIRA_UPLOAD_PART_SIZE_BYTES =
  process.env.MIRA_UPLOAD_PART_SIZE_BYTES || String(256 * 1024);
process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY = process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY || '2';
import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { chromium, type Browser, type Route } from 'playwright';
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
  evaluateMainVideoIsolation,
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
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService) => new MarketplaceService(prisma),
      inject: [PrismaService],
    },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class E2CAcceptanceModule {}

const MANDATORY = [
  'ACC-E2C-ORBS',
  'ACC-E2C-PLACE',
  'ACC-E2C-CALENDAR',
  'ACC-E2C-EXCEPTIONS',
  'ACC-E2C-CLOSED-NO-WEEKLY-SLOTS',
  'ACC-E2C-RESOURCE-CLOSED-KEEPS-OTHERS',
  'ACC-E2C-CLOSED-OVERRIDES-SPECIAL',
  'ACC-E2C-SAVE-RESTORE',
  'ACC-E2C-EXCEPTIONS-ONLY-ROUNDTRIP',
  'ACC-E2C-AVAILABILITY-CLEAR-OMIT',
  'ACC-E2C-INVALID-AVAILABILITY-PATHS',
  'ACC-E2C-PARTNER-REVIEW-PENDING-MEDIA',
  'ACC-E2C-PARTNER-RESUME-SUBMIT',
  'ACC-E2C-DESIGN-AFTER-CATEGORY',
  'ACC-E2C-OPTIONAL-EMPTY',
  'ACC-E2C-BRANCH-OWNERSHIP',
  'ACC-E2C-BRANCH-API',
  'ACC-E2C-CLEAR-VS-OMIT-BRANCH',
  'ACC-E2C-LAYOUTS-DESKTOP',
  'ACC-E2C-LAYOUTS-PHONE',
  'ACC-E2C-DESIGN-MATCH',
  'ACC-E2C-DEV-PUBLISH',
  'ACC-E2C-SERVICE-VIDEO-RETRY',
  'ACC-E2C-ISOLATION',
  'ACC-E2C-NO-REGRESS-PRODUCT-SHELL',
  'ACC-E2C-FIN-SESSION-IDS',
  'ACC-E2C-GATE-REJECTS-BAD',
] as const;

const VALID_PNG = path.resolve(
  __dirname,
  '../../partners-portal/upload-sessions/fixtures/valid.png',
);
const VALID_MP4 = path.resolve(
  __dirname,
  '../../partners-portal/upload-sessions/fixtures/valid-short.mp4',
);
const LARGE_MP4 = path.resolve(
  __dirname,
  '../../partners-portal/upload-sessions/fixtures/valid-large.mp4',
);

/** Exact field-role index order inside e2c-editor-fields (contains ≠ position). */
/** Partner resume: server review state + owner identity — UI toast alone never passes. */
function evaluatePartnerResume(p: {
  id?: string | null;
  expectedId?: string | null;
  mediaCount?: number;
  reviewStatus?: string | null;
  contentStatus?: string | null;
  statusUi?: string;
}): boolean {
  return (
    !!p.id &&
    !!p.expectedId &&
    p.id === p.expectedId &&
    Number(p.mediaCount || 0) >= 1 &&
    (p.reviewStatus === 'in_review' || p.reviewStatus === 'approved')
  );
}

/** Service video retry success: restore card + new media id vs before + session bind. */
function evaluateServiceVideoRetry(p: {
  sawFail?: boolean;
  sawRetryLabel?: boolean;
  mainRetryClicked?: boolean;
  durablePartsBeforeRetry?: boolean;
  resumedSameSession?: boolean;
  createdNewSessionOnRetry?: boolean;
  sessionBoundMediaId?: string | null;
  cycleNewMediaId?: string | null;
  mainsBefore?: string[];
  mainsAfter?: string[];
  videoCardAfterReopen?: boolean;
  chromeState?: string;
  chromeText?: string;
}): boolean {
  const before = Array.isArray(p.mainsBefore) ? p.mainsBefore : [];
  const after = Array.isArray(p.mainsAfter) ? p.mainsAfter : [];
  const newId = p.cycleNewMediaId || null;
  const bound = p.sessionBoundMediaId || null;
  const added = newId && !before.includes(newId) && after.includes(newId);
  const noExtraUnbound =
    after.filter((id) => !before.includes(id)).length === 1 &&
    after.filter((id) => !before.includes(id))[0] === newId;
  const state = String(p.chromeState || '').trim();
  // Explicit terminal failure always rejects — stale success copy must not pass.
  if (/^(failed|error|cancelled)$/i.test(state)) return false;
  const cardOk =
    p.videoCardAfterReopen === true &&
    (/saved|ready/i.test(state) || /فيديو محفوظ|جاهز|رُفع/.test(String(p.chromeText || '')));
  return (
    p.sawFail === true &&
    p.sawRetryLabel === true &&
    p.mainRetryClicked === true &&
    p.durablePartsBeforeRetry === true &&
    p.resumedSameSession === true &&
    p.createdNewSessionOnRetry === false &&
    !!bound &&
    bound === newId &&
    !!added &&
    noExtraUnbound === true &&
    cardOk
  );
}

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

const evidenceDir = path.resolve(__dirname, '../../../../../.e2c-acceptance-evidence');
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
      evidenceGaps.push(
        `${id}:${(hit.evidenceMissing.length ? hit.evidenceMissing : ['<empty>']).join(',')}`,
      );
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
            : ext === '.mp4'
              ? 'video/mp4'
              : 'text/html';
    res.writeHead(200, { 'content-type': type });
    res.end(fs.readFileSync(filePath));
  });
  return new Promise<{ server: http.Server; origin: string }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}


/** Reconstruct availability snapshot from partner draft valuesJson (weeklyHours/dateExceptions). */
function availabilitySnapshotFromDraftValues(values: Record<string, unknown> | null | undefined): unknown | null {
  if (!values || typeof values !== 'object') return null;
  const placeMode = (values.placeMode as string | null | undefined) ?? null;
  const branchId = (values.branchId as string | null | undefined) ?? null;
  if (values.availabilityJson != null && typeof values.availabilityJson === 'object') {
    return { availability: values.availabilityJson, placeMode, branchId };
  }
  const hours = Array.isArray(values.weeklyHours) ? values.weeklyHours : [];
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const toMin = (t: unknown) => {
    const s = String(t || '');
    const parts = s.split(':').map((x) => Number(x));
    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
    return parts[0]! * 60 + parts[1]!;
  };
  const windows = hours
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const h = raw as Record<string, unknown>;
      const dayKey = String(h.day || h.weekday || '');
      const weekday =
        typeof h.weekday === 'number' && Number.isInteger(h.weekday)
          ? h.weekday
          : dayMap[dayKey] != null
            ? dayMap[dayKey]
            : null;
      const startMin = typeof h.startMin === 'number' ? h.startMin : toMin(h.open || h.start);
      const endMin = typeof h.endMin === 'number' ? h.endMin : toMin(h.close || h.end);
      if (weekday == null || startMin == null || endMin == null) return null;
      return {
        weekday,
        startMin,
        endMin,
        capacity: typeof h.capacity === 'number' ? h.capacity : 1,
        resourceId: typeof h.resourceId === 'string' ? h.resourceId : '',
      };
    })
    .filter(Boolean);
  const closedDates: string[] = [];
  const exceptions: Array<Record<string, unknown>> = [];
  for (const x of Array.isArray(values.dateExceptions) ? values.dateExceptions : []) {
    if (typeof x === 'string') {
      if (x.trim()) closedDates.push(x.trim());
      continue;
    }
    if (!x || typeof x !== 'object') continue;
    const row = x as Record<string, unknown>;
    const date = String(row.date || '').trim();
    if (!date) continue;
    const kind = String(row.kind || '').trim();
    if (kind === 'special') {
      exceptions.push({
        date,
        kind: 'special',
        startMin: row.startMin,
        endMin: row.endMin,
        capacity: row.capacity,
        resourceId: row.resourceId || '',
      });
    } else if (kind === 'closed' && row.resourceId) {
      exceptions.push({ date, kind: 'closed', resourceId: String(row.resourceId) });
    } else {
      closedDates.push(date);
    }
  }
  if (!windows.length && !closedDates.length && !exceptions.length) return null;
  return {
    availability: { v: 2, timezone: 'Asia/Riyadh', windows, exceptions, closedDates },
    placeMode,
    branchId,
  };
}

async function main() {
  const started = new Date().toISOString();
  const repoRoot = path.resolve(__dirname, '../../../../');
  const runIdentity = captureAcceptanceRun(repoRoot);
  const testedSha = runIdentity.commit;
  const codeContentSha256 = runIdentity.contentSha256;
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'run-identity.json'), JSON.stringify(runIdentity, null, 2));

  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  fs.mkdirSync(evidenceDir, { recursive: true });

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const salon = await prisma.partner.create({
    data: {
      type: 'salon',
      status: 'active',
      nameAr: `E2C Salon ${suffix}`,
      nameEn: 'E2C Salon',
      city: 'جدة',
      contactPhone: '0500000001',
    },
  });
  const salonBranch = await prisma.partnerBranch.create({
    data: {
      partnerId: salon.id,
      nameAr: 'فرع الاختبار',
      cityId: 'jeddah',
      cityNameAr: 'جدة',
      addressAr: 'حي الاختبار',
      lat: 21.54,
      lng: 39.17,
      active: true,
    },
  });
  const salonBranch2 = await prisma.partnerBranch.create({
    data: {
      partnerId: salon.id,
      nameAr: 'فرع ثاني',
      cityId: 'riyadh',
      cityNameAr: 'الرياض',
      addressAr: 'حي النخيل',
      lat: 24.71,
      lng: 46.67,
      active: true,
    },
  });
  const tokenSalon = `tok-e2c-salon-${suffix}`;
  await prisma.partnerUser.create({
    data: {
      partnerId: salon.id,
      email: `e2c-salon-${suffix}@test.local`,
      accessToken: tokenSalon,
    },
  });
  const developer = await prisma.partner.create({
    data: {
      type: 'developer',
      status: 'active',
      nameAr: `E2C Dev ${suffix}`,
      nameEn: 'E2C Dev',
      city: 'الرياض',
    },
  });
  const tokenDev = `tok-e2c-dev-${suffix}`;
  await prisma.partnerUser.create({
    data: {
      partnerId: developer.id,
      email: `e2c-dev-${suffix}@test.local`,
      accessToken: tokenDev,
    },
  });
  const brand = await prisma.partner.create({
    data: {
      type: 'brand',
      status: 'active',
      nameAr: `E2C Brand ${suffix}`,
      nameEn: 'E2C Brand',
      city: 'الرياض',
    },
  });
  const tokenBrand = `tok-e2c-br-${suffix}`;
  await prisma.partnerUser.create({
    data: {
      partnerId: brand.id,
      email: `e2c-br-${suffix}@test.local`,
      accessToken: tokenBrand,
    },
  });
  // Foreign branch owned by brand — salon must not be allowed to attach it.
  const foreignBranch = await prisma.partnerBranch.create({
    data: {
      partnerId: brand.id,
      nameAr: 'فرع أجنبي',
      cityId: 'dammam',
      cityNameAr: 'الدمام',
      addressAr: 'حي أجنبي',
      lat: 26.4,
      lng: 50.1,
      active: true,
    },
  });

  const createdServiceIds: string[] = [];
  let browser: Browser | null = null;
  let portalServer: http.Server | null = null;
  let app: INestApplication | null = null;

  try {
    app = await NestFactory.create(E2CAcceptanceModule, { bodyParser: false, logger: ['error'] });
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
    const apiBase = `${apiRoot}/api/v1`;
    const portalDir = path.resolve(__dirname, '../../../../partners-portal/web');
    const served = await servePortal(portalDir);
    portalServer = served.server;
    const portalOrigin = served.origin;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: 'ar-SA',
      viewport: { width: 1280, height: 900 },
      recordVideo: { dir: path.join(evidenceDir, 'videos'), size: { width: 1280, height: 900 } },
    });
    const page = await context.newPage();
    (page as { _miraEvidenceName?: string })._miraEvidenceName = 'e2c-service-editor-journey';

    await page.goto(`${portalOrigin}/login.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.evaluate(
      ({ email, token }) => {
        localStorage.setItem('mira_partner_email', email);
        localStorage.setItem('mira_partner_token', token);
      },
      { email: `e2c-salon-${suffix}@test.local`, token: tokenSalon },
    );
    await page.goto(`${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('#goService', { timeout: 20000 });
    await page.click('#goService');
    await page.waitForTimeout(900);

    const shell = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const orbs = Array.from(document.querySelectorAll('[data-testid="e2c-main-circle"]')).map((b) => ({
        id: b.getAttribute('data-category-id'),
        label: (b.querySelector('.e2b-circle-label')?.textContent || '').trim(),
        orb: (b.querySelector('.e2b-circle-orb') as HTMLElement | null)
          ? getComputedStyle(b.querySelector('.e2b-circle-orb') as HTMLElement).backgroundImage
          : '',
      }));
      return {
        serviceMode: document.body.classList.contains('e2b-service-mode'),
        productMode: document.body.classList.contains('e2b-product-mode'),
        orbHost: !!document.querySelector('[data-testid="e2c-orb-host"]'),
        compose: !!document.querySelector('[data-testid="e2c-editor-compose"]'),
        place: !!document.querySelector('[data-testid="e2c-place-section"]'),
        avail: !!document.querySelector('[data-testid="e2c-availability-section"]'),
        city: document.querySelector('[data-testid="e2c-place-city"]')?.textContent || '',
        phone: document.querySelector('[data-testid="e2c-place-phone"]')?.textContent || '',
        formOk: !!form,
        orbs,
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-orbs-desktop.png'), fullPage: true });
    const nailsOrb = shell.orbs.find((o) => o.id === 'nails');
    const nailsNotJewelry = !!nailsOrb && /nails\.png/.test(nailsOrb.orb) && !/accessories/.test(nailsOrb.orb);
    const orbsOk =
      shell.serviceMode &&
      !shell.productMode &&
      shell.orbHost &&
      shell.orbs.length >= 3 &&
      shell.orbs.every((o) => /orbs\//.test(o.orb)) &&
      shell.orbs.every((o) => !!o.label) &&
      nailsNotJewelry;
    record(
      'ACC-E2C-ORBS',
      'دوائر الخدمة المصورة بأسماء أسفلها؛ الأظافر ليست مجوهرات',
      'serviceMode + orbs>=3 + nails.png',
      JSON.stringify({ shell, nailsNotJewelry }),
      orbsOk,
      { criterion: 'ACC-E2C-ORBS', evidence: ['e2c-orbs-desktop.png'] },
    );
    const placeSel = await page.evaluate(() => {
      const home = document.querySelector(
        '[data-testid="e2c-place-chip"][data-place-mode="home"]',
      ) as HTMLButtonElement | null;
      if (home) home.click();
      const branch = document.querySelector(
        '[data-testid="e2c-place-chip"][data-place-mode="branch"]',
      ) as HTMLButtonElement | null;
      if (branch) branch.click();
      const mode = (document.querySelector('[data-testid="e2c-place-mode"]') as HTMLInputElement | null)
        ?.value;
      const city = document.querySelector('[data-testid="e2c-place-city"]')?.textContent || '';
      const phone = document.querySelector('[data-testid="e2c-place-phone"]')?.textContent || '';
      const branchSel = document.querySelector(
        '[data-testid="e2c-branch-select"]',
      ) as HTMLSelectElement | null;
      let selectedBranchId: string | null = null;
      if (branchSel && branchSel.options.length > 1) {
        branchSel.selectedIndex = 1;
        branchSel.dispatchEvent(new Event('change', { bubbles: true }));
        selectedBranchId = branchSel.value || null;
      }
      const map = document.querySelector('[data-testid="e2c-map-preview"]')?.textContent || '';
      const mapPin = !!document.querySelector('[data-testid="e2c-map-pin"]');
      const mapEmbed = document.querySelector(
        '[data-testid="e2c-map-embed"]',
      ) as HTMLIFrameElement | null;
      const mapSrc = mapEmbed?.src || '';
      const chips = document.querySelectorAll('[data-testid="e2c-place-chip"]').length;
      const rail =
        !!document.querySelector('[data-testid="e2c-side-rail"], #e2bSideNav, #e2cSideNav');
      const builtBranchId = branchSel ? String(branchSel.value || '').trim() || null : null;
      return {
        mode,
        city,
        phone,
        map,
        mapPin,
        mapSrc,
        chips,
        branchOptions: branchSel?.options.length || 0,
        selectedBranchId,
        builtBranchId,
        rail,
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-place.png'), fullPage: true });
    record(
      'ACC-E2C-PLACE',
      'اختيار مكان التقديم + فرع/مدينة/خريطة OSM مربوطة بالإحداثيات',
      'placeMode=branch + OSM embed with lat/lng + branch + phone + rail',
      JSON.stringify(placeSel),
      placeSel.mode === 'branch' &&
        placeSel.chips >= 3 &&
        placeSel.branchOptions >= 2 &&
        !!placeSel.selectedBranchId &&
        placeSel.builtBranchId === placeSel.selectedBranchId &&
        placeSel.mapPin === true &&
        /openstreetmap\.org\/export\/embed/.test(placeSel.mapSrc) &&
        /21\.54/.test(placeSel.mapSrc) &&
        /39\.17/.test(placeSel.mapSrc) &&
        placeSel.rail === true &&
        (/جدة/.test(placeSel.city) || /موقع الفرع/.test(placeSel.map)) &&
        /0500000001/.test(placeSel.phone),
      { criterion: 'ACC-E2C-PLACE', evidence: ['e2c-place.png'] },
    );

    // Calendar: compact weekly + on-demand preview + add window
    const cal = await page.evaluate(() => {
      const editFold = document.querySelector(
        '[data-testid="e2c-avail-edit-details"]',
      ) as HTMLDetailsElement | null;
      if (editFold) editFold.open = true;
      const addSun = document.querySelector(
        '[data-weekday="0"] [data-testid="avail-window-add"]',
      ) as HTMLButtonElement | null;
      if (addSun) addSun.click();
      const rows = document.querySelectorAll('[data-testid="avail-window-row"]').length;
      const dayBlocks = document.querySelectorAll('[data-testid="avail-day-block"]').length;
      const preview = document.querySelector('[data-testid="avail-calendar-preview"]') as HTMLElement | null;
      const previewHiddenBefore = !!(preview && preview.hidden);
      const toggle = document.querySelector(
        '[data-testid="avail-preview-toggle"]',
      ) as HTMLButtonElement | null;
      if (toggle) toggle.click();
      const previewHiddenAfter = !!(preview && preview.hidden);
      const cells = preview ? preview.querySelectorAll('[data-avail-status]').length : 0;
      const copy = !!document.querySelector('[data-testid="avail-window-copy-prev"]');
      return { rows, dayBlocks, previewHiddenBefore, previewHiddenAfter, cells, copy };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-calendar.png'), fullPage: true });
    const monthDays = await page.locator('[data-testid="e2c-month-day"]').count();
    record(
      'ACC-E2C-CALENDAR',
      'محرر أسبوعي مختصر + تقويم شهري + نسخ + معاينة عند الطلب',
      'dayBlocks=7; monthDays>=28; preview on demand; copy',
      JSON.stringify({ ...cal, monthDays }),
      cal.dayBlocks === 7 &&
        cal.rows >= 1 &&
        cal.previewHiddenBefore === true &&
        cal.previewHiddenAfter === false &&
        cal.cells >= 7 &&
        cal.copy === true &&
        monthDays >= 28,
      { criterion: 'ACC-E2C-CALENDAR', evidence: ['e2c-calendar.png'] },
    );

    // Exceptions round-trip: special exception without requiring weekly windows on that date path.
    const exProbe = await page.evaluate(() => {
      const fold = document.querySelector(
        '[data-testid="e2c-exceptions-details"]',
      ) as HTMLDetailsElement | null;
      if (fold) fold.open = true;
      const dateInput = document.querySelector(
        '[data-testid="avail-closed-date-input"], [data-testid="avail-exceptions"] input[type="date"]',
      ) as HTMLInputElement | null;
      const exWrap = document.querySelector('[data-testid="avail-exceptions"]');
      if (!exWrap) return { ok: false, reason: 'no-ex-wrap' };
      const inputs = exWrap.querySelectorAll('input');
      const dateEl = Array.from(inputs).find((i) => (i as HTMLInputElement).type === 'date') as
        | HTMLInputElement
        | undefined;
      const kindEl = exWrap.querySelector('select') as HTMLSelectElement | null;
      const addBtn = Array.from(exWrap.querySelectorAll('button')).find((b) =>
        /إضافة/.test(b.textContent || ''),
      ) as HTMLButtonElement | null;
      if (!dateEl || !addBtn) return { ok: false, reason: 'missing-controls' };
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      const key =
        tomorrow.getFullYear() +
        '-' +
        String(tomorrow.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(tomorrow.getDate()).padStart(2, '0');
      dateEl.value = key;
      dateEl.dispatchEvent(new Event('input', { bubbles: true }));
      dateEl.dispatchEvent(new Event('change', { bubbles: true }));
      if (kindEl) {
        kindEl.value = 'special';
        kindEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const times = exWrap.querySelectorAll('input[type="time"]');
      if (times[0]) {
        (times[0] as HTMLInputElement).value = '11:00';
        times[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (times[1]) {
        (times[1] as HTMLInputElement).value = '13:00';
        times[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
      const cap = exWrap.querySelector('input[type="number"]') as HTMLInputElement | null;
      if (cap) {
        cap.value = '1';
        cap.dispatchEvent(new Event('change', { bubbles: true }));
      }
      addBtn.click();
      return { ok: true, key, listText: exWrap.textContent || '' };
    });
    fs.writeFileSync(path.join(evidenceDir, 'e2c-exceptions-ui.json'), JSON.stringify(exProbe, null, 2));
    record(
      'ACC-E2C-EXCEPTIONS',
      'إضافة استثناء خاص مؤرخ في الواجهة قبل الحفظ',
      'exception row visible',
      JSON.stringify(exProbe),
      !!(exProbe as any).ok && /11:00|خاص|استثناء/.test(String((exProbe as any).listText || '')),
      { criterion: 'ACC-E2C-EXCEPTIONS', evidence: ['e2c-exceptions-ui.json'] },
    );

    // Closed day must not show weekly weekday time chips.
    const closedProbe = await page.evaluate(() => {
      const closedInput = document.querySelector(
        '[data-testid="avail-closed-date-input"]',
      ) as HTMLInputElement | null;
      const addBtn = Array.from(
        document.querySelectorAll('[data-testid="avail-closed-dates"] button, [data-testid="avail-closed-date-input"] ~ button'),
      ).find((b) => /إضافة/.test(b.textContent || '')) as HTMLButtonElement | null;
      if (!closedInput || !addBtn) return { ok: false, reason: 'no-closed-controls' };
      const d = new Date();
      d.setDate(d.getDate() + 10);
      const key =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
      closedInput.value = key;
      closedInput.dispatchEvent(new Event('input', { bubbles: true }));
      closedInput.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn.click();
      const cell = document.querySelector(
        `[data-testid="e2c-month-day"][data-date="${key}"]`,
      ) as HTMLButtonElement | null;
      if (cell) cell.click();
      const chips = document.querySelectorAll('[data-testid="e2c-time-chip"]').length;
      const host = document.querySelector('[data-testid="e2c-time-chips"]') as HTMLElement | null;
      return {
        ok: true,
        key,
        chips,
        closedAttr: host?.getAttribute('data-closed-day') || null,
        text: host?.textContent || '',
        cellClosed: !!cell?.classList.contains('is-closed'),
      };
    });
    fs.writeFileSync(path.join(evidenceDir, 'e2c-closed-no-weekly.json'), JSON.stringify(closedProbe, null, 2));
    record(
      'ACC-E2C-CLOSED-NO-WEEKLY-SLOTS',
      'يوم مغلق لا يعرض أوقاتًا أسبوعية',
      'chips=0 + data-closed-day + is-closed cell',
      JSON.stringify(closedProbe),
      !!(closedProbe as any).ok &&
        (closedProbe as any).chips === 0 &&
        ((closedProbe as any).closedAttr === '1' || /مغلق/.test(String((closedProbe as any).text || ''))),
      { criterion: 'ACC-E2C-CLOSED-NO-WEEKLY-SLOTS', evidence: ['e2c-closed-no-weekly.json'] },
    );

    // Resource-scoped closed must keep other resources' weekly chips.
    const resourceClosed = await page.evaluate(() => {
      const editFold = document.querySelector(
        '[data-testid="e2c-avail-edit-details"]',
      ) as HTMLDetailsElement | null;
      if (editFold) editFold.open = true;
      const addSun = document.querySelector(
        '[data-weekday="0"] [data-testid="avail-window-add"]',
      ) as HTMLButtonElement | null;
      if (addSun) addSun.click();
      if (addSun) addSun.click();
      const rows = Array.from(
        document.querySelectorAll('[data-testid="avail-window-row"][data-weekday="0"]'),
      ) as HTMLElement[];
      if (rows.length < 2) return { ok: false, reason: 'need-2-rows', rows: rows.length };
      const specs = [
        { row: rows[0], start: '09:00', end: '12:00', cap: '1', res: 'room-a' },
        { row: rows[1], start: '13:00', end: '16:00', cap: '1', res: 'room-b' },
      ];
      for (const spec of specs) {
        const times = spec.row.querySelectorAll('input[type="time"]');
        const capEl = spec.row.querySelector('input[type="number"]') as HTMLInputElement | null;
        const resEl = spec.row.querySelector('input[type="text"]') as HTMLInputElement | null;
        if (times[0]) {
          (times[0] as HTMLInputElement).value = spec.start;
          times[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (times[1]) {
          (times[1] as HTMLInputElement).value = spec.end;
          times[1].dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (capEl) {
          capEl.value = spec.cap;
          capEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (resEl) {
          resEl.value = spec.res;
          resEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      const fold = document.querySelector(
        '[data-testid="e2c-exceptions-details"]',
      ) as HTMLDetailsElement | null;
      if (fold) fold.open = true;
      const exWrap = document.querySelector('[data-testid="avail-exceptions"]');
      if (!exWrap) return { ok: false, reason: 'no-ex' };
      const dateEl = Array.from(exWrap.querySelectorAll('input')).find(
        (i) => (i as HTMLInputElement).type === 'date',
      ) as HTMLInputElement | undefined;
      const kindEl = exWrap.querySelector('select') as HTMLSelectElement | null;
      const resEx = document.querySelector(
        '[data-testid="avail-exception-resource"]',
      ) as HTMLInputElement | null;
      const addBtn = Array.from(exWrap.querySelectorAll('button')).find((b) =>
        /إضافة/.test(b.textContent || ''),
      ) as HTMLButtonElement | null;
      if (!dateEl || !kindEl || !resEx || !addBtn) return { ok: false, reason: 'missing-ex-controls' };
      const cell = Array.from(document.querySelectorAll('[data-testid="e2c-month-day"]')).find((c) => {
        const key = c.getAttribute('data-date') || '';
        if (!key) return false;
        if ((c as HTMLElement).classList.contains('is-closed')) return false;
        const dt = new Date(key + 'T12:00:00Z');
        return dt.getUTCDay() === 0;
      }) as HTMLButtonElement | undefined;
      const key = cell?.getAttribute('data-date');
      if (!key) return { ok: false, reason: 'no-open-sunday-cell' };
      dateEl.value = key;
      dateEl.dispatchEvent(new Event('change', { bubbles: true }));
      kindEl.value = 'closed';
      kindEl.dispatchEvent(new Event('change', { bubbles: true }));
      resEx.value = 'room-a';
      resEx.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn.click();
      if (cell) cell.click();
      const chips = Array.from(document.querySelectorAll('[data-testid="e2c-time-chip"]')).map((c) => ({
        text: c.textContent || '',
        res: c.getAttribute('data-resource-id'),
      }));
      const host = document.querySelector('[data-testid="e2c-time-chips"]') as HTMLElement | null;
      return {
        ok: true,
        key,
        chips,
        closedDay: host?.getAttribute('data-closed-day'),
        resourceClosed: host?.getAttribute('data-resource-closed'),
        wholeDayText: /يوم مغلق/.test(host?.textContent || ''),
      };
    });
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-resource-closed.json'),
      JSON.stringify(resourceClosed, null, 2),
    );
    const resourceClosedOk =
      !!(resourceClosed as any).ok &&
      (resourceClosed as any).closedDay !== '1' &&
      (resourceClosed as any).wholeDayText !== true &&
      Array.isArray((resourceClosed as any).chips) &&
      (resourceClosed as any).chips.some((c: any) => c.res === 'room-b' || /room-b/.test(c.text || '')) &&
      !(resourceClosed as any).chips.some((c: any) => c.res === 'room-a' || /^09:00 · room-a$/.test(c.text || ''));
    record(
      'ACC-E2C-RESOURCE-CLOSED-KEEPS-OTHERS',
      'إغلاق مورد محدد لا يخفي أوقات الموارد الأخرى',
      'room-a closed; room-b chip remains; not whole-day closed',
      JSON.stringify(resourceClosed),
      resourceClosedOk,
      { criterion: 'ACC-E2C-RESOURCE-CLOSED-KEEPS-OTHERS', evidence: ['e2c-resource-closed.json'] },
    );

    // Same date: closed(room-a) must suppress special(room-a); other resources unchanged.
    const closedVsSpecial = await page.evaluate(() => {
      const fold = document.querySelector(
        '[data-testid="e2c-exceptions-details"]',
      ) as HTMLDetailsElement | null;
      if (fold) fold.open = true;
      const exWrap = document.querySelector('[data-testid="avail-exceptions"]');
      if (!exWrap) return { ok: false, reason: 'no-ex' };
      const dateEl = Array.from(exWrap.querySelectorAll('input')).find(
        (i) => (i as HTMLInputElement).type === 'date',
      ) as HTMLInputElement | undefined;
      const kindEl = exWrap.querySelector('select') as HTMLSelectElement | null;
      const times = Array.from(exWrap.querySelectorAll('input')).filter(
        (i) => (i as HTMLInputElement).type === 'time',
      ) as HTMLInputElement[];
      const resEx = document.querySelector(
        '[data-testid="avail-exception-resource"]',
      ) as HTMLInputElement | null;
      const addBtn = Array.from(exWrap.querySelectorAll('button')).find((b) =>
        /إضافة/.test(b.textContent || ''),
      ) as HTMLButtonElement | null;
      if (!dateEl || !kindEl || !resEx || !addBtn) return { ok: false, reason: 'missing-ex-controls' };
      const cell = Array.from(document.querySelectorAll('[data-testid="e2c-month-day"]')).find((c) => {
        const key = c.getAttribute('data-date') || '';
        if (!key) return false;
        if ((c as HTMLElement).classList.contains('is-closed')) return false;
        // Prefer a weekday that still has room-a weekly slots visible before we close it.
        return true;
      }) as HTMLButtonElement | undefined;
      const key = cell?.getAttribute('data-date');
      if (!key) return { ok: false, reason: 'no-open-cell' };
      dateEl.value = key;
      dateEl.dispatchEvent(new Event('change', { bubbles: true }));
      kindEl.value = 'special';
      kindEl.dispatchEvent(new Event('change', { bubbles: true }));
      if (times[0]) {
        times[0].value = '11:00';
        times[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (times[1]) {
        times[1].value = '12:00';
        times[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
      resEx.value = 'room-a';
      resEx.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn.click();
      dateEl.value = key;
      dateEl.dispatchEvent(new Event('change', { bubbles: true }));
      kindEl.value = 'closed';
      kindEl.dispatchEvent(new Event('change', { bubbles: true }));
      resEx.value = 'room-a';
      resEx.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn.click();
      if (cell) cell.click();
      const chips = Array.from(document.querySelectorAll('[data-testid="e2c-time-chip"]')).map((c) => ({
        text: c.textContent || '',
        res: c.getAttribute('data-resource-id'),
      }));
      return { ok: true, key, chips };
    });
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-closed-overrides-special.json'),
      JSON.stringify(closedVsSpecial, null, 2),
    );
    const closedOverridesOk =
      !!(closedVsSpecial as any).ok &&
      Array.isArray((closedVsSpecial as any).chips) &&
      !(closedVsSpecial as any).chips.some(
        (c: any) => c.res === 'room-a' || /room-a/.test(c.text || ''),
      );
    record(
      'ACC-E2C-CLOSED-OVERRIDES-SPECIAL',
      'closed لنفس المورد يلغي special وفق عقد الخادم',
      'no room-a special chip when closed(room-a) on same date',
      JSON.stringify(closedVsSpecial),
      closedOverridesOk,
      { criterion: 'ACC-E2C-CLOSED-OVERRIDES-SPECIAL', evidence: ['e2c-closed-overrides-special.json'] },
    );

    const svcName = `E2C-Svc-${suffix}`;
    // Known-ahead fixture (not derived from form output). Multi-window, resources, capacities,
    // special exception with hours, closed dates, timezone, owned branch.
    const expectedAvailability = {
      availability: {
        v: 2,
        timezone: 'Asia/Riyadh',
        windows: [
          { weekday: 0, startMin: 600, endMin: 840, capacity: 2, resourceId: 'room-a' },
          { weekday: 0, startMin: 900, endMin: 1020, capacity: 1, resourceId: 'room-b' },
          { weekday: 3, startMin: 660, endMin: 780, capacity: 2, resourceId: 'room-a' },
          { weekday: 5, startMin: 720, endMin: 900, capacity: 4, resourceId: 'room-c' },
        ],
        exceptions: [
          {
            date: '2026-12-15',
            kind: 'special',
            startMin: 600,
            endMin: 720,
            capacity: 1,
            resourceId: 'room-b',
          },
        ],
        closedDates: ['2026-12-25', '2026-12-26'],
      },
      placeMode: 'branch',
      branchId: salonBranch.id,
    };
    const FILL_KNOWN_AVAIL_SOURCE = `({ nm, expected, branchId }) => {
      const form = document.getElementById('catalogForm');
      if (!form) return { ok: false, reason: 'no-form' };
      const editFold = form.querySelector('[data-testid="e2c-avail-edit-details"]');
      if (editFold) editFold.open = true;
      const exFold = form.querySelector('[data-testid="e2c-exceptions-details"]');
      if (exFold) exFold.open = true;
      const hair = document.querySelector('[data-testid="e2c-main-circle"][data-category-id="hair"]');
      if (hair) hair.click();
      const branchChip = document.querySelector('[data-testid="e2c-place-chip"][data-place-mode="branch"]');
      if (branchChip) branchChip.click();
      const branchSel = document.querySelector('[data-testid="e2c-branch-select"], [name="branchId"]');
      if (!branchSel || ![...branchSel.options].some((o) => o.value === branchId)) {
        return { ok: false, reason: 'branch-missing', branchId: branchId };
      }
      branchSel.value = branchId;
      branchSel.dispatchEvent(new Event('change', { bubbles: true }));
      const name = form.querySelector('input[name="nameAr"]');
      const price = form.querySelector('input[name="priceSar"]');
      const dur = form.querySelector('input[name="durationMin"]');
      if (!name || !price || !dur) return { ok: false, reason: 'missing-basics' };
      name.value = nm;
      name.dispatchEvent(new Event('input', { bubbles: true }));
      price.value = '85';
      price.dispatchEvent(new Event('input', { bubbles: true }));
      dur.value = '45';
      dur.dispatchEvent(new Event('input', { bubbles: true }));
      let guard = 0;
      while (guard++ < 40) {
        const rm =
          document.querySelector('[data-testid="avail-window-remove"]') ||
          document.querySelector('[data-testid="avail-exception-row"] button') ||
          document.querySelector('[data-testid="avail-closed-date-row"] button');
        if (!rm) break;
        rm.click();
      }
      const minToTime = (m) =>
        String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      const byDay = {};
      for (const w of expected.availability.windows) {
        (byDay[w.weekday] || (byDay[w.weekday] = [])).push(w);
      }
      for (const weekdayStr of Object.keys(byDay)) {
        const weekday = Number(weekdayStr);
        const wins = byDay[weekday];
        const dayBlock = document.querySelector(
          '[data-testid="e2c-avail-day"][data-weekday="' + weekday + '"], details[data-weekday="' + weekday + '"]',
        );
        if (dayBlock) dayBlock.open = true;
        let rows = Array.from(
          document.querySelectorAll('[data-testid="avail-window-row"][data-weekday="' + weekday + '"]'),
        );
        let addGuard = 0;
        while (rows.length < wins.length && addGuard++ < 6) {
          const addBtn =
            (dayBlock && dayBlock.querySelector('[data-testid="avail-window-add"]')) ||
            Array.from(document.querySelectorAll('[data-testid="avail-window-add"]')).find((b) =>
              b.closest('[data-weekday="' + weekday + '"]'),
            ) ||
            null;
          if (!addBtn) break;
          addBtn.click();
          rows = Array.from(
            document.querySelectorAll('[data-testid="avail-window-row"][data-weekday="' + weekday + '"]'),
          );
        }
        rows = Array.from(
          document.querySelectorAll('[data-testid="avail-window-row"][data-weekday="' + weekday + '"]'),
        );
        if (rows.length < wins.length) {
          return { ok: false, reason: 'missing-rows-day-' + weekday, have: rows.length, need: wins.length };
        }
        wins.forEach((w, idx) => {
          const row = rows[idx];
          const times = row.querySelectorAll('input[type="time"]');
          const cap = row.querySelector('input[type="number"]');
          const res = row.querySelector('input[type="text"]');
          if (times[0]) {
            times[0].value = minToTime(w.startMin);
            times[0].dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (times[1]) {
            times[1].value = minToTime(w.endMin);
            times[1].dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (cap) {
            cap.value = String(w.capacity);
            cap.dispatchEvent(new Event('input', { bubbles: true }));
            cap.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (res) {
            res.value = w.resourceId || '';
            res.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
      const closedInput = form.querySelector('[data-section-role="availability"] input[type="date"]');
      const closedAdd = Array.from(form.querySelectorAll('[data-section-role="availability"] button')).find((b) =>
        /إضافة يوم إغلاق/.test(b.textContent || ''),
      );
      for (const d of expected.availability.closedDates) {
        if (closedInput && closedAdd) {
          closedInput.value = d;
          closedInput.dispatchEvent(new Event('change', { bubbles: true }));
          closedAdd.click();
        }
      }
      const exWrap = form.querySelector('[data-testid="avail-exceptions"]');
      if (!exWrap) return { ok: false, reason: 'no-ex-wrap' };
      const dateEl = exWrap.querySelector('input[type="date"]');
      const kindEl = exWrap.querySelector('select');
      const times = Array.from(exWrap.querySelectorAll('input[type="time"]'));
      const cap = Array.from(exWrap.querySelectorAll('input[type="number"]'))[0];
      const res = exWrap.querySelector('[data-testid="avail-exception-resource"]');
      const addBtn = Array.from(exWrap.querySelectorAll('button')).find((b) =>
        /إضافة استثناء/.test(b.textContent || ''),
      );
      const special = expected.availability.exceptions[0];
      if (!dateEl || !kindEl || !addBtn || !cap || !res || times.length < 2 || !special) {
        return { ok: false, reason: 'missing-special-controls' };
      }
      dateEl.value = special.date;
      dateEl.dispatchEvent(new Event('change', { bubbles: true }));
      kindEl.value = 'special';
      kindEl.dispatchEvent(new Event('change', { bubbles: true }));
      times[0].value = minToTime(special.startMin);
      times[0].dispatchEvent(new Event('change', { bubbles: true }));
      times[1].value = minToTime(special.endMin);
      times[1].dispatchEvent(new Event('change', { bubbles: true }));
      cap.value = String(special.capacity);
      cap.dispatchEvent(new Event('change', { bubbles: true }));
      res.value = special.resourceId;
      res.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn.click();
      return {
        ok: true,
        cat: (form.querySelector('select[name="category"]') || {}).value,
        windows: document.querySelectorAll('[data-testid="avail-window-row"]').length,
        exceptions: document.querySelectorAll('[data-testid="avail-exception-row"]').length,
        closed: document.querySelectorAll('[data-testid="avail-closed-date-row"]').length,
        branchId: branchSel.value,
        placeMode: (form.querySelector('[name="placeMode"]') || {}).value,
      };
    }`;
    const fill = await page.evaluate(
      ({ src, payload }) => (0, eval)('(' + src + ')')(payload),
      {
        src: FILL_KNOWN_AVAIL_SOURCE,
        payload: { nm: svcName, expected: expectedAvailability, branchId: salonBranch.id },
      },
    );

    const formAfterFill = await page.evaluate((src) => (0, eval)('(' + src + ')()'), READ_AVAILABILITY_FROM_FORM_SOURCE);
    const formMatchesKnown = compareAvailabilitySnapshot(expectedAvailability, formAfterFill);
    if (!(fill as any).ok || !formMatchesKnown.ok) {
      fs.writeFileSync(
        path.join(evidenceDir, 'e2c-save-restore-fill-mismatch.json'),
        JSON.stringify({ fill, formAfterFill, formMatchesKnown, expectedAvailability }, null, 2),
      );
    }
    await page.click('#catalogForm-save');
    await page.waitForTimeout(1800);
    // Capture draft identity + reopen BEFORE materialize (server draft round-trip).
    const draftMeta = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const ctx =
        (window as any).MiraEditorV2 && form
          ? (window as any).MiraEditorV2.getEditContext(form.id)
          : null;
      const statusUi =
        form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent ||
        '';
      return {
        clientDraftId: ctx?.clientDraftId || null,
        revision: ctx?.revision ?? null,
        statusUi,
      };
    });
    let draftReopen: Record<string, unknown> = { ok: false, reason: 'not-run' };
    if (draftMeta.clientDraftId) {
      await page.click('#refreshEditorDrafts').catch(() => undefined);
      await page.waitForTimeout(1200);
      const openDraft = page
        .locator('#editorDraftsList .list-row, #editorDraftsList .list-item')
        .filter({ hasText: svcName })
        .getByRole('button', { name: /فتح/ });
      if (await openDraft.count()) {
        await openDraft.first().click();
      } else {
        throw new Error('Server draft open button missing; UI acceptance cannot use a helper fallback');
      }
      await page.waitForTimeout(1000);
      draftReopen = await page.evaluate((expected) => {
        const form = document.getElementById('catalogForm');
        if (!form) return { ok: false, reason: 'no-form' };
        const ctx =
          (window as any).MiraEditorV2 && (window as any).MiraEditorV2.getEditContext(form.id);
        const rows = Array.from(document.querySelectorAll('[data-testid="avail-window-row"]')).map(
          (r) => {
            const times = r.querySelectorAll('input[type="time"]');
            const cap = r.querySelector('input[type="number"]') as HTMLInputElement | null;
            const res = r.querySelector('input[type="text"]') as HTMLInputElement | null;
            return {
              weekday: r.getAttribute('data-weekday'),
              start: (times[0] as HTMLInputElement | undefined)?.value,
              end: (times[1] as HTMLInputElement | undefined)?.value,
              capacity: cap?.value,
              resourceId: res?.value,
            };
          },
        );
        const placeMode = (form.querySelector('[name="placeMode"]') as HTMLInputElement | null)?.value;
        const branchId = (form.querySelector('[name="branchId"]') as HTMLSelectElement | null)?.value;
        const name = (form.querySelector('input[name="nameAr"]') as HTMLInputElement)?.value;
        const sun = rows.find((r) => r.weekday === '0');
        const ok =
          name === expected.name &&
          !!sun &&
          sun.start === '10:00' &&
          sun.end === '14:00' &&
          sun.capacity === '2' &&
          sun.resourceId === 'room-a' &&
          placeMode === 'branch' &&
          branchId === expected.branchId &&
          ctx?.clientDraftId === expected.clientDraftId;
        return {
          ok,
          name,
          rows,
          placeMode,
          branchId,
          clientDraftId: ctx?.clientDraftId || null,
          materialized: !!(ctx && (ctx.status === 'materialized' || ctx.targetOwnerId)),
        };
      }, { name: svcName, clientDraftId: draftMeta.clientDraftId, branchId: salonBranch.id });
    }
    let draftServerAvailability: unknown = null;
    let draftServerOk = false;
    if (draftMeta.clientDraftId) {
      const draftRow = await prisma.partnerEditorDraft.findFirst({
        where: { clientDraftId: String(draftMeta.clientDraftId), partnerId: salon.id },
      }).catch(() => null);
      const values = ((draftRow as any)?.valuesJson || null) as Record<string, unknown> | null;
      draftServerAvailability = availabilitySnapshotFromDraftValues(values);
      draftServerOk = draftServerAvailability
        ? compareAvailabilitySnapshot(expectedAvailability, draftServerAvailability).ok
        : false;
    }
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-draft-before-materialize.json'),
      JSON.stringify({ draftMeta, draftReopen, draftServerOk, draftServerAvailability }, null, 2),
    );

    const draftAvailability = await page.evaluate((src) => (0, eval)('(' + src + ')()'), READ_AVAILABILITY_FROM_FORM_SOURCE);
    const draftAvailabilityCheck = compareAvailabilitySnapshot(expectedAvailability, draftAvailability);

    // Salon: draft save then materialize → create service owner (same path as E2أ brand).
    await page
      .waitForFunction(() => {
        const mat = document.querySelector(
          '#catalogForm [data-testid="materialize-draft"], #catalogForm [data-editor-v2-materialize="1"]',
        ) as HTMLButtonElement | null;
        return !!mat && !mat.disabled && mat.offsetParent !== null;
      }, undefined, { timeout: 15000 })
      .catch(() => undefined);
    const mat = page.locator(
      '#catalogForm [data-testid="materialize-draft"]:visible, #catalogForm [data-editor-v2-materialize="1"]:visible',
    );
    if (await mat.count()) {
      await mat.first().click();
      await page.waitForTimeout(4000);
    }
    let afterSave = await page.evaluate(async (nm) => {
      const dash = await (window as any).PartnersApi.dashboard();
      const svc =
        (dash?.catalog?.services || []).find((s: any) => s.nameAr === nm) ||
        (dash?.catalog?.services || []).find((s: any) => String(s.nameAr || '').includes(nm.slice(0, 12)));
      const statusUi =
        document
          .getElementById('catalogForm')
          ?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || '';
      return {
        id: svc?.id || null,
        nameAr: svc?.nameAr || null,
        durationMin: svc?.durationMin ?? null,
        priceHalalas: svc?.priceHalalas ?? null,
        category: svc?.category || null,
        descriptionAr: svc?.descriptionAr ?? null,
        availabilityJson: svc?.availabilityJson || null,
        statusUi,
      };
    }, svcName);
    // Poll briefly — materialize may land after UI status updates.
    for (let t = 0; t < 12 && !afterSave.id; t++) {
      await page.waitForTimeout(500);
      afterSave = await page.evaluate(async (nm) => {
        const dash = await (window as any).PartnersApi.dashboard();
        const svc =
          (dash?.catalog?.services || []).find((s: any) => s.nameAr === nm) ||
          (dash?.catalog?.services || []).find((s: any) => String(s.nameAr || '').includes(nm.slice(0, 12)));
        return {
          id: svc?.id || null,
          nameAr: svc?.nameAr || null,
          durationMin: svc?.durationMin ?? null,
          priceHalalas: svc?.priceHalalas ?? null,
          category: svc?.category || null,
          descriptionAr: svc?.descriptionAr ?? null,
          availabilityJson: svc?.availabilityJson || null,
          statusUi:
            document
              .getElementById('catalogForm')
              ?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || '',
        };
      }, svcName);
    }
    // Refresh from DB after materialize so availabilityJson / place / branch are current.
    let persistedBranchId: string | null = null;
    let persistedPlaceMode: string | null = null;
    if (afterSave.id) {
      const dbSvc = await prisma.service.findUnique({ where: { id: afterSave.id } });
      if (dbSvc) {
        afterSave = {
          ...afterSave,
          durationMin: dbSvc.durationMin,
          category: dbSvc.category,
          descriptionAr: dbSvc.descriptionAr,
          availabilityJson: dbSvc.availabilityJson as any,
        };
        persistedBranchId = (dbSvc as any).branchId ?? null;
        persistedPlaceMode = (dbSvc as any).placeMode ?? null;
      }
    }
    if (afterSave.id) createdServiceIds.push(afterSave.id);

    // Re-open and assert restore
    let restore: Record<string, unknown> = { ok: false };
    let restoredAvailability: unknown = null;
    if (afterSave.id) {
      const openBtn = page
        .locator('#catalogList .list-item')
        .filter({ hasText: svcName })
        .getByRole('button', { name: 'فتح في النموذج' });
      if (await openBtn.count()) {
        await openBtn.click();
        await page.waitForTimeout(800);
      } else {
        await page.evaluate((id) => {
          const items = Array.from(document.querySelectorAll('#catalogList .list-item'));
          for (const it of items) {
            if ((it.textContent || '').includes(id) || (it.textContent || '').includes('E2C-Svc-')) {
              const b = it.querySelector('button');
              if (b) b.click();
            }
          }
        }, afterSave.id);
        await page.waitForTimeout(800);
      }
      restore = await page.evaluate(() => {
        const form = document.getElementById('catalogForm');
        if (!form) return { ok: false, reason: 'no-form' };
        const name = (form.querySelector('input[name="nameAr"]') as HTMLInputElement)?.value;
        const price = (form.querySelector('input[name="priceSar"]') as HTMLInputElement)?.value;
        const dur = (form.querySelector('input[name="durationMin"]') as HTMLInputElement)?.value;
        const cat = (form.querySelector('select[name="category"]') as HTMLSelectElement)?.value;
        const hairSelected = !!document.querySelector(
          '[data-testid="e2c-main-circle"][data-category-id="hair"].is-selected',
        );
        const rows = Array.from(document.querySelectorAll('[data-testid="avail-window-row"]')).map((r) => {
          const times = r.querySelectorAll('input[type="time"]');
          const cap = r.querySelector('input[type="number"]') as HTMLInputElement | null;
          const res = r.querySelector('input[type="text"]') as HTMLInputElement | null;
          return {
            weekday: r.getAttribute('data-weekday'),
            start: (times[0] as HTMLInputElement | undefined)?.value,
            end: (times[1] as HTMLInputElement | undefined)?.value,
            capacity: cap?.value,
            resourceId: res?.value,
          };
        });
        const city = document.querySelector('[data-testid="e2c-place-city"]')?.textContent || '';
        const desc = (form.querySelector('[name="descriptionAr"]') as HTMLTextAreaElement | null)?.value;
        const placeMode = (form.querySelector('[name="placeMode"]') as HTMLInputElement | null)?.value;
        const branchId = (form.querySelector('[name="branchId"]') as HTMLSelectElement | null)?.value;
        const monthDays = document.querySelectorAll('[data-testid="e2c-month-day"]').length;
        return {
          ok: true,
          name,
          price,
          dur,
          cat,
          hairSelected,
          rows,
          city,
          desc,
          placeMode,
          branchId,
          monthDays,
        };
      });
      restoredAvailability = await page.evaluate((src) => (0, eval)('(' + src + ')()'), READ_AVAILABILITY_FROM_FORM_SOURCE);
      // Modify name and save again
      await page.evaluate(() => {
        const name = document.querySelector(
          '#catalogForm input[name="nameAr"]',
        ) as HTMLInputElement | null;
        if (name) {
          name.value = name.value + '-عدّل';
          name.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.click('#catalogForm-save');
      await page.waitForTimeout(2200);
    }
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-save-restore.png'), fullPage: true });
    const sunWin = (restore.rows as any[] | undefined)?.find((r) => r.weekday === '0');
    const availWindows = Array.isArray((afterSave.availabilityJson as any)?.windows)
      ? (afterSave.availabilityJson as any).windows
      : [];
    const serverSun = availWindows.find((w: any) => Number(w.weekday) === 0);
    const serverTimezone = String((afterSave.availabilityJson as any)?.timezone || '');
    const serverCapacity = serverSun ? Number(serverSun.capacity) : null;
    const restoreCapacity = sunWin ? Number(sunWin.capacity) : null;
    // Exact field order after save/reopen (contains ≠ position).
    const orderAfterReopen = await page.evaluate(() => {
      const fields = document.querySelector('[data-testid="e2c-editor-fields"]');
      const side = document.querySelector('[data-testid="e2c-side-stack"]');
      const fieldRoles = fields
        ? Array.from(fields.children)
            .map((n) => (n as HTMLElement).getAttribute('data-section-role') || '')
            .filter(Boolean)
        : [];
      const sideRoles = side
        ? Array.from(side.children)
            .map((n) => {
              const el = n as HTMLElement;
              return (
                el.getAttribute('data-section-role') ||
                (el.getAttribute('data-testid') === 'catalog-main-media-section' ||
                el.classList.contains('e2b-media-stage')
                  ? 'main-media'
                  : '')
              );
            })
            .filter(Boolean)
        : [];
      return { fieldRoles, sideRoles };
    });
    const orderAfterReopenEval = evaluateComposeFieldOrder(orderAfterReopen);
    const draftBeforeOk =
      !!draftMeta.clientDraftId &&
      (draftReopen as any).ok === true &&
      (draftReopen as any).materialized !== true;
    const serverAvailability = {
      availability: afterSave.availabilityJson,
      placeMode: persistedPlaceMode, branchId: persistedBranchId,
    };
    const serverAvailabilityCheck = compareAvailabilitySnapshot(expectedAvailability, serverAvailability);
    const restoredAvailabilityCheck = compareAvailabilitySnapshot(expectedAvailability, restoredAvailability);
    fs.writeFileSync(path.join(evidenceDir, 'e2c-availability-roundtrip.json'), JSON.stringify({
      expectedAvailability, draftAvailability, serverAvailability, restoredAvailability,
      draftAvailabilityCheck, serverAvailabilityCheck, restoredAvailabilityCheck,
    }, null, 2));
    const restoreOk = Boolean(
      afterSave.id &&
        draftBeforeOk &&
        draftServerOk &&
        formMatchesKnown.ok &&
        (fill as any).ok === true &&
        (restore as any).ok === true &&
        String((restore as any).name || '').includes('E2C-Svc-') &&
        (restore as any).cat === 'hair' &&
        (restore as any).hairSelected === true &&
        sunWin &&
        sunWin.start === '10:00' &&
        sunWin.end === '14:00' &&
        restoreCapacity === 2 &&
        serverCapacity === 2 &&
        serverTimezone === 'Asia/Riyadh' &&
        afterSave.durationMin === 45 &&
        draftAvailabilityCheck.ok && serverAvailabilityCheck.ok && restoredAvailabilityCheck.ok &&
        persistedPlaceMode === 'branch' &&
        !!persistedBranchId &&
        (restore as any).placeMode === 'branch' &&
        (restore as any).branchId === persistedBranchId &&
        Number((restore as any).monthDays || 0) >= 28 &&
        orderAfterReopenEval.ok,
    );
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-save-restore.json'),
      JSON.stringify(
        {
          fill,
          draftMeta,
          draftReopen,
          draftBeforeOk,
          afterSave,
          restore,
          serverSun,
          serverTimezone,
          serverCapacity,
          restoreCapacity,
          persistedBranchId,
          persistedPlaceMode,
          orderAfterReopen,
          orderAfterReopenEval,
          restoreOk,
        },
        null,
        2,
      ),
    );
    record(
      'ACC-E2C-SAVE-RESTORE',
      'إنشاء خدمة وحفظ وإعادة فتح مع استعادة الحقول والتقويم والموقع',
      'draft reopen before materialize + post-materialize hair/windows/capacity/timezone/branch + compose order',
      JSON.stringify({
        fill,
        draftBeforeOk,
        afterSave,
        restore,
        serverSun,
        serverTimezone,
        serverCapacity,
        persistedBranchId,
        persistedPlaceMode,
        orderAfterReopenEval,
      }),
      restoreOk,
      {
        criterion: 'ACC-E2C-SAVE-RESTORE',
        evidence: ['e2c-save-restore.png', 'e2c-save-restore.json', 'e2c-availability-roundtrip.json'],
      },
    );
    const partnerStatusUi = String((afterSave as any).statusUi || '');
    const partnerPendingOk =
      !!afterSave.id &&
      !/تعذر الإرسال للمراجعة — ارفعي وسائط/.test(partnerStatusUi) &&
      /أضيفي وسائط|استئناف الإرسال|تم التحويل والإرسال|تم إنشاء العنصر —|أكملي الإرسال/.test(
        partnerStatusUi,
      );
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-partner-review-pending.json'),
      JSON.stringify({ statusUi: partnerStatusUi, id: afterSave.id, partnerPendingOk }, null, 2),
    );
    record(
      'ACC-E2C-PARTNER-REVIEW-PENDING-MEDIA',
      'إنشاء بلا وسائط لا يظهر رسالة تعذر الإرسال الكاذبة',
      'create/materialize without media → pending-media copy, not false submit failure',
      JSON.stringify({ statusUi: partnerStatusUi, id: afterSave.id }),
      partnerPendingOk,
      {
        criterion: 'ACC-E2C-PARTNER-REVIEW-PENDING-MEDIA',
        evidence: ['e2c-partner-review-pending.json'],
      },
    );

    // Complete salon journey: pending create → UI media → resume submit → server review state.
    let partnerResume: Record<string, unknown> = { ok: false, reason: 'no-owner' };
    if (afterSave.id) {
      const imgInput = page.locator('#catalogForm-images');
      const mediaPicked = (await imgInput.count()) > 0;
      if (mediaPicked) {
        await imgInput.setInputFiles(VALID_PNG);
        await page.waitForTimeout(2500);
      }
      const resumeBtn = page.locator(
        '#catalogForm [data-testid="materialize-draft"], #catalogForm [data-editor-v2-materialize="1"]',
      );
      if (await resumeBtn.count()) {
        await resumeBtn.first().click();
        await page.waitForTimeout(3500);
      }
      for (let t = 0; t < 16; t++) {
        const row = await prisma.service.findUnique({ where: { id: afterSave.id } });
        const mediaCount = await prisma.catalogMedia.count({
          where: { ownerKind: 'service', ownerId: afterSave.id },
        });
        const statusUi = await page.evaluate(() => {
          const form = document.getElementById('catalogForm');
          return (
            form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || ''
          );
        });
        partnerResume = {
          ok: true,
          id: afterSave.id,
          mediaPicked,
          mediaCount,
          reviewStatus: row?.reviewStatus ?? null,
          contentStatus: row?.contentStatus ?? null,
          statusUi,
        };
        if (
          mediaCount >= 1 &&
          (row?.reviewStatus === 'in_review' || row?.reviewStatus === 'approved')
        ) {
          break;
        }
        if (t === 6 || t === 11) {
          if (await resumeBtn.count()) await resumeBtn.first().click();
        }
        await page.waitForTimeout(500);
      }
    }
    const resumeLive = {
      id: (partnerResume as any).id ?? null,
      expectedId: afterSave.id,
      mediaCount: Number((partnerResume as any).mediaCount || 0),
      reviewStatus: (partnerResume as any).reviewStatus ?? null,
      contentStatus: (partnerResume as any).contentStatus ?? null,
      statusUi: String((partnerResume as any).statusUi || ''),
    };
    const resumeNegWrongState = evaluatePartnerResume({
      ...resumeLive,
      reviewStatus: 'draft',
      statusUi: 'تم التحويل والإرسال للمراجعة',
    });
    const resumeNegWrongId = evaluatePartnerResume({
      ...resumeLive,
      id: 'other-owner',
      reviewStatus: 'in_review',
    });
    const resumeNegNoMedia = evaluatePartnerResume({
      ...resumeLive,
      mediaCount: 0,
      reviewStatus: 'in_review',
      statusUi: 'تم التحويل والإرسال للمراجعة',
    });
    const partnerResumeOk =
      evaluatePartnerResume(resumeLive) &&
      resumeNegWrongState === false &&
      resumeNegWrongId === false &&
      resumeNegNoMedia === false;
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-partner-resume-submit.json'),
      JSON.stringify(
        {
          partnerResume,
          resumeLive,
          negatives: { resumeNegWrongState, resumeNegWrongId, resumeNegNoMedia },
          partnerResumeOk,
        },
        null,
        2,
      ),
    );
    record(
      'ACC-E2C-PARTNER-RESUME-SUBMIT',
      'العادي: رفع وسائط ثم استئناف الإرسال للمراجعة بنجاح',
      'server reviewStatus in_review|approved + same owner id; UI toast alone rejected',
      JSON.stringify({ resumeLive, negatives: { resumeNegWrongState, resumeNegWrongId, resumeNegNoMedia } }),
      partnerResumeOk,
      {
        criterion: 'ACC-E2C-PARTNER-RESUME-SUBMIT',
        evidence: ['e2c-partner-resume-submit.json'],
      },
    );

    // Geometry vs compose origin (layout truth) — not scrollIntoView as a compose fix.
    async function measureGeom(): Promise<{
      viewportWidth: number;
      orbsTop: number;
      basicsTop: number;
      fieldsLeft: number;
      fieldsRight: number;
      mediaLeft: number;
      mediaRight: number;
      mediaTop: number;
      previewLeft: number;
      previewRight: number;
      previewTop: number;
      previewWidth: number;
      measuredPreview: boolean;
      availTop: number;
      secondaryOpen: boolean | null;
      exceptionsOpen: boolean | null;
      weeklyEditOpen: boolean | null;
      sideBySidePx: number;
      fieldsWidth: number;
      mediaWidth: number;
    }> {
      const fullLayout = await page.evaluate((src) => (0, eval)('(' + src + ')()'), READ_FULL_SERVICE_LAYOUT_SOURCE);
      const fullLayoutCheck = evaluateFullServiceLayout(fullLayout);
      fs.writeFileSync(path.join(evidenceDir, 'e2c-full-form-layout.json'),
        JSON.stringify({ fullLayout, fullLayoutCheck }, null, 2));
      if (!fullLayoutCheck.ok) throw new Error(fullLayoutCheck.reason);
      return page.evaluate(`(() => {
        var compose = document.querySelector('[data-testid="e2c-editor-compose"]');
        var origin = compose ? compose.getBoundingClientRect() : { top: 0, left: 0 };
        function box(sel, root) {
          var n = (root || document).querySelector(sel);
          if (!n || n.hidden) return null;
          var r = n.getBoundingClientRect();
          return {
            top: r.top - origin.top,
            left: r.left - origin.left,
            right: r.right - origin.left,
            bottom: r.bottom - origin.top,
            width: r.width,
            height: r.height
          };
        }
        var orbs = box('[data-section-role="service-orbs"]') || box('[data-testid="e2c-orb-host"]') || box('[data-testid="e2c-main-circle"]');
        var basics = box('[data-section-role="basics"]');
        var fields = box('[data-testid="e2c-editor-fields"]');
        var media = box('[data-testid="e2c-editor-media"]');
        // Actual preview card inside the side tools column — not a distant detail-media card.
        var sideRoot = document.querySelector('[data-testid="e2c-side-stack"]') || document.querySelector('[data-testid="e2c-editor-media"]');
        // Prefer the real video/preview card — never treat the tall e2c-editor-media shell as the card.
        var preview =
          box('[data-testid="e2b-video-card"]', sideRoot) ||
          box('[data-testid="media-card-saved"]', sideRoot) ||
          box('[data-testid="media-card-staged"]', sideRoot) ||
          box('[data-testid="catalog-main-media-section"] .media-box', sideRoot) ||
          box('[data-testid="catalog-main-media-section"]', sideRoot) ||
          box('[data-section-role="main-media"]', sideRoot);
        var avail = box('[data-section-role="availability"]', sideRoot) || box('[data-section-role="availability"]');
        var secondary = document.querySelector('[data-testid="e2c-secondary-details"]');
        var exDetails = document.querySelector('[data-testid="e2c-exceptions-details"]');
        var weeklyEdit = document.querySelector('[data-testid="e2c-avail-edit-details"]');
        var previewLeft = preview ? preview.left : -1;
        var fieldsLeft = fields ? fields.left : -1;
        return {
          viewportWidth: window.innerWidth,
          orbsTop: orbs ? orbs.top : -1,
          basicsTop: basics ? basics.top : -1,
          fieldsLeft: fieldsLeft,
          fieldsRight: fields ? fields.right : -1,
          fieldsWidth: fields ? fields.width : 0,
          mediaLeft: media ? media.left : -1,
          mediaRight: media ? media.right : -1,
          mediaWidth: media ? media.width : 0,
          mediaTop: media ? media.top : -1,
          previewLeft: previewLeft,
          previewRight: preview ? preview.right : -1,
          previewTop: preview ? preview.top : -1,
          previewWidth: preview ? preview.width : 0,
          measuredPreview: !!preview && preview.width > 40,
          availTop: avail ? avail.top : -1,
          secondaryOpen: secondary ? !!secondary.open : null,
          exceptionsOpen: exDetails ? !!exDetails.open : null,
          weeklyEditOpen: weeklyEdit ? !!weeklyEdit.open : null,
          sideBySidePx: fields && preview ? Math.abs(fieldsLeft - previewLeft) : 0
        };
      })()`) as Promise<{
        viewportWidth: number;
        orbsTop: number;
        basicsTop: number;
        fieldsLeft: number;
        fieldsRight: number;
        fieldsWidth: number;
        mediaLeft: number;
        mediaRight: number;
        mediaWidth: number;
        mediaTop: number;
        previewLeft: number;
        previewRight: number;
        previewTop: number;
        previewWidth: number;
        measuredPreview: boolean;
        availTop: number;
        secondaryOpen: boolean | null;
        exceptionsOpen: boolean | null;
        weeklyEditOpen: boolean | null;
        sideBySidePx: number;
      }>;
    }
    // Design must survive category change — order index + real geometry (contains alone insufficient).
    const designAfterCat = await page.evaluate(() => {
      const nails = document.querySelector(
        '[data-testid="e2c-main-circle"][data-category-id="nails"]',
      ) as HTMLButtonElement | null;
      if (nails) nails.click();
      const compose = document.querySelector('[data-testid="e2c-editor-compose"]') as HTMLElement | null;
      const fields = document.querySelector('[data-testid="e2c-editor-fields"]') as HTMLElement | null;
      const media = document.querySelector('[data-testid="e2c-editor-media"]') as HTMLElement | null;
      const avail = document.querySelector('[data-section-role="availability"]') as HTMLElement | null;
      const side = document.querySelector('[data-testid="e2c-side-stack"]') as HTMLElement | null;
      const stable = compose?.getAttribute('data-e2c-compose-stable') === '1';
      const fieldRoles = fields
        ? Array.from(fields.children)
            .map((n) => (n as HTMLElement).getAttribute('data-section-role') || '')
            .filter(Boolean)
        : [];
      const sideRoles = side
        ? Array.from(side.children)
            .map((n) => {
              const el = n as HTMLElement;
              return (
                el.getAttribute('data-section-role') ||
                (el.getAttribute('data-testid') === 'catalog-main-media-section' ||
                el.classList.contains('e2b-media-stage')
                  ? 'main-media'
                  : '')
              );
            })
            .filter(Boolean)
        : [];
      const availIdx = sideRoles.indexOf('availability');
      const mediaIdx = sideRoles.findIndex((r) => r === 'main-media' || r === 'media');
      return {
        nailsSelected: !!document.querySelector(
          '[data-testid="e2c-main-circle"][data-category-id="nails"].is-selected',
        ),
        compose: !!compose && !compose.hidden,
        fields: !!fields,
        media: !!media,
        sideHasAvail: !!(side && avail && side.contains(avail)),
        fieldRoles,
        sideRoles,
        mediaBeforeAvail: mediaIdx >= 0 && (availIdx < 0 || mediaIdx < availIdx),
        stable,
        attrOrder: compose?.getAttribute('data-e2c-field-order') || null,
      };
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      for (const sel of [
        '[data-testid="e2c-avail-edit-details"]',
        '[data-testid="e2c-exceptions-details"]',
        '[data-testid="e2c-secondary-details"]',
      ]) {
        const d = document.querySelector(sel) as HTMLDetailsElement | null;
        if (d) d.open = false;
      }
    });
    const geomAfterCat = await measureGeom();
    const designOrderEval = evaluateComposeFieldOrder({
      fieldRoles: (designAfterCat as any).fieldRoles || [],
      sideRoles: (designAfterCat as any).sideRoles || [],
    });
    const geomAfterCatEval = evaluateDesktopGeometry(geomAfterCat);
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-design-after-category.png'), fullPage: true });
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-design-after-category.json'),
      JSON.stringify({ designAfterCat, designOrderEval, geomAfterCat, geomAfterCatEval }, null, 2),
    );
    record(
      'ACC-E2C-DESIGN-AFTER-CATEGORY',
      'ترتيب المحرر يبقى بعد تغيير التصنيف',
      'exact fieldRoles + side-by-side geometry px + secondary collapsed',
      JSON.stringify({ designAfterCat, designOrderEval, geomAfterCat, geomAfterCatEval }),
      !!(designAfterCat as any).compose &&
        !!(designAfterCat as any).fields &&
        !!(designAfterCat as any).media &&
        !!(designAfterCat as any).sideHasAvail &&
        !!(designAfterCat as any).nailsSelected &&
        !!(designAfterCat as any).mediaBeforeAvail &&
        designOrderEval.ok &&
        geomAfterCatEval.ok &&
        Number(geomAfterCat.sideBySidePx) >= 120 &&
        Number(geomAfterCat.previewTop) <= Number(geomAfterCat.basicsTop) + 280,
      {
        criterion: 'ACC-E2C-DESIGN-AFTER-CATEGORY',
        evidence: ['e2c-design-after-category.png', 'e2c-design-after-category.json'],
      },
    );

    // Branch ownership via UI only (no API compensation; schedule already persisted clean at create).
    let branchOwnership: Record<string, unknown> = { ok: false };
    if (afterSave.id) {
      // Re-open owner — independent of prior probe DOM; server restore carries valid windows.
      const openOwned = page
        .locator('#catalogList .list-item')
        .filter({ hasText: svcName })
        .getByRole('button', { name: 'فتح في النموذج' });
      if (await openOwned.count()) {
        await openOwned.click();
        await page.waitForTimeout(900);
      }
      const switchUi = await page.evaluate((bid) => {
        const branchChip = document.querySelector(
          '[data-testid="e2c-place-chip"][data-place-mode="branch"]',
        ) as HTMLButtonElement | null;
        if (branchChip) branchChip.click();
        const sel = document.querySelector(
          '[data-testid="e2c-branch-select"]',
        ) as HTMLSelectElement | null;
        if (!sel) return { ok: false, reason: 'no-select' };
        const opt = Array.from(sel.options).find((o) => o.value === bid);
        if (!opt) return { ok: false, reason: 'branch2-missing', options: sel.options.length };
        sel.value = bid;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        const city = document.querySelector('[data-testid="e2c-place-city"]')?.textContent || '';
        const mapSrc =
          (document.querySelector('[data-testid="e2c-map-embed"]') as HTMLIFrameElement | null)?.src ||
          '';
        const placeMode = (
          document.querySelector('[data-testid="e2c-place-mode"]') as HTMLInputElement | null
        )?.value;
        return {
          ok: true,
          value: sel.value,
          placeMode,
          city,
          mapHasCoords: /24\.71|46\.67/.test(mapSrc) || /الرياض/.test(city),
        };
      }, salonBranch2.id);
      const patchWait = page.waitForResponse(
        (res) =>
          /\/partners-portal\/services\//.test(res.url()) &&
          res.request().method() === 'PATCH',
        { timeout: 8000 },
      );
      await page.click('#catalogForm-save');
      let patchMeta: Record<string, unknown> = { seen: false };
      try {
        const patchRes = await patchWait;
        const reqBody = patchRes.request().postDataJSON?.() || null;
        patchMeta = {
          seen: true,
          status: patchRes.status(),
          reqBranchId: reqBody?.branchId ?? null,
          reqPlaceMode: reqBody?.placeMode ?? null,
        };
      } catch {
        patchMeta = { seen: false };
      }
      await page.waitForTimeout(1200);
      const statusAfterSwitch = await page.evaluate(() => {
        const form = document.getElementById('catalogForm');
        return (
          form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent ||
          ''
        );
      });
      const afterSwitch = await prisma.service.findUnique({ where: { id: afterSave.id } });
      // Reopen and assert UI restore of branch2 (no API patch).
      if (await openOwned.count()) {
        await openOwned.click();
        await page.waitForTimeout(800);
      }
      const restoreUi = await page.evaluate(() => {
        const mode = (document.querySelector('[data-testid="e2c-place-mode"]') as HTMLInputElement | null)
          ?.value;
        const branchId = (
          document.querySelector('[data-testid="e2c-branch-select"]') as HTMLSelectElement | null
        )?.value;
        const city = document.querySelector('[data-testid="e2c-place-city"]')?.textContent || '';
        return { mode, branchId, city };
      });
      // Foreign branch via form save: status must show Arabic contract text (not only test-log catch).
      const uiReject = await page.evaluate(async ({ foreignId }) => {
        const form = document.getElementById('catalogForm') as HTMLFormElement | null;
        if (!form) return { ok: false, reason: 'no-form' };
        const branchSel = form.querySelector(
          '[name="branchId"], [data-testid="e2c-branch-select"]',
        ) as HTMLSelectElement | null;
        if (!branchSel) return { ok: false, reason: 'no-branch-select' };
        if (![...branchSel.options].some((o) => o.value === foreignId)) {
          const opt = document.createElement('option');
          opt.value = foreignId;
          opt.textContent = 'فرع غير مملوك (اختبار)';
          branchSel.appendChild(opt);
        }
        const placeMode = form.querySelector('[name="placeMode"]') as HTMLInputElement | null;
        if (placeMode) {
          placeMode.value = 'branch';
          placeMode.dispatchEvent(new Event('change', { bubbles: true }));
        }
        branchSel.value = foreignId;
        branchSel.dispatchEvent(new Event('change', { bubbles: true }));
        const save = document.getElementById('catalogForm-save') as HTMLButtonElement | null;
        if (!save) return { ok: false, reason: 'no-save' };
        save.click();
        await new Promise((r) => setTimeout(r, 1800));
        const statusUi =
          form.querySelector('[data-catalog-persist-status], p.lead, [role="status"], .field-error')
            ?.textContent || '';
        const ok = /الفرع غير موجود أو لا يخص هذه الجهة|تعذر الحفظ/.test(statusUi);
        return { ok, statusUi };
      }, { foreignId: foreignBranch.id });
      branchOwnership = {
        switchUi,
        patchMeta,
        statusAfterSwitch,
        branchAfterSwitch: (afterSwitch as any)?.branchId ?? null,
        placeAfterSwitch: (afterSwitch as any)?.placeMode ?? null,
        expectedBranch2: salonBranch2.id,
        restoreUi,
        uiReject,
      };
    }
    const branchOwnershipOk =
      (branchOwnership.switchUi as any)?.ok === true &&
      (branchOwnership.switchUi as any)?.mapHasCoords === true &&
      (branchOwnership.patchMeta as any)?.seen === true &&
      Number((branchOwnership.patchMeta as any)?.status) < 400 &&
      (branchOwnership.patchMeta as any)?.reqBranchId === salonBranch2.id &&
      branchOwnership.branchAfterSwitch === salonBranch2.id &&
      branchOwnership.placeAfterSwitch === 'branch' &&
      (branchOwnership.restoreUi as any)?.branchId === salonBranch2.id &&
      (branchOwnership.restoreUi as any)?.mode === 'branch' &&
      (branchOwnership.uiReject as any)?.ok === true;
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-branch-ownership.json'),
      JSON.stringify(branchOwnership, null, 2),
    );
    record(
      'ACC-E2C-BRANCH-OWNERSHIP',
      'تبديل فرع مملوك وحفظه وإعادة فتحه من الواجهة + رفض غير المملوك',
      'UI save persists branch2 + map/city; reopen restores; foreign rejected with message',
      JSON.stringify(branchOwnership),
      branchOwnershipOk,
      { criterion: 'ACC-E2C-BRANCH-OWNERSHIP', evidence: ['e2c-branch-ownership.json'] },
    );

    // Separate API contract tests (not a substitute for UI save).
    let branchApi: Record<string, unknown> = { ok: false };
    if (afterSave.id) {
      const beforeRejectRow = await prisma.service.findUnique({ where: { id: afterSave.id } });
      const beforeRejectBranch = (beforeRejectRow as any)?.branchId ?? null;
      const rejectRes = await fetch(`${apiBase}/partners-portal/services/${afterSave.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenSalon}`,
        },
        body: JSON.stringify({ branchId: foreignBranch.id, placeMode: 'branch' }),
      });
      const rejectBody = await rejectRes.json().catch(() => ({}));
      const rejectMsg = String(
        (rejectBody as any)?.messageAr || (rejectBody as any)?.message || JSON.stringify(rejectBody),
      );
      const afterReject = await prisma.service.findUnique({ where: { id: afterSave.id } });
      const seed = await fetch(`${apiBase}/partners-portal/services/${afterSave.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenSalon}`,
        },
        body: JSON.stringify({ branchId: salonBranch.id, placeMode: 'branch' }),
      });
      const beforeOmit = await prisma.service.findUnique({ where: { id: afterSave.id } });
      const omitRes = await fetch(`${apiBase}/partners-portal/services/${afterSave.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenSalon}`,
        },
        body: JSON.stringify({ nameAr: `E2C-Svc-${suffix}-omit` }),
      });
      const afterOmit = await prisma.service.findUnique({ where: { id: afterSave.id } });
      const clearApi = await fetch(`${apiBase}/partners-portal/services/${afterSave.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokenSalon}`,
        },
        body: JSON.stringify({ branchId: null, placeMode: 'home' }),
      });
      const afterClearApi = await prisma.service.findUnique({ where: { id: afterSave.id } });
      branchApi = {
        rejectStatus: rejectRes.status,
        rejectMsg,
        beforeRejectBranch,
        branchUnchangedAfterReject: (afterReject as any)?.branchId === beforeRejectBranch,
        seedStatus: seed.status,
        beforeOmitBranch: (beforeOmit as any)?.branchId ?? null,
        omitStatus: omitRes.status,
        afterOmitBranch: (afterOmit as any)?.branchId ?? null,
        clearApiStatus: clearApi.status,
        afterClearApiBranch: (afterClearApi as any)?.branchId ?? null,
        afterClearApiPlace: (afterClearApi as any)?.placeMode ?? null,
      };
    }
    const branchApiOk =
      Number(branchApi.rejectStatus) >= 400 &&
      /الفرع غير موجود أو لا يخص هذه الجهة/.test(String(branchApi.rejectMsg || '')) &&
      branchApi.branchUnchangedAfterReject === true &&
      Number(branchApi.seedStatus) < 400 &&
      Number(branchApi.omitStatus) < 400 &&
      branchApi.afterOmitBranch === salonBranch.id &&
      Number(branchApi.clearApiStatus) < 400 &&
      branchApi.afterClearApiBranch == null &&
      branchApi.afterClearApiPlace === 'home';
    fs.writeFileSync(path.join(evidenceDir, 'e2c-branch-api.json'), JSON.stringify(branchApi, null, 2));
    record(
      'ACC-E2C-BRANCH-API',
      'عقد API منفصل: رفض فرع أجنبي + إغفال يُبقي + مسح null',
      '404 foreign; omit keeps; null clears',
      JSON.stringify(branchApi),
      branchApiOk,
      { criterion: 'ACC-E2C-BRANCH-API', evidence: ['e2c-branch-api.json'] },
    );

    // Explicit clear via UI save only — no API fallback when save fails.
    let clearVsOmit: Record<string, unknown> = { ok: false };
    if (afterSave.id) {
      // Seed branch1 via UI so clear journey is end-to-end UI.
      const openAgain = page
        .locator('#catalogList .list-item')
        .filter({ hasText: svcName })
        .getByRole('button', { name: 'فتح في النموذج' });
      if (await openAgain.count()) {
        await openAgain.first().click();
        await page.waitForTimeout(800);
      }
      await page.evaluate((bid) => {
        const branchChip = document.querySelector(
          '[data-testid="e2c-place-chip"][data-place-mode="branch"]',
        ) as HTMLButtonElement | null;
        if (branchChip) branchChip.click();
        const sel = document.querySelector(
          '[data-testid="e2c-branch-select"]',
        ) as HTMLSelectElement | null;
        if (sel) {
          sel.value = bid;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, salonBranch.id);
      const seedPatchWait = page.waitForResponse(
        (res) =>
          /\/partners-portal\/services\//.test(res.url()) &&
          res.request().method() === 'PATCH',
        { timeout: 8000 },
      );
      await page.click('#catalogForm-save');
      let seedPatch: Record<string, unknown> = { seen: false };
      try {
        const r = await seedPatchWait;
        seedPatch = { seen: true, status: r.status(), body: r.request().postDataJSON?.() || null };
      } catch {
        seedPatch = { seen: false };
      }
      await page.waitForTimeout(1000);
      const beforeClear = await prisma.service.findUnique({ where: { id: afterSave.id } });
      const homeUi = await page.evaluate(() => {
        const home = document.querySelector(
          '[data-testid="e2c-place-chip"][data-place-mode="home"]',
        ) as HTMLButtonElement | null;
        if (home) home.click();
        const mode = (document.querySelector('[data-testid="e2c-place-mode"]') as HTMLInputElement | null)
          ?.value;
        const branchEl = document.querySelector(
          '[name="branchId"], [data-testid="e2c-branch-select"]',
        ) as HTMLSelectElement | null;
        return {
          mode,
          branchVal: branchEl ? String(branchEl.value || '') : null,
          branchMounted: !!branchEl,
        };
      });
      const clearPatchWait = page.waitForResponse(
        (res) =>
          /\/partners-portal\/services\//.test(res.url()) &&
          res.request().method() === 'PATCH',
        { timeout: 8000 },
      );
      await page.click('#catalogForm-save');
      let clearPatch: Record<string, unknown> = { seen: false };
      try {
        const r = await clearPatchWait;
        clearPatch = { seen: true, status: r.status(), body: r.request().postDataJSON?.() || null };
      } catch {
        clearPatch = { seen: false };
      }
      await page.waitForTimeout(1200);
      const afterUiClear = await prisma.service.findUnique({ where: { id: afterSave.id } });
      if (await openAgain.count()) {
        await openAgain.click();
        await page.waitForTimeout(800);
      }
      const restoreAfterClear = await page.evaluate(() => {
        const mode = (document.querySelector('[data-testid="e2c-place-mode"]') as HTMLInputElement | null)
          ?.value;
        const branchId = (
          document.querySelector('[name="branchId"], [data-testid="e2c-branch-select"]') as
            | HTMLSelectElement
            | null
        )?.value;
        return { mode, branchId };
      });
      // Geometry still holds after save/reopen of place clear.
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.waitForTimeout(200);
      const geomAfterSave = await measureGeom();
      const geomAfterSaveEval = evaluateDesktopGeometry(geomAfterSave);
      await page.screenshot({ path: path.join(evidenceDir, 'e2c-design-after-save-reopen.png'), fullPage: true });
      clearVsOmit = {
        beforeClearBranch: (beforeClear as any)?.branchId ?? null,
        homeUi,
        seedPatch,
        clearPatch,
        afterClearBranch: (afterUiClear as any)?.branchId ?? null,
        afterClearPlace: (afterUiClear as any)?.placeMode ?? null,
        restoreAfterClear,
        geomAfterSave,
        geomAfterSaveEval,
        usedApiFallback: false,
      };
    }
    const clearVsOmitOk =
      clearVsOmit.beforeClearBranch === salonBranch.id &&
      (clearVsOmit.homeUi as any)?.mode === 'home' &&
      (clearVsOmit.homeUi as any)?.branchMounted === true &&
      (clearVsOmit.homeUi as any)?.branchVal === '' &&
      (clearVsOmit.clearPatch as any)?.seen === true &&
      Number((clearVsOmit.clearPatch as any)?.status) < 400 &&
      ((clearVsOmit.clearPatch as any)?.body?.branchId === null ||
        (clearVsOmit.clearPatch as any)?.body?.placeMode === 'home') &&
      clearVsOmit.afterClearBranch == null &&
      clearVsOmit.afterClearPlace === 'home' &&
      ((clearVsOmit.restoreAfterClear as any)?.mode === 'home' ||
        (clearVsOmit.restoreAfterClear as any)?.branchId === '' ||
        (clearVsOmit.restoreAfterClear as any)?.branchId == null) &&
      (clearVsOmit.geomAfterSaveEval as any)?.ok === true &&
      clearVsOmit.usedApiFallback === false;
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-clear-vs-omit-branch.json'),
      JSON.stringify(clearVsOmit, null, 2),
    );
    record(
      'ACC-E2C-CLEAR-VS-OMIT-BRANCH',
      'مسح صريح للفرع من الواجهة ثم إعادة فتح (بلا تعويض API)',
      'home chip + save clears server branchId; reopen restores home; geometry ok',
      JSON.stringify(clearVsOmit),
      clearVsOmitOk,
      {
        criterion: 'ACC-E2C-CLEAR-VS-OMIT-BRANCH',
        evidence: ['e2c-clear-vs-omit-branch.json', 'e2c-design-after-save-reopen.png'],
      },
    );

    // اختياري فعلي على خدمة مستقلة: مورد/وصف فارغان لا يتحولان إلى صفر أو قيمة وهمية.
    const optName = `E2C-OptEmpty-${suffix}`;
    await page.click('#goService');
    await page.waitForTimeout(700);
    const optFill = await page.evaluate((nm) => {
      const form = document.getElementById('catalogForm');
      if (!form) return { ok: false, reason: 'no-form' };
      const editFold = form.querySelector('[data-testid="e2c-avail-edit-details"]') as any;
      if (editFold) editFold.open = true;
      const hair = document.querySelector('[data-testid="e2c-main-circle"][data-category-id="hair"]') as any;
      if (hair) hair.click();
      const home = document.querySelector('[data-testid="e2c-place-chip"][data-place-mode="home"]') as any;
      if (home) home.click();
      const name = form.querySelector('input[name="nameAr"]') as any;
      const price = form.querySelector('input[name="priceSar"]') as any;
      const dur = form.querySelector('input[name="durationMin"]') as any;
      const desc = form.querySelector('[name="descriptionAr"]') as any;
      if (!name || !price || !dur) return { ok: false, reason: 'missing-basics' };
      name.value = nm; name.dispatchEvent(new Event('input', { bubbles: true }));
      price.value = '33'; price.dispatchEvent(new Event('input', { bubbles: true }));
      dur.value = '25'; dur.dispatchEvent(new Event('input', { bubbles: true }));
      if (desc) { desc.value = ''; desc.dispatchEvent(new Event('input', { bubbles: true })); }
      let guard = 0;
      while (guard++ < 40) {
        const rm = document.querySelector('[data-testid="avail-window-remove"]') as any
          || document.querySelector('[data-testid="avail-exception-row"] button') as any
          || document.querySelector('[data-testid="avail-closed-date-row"] button') as any;
        if (!rm) break;
        rm.click();
      }
      const day0 = document.querySelector('details[data-weekday="0"]') as any;
      if (day0) day0.open = true;
      let row = form.querySelector('[data-testid="avail-window-row"][data-weekday="0"]') as any;
      if (!row) {
        const add = day0 && day0.querySelector('[data-testid="avail-window-add"]');
        if (add) add.click();
        row = form.querySelector('[data-testid="avail-window-row"][data-weekday="0"]') as any;
      }
      if (!row) return { ok: false, reason: 'no-sunday-row' };
      const times = row.querySelectorAll('input[type="time"]');
      const cap = row.querySelector('input[type="number"]') as any;
      const res = row.querySelector('input[type="text"]') as any;
      if (times[0]) { times[0].value = '09:00'; times[0].dispatchEvent(new Event('change', { bubbles: true })); }
      if (times[1]) { times[1].value = '11:00'; times[1].dispatchEvent(new Event('change', { bubbles: true })); }
      if (cap) { cap.value = '2'; cap.dispatchEvent(new Event('input', { bubbles: true })); cap.dispatchEvent(new Event('change', { bubbles: true })); }
      if (res) { res.value = ''; res.dispatchEvent(new Event('change', { bubbles: true })); }
      return { ok: true, resUi: res ? res.value : null };
    }, optName);
    await page.click('#catalogForm-save');
    await page.waitForTimeout(1200);
    const matOpt = page.locator('#catalogForm [data-testid="materialize-draft"]:visible, #catalogForm [data-editor-v2-materialize="1"]:visible');
    if (await matOpt.count()) { await matOpt.first().click(); await page.waitForTimeout(3000); }
    let optOwner: { id: string | null; resourceId: unknown; descriptionAr: unknown } = { id: null, resourceId: undefined, descriptionAr: undefined };
    for (let t = 0; t < 12; t++) {
      const hit = await page.evaluate(async (nm) => {
        const dash = await (window as any).PartnersApi.dashboard();
        return (dash?.catalog?.services || []).find((s: any) => s.nameAr === nm) || null;
      }, optName);
      if (hit?.id) {
        const db = await prisma.service.findUnique({ where: { id: hit.id } });
        const wins = Array.isArray((db?.availabilityJson as any)?.windows) ? (db?.availabilityJson as any).windows : [];
        const sun = wins.find((w: any) => Number(w.weekday) === 0);
        optOwner = { id: hit.id, resourceId: sun ? sun.resourceId : undefined, descriptionAr: db?.descriptionAr ?? null };
        createdServiceIds.push(hit.id);
        break;
      }
      await page.waitForTimeout(400);
    }
    const resUi = String((optFill as any)?.resUi ?? '');
    const resServer = optOwner.resourceId;
    const descServer = optOwner.descriptionAr;
    const optionalEmptyOk =
      !!(optFill as any)?.ok && !!optOwner.id &&
      (resUi === '' || resUi == null) &&
      (resServer === '' || resServer == null) &&
      resServer !== 0 && resServer !== '0' && resServer !== 'resource-1' &&
      (descServer == null || descServer === '') && descServer !== 0 && descServer !== '0';
    fs.writeFileSync(path.join(evidenceDir, 'e2c-optional-empty.json'), JSON.stringify({ note: 'independent empty resource/description', optFill, optOwner, resUi, resServer, descServer, optionalEmptyOk }, null, 2));
    record('ACC-E2C-OPTIONAL-EMPTY', 'المورد/الوصف الاختياريان الفارغان لا يتحولان إلى صفر', 'independent service; empty resource/description stay empty', JSON.stringify({ resUi, resServer, descServer, optionalEmptyOk }), optionalEmptyOk, { criterion: 'ACC-E2C-OPTIONAL-EMPTY', evidence: ['e2c-optional-empty.json'] });


    record(
      'ACC-E2C-LAYOUTS-DESKTOP',
      'مطابقة سطح المكتب لمحرر الخدمة',
      'compose + orbs + place + avail visible at 1280',
      JSON.stringify({ compose: shell.compose, orbHost: shell.orbHost }),
      !!(shell.compose && shell.orbHost && shell.place && shell.avail),
      { criterion: 'ACC-E2C-LAYOUTS-DESKTOP', evidence: ['e2c-orbs-desktop.png'] },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-phone.png'), fullPage: true });
    const phoneLayout = await page.evaluate(() => {
      const compose = document.querySelector('[data-testid="e2c-editor-compose"]') as HTMLElement | null;
      const workspace = document.querySelector(
        '[data-testid="e2c-workspace"], .e2c-workspace',
      ) as HTMLElement | null;
      const fields = document.querySelector('[data-testid="e2c-editor-fields"]') as HTMLElement | null;
      const cs = compose ? getComputedStyle(compose) : null;
      const ws = workspace ? getComputedStyle(workspace) : null;
      const fieldsW = fields ? fields.getBoundingClientRect().width : 0;
      const trackCount = (ws?.gridTemplateColumns || '')
        .split(' ')
        .map((x) => x.trim())
        .filter(Boolean).length;
      return {
        compose: !!compose,
        cols: cs?.gridTemplateColumns || '',
        workspaceCols: ws?.gridTemplateColumns || '',
        workspaceTracks: trackCount,
        fieldsWidth: fieldsW,
        orbs: document.querySelectorAll('[data-testid="e2c-main-circle"]').length,
      };
    });
    record(
      'ACC-E2C-LAYOUTS-PHONE',
      'عرض الهاتف لمحاكاة البوابة (ليس جهازًا فعليًا)',
      'workspace 1-col; fieldsWidth>=280; orbs visible',
      JSON.stringify(phoneLayout),
      phoneLayout.compose &&
        phoneLayout.orbs >= 3 &&
        phoneLayout.workspaceTracks <= 1 &&
        phoneLayout.fieldsWidth >= 280,
      { criterion: 'ACC-E2C-LAYOUTS-PHONE', evidence: ['e2c-phone.png'] },
    );

    // Developer publish path — natural UI journey:
    // pick file → upload (onchange stages+draft save) → save/reopen → edit → publish CTA.
    // Never PartnersApi.addMedia / submitReview as UI substitutes.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(
      ({ email, token }) => {
        localStorage.setItem('mira_partner_email', email);
        localStorage.setItem('mira_partner_token', token);
      },
      { email: `e2c-dev-${suffix}@test.local`, token: tokenDev },
    );
    await page.goto(`${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('#goService', { timeout: 20000 });
    await page.click('#goService');
    await page.waitForTimeout(800);
    const devName = `E2C-DevSvc-${suffix}`;
    await page.evaluate((nm) => {
      const form = document.getElementById('serviceForm');
      if (!form) return;
      const name = form.querySelector('input[name="nameAr"]') as HTMLInputElement | null;
      const price = form.querySelector('input[name="priceSar"]') as HTMLInputElement | null;
      const dur = form.querySelector('input[name="durationMin"]') as HTMLInputElement | null;
      const cat = form.querySelector('select[name="category"]') as HTMLSelectElement | null;
      if (name) {
        name.value = nm;
        name.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (price) {
        price.value = '99';
        price.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (dur) {
        dur.value = '30';
        dur.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (cat && cat.options.length > 1) {
        cat.selectedIndex = 1;
        cat.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const hair = document.querySelector(
        '#serviceForm [data-testid="e2c-main-circle"], [data-testid="e2c-main-circle"]',
      ) as HTMLButtonElement | null;
      if (hair) hair.click();
    }, devName);
    const devCta = await page.evaluate(() => {
      const save = document.getElementById('serviceForm-save') as HTMLButtonElement | null;
      const bar = document.querySelector('#serviceForm [data-testid="e2b-editor-actions"]');
      const finals = Array.from(bar?.querySelectorAll('button') || []).map((b) => (b.textContent || '').trim());
      return { saveLabel: save?.textContent || '', ctaRole: save?.dataset?.ctaRole || '', finals };
    });
    // 1) Choose media via real file input (stages + draft persist inside onchange).
    const imgInput = page.locator('#serviceForm-images');
    const mediaPicked = (await imgInput.count()) > 0;
    if (mediaPicked) {
      await imgInput.setInputFiles(VALID_PNG);
      await page.waitForTimeout(2500);
    }
    // Wait until owner exists from draft autosave after file pick (or click save once).
    let devSvc: any = null;
    for (let t = 0; t < 20 && !devSvc?.id; t++) {
      const dash = await page.evaluate(async () => (window as any).PartnersApi.dashboard());
      devSvc =
        (dash?.catalog?.services || []).find((s: any) => s.nameAr === devName) ||
        (dash?.catalog?.services || []).find((s: any) => String(s.nameAr || '').includes('E2C-DevSvc-'));
      if (devSvc?.id) break;
      if (t === 4) await page.click('#serviceForm-save');
      await page.waitForTimeout(500);
    }
    if (devSvc?.id) createdServiceIds.push(devSvc.id);
    let mediaRestored = false;
    // 2) Re-open → edit → publish via CTA only.
    if (devSvc?.id) {
      const openDev = page
        .locator('#serviceList .list-item')
        .filter({ hasText: 'E2C-DevSvc-' })
        .getByRole('button', { name: 'فتح في النموذج' });
      if (await openDev.count()) await openDev.click();
      else {
        // Ensure list visible for developer dual sections.
        await page.evaluate(() => document.getElementById('serviceSection')?.scrollIntoView());
        await page.waitForTimeout(300);
        if (await openDev.count()) await openDev.click();
      }
      await page.waitForTimeout(900);
      await page.evaluate(() => {
        const name = document.querySelector(
          '#serviceForm input[name="nameAr"]',
        ) as HTMLInputElement | null;
        if (name && !/-عدّل$/.test(name.value)) {
          name.value = name.value + '-عدّل';
          name.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      // Media must restore after reopen — re-picking here would hide a restore defect.
      const savedCards = await page.locator('#serviceForm [data-testid="media-card-saved"]').count();
      const stagedCards = await page.locator('#serviceForm [data-testid="media-card-staged"]').count();
      mediaRestored = savedCards + stagedCards >= 1;
      fs.writeFileSync(
        path.join(evidenceDir, 'e2c-dev-media-restore.json'),
        JSON.stringify({ savedCards, stagedCards, mediaRestored }, null, 2),
      );
      if (!mediaRestored) {
        // Do not compensate with setInputFiles — leave publish to fail honestly.
      }
      const pub = page.locator('#serviceForm-save').filter({ hasText: /نشر الآن|استئناف النشر|استكمال النشر/ });
      if (await pub.count()) await pub.first().click();
      else await page.click('#serviceForm-save');
      await page.waitForTimeout(2800);
      for (let t = 0; t < 24; t++) {
        const row = await prisma.service.findUnique({ where: { id: devSvc.id } });
        if (row?.contentStatus === 'published' && row?.active === true) break;
        if (t === 6 || t === 14) {
          const again = page.locator('#serviceForm-save').filter({ hasText: /نشر الآن|استئناف|استكمال/ });
          if (await again.count()) await again.first().click();
          else await page.click('#serviceForm-save');
        }
        await page.waitForTimeout(500);
      }
      devSvc = (await page.evaluate(async () => (window as any).PartnersApi.dashboard()))?.catalog?.services?.find(
        (s: any) => s.id === devSvc.id,
      );
    }
    const mediaCount = devSvc?.id
      ? await prisma.catalogMedia.count({
          where: { ownerKind: 'service', ownerId: devSvc.id },
        })
      : 0;
    const statusUi = await page.evaluate(() => {
      const form = document.getElementById('serviceForm');
      return form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent || '';
    });
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-dev-cta.json'),
      JSON.stringify(
        { devCta, id: devSvc?.id || null, mediaPicked, mediaCount, statusUi },
        null,
        2,
      ),
    );
    const devRow = devSvc?.id ? await prisma.service.findUnique({ where: { id: devSvc.id } }) : null;
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-dev-publish.png'), fullPage: true });
    record(
      'ACC-E2C-DEV-PUBLISH',
      'حساب المطور ينشر الخدمة مباشرة بعد التحقق',
      'published + active via UI media+CTA (no addMedia/submitReview)',
      JSON.stringify({
        id: devSvc?.id,
        status: devRow?.contentStatus,
        active: devRow?.active,
        mediaCount,
        statusUi,
        mediaPicked,
      }),
      !!devSvc?.id &&
        mediaPicked &&
        mediaRestored &&
        Number(mediaCount) >= 1 &&
        devRow?.contentStatus === 'published' &&
        devRow?.active === true,
      {
        criterion: 'ACC-E2C-DEV-PUBLISH',
        evidence: ['e2c-dev-publish.png', 'e2c-dev-cta.json', 'e2c-dev-media-restore.json'],
      },
    );

    // Service video: fail part upload → natural «إعادة المحاولة» without mutating session ids.
    // Success requires server bind + owner identity — UI toast alone is insufficient.
    let videoRetry: Record<string, unknown> = { ok: false, reason: 'no-dev-owner' };
    if (devSvc?.id && fs.existsSync(LARGE_MP4)) {
      await page.evaluate(() => {
        document.getElementById('serviceSection')?.scrollIntoView();
      });
      await page.waitForTimeout(300);
      // Re-open service form owner if needed.
      const openDevVid = page
        .locator('#serviceList .list-item')
        .filter({ hasText: 'E2C-DevSvc-' })
        .getByRole('button', { name: 'فتح في النموذج' });
      if (await openDevVid.count()) await openDevVid.click();
      await page.waitForTimeout(600);

      const readVideoChrome = async () =>
        page.evaluate(() => {
          const root = document.getElementById('serviceForm') || document;
          const st = root.querySelector('[data-testid="e2b-video-card-status"]') as HTMLElement | null;
          const pick = root.querySelector('[data-testid="e2b-video-pick"]') as HTMLElement | null;
          return {
            text: st?.textContent || '',
            state: st?.dataset?.state || '',
            pick: pick?.textContent || '',
            pickAction: pick?.dataset?.action || '',
          };
        });
      const serverMainVideo = async (serviceId: string) => {
        const rows = await prisma.catalogMedia.findMany({
          where: { ownerKind: 'service', ownerId: serviceId },
          select: {
            id: true,
            kind: true,
            placement: true,
            publication: true,
            mimeType: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        });
        const mains = rows.filter(
          (m) => /video/i.test(String(m.kind)) && String(m.placement || 'main') !== 'detail',
        );
        return { main: mains.length ? mains[mains.length - 1] : null, mains, rows };
      };

      let blockMainParts = true;
      let durablePutsAllowed = 1;
      let durablePutsSeen = 0;
      let cycleSessionId: string | null = null;
      let failSessionId: string | null = null;
      let durablePartsBeforeRetry = false;
      let createdNewSessionOnRetry = false;
      let sessionBoundMediaId: string | null = null;
      let cycleNewMediaId: string | null = null;
      let sawFail = false;
      let sawRetryLabel = false;
      let mainRetryClicked = false;
      let resumedSameSession = false;
      let cycleSaved = false;

      // Confirm session uploads are enabled (legacy addMedia path would skip fail/retry).
      const policyProbe = await page.evaluate(async () => {
        try {
          const p = await (window as any).PartnersApi.uploadSessionPolicy();
          return p;
        } catch (e: any) {
          return { error: String(e?.message || e) };
        }
      });

      await page.unroute('**/upload-sessions**').catch(() => undefined);
      await page.unroute('**/direct-parts/**').catch(() => undefined);
      const failRoute = async (route: Route) => {
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
            if ((isSign || isPut) && durablePutsSeen < durablePutsAllowed) {
              if (isPut) durablePutsSeen += 1;
              await route.continue();
              return;
            }
            await route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ code: 'UPLOAD_PART_TEMP', messageAr: 'فشل جزء رفع فيديو الخدمة' }),
            });
            return;
          }
          await route.continue();
        } catch {
          /* already handled */
        }
      };
      await page.route('**/upload-sessions**', failRoute);
      await page.route('**/direct-parts/**', failRoute);

      const mainsBefore = (await serverMainVideo(devSvc.id)).mains.map((m) => m.id);
      const vidInput = page.locator('#serviceForm-videos');
      if ((await vidInput.count()) === 0) {
        videoRetry = { ok: false, reason: 'no-serviceForm-videos', policyProbe };
      } else if (!(policyProbe as any)?.enabled) {
        videoRetry = { ok: false, reason: 'upload-session-disabled', policyProbe };
      } else {
        await page.evaluate(() => {
          const input = document.querySelector('#serviceForm-videos') as HTMLInputElement | null;
          if (input) input.value = '';
        });
        await vidInput.setInputFiles(LARGE_MP4);
        // If owner exists, uploadOne starts on change; otherwise click save once.
        await page.waitForTimeout(500);
        const chrome0 = await readVideoChrome();
        if (/بانتظار|انتظار/.test(chrome0.text || '') || chrome0.state === 'selected' || chrome0.state === 'awaiting-save') {
          await page.click('#serviceForm-save');
        }
        for (let t = 0; t < 120; t++) {
          const c = await readVideoChrome();
          if (c.state === 'failed' || /فشل/.test(c.text)) {
            sawFail = true;
            if (/إعادة المحاولة/.test(c.pick) || c.pickAction === 'retry') sawRetryLabel = true;
            break;
          }
          await page.waitForTimeout(250);
        }
        failSessionId = cycleSessionId;
        if (failSessionId) {
          const sess = await prisma.partnerUploadSession.findUnique({ where: { id: failSessionId } });
          const partsJson = (sess as any)?.completedPartsJson;
          const completed = Array.isArray(partsJson)
            ? partsJson.length
            : Array.isArray(partsJson?.parts)
              ? partsJson.parts.length
              : 0;
          durablePartsBeforeRetry = completed >= 1;
        }

        if (sawFail && sawRetryLabel) {
          blockMainParts = false;
          await page.unroute('**/upload-sessions**').catch(() => undefined);
          await page.waitForTimeout(200);
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
          // Real retry only — no mutation of sessionStorage / uploadSessionId / clientMediaId.
          for (let t = 0; t < 40; t++) {
            const clicked = await page.evaluate(() => {
              const root = document.getElementById('serviceForm') || document;
              const cards = Array.from(root.querySelectorAll('[data-testid="media-card-staged"]'));
              for (const card of cards) {
                const txt = card.textContent || '';
                if (!/فشل|خطأ|تعذر|فيديو|رئيسي|العرض/.test(txt) && !card.querySelector('[data-testid="e2b-video-card-status"]')) {
                  /* still allow video cards */
                }
                const btn = Array.from(card.querySelectorAll('button')).find((b) =>
                  /إعادة المحاولة/.test(b.textContent || ''),
                ) as HTMLButtonElement | null;
                if (btn && !btn.disabled) {
                  btn.click();
                  return 'card';
                }
              }
              const pick = root.querySelector('[data-testid="e2b-video-pick"]') as HTMLElement | null;
              if (pick && (pick.dataset.action === 'retry' || /إعادة المحاولة/.test(pick.textContent || ''))) {
                pick.click();
                return 'chrome';
              }
              return '';
            });
            if (clicked) {
              mainRetryClicked = true;
              break;
            }
            await page.waitForTimeout(150);
          }
          try {
            const created = await sessionCreateWatch;
            const body = await created.json().catch(() => null);
            if (body && body.sessionId && failSessionId && String(body.sessionId) !== failSessionId) {
              createdNewSessionOnRetry = true;
              cycleSessionId = String(body.sessionId);
            }
          } catch {
            /* expected: resume same session */
          }
          for (let t = 0; t < 150; t++) {
            if (!mainRetryClicked) break;
            const c = await readVideoChrome();
            const srvNow = await serverMainVideo(devSvc.id);
            const latest = srvNow.main?.id || null;
            if (latest && !mainsBefore.includes(latest)) cycleNewMediaId = latest;
            for (const m of srvNow.mains || []) {
              if (m?.id && !mainsBefore.includes(m.id)) cycleNewMediaId = m.id;
            }
            if (failSessionId) {
              const sess = await prisma.partnerUploadSession.findUnique({ where: { id: failSessionId } });
              if (sess?.catalogMediaId) {
                sessionBoundMediaId = sess.catalogMediaId;
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
        }
        await page.unroute('**/upload-sessions**').catch(() => undefined);

        // Reopen and prove video *card* restore — sessionBoundMediaId alone is insufficient.
        const openAgain = page
          .locator('#serviceList .list-item')
          .filter({ hasText: 'E2C-DevSvc-' })
          .getByRole('button', { name: 'فتح في النموذج' });
        if (await openAgain.count()) await openAgain.click();
        await page.waitForTimeout(900);
        const chromeAfterReopen = await readVideoChrome();
        const videoCardAfterReopen = await page.evaluate(() => {
          const root = document.getElementById('serviceForm') || document;
          const card = root.querySelector('[data-testid="e2b-video-card"]') as HTMLElement | null;
          const st = root.querySelector('[data-testid="e2b-video-card-status"]') as HTMLElement | null;
          const saved = root.querySelectorAll('[data-testid="media-card-saved"]').length;
          return {
            cardVisible: !!(card && card.offsetParent !== null),
            state: st?.dataset?.state || '',
            text: st?.textContent || '',
            savedCards: saved,
          };
        });
        const finalSrv = await serverMainVideo(devSvc.id);
        resumedSameSession =
          !!failSessionId &&
          !!cycleSessionId &&
          failSessionId === cycleSessionId &&
          !createdNewSessionOnRetry &&
          durablePartsBeforeRetry;

        videoRetry = {
          ownerId: devSvc.id,
          policyProbe,
          sawFail,
          sawRetryLabel,
          mainRetryClicked,
          failSessionId,
          cycleSessionId,
          durablePartsBeforeRetry,
          createdNewSessionOnRetry,
          resumedSameSession,
          sessionBoundMediaId,
          cycleNewMediaId,
          cycleSaved,
          chromeAfterReopen,
          videoCardAfterReopen,
          mainsBefore,
          mainsAfter: finalSrv.mains.map((m) => m.id),
        };
      }
    } else if (!fs.existsSync(LARGE_MP4)) {
      videoRetry = { ok: false, reason: 'missing-LARGE_MP4', path: LARGE_MP4 };
    }
    const videoLive = {
      sawFail: videoRetry.sawFail === true,
      sawRetryLabel: videoRetry.sawRetryLabel === true,
      mainRetryClicked: videoRetry.mainRetryClicked === true,
      durablePartsBeforeRetry: videoRetry.durablePartsBeforeRetry === true,
      resumedSameSession: videoRetry.resumedSameSession === true,
      createdNewSessionOnRetry: videoRetry.createdNewSessionOnRetry === true,
      sessionBoundMediaId: (videoRetry.sessionBoundMediaId as string) || null,
      cycleNewMediaId: (videoRetry.cycleNewMediaId as string) || null,
      mainsBefore: (videoRetry.mainsBefore as string[]) || [],
      mainsAfter: (videoRetry.mainsAfter as string[]) || [],
      videoCardAfterReopen: !!(videoRetry.videoCardAfterReopen as any)?.cardVisible,
      chromeState:
        String((videoRetry.videoCardAfterReopen as any)?.state || '') ||
        String((videoRetry.chromeAfterReopen as any)?.state || ''),
      chromeText:
        String((videoRetry.videoCardAfterReopen as any)?.text || '') ||
        String((videoRetry.chromeAfterReopen as any)?.text || ''),
    };
    const videoNegMissingCard = evaluateServiceVideoRetry({
      ...videoLive,
      videoCardAfterReopen: false,
      chromeState: '',
      chromeText: '',
    });
    const videoNegExtraMedia = evaluateServiceVideoRetry({
      ...videoLive,
      mainsAfter: [...videoLive.mainsAfter, 'extra-media-id'],
    });
    const videoNegWrongServer = evaluateServiceVideoRetry({
      ...videoLive,
      sessionBoundMediaId: videoLive.cycleNewMediaId,
      cycleNewMediaId: videoLive.cycleNewMediaId,
      chromeState: 'saved',
      chromeText: 'فيديو محفوظ',
      videoCardAfterReopen: true,
      resumedSameSession: false,
      createdNewSessionOnRetry: true,
    });
    // Stale success text must not override an explicit failed chrome state.
    const videoNegFailedDespiteSuccessText = evaluateServiceVideoRetry({
      ...videoLive,
      chromeState: 'failed',
      chromeText: 'فيديو محفوظ',
      videoCardAfterReopen: true,
    });
    const videoRetryOk =
      evaluateServiceVideoRetry(videoLive) &&
      videoNegMissingCard === false &&
      videoNegExtraMedia === false &&
      videoNegWrongServer === false &&
      videoNegFailedDespiteSuccessText === false;
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-service-video-retry.json'),
      JSON.stringify(
        {
          videoRetry,
          videoLive,
          negatives: {
            videoNegMissingCard,
            videoNegExtraMedia,
            videoNegWrongServer,
            videoNegFailedDespiteSuccessText,
          },
          videoRetryOk,
        },
        null,
        2,
      ),
    );
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-service-video-retry.png'), fullPage: true });
    record(
      'ACC-E2C-SERVICE-VIDEO-RETRY',
      'فشل رفع فيديو الخدمة ثم إعادة المحاولة الطبيعية دون تعديل جلسة الرفع',
      'fail→retry same session; new media id vs before; card after reopen; failed+success-text rejects',
      JSON.stringify({
        videoLive,
        negatives: {
          videoNegMissingCard,
          videoNegExtraMedia,
          videoNegWrongServer,
          videoNegFailedDespiteSuccessText,
        },
      }),
      videoRetryOk,
      {
        criterion: 'ACC-E2C-SERVICE-VIDEO-RETRY',
        evidence: ['e2c-service-video-retry.json', 'e2c-service-video-retry.png'],
      },
    );

    // No-regress: brand still gets product shell, not service orbs as product mode
    await page.evaluate(
      ({ email, token }) => {
        localStorage.setItem('mira_partner_email', email);
        localStorage.setItem('mira_partner_token', token);
      },
      { email: `e2c-br-${suffix}@test.local`, token: tokenBrand },
    );
    await page.goto(`${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('#goProduct', { timeout: 20000 });
    await page.click('#goProduct');
    await page.waitForTimeout(900);
    const productShell = await page.evaluate(() => ({
      productMode: document.body.classList.contains('e2b-product-mode'),
      serviceMode: document.body.classList.contains('e2b-service-mode'),
      e2bCircles: document.querySelectorAll('[data-testid="e2b-main-circle"]').length,
      e2cCircles: document.querySelectorAll('[data-testid="e2c-main-circle"]').length,
      scriptLoaded: typeof (window as any).MiraE2BProductShell !== 'undefined',
    }));
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-no-regress-product.png'), fullPage: true });
    record(
      'ACC-E2C-NO-REGRESS-PRODUCT-SHELL',
      'صدفة المنتجات تبقى لمنتجات العلامة دون خلط أوضاع الخدمة',
      'productMode + e2b circles + no service mode',
      JSON.stringify(productShell),
      productShell.productMode &&
        !productShell.serviceMode &&
        productShell.e2bCircles >= 3 &&
        productShell.scriptLoaded,
      { criterion: 'ACC-E2C-NO-REGRESS-PRODUCT-SHELL', evidence: ['e2c-no-regress-product.png'] },
    );

    // Developer isolation: product → service → product without field/orb bleed.
    await page.evaluate(
      ({ email, token }) => {
        localStorage.setItem('mira_partner_email', email);
        localStorage.setItem('mira_partner_token', token);
      },
      { email: `e2c-dev-${suffix}@test.local`, token: tokenDev },
    );
    await page.goto(`${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('#goProduct', { timeout: 20000 });
    await page.click('#goProduct');
    await page.waitForTimeout(700);
    // Seed a product field value to prove it survives service round-trip without bleed.
    await page.evaluate(() => {
      const name = document.querySelector(
        '#catalogForm input[name="nameAr"]',
      ) as HTMLInputElement | null;
      if (name) {
        name.value = 'منتج-عزل-E2C';
        name.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const iso1 = await page.evaluate(() => ({
      productMode: document.body.classList.contains('e2b-product-mode'),
      serviceMode: document.body.classList.contains('e2b-service-mode'),
      e2b: document.querySelectorAll('[data-testid="e2b-main-circle"]').length,
      e2cVisible: Array.from(document.querySelectorAll('[data-testid="e2c-main-circle"]')).filter(
        (n) => (n as HTMLElement).offsetParent !== null && !(n as HTMLElement).hidden,
      ).length,
      e2cComposeVisible: Array.from(
        document.querySelectorAll('[data-testid="e2c-editor-compose"]'),
      ).filter((n) => (n as HTMLElement).offsetParent !== null && !(n as HTMLElement).hidden).length,
      placeChipsVisible: Array.from(document.querySelectorAll('[data-testid="e2c-place-chip"]')).filter(
        (n) => (n as HTMLElement).offsetParent !== null,
      ).length,
      productName: (document.querySelector('#catalogForm input[name="nameAr"]') as HTMLInputElement | null)
        ?.value,
    }));
    await page.click('#goService');
    await page.waitForTimeout(900);
    await page.evaluate(() => {
      const name = document.querySelector(
        '#serviceForm input[name="nameAr"]',
      ) as HTMLInputElement | null;
      if (name) {
        name.value = 'خدمة-عزل-E2C';
        name.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const iso2 = await page.evaluate(() => ({
      productMode: document.body.classList.contains('e2b-product-mode'),
      serviceMode: document.body.classList.contains('e2b-service-mode'),
      e2bHidden: (() => {
        const h = document.getElementById('e2bMainCircles');
        return !h || h.hidden === true || (h as HTMLElement).offsetParent === null;
      })(),
      catalogSectionHidden: (() => {
        const s = document.getElementById('catalogSection') as HTMLElement | null;
        if (!s) return true;
        return s.hidden === true || s.classList.contains('e2c-inactive-editor') || s.offsetParent === null;
      })(),
      e2c: document.querySelectorAll('[data-testid="e2c-main-circle"]').length,
      e2cVisible: Array.from(document.querySelectorAll('[data-testid="e2c-main-circle"]')).filter(
        (n) => (n as HTMLElement).offsetParent !== null && !(n as HTMLElement).hidden,
      ).length,
      form: !!document.getElementById('serviceForm')?.querySelector('input[name="nameAr"]'),
      serviceName: (document.querySelector('#serviceForm input[name="nameAr"]') as HTMLInputElement | null)
        ?.value,
      placeChipsVisible: Array.from(document.querySelectorAll('[data-testid="e2c-place-chip"]')).filter(
        (n) => (n as HTMLElement).offsetParent !== null,
      ).length,
      productNameWhileService: (
        document.querySelector('#catalogForm input[name="nameAr"]') as HTMLInputElement | null
      )?.value,
      durationVisible: !!document.querySelector(
        '#serviceForm input[name="durationMin"], #serviceForm [data-testid="e2c-duration-chip"]',
      ),
    }));
    await page.click('#goProduct');
    await page.waitForTimeout(900);
    const iso3 = await page.evaluate(() => ({
      productMode: document.body.classList.contains('e2b-product-mode'),
      serviceMode: document.body.classList.contains('e2b-service-mode'),
      e2b: document.querySelectorAll('[data-testid="e2b-main-circle"]').length,
      e2cVisible: Array.from(document.querySelectorAll('[data-testid="e2c-main-circle"]')).filter(
        (n) => (n as HTMLElement).offsetParent !== null && !(n as HTMLElement).hidden,
      ).length,
      e2cComposeVisible: Array.from(
        document.querySelectorAll('[data-testid="e2c-editor-compose"]'),
      ).filter((n) => (n as HTMLElement).offsetParent !== null && !(n as HTMLElement).hidden).length,
      placeChipsVisible: Array.from(document.querySelectorAll('[data-testid="e2c-place-chip"]')).filter(
        (n) => (n as HTMLElement).offsetParent !== null,
      ).length,
      productName: (document.querySelector('#catalogForm input[name="nameAr"]') as HTMLInputElement | null)
        ?.value,
      serviceNameHiddenForm: (
        document.querySelector('#serviceForm input[name="nameAr"]') as HTMLInputElement | null
      )?.value,
      serviceFormStillServiceMode: document.body.classList.contains('e2b-service-mode'),
    }));
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-isolation.png'), fullPage: true });
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-isolation.json'),
      JSON.stringify({ iso1, iso2, iso3 }, null, 2),
    );
    // Visible inactive-editor orbs/fields must FAIL — class toggle alone is insufficient.
    const isolationOk =
      iso1.productMode &&
      !iso1.serviceMode &&
      iso1.e2cVisible === 0 &&
      iso1.e2cComposeVisible === 0 &&
      iso1.placeChipsVisible === 0 &&
      iso1.productName === 'منتج-عزل-E2C' &&
      iso2.serviceMode &&
      !iso2.productMode &&
      iso2.e2cVisible >= 1 &&
      iso2.e2bHidden === true &&
      iso2.catalogSectionHidden === true &&
      iso2.serviceName === 'خدمة-عزل-E2C' &&
      iso2.placeChipsVisible >= 3 &&
      iso2.durationVisible === true &&
      iso2.productNameWhileService === 'منتج-عزل-E2C' &&
      iso3.productMode &&
      !iso3.serviceMode &&
      iso3.e2b >= 3 &&
      iso3.e2cVisible === 0 &&
      iso3.e2cComposeVisible === 0 &&
      iso3.placeChipsVisible === 0 &&
      iso3.productName === 'منتج-عزل-E2C' &&
      iso3.serviceNameHiddenForm === 'خدمة-عزل-E2C';
    record(
      'ACC-E2C-ISOLATION',
      'المطور: منتج←خدمة←منتج دون تسرب أوضاع/دوائر/حقول',
      'modes exclusive; fields preserved; inactive controls not visible',
      JSON.stringify({ iso1, iso2, iso3 }),
      isolationOk,
      { criterion: 'ACC-E2C-ISOLATION', evidence: ['e2c-isolation.png', 'e2c-isolation.json'] },
    );

    // Design match on salon surface (ref-2 categories include nails).
    await page.evaluate(
      ({ email, token }) => {
        localStorage.setItem('mira_partner_email', email);
        localStorage.setItem('mira_partner_token', token);
      },
      { email: `e2c-salon-${suffix}@test.local`, token: tokenSalon },
    );
    await page.goto(`${portalOrigin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('#goService', { timeout: 20000 });
    await page.click('#goService');
    await page.waitForTimeout(900);
    // Select a subcategory + ensure media stage visible for visual proof.
    await page.evaluate(() => {
      const nails = document.querySelector(
        '[data-testid="e2c-main-circle"][data-category-id="nails"]',
      ) as HTMLButtonElement | null;
      if (nails) nails.click();
      const sub = document.querySelector('[data-testid="e2c-sub-circle"]') as HTMLButtonElement | null;
      if (sub) sub.click();
    });
    await page.waitForTimeout(400);
    if (fs.existsSync(VALID_PNG)) {
      const img = page.locator('#catalogForm-images');
      if (await img.count()) {
        await img.setInputFiles(VALID_PNG);
        await page.waitForTimeout(800);
      }
    }
    const design = await page.evaluate(() => {
      const compose = document.querySelector('[data-testid="e2c-editor-compose"]') as HTMLElement | null;
      const media = document.querySelector('[data-testid="e2c-editor-media"]');
      const fields = document.querySelector('[data-testid="e2c-editor-fields"]');
      const month = document.querySelector('[data-testid="e2c-month-calendar"]');
      const toggle = document.querySelector('[data-testid="e2c-kind-toggle"]');
      const durationChips = document.querySelectorAll('[data-testid="e2c-duration-chip"]').length;
      const placeChips = document.querySelectorAll('[data-testid="e2c-place-chip"]').length;
      const rail = !!document.querySelector(
        '[data-testid="e2c-side-rail"], #e2bSideNav, #e2cSideNav',
      );
      const secondary = !!document.querySelector('[data-testid="e2c-secondary-details"]');
      const templateDetails = !!document.querySelector('[data-testid="e2c-template-details"]');
      const sideStack = document.querySelector('[data-testid="e2c-side-stack"]');
      const subSelected = !!document.querySelector('[data-testid="e2c-sub-circle"].is-selected');
      const nails = document.querySelector(
        '[data-testid="e2c-main-circle"][data-category-id="nails"]',
      ) as HTMLElement | null;
      const nailsOrb =
        nails?.getAttribute('data-orb-src') ||
        (nails?.querySelector('.e2b-circle-orb')
          ? getComputedStyle(nails.querySelector('.e2b-circle-orb') as HTMLElement).backgroundImage
          : '');
      const cols = compose ? getComputedStyle(compose).gridTemplateColumns : '';
      const colCount = cols
        .split(' ')
        .map((c) => c.trim())
        .filter(Boolean).length;
      const fieldRoles = fields
        ? Array.from(fields.children)
            .map((n) => (n as HTMLElement).getAttribute('data-section-role') || '')
            .filter(Boolean)
        : [];
      const sideRoles = sideStack
        ? Array.from(sideStack.children)
            .map((n) => {
              const el = n as HTMLElement;
              return (
                el.getAttribute('data-section-role') ||
                (el.getAttribute('data-testid') === 'catalog-main-media-section' ||
                el.classList.contains('e2b-media-stage')
                  ? 'main-media'
                  : '')
              );
            })
            .filter(Boolean)
        : [];
      return {
        compose: !!compose,
        media: !!media,
        month: !!month,
        toggle: !!toggle,
        durationChips,
        placeChips,
        nailsOrb,
        cols,
        colCount,
        rail,
        secondary,
        templateDetails,
        sideStack: !!sideStack,
        subSelected,
        fieldRoles,
        sideRoles,
      };
    });
    const designMatchOrder = evaluateComposeFieldOrder({
      fieldRoles: design.fieldRoles || [],
      sideRoles: design.sideRoles || [],
    });
    // Collapse advanced folds before geometry — earlier calendar probes may have opened them.
    await page.evaluate(() => {
      for (const sel of [
        '[data-testid="e2c-avail-edit-details"]',
        '[data-testid="e2c-exceptions-details"]',
        '[data-testid="e2c-secondary-details"]',
      ]) {
        const d = document.querySelector(sel) as HTMLDetailsElement | null;
        if (d) d.open = false;
      }
    });
    await page.waitForTimeout(200);
    const geomMatch = await measureGeom();
    const geomMatchEval = evaluateDesktopGeometry(geomMatch);
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-design-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const phoneDesign = await page.evaluate(() => {
      const compose = document.querySelector('[data-testid="e2c-editor-compose"]') as HTMLElement | null;
      const workspace = document.querySelector(
        '[data-testid="e2c-workspace"], .e2c-workspace',
      ) as HTMLElement | null;
      const fields = document.querySelector('[data-testid="e2c-editor-fields"]') as HTMLElement | null;
      const cols = compose ? getComputedStyle(compose).gridTemplateColumns : '';
      const wsCols = workspace ? getComputedStyle(workspace).gridTemplateColumns : '';
      const tracks = wsCols.split(/\s+/).filter(Boolean).length;
      const secondary = document.querySelector(
        '[data-testid="e2c-secondary-details"]',
      ) as HTMLDetailsElement | null;
      return {
        cols,
        workspaceCols: wsCols,
        workspaceTracks: tracks,
        fieldsWidth: fields ? fields.getBoundingClientRect().width : 0,
        singleCol: !cols.includes(' ') || cols.split(/\s+/).length === 1,
        orbs: document.querySelectorAll('[data-testid="e2c-main-circle"]').length,
        rail: !!document.querySelector('[data-testid="e2c-side-rail"], #e2cSideNav, #e2bSideNav'),
        secondaryOpen: secondary ? secondary.open : null,
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e2c-design-phone.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-design-match.json'),
      JSON.stringify({ design, phoneDesign, designMatchOrder, geomMatch, geomMatchEval }, null, 2),
    );
    record(
      'ACC-E2C-DESIGN-MATCH',
      'مطابقة تكوين المرجع: سكة يمنى، دوائر، مدة، مكان، تقويم بجوار الوسائط، تفاصيل قابلة للطي',
      'desktop geometry px + exact field order + phone stacked + secondary collapsed',
      JSON.stringify({ design, phoneDesign, designMatchOrder, geomMatch, geomMatchEval }),
      design.compose &&
        design.media &&
        design.month &&
        design.toggle &&
        design.durationChips >= 3 &&
        design.placeChips >= 3 &&
        /nails\.png/.test(design.nailsOrb) &&
        design.rail === true &&
        design.secondary === true &&
        design.templateDetails === true &&
        design.sideStack === true &&
        design.colCount >= 2 &&
        design.subSelected === true &&
        designMatchOrder.ok &&
        geomMatchEval.ok &&
        Number(geomMatch.sideBySidePx) >= 120 &&
        phoneDesign.orbs >= 3 &&
        phoneDesign.workspaceTracks <= 1 &&
        phoneDesign.fieldsWidth >= 280 &&
        phoneDesign.secondaryOpen !== true,
      {
        criterion: 'ACC-E2C-DESIGN-MATCH',
        evidence: ['e2c-design-desktop.png', 'e2c-design-phone.png', 'e2c-design-match.json'],
      },
    );

    // FIN note unit: failSessionId/finalMainId required + null/delete/mismatch
    const finBaseline = evaluateMainVideoIsolation(baselineMainVideoIsolationSuccess());
    const finNullSess = evaluateMainVideoIsolation(
      baselineMainVideoIsolationSuccess({ failSessionId: null }),
    );
    const finDelSess = evaluateMainVideoIsolation(
      (() => {
        const b = baselineMainVideoIsolationSuccess();
        delete (b as { failSessionId?: string | null }).failSessionId;
        return b;
      })(),
    );
    const finMisSess = evaluateMainVideoIsolation(
      baselineMainVideoIsolationSuccess({ failSessionId: 'other' }),
    );
    const finNullMain = evaluateMainVideoIsolation(
      baselineMainVideoIsolationSuccess({ finalMainId: null }),
    );
    const finMisMain = evaluateMainVideoIsolation(
      baselineMainVideoIsolationSuccess({ finalMainId: 'other' }),
    );
    const finIdsOk =
      finBaseline.ok === true &&
      finNullSess.ok === false &&
      finDelSess.ok === false &&
      finMisSess.ok === false &&
      finNullMain.ok === false &&
      finMisMain.ok === false;
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-fin-session-ids.json'),
      JSON.stringify(
        { finBaseline, finNullSess, finDelSess, finMisSess, finNullMain, finMisMain, finIdsOk },
        null,
        2,
      ),
    );
    record(
      'ACC-E2C-FIN-SESSION-IDS',
      'failSessionId و finalMainId إلزاميان؛ null/حذف/عدم مطابقة ترفض',
      'baseline ok; negatives reject',
      JSON.stringify({ finIdsOk }),
      finIdsOk,
      { criterion: 'ACC-E2C-FIN-SESSION-IDS', evidence: ['e2c-fin-session-ids.json'] },
    );

    // --- Remaining availability acceptance: exceptions-only, clear vs omit, invalid paths ---
    await page.click('#goService');
    await page.waitForTimeout(900);
    const exOnlyName = `E2C-ExOnly-${suffix}`;
    // Known-ahead fixture (not "whatever the form emitted").
    const expectedExOnly = {
      availability: {
        v: 2,
        timezone: 'Asia/Riyadh',
        windows: [],
        exceptions: [
          {
            date: '2026-12-16',
            kind: 'special',
            startMin: 540,
            endMin: 660,
            capacity: 2,
            resourceId: 'chair-1',
          },
        ],
        closedDates: ['2026-12-20'],
      },
      placeMode: 'home',
      branchId: null,
    };
    const exOnlyFill = await page.evaluate((payload) => {
      const nm = payload.name;
      const expected = payload.expected;
      const form = document.getElementById('catalogForm');
      if (!form) return { ok: false, reason: 'no-form' };
      const editFold = form.querySelector(
        '[data-testid="e2c-avail-edit-details"]',
      ) as HTMLDetailsElement | null;
      if (editFold) editFold.open = true;
      const exFold = form.querySelector(
        '[data-testid="e2c-exceptions-details"]',
      ) as HTMLDetailsElement | null;
      if (exFold) exFold.open = true;
      const hair = document.querySelector(
        '[data-testid="e2c-main-circle"][data-category-id="hair"]',
      ) as HTMLButtonElement | null;
      hair?.click();
      const home = document.querySelector(
        '[data-testid="e2c-place-chip"][data-place-mode="home"]',
      ) as HTMLButtonElement | null;
      home?.click();
      const name = form.querySelector('input[name="nameAr"]') as HTMLInputElement | null;
      const price = form.querySelector('input[name="priceSar"]') as HTMLInputElement | null;
      const dur = form.querySelector('input[name="durationMin"]') as HTMLInputElement | null;
      if (!name || !price || !dur) return { ok: false, reason: 'missing-basics' };
      name.value = nm;
      name.dispatchEvent(new Event('input', { bubbles: true }));
      price.value = '70';
      price.dispatchEvent(new Event('input', { bubbles: true }));
      dur.value = '30';
      dur.dispatchEvent(new Event('input', { bubbles: true }));
      let guard = 0;
      while (guard++ < 24) {
        const rm =
          (form.querySelector('[data-testid="avail-window-remove"]') as HTMLButtonElement | null) ||
          (form.querySelector('[data-testid="avail-exception-row"] button') as HTMLButtonElement | null) ||
          (form.querySelector('[data-testid="avail-closed-date-row"] button') as HTMLButtonElement | null);
        if (!rm) break;
        rm.click();
      }
      const closedInput = form.querySelector(
        '[data-section-role="availability"] input[type="date"]',
      ) as HTMLInputElement | null;
      const closedAdd = Array.from(form.querySelectorAll('[data-section-role="availability"] button')).find((b) =>
        /إضافة يوم|إضافة/.test(b.textContent || ''),
      ) as HTMLButtonElement | null;
      // Prefer closedDates list UI when present.
      const closedDate = expected.availability.closedDates[0];
      const closedWrapButtons = Array.from(
        form.querySelectorAll('[data-section-role="availability"] button'),
      ) as HTMLButtonElement[];
      // Closed day via dedicated closed list if available; else via exceptions kind=closed.
      const exWrap = form.querySelector('[data-testid="avail-exceptions"]') as HTMLElement | null;
      if (!exWrap) return { ok: false, reason: 'no-ex-wrap' };
      const dateEl = exWrap.querySelector('input[type="date"]') as HTMLInputElement | null;
      const kindEl = exWrap.querySelector('select') as HTMLSelectElement | null;
      const times = Array.from(exWrap.querySelectorAll('input[type="time"]')) as HTMLInputElement[];
      const cap = Array.from(exWrap.querySelectorAll('input[type="number"]'))[0] as HTMLInputElement | undefined;
      const res = exWrap.querySelector('[data-testid="avail-exception-resource"]') as HTMLInputElement | null;
      const addBtn = Array.from(exWrap.querySelectorAll('button')).find((b) =>
        /إضافة استثناء/.test(b.textContent || ''),
      ) as HTMLButtonElement | null;
      if (!dateEl || !kindEl || !addBtn || !cap || !res || times.length < 2) {
        return { ok: false, reason: 'missing-special-controls' };
      }
      // Closed date (day close without weekly windows).
      dateEl.value = closedDate;
      dateEl.dispatchEvent(new Event('change', { bubbles: true }));
      kindEl.value = 'closed';
      kindEl.dispatchEvent(new Event('change', { bubbles: true }));
      res.value = '';
      res.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn.click();
      // Special exception with hours/capacity/resource — required for this criterion.
      const special = expected.availability.exceptions[0];
      dateEl.value = special.date;
      dateEl.dispatchEvent(new Event('change', { bubbles: true }));
      kindEl.value = 'special';
      kindEl.dispatchEvent(new Event('change', { bubbles: true }));
      const sh = String(Math.floor(special.startMin / 60)).padStart(2, '0');
      const sm = String(special.startMin % 60).padStart(2, '0');
      const eh = String(Math.floor(special.endMin / 60)).padStart(2, '0');
      const em = String(special.endMin % 60).padStart(2, '0');
      times[0].value = `${sh}:${sm}`;
      times[0].dispatchEvent(new Event('change', { bubbles: true }));
      times[1].value = `${eh}:${em}`;
      times[1].dispatchEvent(new Event('change', { bubbles: true }));
      cap.value = String(special.capacity);
      cap.dispatchEvent(new Event('change', { bubbles: true }));
      res.value = special.resourceId;
      res.dispatchEvent(new Event('change', { bubbles: true }));
      addBtn.click();
      // Move closed exception into closedDates if UI stores day-close there.
      return {
        ok: true,
        windows: document.querySelectorAll('[data-testid="avail-window-row"]').length,
        exceptions: document.querySelectorAll('[data-testid="avail-exception-row"]').length,
        closed: document.querySelectorAll('[data-testid="avail-closed-date-row"]').length,
        specialRows: Array.from(document.querySelectorAll('[data-testid="avail-exception-row"]')).map((r) => ({
          kind: r.getAttribute('data-kind'),
          date: r.getAttribute('data-date'),
          start: r.getAttribute('data-start-min'),
          end: r.getAttribute('data-end-min'),
          capacity: r.getAttribute('data-capacity'),
          resourceId: r.getAttribute('data-resource-id'),
        })),
      };
    }, { name: exOnlyName, expected: expectedExOnly });
    const formExOnly = await page.evaluate((src) => (0, eval)('(' + src + ')()'), READ_AVAILABILITY_FROM_FORM_SOURCE);
    // Normalize day-close: UI may put kind=closed into exceptions; fixture uses closedDates.
    const formForCompare = JSON.parse(JSON.stringify(formExOnly));
    if (Array.isArray(formForCompare?.availability?.exceptions)) {
      const dayCloses = formForCompare.availability.exceptions.filter(
        (e: any) => e.kind === 'closed' && !e.resourceId,
      );
      formForCompare.availability.exceptions = formForCompare.availability.exceptions.filter(
        (e: any) => !(e.kind === 'closed' && !e.resourceId),
      );
      const closed = new Set<string>(formForCompare.availability.closedDates || []);
      dayCloses.forEach((e: any) => closed.add(e.date));
      formForCompare.availability.closedDates = Array.from(closed).sort();
    }
    const formMatchesFixture = compareAvailabilitySnapshot(expectedExOnly, formForCompare);
    const sabotagedExOnly = JSON.parse(JSON.stringify(expectedExOnly));
    sabotagedExOnly.availability.exceptions[0].capacity = 9;
    const sabotageSpecial = compareAvailabilitySnapshot(expectedExOnly, sabotagedExOnly);
    await page.click('#catalogForm-save');
    await page.waitForTimeout(1600);
    const exDraftMeta = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const ctx =
        (window as any).MiraEditorV2 && form
          ? (window as any).MiraEditorV2.getEditContext(form.id)
          : null;
      return { clientDraftId: ctx?.clientDraftId || null, revision: ctx?.revision ?? null };
    });
    let exDraftReopenOk = false;
    let exDraftServerAvailability: unknown = null;
    if (exDraftMeta.clientDraftId) {
      const draftRow = await prisma.partnerEditorDraft.findFirst({
        where: { clientDraftId: String(exDraftMeta.clientDraftId), partnerId: salon.id },
      }).catch(() => null);
      const values = ((draftRow as any)?.valuesJson || (draftRow as any)?.values || null) as Record<string, unknown> | null;
      exDraftServerAvailability = availabilitySnapshotFromDraftValues(values);
      await page.click('#refreshEditorDrafts').catch(() => undefined);
      await page.waitForTimeout(1000);
      const openDraft = page
        .locator('#editorDraftsList .list-row, #editorDraftsList .list-item')
        .filter({ hasText: exOnlyName })
        .getByRole('button', { name: /فتح/ });
      if (await openDraft.count()) {
        await openDraft.first().click();
        await page.waitForTimeout(900);
        const draftSnap = await page.evaluate((src) => (0, eval)('(' + src + ')()'), READ_AVAILABILITY_FROM_FORM_SOURCE);
        const draftNorm = JSON.parse(JSON.stringify(draftSnap));
        if (Array.isArray(draftNorm?.availability?.exceptions)) {
          const dayCloses = draftNorm.availability.exceptions.filter(
            (e: any) => e.kind === 'closed' && !e.resourceId,
          );
          draftNorm.availability.exceptions = draftNorm.availability.exceptions.filter(
            (e: any) => !(e.kind === 'closed' && !e.resourceId),
          );
          const closed = new Set<string>(draftNorm.availability.closedDates || []);
          dayCloses.forEach((e: any) => closed.add(e.date));
          draftNorm.availability.closedDates = Array.from(closed).sort();
        }
        exDraftReopenOk = compareAvailabilitySnapshot(expectedExOnly, draftNorm).ok;
      }
    }
    const exDraftServerOk = exDraftServerAvailability
      ? compareAvailabilitySnapshot(expectedExOnly, exDraftServerAvailability).ok
      : false;
    const matEx = page.locator(
      '#catalogForm [data-testid="materialize-draft"]:visible, #catalogForm [data-editor-v2-materialize="1"]:visible',
    );
    if (await matEx.count()) {
      await matEx.first().click();
      await page.waitForTimeout(3500);
    }
    let exOwner: { id: string | null; availabilityJson: unknown; placeMode: string | null; branchId: string | null } = {
      id: null,
      availabilityJson: null,
      placeMode: null,
      branchId: null,
    };
    for (let t = 0; t < 12; t++) {
      const hit = await page.evaluate(async (nm) => {
        const dash = await (window as any).PartnersApi.dashboard();
        return (dash?.catalog?.services || []).find((s: any) => s.nameAr === nm) || null;
      }, exOnlyName);
      if (hit?.id) {
        const db = await prisma.service.findUnique({ where: { id: hit.id } });
        exOwner = {
          id: hit.id,
          availabilityJson: db?.availabilityJson ?? null,
          placeMode: (db as any)?.placeMode ?? null,
          branchId: (db as any)?.branchId ?? null,
        };
        createdServiceIds.push(hit.id);
        break;
      }
      await page.waitForTimeout(400);
    }
    let exRestoredOk = false;
    if (exOwner.id) {
      const openBtn = page
        .locator('#catalogList .list-item')
        .filter({ hasText: exOnlyName })
        .getByRole('button', { name: 'فتح في النموذج' });
      if (await openBtn.count()) {
        await openBtn.click();
        await page.waitForTimeout(900);
      }
      const restored = await page.evaluate((src) => (0, eval)('(' + src + ')()'), READ_AVAILABILITY_FROM_FORM_SOURCE);
      const restoredNorm = JSON.parse(JSON.stringify(restored));
      if (Array.isArray(restoredNorm?.availability?.exceptions)) {
        const dayCloses = restoredNorm.availability.exceptions.filter(
          (e: any) => e.kind === 'closed' && !e.resourceId,
        );
        restoredNorm.availability.exceptions = restoredNorm.availability.exceptions.filter(
          (e: any) => !(e.kind === 'closed' && !e.resourceId),
        );
        const closed = new Set<string>(restoredNorm.availability.closedDates || []);
        dayCloses.forEach((e: any) => closed.add(e.date));
        restoredNorm.availability.closedDates = Array.from(closed).sort();
      }
      exRestoredOk = compareAvailabilitySnapshot(expectedExOnly, restoredNorm).ok;
    }
    const exServerOk = compareAvailabilitySnapshot(expectedExOnly, {
      availability: exOwner.availabilityJson,
      placeMode: exOwner.placeMode,
      branchId: exOwner.branchId,
    }).ok;
    const hasSpecial =
      Array.isArray((expectedExOnly as any).availability.exceptions) &&
      (expectedExOnly as any).availability.exceptions.some((e: any) => e.kind === 'special');
    const exOnlyOk =
      !!(exOnlyFill as any).ok &&
      Number((exOnlyFill as any).windows || 0) === 0 &&
      hasSpecial &&
      Number((exOnlyFill as any).exceptions || 0) >= 1 &&
      formMatchesFixture.ok &&
      sabotageSpecial.ok === false &&
      exDraftReopenOk &&
      exDraftServerOk &&
      !!exOwner.id &&
      exServerOk &&
      exRestoredOk;
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-exceptions-only-roundtrip.json'),
      JSON.stringify(
        {
          expectedExOnly,
          exOnlyFill,
          formExOnly,
          formMatchesFixture,
          sabotageSpecial,
          exDraftMeta,
          draftServerOk: exDraftServerOk,
          exDraftReopenOk,
          exOwner,
          exServerOk,
          exRestoredOk,
          exOnlyOk,
        },
        null,
        2,
      ),
    );
    record(
      'ACC-E2C-EXCEPTIONS-ONLY-ROUNDTRIP',
      'حفظ واستعادة إتاحة باستثناء special فعلي بدون فترات أسبوعية',
      'known fixture special+closedDates; draft/server/restore compare',
      JSON.stringify({ exOnlyOk, formMatchesFixture, sabotageSpecial, exServerOk, exRestoredOk }),
      exOnlyOk,
      { criterion: 'ACC-E2C-EXCEPTIONS-ONLY-ROUNDTRIP', evidence: ['e2c-exceptions-only-roundtrip.json'] },
    );


    async function resetCatalogFormToNewService() {
      await page.evaluate(() => {
        const p = (window as any).sessionPartner || {};
        const type = p.type === 'clinic' ? 'clinic' : 'salon';
        if (!(window as any).CatalogJourney || typeof (window as any).CatalogJourney.renderForm !== 'function') {
          throw new Error('CatalogJourney.renderForm unavailable');
        }
        (window as any).CatalogJourney.renderForm(type, null, 'catalogForm', 'catalogTitle');
      });
      await page.waitForTimeout(500);
    }

    // Explicit clear on exOwner; omit on an independent non-empty service.
    let clearOmit: Record<string, unknown> = { ok: false };
    const omitName = `E2C-OmitKeep-${suffix}`;
    const omitExpectedFixture = {
      availability: {
        v: 2,
        timezone: 'Asia/Riyadh',
        windows: [
          { weekday: 1, startMin: 660, endMin: 780, capacity: 4, resourceId: `omit-desk-a-${suffix}` },
          { weekday: 2, startMin: 600, endMin: 720, capacity: 2, resourceId: `omit-desk-b-${suffix}` },
        ],
        exceptions: [
          {
            date: '2026-12-18',
            kind: 'special',
            startMin: 540,
            endMin: 660,
            capacity: 4,
            resourceId: `omit-desk-a-${suffix}`,
          },
        ],
        closedDates: ['2026-12-22'],
      },
      placeMode: 'home',
      branchId: null,
    };
    // Independent omit record via API with known non-empty availability (windows+exceptions+resources+closed).
    // Clear path below remains UI-only on ExOnly; omit path is PATCH without availability field.
    const omitCreate = await fetch(`${apiBase}/partners-portal/services`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${tokenSalon}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        nameAr: omitName,
        priceHalalas: 5500,
        durationMin: 25,
        category: 'hair',
        placeMode: 'home',
        availabilityJson: omitExpectedFixture.availability,
      }),
    });
    const omitCreateBody = (await omitCreate.json().catch(() => ({}))) as { id?: string; message?: string; code?: string };
    let omitOwnerId: string | null = omitCreateBody.id || null;
    if (omitOwnerId) createdServiceIds.push(omitOwnerId);
    let omitServerBefore: unknown = null;
    let omitServerNonEmpty = false;
    let omitMatStatus = `api-create:${omitCreate.status}`;
    if (omitOwnerId) {
      const row = await prisma.service.findUnique({ where: { id: omitOwnerId } });
      omitServerBefore = {
        availability: row?.availabilityJson,
        placeMode: (row as any)?.placeMode ?? null,
        branchId: (row as any)?.branchId ?? null,
      };
      const avail = (row as any)?.availabilityJson || {};
      omitServerNonEmpty =
        Array.isArray(avail.windows) &&
        avail.windows.length > 0 &&
        Array.isArray(avail.exceptions) &&
        avail.exceptions.length > 0 &&
        Array.isArray(avail.closedDates) &&
        avail.closedDates.length > 0;
    }
    const omitFill = { ok: omitCreate.status < 400 && !!omitOwnerId, via: 'api-seed' };
    const omitFormOk = omitServerNonEmpty;
    if (exOwner.id && omitOwnerId && omitServerNonEmpty) {
      const openClear = page
        .locator('#catalogList .list-item')
        .filter({ hasText: exOnlyName })
        .getByRole('button', { name: 'فتح في النموذج' });
      if (await openClear.count()) {
        await openClear.click();
        await page.waitForTimeout(1000);
      }
      const formNameBeforeClear = await page.evaluate(() => {
        const form = document.getElementById('catalogForm');
        return (form?.querySelector('input[name="nameAr"]') as HTMLInputElement | null)?.value || '';
      });
      const beforeClear = await prisma.service.findUnique({ where: { id: exOwner.id } });
      const clearUi = await page.evaluate((expectedName) => {
        const form = document.getElementById('catalogForm');
        if (!form) return { ok: false, reason: 'no-form' };
        const name = (form.querySelector('input[name="nameAr"]') as HTMLInputElement | null)?.value || '';
        if (name !== expectedName) return { ok: false, reason: 'wrong-owner-open', name, expectedName };
        const exFold = form.querySelector(
          '[data-testid="e2c-exceptions-details"]',
        ) as HTMLDetailsElement | null;
        if (exFold) exFold.open = true;
        let guard = 0;
        while (guard++ < 24) {
          const rm =
            (form.querySelector('[data-testid="avail-exception-row"] button') as HTMLButtonElement | null) ||
            (form.querySelector('[data-testid="avail-closed-date-row"] button') as HTMLButtonElement | null);
          if (!rm) break;
          rm.click();
        }
        return {
          ok: true,
          name,
          exceptions: document.querySelectorAll('[data-testid="avail-exception-row"]').length,
          closed: document.querySelectorAll('[data-testid="avail-closed-date-row"]').length,
        };
      }, exOnlyName);
      const clearedExpected = await page.evaluate((src) => (0, eval)('(' + src + ')()'), READ_AVAILABILITY_FROM_FORM_SOURCE);
      const clearPatchWait = page.waitForResponse(
        (res) =>
          /\/partners-portal\/services\//.test(res.url()) &&
          res.request().method() === 'PATCH',
        { timeout: 8000 },
      );
      await page.click('#catalogForm-save');
      let clearPatch: Record<string, unknown> = { seen: false };
      try {
        const r = await clearPatchWait;
        const url = r.url();
        clearPatch = {
          seen: true,
          status: r.status(),
          url,
          targetsExOwner: !!exOwner.id && url.includes(String(exOwner.id)),
          body: r.request().postDataJSON?.() || null,
        };
      } catch {
        clearPatch = { seen: false };
      }
      await page.waitForTimeout(1200);
      const afterClear = await prisma.service.findUnique({ where: { id: exOwner.id } });
      const afterClearSnap = {
        availability: afterClear?.availabilityJson,
        placeMode: (afterClear as any)?.placeMode ?? null,
        branchId: (afterClear as any)?.branchId ?? null,
      };
      const clearCompare = compareAvailabilitySnapshot(clearedExpected, afterClearSnap);
      const beforeOmit = await prisma.service.findUnique({ where: { id: omitOwnerId } });
      const beforeOmitSnap = {
        availability: beforeOmit?.availabilityJson,
        placeMode: (beforeOmit as any)?.placeMode ?? null,
        branchId: (beforeOmit as any)?.branchId ?? null,
      };
      const beforeOmitAvail = (beforeOmit as any)?.availabilityJson || {};
      const beforeOmitNonEmpty =
        (Array.isArray(beforeOmitAvail.windows) && beforeOmitAvail.windows.length > 0) &&
        (Array.isArray(beforeOmitAvail.exceptions) && beforeOmitAvail.exceptions.length > 0) &&
        (Array.isArray(beforeOmitAvail.closedDates) && beforeOmitAvail.closedDates.length > 0);
      const omitRes = await fetch(`${apiBase}/partners-portal/services/${omitOwnerId}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${tokenSalon}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ nameAr: `${omitName}-renamed` }),
      });
      const omitStatus = omitRes.status;
      const afterOmit = await prisma.service.findUnique({ where: { id: omitOwnerId } });
      const afterOmitSnap = {
        availability: afterOmit?.availabilityJson,
        placeMode: (afterOmit as any)?.placeMode ?? null,
        branchId: (afterOmit as any)?.branchId ?? null,
      };
      const omitPreserved = compareAvailabilitySnapshot(beforeOmitSnap, afterOmitSnap).ok;
      const omitMatchesFixture = compareAvailabilitySnapshot(omitExpectedFixture, beforeOmitSnap).ok;
      clearOmit = {
        omitFill,
        omitFormOk,
        omitServerNonEmpty,
        omitServerBefore,
        omitCreateStatus: omitCreate.status,
        omitCreateBody,
        formNameBeforeClear,
        beforeHadRules:
          (Array.isArray((beforeClear as any)?.availabilityJson?.exceptions) &&
            (beforeClear as any).availabilityJson.exceptions.length > 0) ||
          (Array.isArray((beforeClear as any)?.availabilityJson?.closedDates) &&
            (beforeClear as any).availabilityJson.closedDates.length > 0),
        clearUi,
        clearPatch,
        clearCompare,
        omitOwnerId,
        omitExpectedFixture,
        beforeOmitSnap,
        beforeOmitNonEmpty,
        omitMatchesFixture,
        omitStatus,
        omitPreserved,
        usedHelperWrite: false,
      };
    } else {
      clearOmit = {
        omitFill,
        omitFormOk,
        omitServerNonEmpty,
        omitServerBefore,
        omitMatStatus,
        omitCreateStatus: omitCreate.status,
        omitCreateBody,
        omitOwnerId,
        exOwnerId: exOwner.id,
        reason: !omitOwnerId
          ? 'omit-not-materialized'
          : !omitServerNonEmpty
            ? 'omit-empty-before-test'
            : 'ex-owner-missing',
        usedHelperWrite: false,
      };
    }
    const clearOmitOk =
      clearOmit.omitFormOk === true &&
      clearOmit.omitServerNonEmpty === true &&
      clearOmit.beforeHadRules === true &&
      (clearOmit.clearUi as any)?.ok === true &&
      Number((clearOmit.clearUi as any)?.exceptions) === 0 &&
      Number((clearOmit.clearUi as any)?.closed) === 0 &&
      (clearOmit.clearPatch as any)?.seen === true &&
      (clearOmit.clearPatch as any)?.targetsExOwner === true &&
      Number((clearOmit.clearPatch as any)?.status) < 400 &&
      (clearOmit.clearCompare as any)?.ok === true &&
      !!clearOmit.omitOwnerId &&
      clearOmit.beforeOmitNonEmpty === true &&
      clearOmit.omitMatchesFixture === true &&
      clearOmit.omitPreserved === true &&
      Number(clearOmit.omitStatus) < 400 &&
      clearOmit.usedHelperWrite === false;
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-availability-clear-omit.json'),
      JSON.stringify(clearOmit, null, 2),
    );
    record(
      'ACC-E2C-AVAILABILITY-CLEAR-OMIT',
      'مسح صريح من الواجهة مقابل إغفال الحقل على سجل مستقل غير فارغ',
      'UI clear on ExOnly only; independent omit keeps non-empty windows+exceptions+closed',
      JSON.stringify(clearOmit),
      clearOmitOk,
      { criterion: 'ACC-E2C-AVAILABILITY-CLEAR-OMIT', evidence: ['e2c-availability-clear-omit.json'] },
    );

    // Invalid availability: independent draft / materialize / PATCH paths (no default PASS).
    // Must renderForm(null) — goService will not replace an existing editor instance/item closure.
    await resetCatalogFormToNewService();
    const invalidName = `E2C-Invalid-${suffix}`;
    await page.waitForSelector('#catalogForm input[name="nameAr"]', { timeout: 5000 });
    await page.fill('#catalogForm input[name="nameAr"]', invalidName);
    await page.fill('#catalogForm input[name="priceSar"]', '40');
    await page.fill('#catalogForm input[name="durationMin"]', '20');
    await page.click('[data-testid="e2c-main-circle"][data-category-id="hair"]').catch(() => undefined);
    await page.click('[data-testid="e2c-place-chip"][data-place-mode="home"]').catch(() => undefined);
    const editFold = page.locator('#catalogForm [data-testid="e2c-avail-edit-details"]');
    if (await editFold.count()) {
      await editFold.evaluate((el) => {
        (el as HTMLDetailsElement).open = true;
      });
    }
    // Clear existing rows
    for (let i = 0; i < 20; i++) {
      const rm = page.locator(
        '#catalogForm [data-testid="avail-window-remove"], #catalogForm [data-testid="avail-exception-row"] button, #catalogForm [data-testid="avail-closed-date-row"] button',
      ).first();
      if (!(await rm.count())) break;
      await rm.click();
      await page.waitForTimeout(50);
    }
    await page.locator('details[data-weekday="0"]').evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    }).catch(() => undefined);
    if (!(await page.locator('[data-testid="avail-window-row"][data-weekday="0"]').count())) {
      await page.click('details[data-weekday="0"] [data-testid="avail-window-add"]').catch(() => undefined);
    }
    const row = page.locator('[data-testid="avail-window-row"][data-weekday="0"]').first();
    await row.waitFor({ state: 'visible', timeout: 3000 });
    const INVALID_SET_SOURCE = `() => {
      const row = document.querySelector('[data-testid="avail-window-row"][data-weekday="0"]');
      if (!row) return { ok: false, reason: 'no-row' };
      const times = row.querySelectorAll('input[type="time"]');
      const cap = row.querySelector('input[type="number"]');
      const start = times[0];
      const end = times[1];
      if (!start || !end || !cap) return { ok: false, reason: 'missing-controls' };
      start.value = '14:00';
      if (typeof start.onchange === 'function') start.onchange(new Event('change'));
      else start.dispatchEvent(new Event('change', { bubbles: true }));
      end.value = '10:00';
      if (typeof end.onchange === 'function') end.onchange(new Event('change'));
      else end.dispatchEvent(new Event('change', { bubbles: true }));
      cap.value = '0';
      if (typeof cap.oninput === 'function') cap.oninput(new Event('input'));
      if (typeof cap.onchange === 'function') cap.onchange(new Event('change'));
      else {
        cap.dispatchEvent(new Event('input', { bubbles: true }));
        cap.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { ok: true, start: start.value, end: end.value, capacity: cap.value };
    }`;
    const invalidFill = await page.evaluate((src) => (0, eval)('(' + src + ')()'), INVALID_SET_SOURCE);
    const invalidCtx = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const V2 = (window as any).MiraEditorV2;
      const ctx = V2 && form ? V2.getEditContext(form.id) : null;
      return {
        clientDraftId: ctx?.clientDraftId || null,
        targetOwnerId: ctx?.targetOwnerId || null,
        status: ctx?.status || null,
        name: (form?.querySelector('input[name="nameAr"]') as HTMLInputElement | null)?.value || '',
        ownerResolved: !!(form && ((form as any).dataset?.ownerId || (form as any).dataset?.serviceId)),
      };
    });
    const saveBtn = page.locator('#catalogForm-save');
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    const draftSaveWait = page
      .waitForResponse(
        (res) => /\/editor-drafts\//.test(res.url()) && res.request().method() === 'PUT',
        { timeout: 5000 },
      )
      .catch(() => null);
    await saveBtn.click();
    const draftSaveRes = await draftSaveWait;
    await page.waitForTimeout(1200);
    let draftInvalidStatus = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const status =
        form?.querySelector('[data-catalog-persist-status]')?.textContent ||
        form?.querySelector('[data-editor-v2-status]')?.textContent ||
        '';
      const fieldErr =
        form?.querySelector('[data-testid="avail-field-error"]')?.textContent ||
        form?.querySelector('.field-error[data-for="availabilityJson"]')?.textContent ||
        '';
      const lead = form?.querySelector('p.lead')?.textContent || '';
      const allFieldErrors = Array.from(form?.querySelectorAll('.field-error') || [])
        .map((n) => ({
          for: (n as HTMLElement).getAttribute('data-for'),
          text: n.textContent || '',
        }))
        .filter((x) => x.text.trim());
      return { status, fieldErr, lead, allFieldErrors };
    });
    if (!/وقت غير صالح|السعة|لم يُحفظ|AVAILABILITY/i.test(
      `${(draftInvalidStatus as any).fieldErr || ''}\n${(draftInvalidStatus as any).status || ''}`,
    )) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      draftInvalidStatus = await page.evaluate(() => {
        const form = document.getElementById('catalogForm');
        const status =
          form?.querySelector('[data-catalog-persist-status]')?.textContent ||
          form?.querySelector('[data-editor-v2-status]')?.textContent ||
          '';
        const fieldErr =
          form?.querySelector('[data-testid="avail-field-error"]')?.textContent ||
          form?.querySelector('.field-error[data-for="availabilityJson"]')?.textContent ||
          '';
        const lead = form?.querySelector('p.lead')?.textContent || '';
        const allFieldErrors = Array.from(form?.querySelectorAll('.field-error') || [])
          .map((n) => ({
            for: (n as HTMLElement).getAttribute('data-for'),
            text: n.textContent || '',
          }))
          .filter((x) => x.text.trim());
        return { status, fieldErr, lead, allFieldErrors };
      });
    }

    let draftSaveBody: unknown = null;
    let draftSaveHttp: number | null = draftSaveRes ? draftSaveRes.status() : null;
    if (draftSaveRes) {
      draftSaveBody = await draftSaveRes.json().catch(async () => draftSaveRes!.text().catch(() => null));
    }
    const draftBodyText = JSON.stringify(draftSaveBody || {});
    const fieldErrText = String((draftInvalidStatus as any)?.fieldErr || '');
    const statusText = String(
      ((draftInvalidStatus as any)?.status || '') + '\n' + ((draftInvalidStatus as any)?.lead || ''),
    );
    const clientAvailBlock = /وقت غير صالح|السعة مطلوبة|السعة يجب|اتاحة|إتاحة|availability|AVAILABILITY|فترة توفر|لم يُحفظ/i.test(
      `${fieldErrText}\n${statusText}`,
    );
    const apiAvailBlock =
      typeof draftSaveHttp === 'number' &&
      draftSaveHttp >= 400 &&
      /AVAILABILITY|اتاحة|إتاحة|فترة توفر|سعة/i.test(draftBodyText);
    const draftTemplateConflict =
      !clientAvailBlock &&
      !apiAvailBlock &&
      (/تعارض قالب|SERVICE_PROFILE_REVISION_CONFLICT/i.test(statusText) ||
        draftSaveHttp === 409 ||
        /SERVICE_PROFILE_REVISION_CONFLICT|TEMPLATE|SCHEMA|تعارض قالب/i.test(draftBodyText));
    const draftUiRejected = clientAvailBlock || apiAvailBlock;

    // Independent API draft-save path (separated from UI): invalid weeklyHours must return AVAILABILITY_* and leave no persisted invalid schedule.
    const apiDraftId = `new:invalid-api-${suffix}:service:${suffix}`;
    const apiDraftValid = await fetch(`${apiBase}/partners-portal/editor-drafts/${apiDraftId}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${tokenSalon}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: null,
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        schemaVersion: 2,
        values: {
          nameAr: `E2C-InvalidApi-${suffix}`,
          priceHalalas: 4000,
          durationMin: 20,
          category: 'hair',
          placeMode: 'home',
          weeklyHours: [
            { weekday: 1, startMin: 600, endMin: 720, capacity: 2, resourceId: 'api-ok' },
          ],
          dateExceptions: [],
        },
      }),
    });
    const apiDraftValidBody = await apiDraftValid.json().catch(() => ({}));
    const beforeInvalidPut = await prisma.partnerEditorDraft.findFirst({
      where: { clientDraftId: apiDraftId, partnerId: salon.id },
    });
    const apiDraftInvalid = await fetch(`${apiBase}/partners-portal/editor-drafts/${apiDraftId}`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${tokenSalon}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: (apiDraftValidBody as any)?.revision ?? 1,
        kind: 'service',
        profileId: 'service.salon_hair_cut',
        schemaVersion: 2,
        values: {
          nameAr: `E2C-InvalidApi-${suffix}`,
          priceHalalas: 4000,
          durationMin: 20,
          category: 'hair',
          placeMode: 'home',
          weeklyHours: [
            { weekday: 0, startMin: 800, endMin: 700, capacity: 0, resourceId: '' },
          ],
          dateExceptions: [],
        },
      }),
    });
    const apiDraftInvalidBody = await apiDraftInvalid.json().catch(() => ({}));
    const afterInvalidPut = await prisma.partnerEditorDraft.findFirst({
      where: { clientDraftId: apiDraftId, partnerId: salon.id },
    });
    const apiDraftRejected =
      apiDraftValid.status < 400 &&
      apiDraftInvalid.status >= 400 &&
      /AVAILABILITY|اتاحة|إتاحة|فترة|سعة|وقت/i.test(JSON.stringify(apiDraftInvalidBody)) &&
      !/SERVICE_PROFILE_REVISION_CONFLICT|تعارض قالب/i.test(JSON.stringify(apiDraftInvalidBody)) &&
      JSON.stringify((beforeInvalidPut as any)?.valuesJson || null) ===
        JSON.stringify((afterInvalidPut as any)?.valuesJson || null);

    // UI journey and API contract are independent — API success must not mask a missing UI rejection.
    const uiDraftPathStatus: 'PASS' | 'FAIL' | 'NOT_RUN' = draftUiRejected
      ? 'PASS'
      : draftTemplateConflict
        ? 'FAIL'
        : draftSaveHttp == null && !clientAvailBlock
          ? 'NOT_RUN'
          : 'FAIL';
    const apiDraftPathStatus: 'PASS' | 'FAIL' | 'NOT_RUN' = apiDraftRejected
      ? 'PASS'
      : 'FAIL';
    const draftPathStatus =
      uiDraftPathStatus === 'PASS' && apiDraftPathStatus === 'PASS'
        ? 'PASS'
        : uiDraftPathStatus === 'NOT_RUN' || apiDraftPathStatus === 'NOT_RUN'
          ? 'NOT_RUN'
          : 'FAIL';


    const matInvalid = page.locator(
      '#catalogForm [data-testid="materialize-draft"]:visible, #catalogForm [data-editor-v2-materialize="1"]:visible',
    );
    let materializePathStatus: 'PASS' | 'FAIL' | 'NOT_RUN' = 'NOT_RUN';
    let materializeRejected = false;
    let materializeAttempted = false;
    let materializeResponse: Record<string, unknown> | null = null;
    let materializeStatusUi = '';
    if (draftUiRejected && invalidCtx.targetOwnerId == null) {
      // UI blocked draft save of invalid availability — materialize must not create the service.
      const afterBlocked = await page.evaluate(async (nm) => {
        const dash = await (window as any).PartnersApi.dashboard();
        return (dash?.catalog?.services || []).find((s: any) => s.nameAr === nm) || null;
      }, invalidName);
      materializeRejected = !afterBlocked?.id;
      materializePathStatus = materializeRejected ? 'PASS' : 'FAIL';
      materializeResponse = { blockedByUiDraftValidation: true, created: !!afterBlocked?.id };
    } else if (await matInvalid.count()) {
      materializeAttempted = true;
      const matWait = page.waitForResponse(
        (res) => /materialize|editor-drafts/.test(res.url()) && res.request().method() !== 'GET',
        { timeout: 8000 },
      ).catch(() => null);
      await matInvalid.first().click();
      const matRes = await matWait;
      await page.waitForTimeout(2500);
      materializeStatusUi = await page.evaluate(() => {
        const form = document.getElementById('catalogForm');
        return (
          form?.querySelector('[data-catalog-persist-status], p.lead, [role="status"]')?.textContent ||
          ''
        );
      });
      let matBody: unknown = null;
      if (matRes) {
        matBody = await matRes.json().catch(async () => matRes!.text().catch(() => null));
        materializeResponse = { status: matRes.status(), body: matBody, url: matRes.url() };
      }
      const afterMat = await page.evaluate(async (nm) => {
        const dash = await (window as any).PartnersApi.dashboard();
        return (dash?.catalog?.services || []).find((s: any) => s.nameAr === nm) || null;
      }, invalidName);
      const bodyText = JSON.stringify(matBody || {}) + materializeStatusUi;
      // Preflight may reject without an HTTP round-trip — match UI copy from buildEditorValues.
      materializeRejected =
        !afterMat?.id &&
        (/AVAILABILITY|اتاحة|إتاحة|وقت غير صالح|السعة|فترة توفر|الحقول غير صالحة|لم يُحوَّل/i.test(
          bodyText,
        ) ||
          (matRes != null && matRes.status() >= 400));
      materializePathStatus = materializeRejected ? 'PASS' : afterMat?.id ? 'FAIL' : 'NOT_RUN';
    }

    // Valid counterpart service for PATCH path (correct template/identity).
    const validPatchName = `E2C-ValidPatch-${suffix}`;
    const validCreate = await fetch(`${apiBase}/partners-portal/services`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${tokenSalon}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        nameAr: validPatchName,
        priceHalalas: 5000,
        durationMin: 30,
        category: 'hair',
        placeMode: 'home',
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: [{ weekday: 1, startMin: 600, endMin: 720, capacity: 2, resourceId: 'ok-1' }],
          exceptions: [],
          closedDates: [],
        },
      }),
    });
    const validBody = (await validCreate.json().catch(() => ({}))) as { id?: string };
    if (validBody.id) createdServiceIds.push(validBody.id);
    const beforePatch = validBody.id
      ? await prisma.service.findUnique({ where: { id: validBody.id } })
      : null;
    const patchInvalid = validBody.id
      ? await fetch(`${apiBase}/partners-portal/services/${validBody.id}`, {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${tokenSalon}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            availabilityJson: {
              v: 2,
              timezone: 'Asia/Riyadh',
              windows: [{ weekday: 0, startMin: 800, endMin: 700, capacity: 0, resourceId: '' }],
              exceptions: [],
              closedDates: [],
            },
          }),
        })
      : null;
    const patchInvalidBody = patchInvalid ? await patchInvalid.json().catch(() => ({})) : {};
    const afterPatch = validBody.id
      ? await prisma.service.findUnique({ where: { id: validBody.id } })
      : null;
    const patchUnchanged =
      !!beforePatch &&
      !!afterPatch &&
      JSON.stringify(beforePatch.availabilityJson) === JSON.stringify(afterPatch.availabilityJson);
    const patchPathStatus =
      !validBody.id || !patchInvalid
        ? 'NOT_RUN'
        : patchInvalid.status >= 400 &&
            /AVAILABILITY|اتاحة|إتاحة|غير صالح/i.test(
              JSON.stringify(patchInvalidBody),
            ) &&
            patchUnchanged
          ? 'PASS'
          : 'FAIL';
    const validPatchOk = validCreate.status < 400 && !!validBody.id;

    const invalidOk =
      uiDraftPathStatus === 'PASS' &&
      apiDraftPathStatus === 'PASS' &&
      draftUiRejected === true &&
      apiDraftRejected === true &&
      materializePathStatus === 'PASS' &&
      materializeRejected === true &&
      invalidCtx.targetOwnerId == null &&
      invalidCtx.name === invalidName &&
      patchPathStatus === 'PASS' &&
      validPatchOk;
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-invalid-availability-paths.json'),
      JSON.stringify(
        {
          draftInvalidStatus,
          draftPathStatus,
          uiDraftPathStatus,
          apiDraftPathStatus,
          draftSaveStatus: draftSaveHttp,
          draftSaveBody,
          draftTemplateConflict,
          clientAvailBlock,
          apiAvailBlock,
          draftUiRejected,
          apiDraftValidStatus: apiDraftValid.status,
          apiDraftInvalidStatus: apiDraftInvalid.status,
          apiDraftInvalidBody,
          apiDraftRejected,
          invalidFill,
          invalidCtx,
          materializeAttempted,
          materializeRejected,
          materializeResponse,
          materializeStatusUi,
          materializePathStatus,
          validCreateStatus: validCreate.status,
          validBody,
          patchInvalidStatus: patchInvalid ? patchInvalid.status : null,
          patchInvalidBody,
          patchUnchanged,
          patchPathStatus,
          validPatchOk,
          invalidOk,
        },
        null,
        2,
      ),
    );
    record(
      'ACC-E2C-INVALID-AVAILABILITY-PATHS',
      'رفض الإتاحة غير الصالحة في المسودة والتحويل وPATCH مع حالة صحيحة مقابلة',
      'draft/materialize/PATCH availability errors; data unchanged; valid create succeeds',
      JSON.stringify({
        draftPathStatus,
        uiDraftPathStatus,
        apiDraftPathStatus,
        draftUiRejected,
        apiDraftRejected,
        materializePathStatus,
        materializeAttempted,
        materializeRejected,
        patchPathStatus,
        validPatchOk,
      }),
      invalidOk,
      {
        criterion: 'ACC-E2C-INVALID-AVAILABILITY-PATHS',
        evidence: ['e2c-invalid-availability-paths.json'],
      },
    );

    // After save/reopen design proof shots (desktop + phone) from the final service form.
    await page.click('#goService');
    await page.waitForTimeout(500);
    if (afterSave.id) {
      const reopenFinal = page
        .locator('#catalogList .list-item')
        .filter({ hasText: svcName })
        .getByRole('button', { name: 'فتح في النموذج' });
      if (await reopenFinal.count()) {
        await reopenFinal.first().click();
        await page.waitForTimeout(900);
      }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(evidenceDir, 'e2c-design-final-desktop-reopen.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(evidenceDir, 'e2c-design-final-phone-reopen.png'),
      fullPage: true,
    });

    const gateBaseline = evaluateGate({ cases: results, mandatory: MANDATORY.filter((m) => m !== 'ACC-E2C-GATE-REJECTS-BAD') });
    const sabotage: CaseResult = {
      id: 'e2c-sabotage',
      criterion: 'ACC-E2C-ORBS',
      scenario: 'sabotage',
      expected: 'x',
      actual: 'x',
      evidence: ['e2c-orbs-desktop.png'],
      evidenceMissing: [],
      status: 'FAIL',
    };
    const gateBad = evaluateGate({
      cases: [...results.filter((r) => r.criterion !== 'ACC-E2C-ORBS'), sabotage],
      mandatory: MANDATORY.filter((m) => m !== 'ACC-E2C-GATE-REJECTS-BAD'),
    });
    fs.writeFileSync(
      path.join(evidenceDir, 'e2c-gate-reject.json'),
      JSON.stringify({ gateBaseline, gateBad }, null, 2),
    );
    record(
      'ACC-E2C-GATE-REJECTS-BAD',
      'البوابة ترفض معيارًا واحدًا فاشلًا من مجموعة مكتملة',
      'gateBad.ok=false',
      JSON.stringify({ gateBad }),
      gateBad.ok === false && (gateBad.bad || []).some((b) => b.startsWith('ACC-E2C-ORBS=')),
      { criterion: 'ACC-E2C-GATE-REJECTS-BAD', evidence: ['e2c-gate-reject.json'] },
    );
  } finally {
    try {
      if (browser) {
        const pages = browser.contexts().flatMap((c) => c.pages());
        for (let i = 0; i < pages.length; i++) {
          const p = pages[i];
          const v = p.video();
          const evidenceName =
            (p as { _miraEvidenceName?: string })._miraEvidenceName || `e2c-page-${i}`;
          await p.close().catch(() => undefined);
          if (v) {
            const raw = await v.path().catch(() => null);
            if (raw && fs.existsSync(raw)) {
              fs.copyFileSync(raw, path.join(evidenceDir, evidenceName + '.webm'));
            }
          }
        }
        await browser.close();
      }
    } catch {
      if (browser) await browser.close().catch(() => undefined);
    }
    for (const id of createdServiceIds) {
      await prisma.catalogMedia.deleteMany({ where: { ownerKind: 'service', ownerId: id } }).catch(() => undefined);
      await prisma.service.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.partnerBranch
      .deleteMany({ where: { partnerId: { in: [salon.id, brand.id] } } })
      .catch(() => undefined);
    await prisma.partnerUser.deleteMany({
      where: { partnerId: { in: [salon.id, developer.id, brand.id] } },
    });
    await prisma.partner.deleteMany({ where: { id: { in: [salon.id, developer.id, brand.id] } } });
    void salonBranch;
    void salonBranch2;
    void foreignBranch;
    if (portalServer) await new Promise<void>((r) => portalServer!.close(() => r()));
    if (app) await app.close();
    await prisma.$disconnect();
  }

  assertAcceptanceContentUnchanged(runIdentity, repoRoot);
  const ended = new Date().toISOString();
  const gate = evaluateGate({ cases: results, mandatory: MANDATORY });
  const verdict = gate.ok ? 'E2C_SERVICE_EDITOR_CLOSED_VERIFIED — LOCAL/TEST ONLY' : 'E2C_OPEN';
  const report = {
    started,
    ended,
    testedSha,
    runId: runIdentity.runId,
    codeContentSha256,
    verdict,
    gate,
    mandatory: MANDATORY,
    results,
  };
  fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ verdict, gate, codeContentSha256, started, ended }, null, 2));
  process.exit(gate.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
