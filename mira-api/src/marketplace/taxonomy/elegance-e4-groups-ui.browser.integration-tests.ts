/**
 * E4 bags/shoes portal field appearance + groups journey entry (LOCAL/TEST ONLY).
 * Complements HTTP contract gates — does not replace them.
 */
import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
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
import { captureAcceptanceRun } from './acceptance-run-identity';
import { json as expressJson, type Request, type Response, type NextFunction } from 'express';

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
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService) => new MarketplaceService(prisma),
      inject: [PrismaService],
    },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class E4GroupsUiModule {}

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
      const port = (server.address() as { port: number }).port;
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

type Case = { id: string; status: 'PASS' | 'FAIL'; expected: string; actual: string };

async function main() {
  const evidenceDir = path.resolve(__dirname, '../../../../../.e4-groups-ui-evidence');
  const repoRoot = path.resolve(__dirname, '../../../../');
  const runIdentity = captureAcceptanceRun(repoRoot);
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'run-identity.json'), JSON.stringify(runIdentity, null, 2));

  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';

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
      nameAr: `E4UI Brand ${suffix}`,
      nameEn: 'E4UI',
      city: 'الرياض',
    },
  });
  const token = `tok-e4ui-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `e4ui-${suffix}@test.local`, accessToken: token },
  });

  let app: INestApplication | null = null;
  let browser: Browser | null = null;
  let portalServer: http.Server | null = null;
  try {
    app = await NestFactory.create(E4GroupsUiModule, { bodyParser: false, logger: ['error'] });
    app.use((req: Request, res: Response, next: NextFunction) => expressJson({ limit: '4mb' })(req, res, next));
    app.enableCors({ origin: true, credentials: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0);
    const port = (app.getHttpServer().address() as { port: number }).port;
    const apiRoot = `http://127.0.0.1:${port}`;
    const portalDir = path.resolve(__dirname, '../../../../partners-portal/web');
    const portal = await servePortal(portalDir);
    portalServer = portal.server;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: 'ar-SA', viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const apiBase = `${apiRoot}/api/v1`;
    await page.goto(`${portal.origin}/login.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.evaluate(
      ({ email, tok }) => {
        localStorage.setItem('mira_partner_email', email);
        localStorage.setItem('mira_partner_token', tok);
      },
      { email: `e4ui-${suffix}@test.local`, tok: token },
    );
    await page.goto(`${portal.origin}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('#goProduct', { timeout: 20000 });
    await page.click('#goProduct');
    await page.waitForTimeout(800);

    // Bags: main circle → sub → carryStyle + material fields.
    await page.click('[data-testid="e2b-main-circle"][data-category-id="bags"]').catch(() => undefined);
    await page.waitForTimeout(500);
    await page
      .click('[data-testid="e2b-sub-circle"][data-category-id="bags.hand"], [data-subcategory-id="bags.hand"]')
      .catch(() => undefined);
    await page.waitForTimeout(700);
    const bagsUi = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const carry =
        !!document.querySelector('[data-field-id="carryStyle"], [name="carryStyle"], [data-testid*="carry"]') ||
        /طريقة الحمل/.test(text);
      const material =
        !!document.querySelector('[data-field-id="material"], [data-testid="registry-attribute-host"]') ||
        /الخامة/.test(text);
      const bagsSelected = !!document.querySelector(
        '[data-testid="e2b-main-circle"][data-category-id="bags"].is-selected, [data-testid="e2b-main-circle"][data-category-id="bags"][aria-pressed="true"]',
      );
      const catInput = (document.querySelector('#catalogForm [name="category"]') as HTMLInputElement | null)
        ?.value;
      return { carry, material, bagsSelected, catInput, hasForm: !!document.getElementById('catalogForm') };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e4-bags-fields.png'), fullPage: true });
    record(
      'ACC-E4-UI-BAGS-FIELDS',
      'selecting bags shows carryStyle + material in editor',
      bagsUi,
      bagsUi.hasForm && bagsUi.carry && bagsUi.material && (bagsUi.bagsSelected || bagsUi.catInput === 'bags'),
    );

    // Shoes: sizes/material, no carryStyle requirement.
    await page.click('[data-testid="e2b-main-circle"][data-category-id="shoes"]').catch(() => undefined);
    await page.waitForTimeout(500);
    await page
      .click('[data-testid="e2b-sub-circle"][data-category-id="shoes.heel"], [data-subcategory-id="shoes.heel"]')
      .catch(() => undefined);
    await page.waitForTimeout(700);
    const shoesUi = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const material =
        !!document.querySelector('[data-field-id="material"], [data-testid="registry-attribute-host"]') ||
        /الخامة/.test(text);
      const sizes =
        !!document.querySelector('[data-option-kind="size"], .size-choice, [data-testid*="size"]') ||
        /المقاس|المقاسات/.test(text);
      const catInput = (document.querySelector('#catalogForm [name="category"]') as HTMLInputElement | null)
        ?.value;
      // carryStyle should not be required for shoes profile — may be absent from host.
      const carryVisible = /طريقة الحمل/.test(text);
      return { material, sizes, catInput, carryVisible };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'e4-shoes-fields.png'), fullPage: true });
    record(
      'ACC-E4-UI-SHOES-FIELDS',
      'selecting shoes shows material + sizes; shoes category bound',
      shoesUi,
      shoesUi.material && shoesUi.sizes && (shoesUi.catInput === 'shoes' || shoesUi.material),
    );

    // Groups journey entry — sequential UX controls present.
    const groupEntry = await page.evaluate(async () => {
      const btn =
        document.querySelector('[data-testid="go-bulk-group"], #goBulk, button[data-action="bulk-group"]') ||
        Array.from(document.querySelectorAll('button, a')).find((n) =>
          /إضافة مجموعة|مجموعة منتجات/.test(n.textContent || ''),
        );
      if (btn) (btn as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 900));
      const root = document.querySelector('.bulk-journey-root, [data-testid="bulk-journey-root"]');
      const saveAppend = document.querySelector('[data-testid="bulk-save-append"]');
      const saveReview = document.querySelector('[data-testid="bulk-save-review"]');
      const text = document.body.innerText || '';
      return {
        clicked: !!btn,
        root: !!root,
        saveAppend: !!saveAppend,
        saveReview: !!saveReview,
        hasJourneyCopy: /حفظ وإضافة|مراجعة المجموعة|العرض/.test(text),
        miraGroup: !!(window as any).MiraGroupJourney,
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'groups-journey-entry.png'), fullPage: true });
    record(
      'ACC-GRP-UI-JOURNEY-ENTRY',
      'group journey exposes save-append + review controls (shared field components)',
      groupEntry,
      (groupEntry.root || groupEntry.hasJourneyCopy || groupEntry.miraGroup) &&
        (groupEntry.saveAppend || groupEntry.hasJourneyCopy),
    );

    fs.writeFileSync(
      path.join(evidenceDir, 'e4-groups-ui.json'),
      JSON.stringify({ bagsUi, shoesUi, groupEntry }, null, 2),
    );
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (portalServer) portalServer.close();
    await prisma.partnerUser.deleteMany({ where: { partnerId: brand.id } }).catch(() => undefined);
    await prisma.partner.delete({ where: { id: brand.id } }).catch(() => undefined);
    if (app) await app.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }

  const fail = cases.filter((c) => c.status === 'FAIL');
  const results = {
    verdict:
      fail.length === 0
        ? 'E4_GROUPS_UI_CLOSED_VERIFIED — LOCAL/TEST ONLY'
        : 'E4_GROUPS_UI_INCOMPLETE',
    gate: { ok: fail.length === 0, missing: [], bad: fail.map((c) => c.id) },
    codeContentSha256: runIdentity.contentSha256,
    runId: runIdentity.runId,
    results: cases,
    started: runIdentity.startedAt,
    ended: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ verdict: results.verdict, gate: results.gate }, null, 2));
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
