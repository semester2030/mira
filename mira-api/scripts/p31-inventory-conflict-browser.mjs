/**
 * Dual-session inventory revision conflict via REAL portal form saves.
 * Forbidden: inject conflict/success DOM messages; API-only save as the accepted path.
 * API may be used for seed + independent server verification only.
 *
 * Env:
 *   MIRA_API_BASE (default http://127.0.0.1:3000/api/v1)
 *   DATABASE_URL (local) — auto-seed when tokens/product not provided
 *   MIRA_P31_TOKEN_A / MIRA_P31_TOKEN_B / MIRA_P31_PRODUCT_ID — optional override
 *   MIRA_P31_DEVELOPER=1 — also cover developer publish=true path
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const outDir =
  process.env.MIRA_P31_OUT_DIR ||
  join(repoRoot, 'audit-out/p2-p31-p4/logs/ui-conflict');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'shots'), { recursive: true });
mkdirSync(join(outDir, 'network'), { recursive: true });

const apiBase = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const portalRoot = join(repoRoot, 'partners-portal/web');
const commit = process.env.MIRA_P21_COMMIT || '';
const runId = process.env.MIRA_P21_RUN_ID || process.env.MIRA_TEST_RUN_ID || `ui-conflict-${Date.now()}`;

function mime(p) {
  const e = extname(p);
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    }[e] || 'application/octet-stream'
  );
}

function requireLocalDb(url) {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`REFUSE non-local DATABASE_URL host=${host}`);
  }
}

async function seedFixture(prisma, { developer }) {
  const run = randomUUID().slice(0, 8);
  const token = `tok-ui-${run}`;
  const partner = await prisma.partner.create({
    data: {
      type: developer ? 'developer' : 'brand',
      status: 'active',
      nameAr: developer ? `مطوّر واجهة ${run}` : `علامة واجهة ${run}`,
      nameEn: `ui-${run}`,
      city: 'الرياض',
    },
  });
  const pu = await prisma.partnerUser.create({
    data: {
      partnerId: partner.id,
      email: `ui-conflict-${run}@t.local`,
      accessToken: token,
    },
  });
  const variantId = `v-${run}`;
  const product = await prisma.product.create({
    data: {
      partnerId: partner.id,
      nameAr: `منتج تعارض ${run}`,
      nameEn: `conflict-${run}`,
      priceHalalas: 2500,
      purchaseMode: 'internal_cod',
      stockQty: null,
      inventoryMode: 'variant',
      category: 'clothes',
      externalUrl: '',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'published',
      reviewStatus: 'none',
      active: true,
      catalogSource: 'catalog',
      deliveryFeeHalalas: 0,
      // category=clothes unlocks easy options UI (variant stock fields).
      optionsJson: [{ id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 'm', labelAr: 'M' }] }],
      variantsJson: [{ id: variantId, selections: { size: 'm' }, available: true, labels: { size: 'M' } }],
    },
  });
  await prisma.productVariantInventory.create({
    data: {
      productId: product.id,
      variantId,
      stockMode: 'tracked',
      stockQty: 5,
      reservedQty: 0,
      revision: 1,
    },
  });
  return {
    token,
    productId: product.id,
    variantId,
    partnerId: partner.id,
    partnerUserId: pu.id,
    email: pu.email,
    developer: Boolean(developer),
    cleanup: async () => {
      await prisma.productVariantInventory.deleteMany({ where: { productId: product.id } }).catch(() => undefined);
      await prisma.catalogMedia.deleteMany({ where: { ownerKind: 'product', ownerId: product.id } }).catch(() => undefined);
      await prisma.catalogReviewLog.deleteMany({ where: { ownerKind: 'product', ownerId: product.id } }).catch(() => undefined);
      await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
      await prisma.partnerUser.delete({ where: { id: pu.id } }).catch(() => undefined);
      await prisma.partner.delete({ where: { id: partner.id } }).catch(() => undefined);
    },
  };
}

async function main() {
  const startedUtc = new Date().toISOString();
  const steps = [];
  const networkLog = [];
  const record = (id, ok, detail) => {
    steps.push({ id, ok, detail });
    console.log(JSON.stringify({ id, ok, detail }));
  };

  let apiUp = false;
  try {
    const r = await fetch(`${apiBase}/partners-portal/registry`).catch(() => null);
    apiUp = Boolean(r);
  } catch {
    apiUp = false;
  }
  if (!apiUp) {
    const summary = {
      ok: false,
      blocked: true,
      id: 'P31_UI_INVENTORY_CONFLICT_BROWSER',
      reason: 'API not reachable — start mira-api on local port first',
      commit,
      runId,
      startedUtc,
      finishedUtc: new Date().toISOString(),
      steps: [{ id: 'API_UP', ok: 'BLOCKED' }],
    };
    writeFileSync(join(outDir, 'inventory-conflict-browser.json'), JSON.stringify(summary, null, 2));
    writeFileSync(join(outDir, 'verdict.txt'), 'BLOCKED\n');
    process.exit(0);
  }
  record('API_UP', true, { apiBase });

  const prisma = new PrismaClient();
  const cleanups = [];
  let tokenA = (process.env.MIRA_P31_TOKEN_A || '').trim();
  let tokenB = (process.env.MIRA_P31_TOKEN_B || '').trim();
  let productId = (process.env.MIRA_P31_PRODUCT_ID || '').trim();
  let variantId = (process.env.MIRA_P31_VARIANT_ID || '').trim();
  let coverDeveloper = process.env.MIRA_P31_DEVELOPER === '1';

  try {
    if (!tokenA || !tokenB || !productId) {
      const dbUrl = process.env.DATABASE_URL || '';
      if (!dbUrl) {
        const summary = {
          ok: false,
          blocked: true,
          id: 'P31_UI_INVENTORY_CONFLICT_BROWSER',
          reason: 'Need MIRA_P31_TOKEN_* + PRODUCT_ID or DATABASE_URL for auto-seed',
          commit,
          runId,
          startedUtc,
          finishedUtc: new Date().toISOString(),
          steps: [{ id: 'SEED', ok: 'BLOCKED' }],
          requiredEnvNames: ['MIRA_P31_TOKEN_A', 'MIRA_P31_TOKEN_B', 'MIRA_P31_PRODUCT_ID', 'DATABASE_URL'],
        };
        writeFileSync(join(outDir, 'inventory-conflict-browser.json'), JSON.stringify(summary, null, 2));
        writeFileSync(join(outDir, 'verdict.txt'), 'BLOCKED\n');
        process.exit(0);
      }
      requireLocalDb(dbUrl);
      const seeded = await seedFixture(prisma, { developer: false });
      cleanups.push(seeded.cleanup);
      tokenA = seeded.token;
      tokenB = seeded.token; // same partner; two browser sessions (PartnerUser unique per partner)
      productId = seeded.productId;
      variantId = seeded.variantId;
      record('SEED_BRAND', true, {
        productIdSuffix: productId.slice(-8),
        variantId,
        sameTokenBothSessions: true,
      });
      coverDeveloper = true;
    } else {
      record('SEED_ENV', true, { productIdSuffix: productId.slice(-8) });
    }

    // Independent expected values (not read-back-as-oracle).
    const EXPECT_A = 12;
    const EXPECT_B_LOCAL = 7;
    const EXPECT_SERVER_AFTER = 12;

    // Same-origin proxy: portal + /api/v1 → API (avoids CORS on ephemeral ports).
    const apiOrigin = apiBase.replace(/\/api\/v1\/?$/, '');
    const readReqBody = (req) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
      });
    const server = createServer(async (req, res) => {
      const rawUrl = req.url || '/';
      if (rawUrl.startsWith('/api/')) {
        try {
          const method = req.method || 'GET';
          const body = ['GET', 'HEAD'].includes(method) ? undefined : await readReqBody(req);
          const headers = {
            accept: req.headers.accept || 'application/json',
          };
          if (req.headers.authorization) headers.authorization = req.headers.authorization;
          if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
          if (req.headers['x-admin-key']) headers['x-admin-key'] = req.headers['x-admin-key'];
          if (req.headers['x-mira-media-req']) headers['x-mira-media-req'] = req.headers['x-mira-media-req'];
          const upstream = await fetch(`${apiOrigin}${rawUrl}`, { method, headers, body });
          const buf = Buffer.from(await upstream.arrayBuffer());
          const outHeaders = { 'content-type': upstream.headers.get('content-type') || 'application/json' };
          res.writeHead(upstream.status, outHeaders);
          res.end(buf);
        } catch (e) {
          res.writeHead(502, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ message: 'proxy-failed', error: String(e?.message || e) }));
        }
        return;
      }
      let path = rawUrl.split('?')[0];
      if (path === '/') path = '/dashboard.html';
      const file = join(portalRoot, path.replace(/^\//, ''));
      if (!file.startsWith(portalRoot) || !existsSync(file)) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      res.writeHead(200, { 'content-type': mime(file) });
      res.end(readFileSync(file));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const origin = `http://127.0.0.1:${port}`;
    const portalApiBase = `${origin}/api/v1`;

    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });

    async function openSession(token, label) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const reqs = [];
      // Capture ALL partners-portal requests (incl. POST submit-review) — not only inventory PATCH responses.
      page.on('request', (req) => {
        const u = req.url();
        if (!/\/partners-portal\//.test(u) && !/\/variant-inventory/.test(u)) return;
        let postData = null;
        try {
          postData = req.postData() || null;
        } catch {
          postData = null;
        }
        let postJson = null;
        if (postData) {
          try {
            postJson = JSON.parse(postData);
          } catch {
            postJson = { rawLen: postData.length };
          }
        }
        const entry = {
          t: Date.now(),
          label,
          phase: 'request',
          method: req.method(),
          url: u.replace(apiOrigin, '').replace(portalApiBase, '/api/v1').replace(apiBase, '/api/v1'),
          postJson,
        };
        reqs.push(entry);
        networkLog.push(entry);
      });
      page.on('response', async (res) => {
        const u = res.url();
        if (!/\/partners-portal\//.test(u) && !/\/variant-inventory/.test(u)) return;
        let bodyPreview = '';
        try {
          bodyPreview = (await res.text()).slice(0, 400);
        } catch {
          /* ignore */
        }
        networkLog.push({
          t: Date.now(),
          label,
          phase: 'response',
          status: res.status(),
          method: res.request().method(),
          url: u.replace(apiOrigin, '').replace(portalApiBase, '/api/v1').replace(apiBase, '/api/v1'),
          bodyPreview,
        });
      });
      await page.addInitScript(
        ({ token, api }) => {
          localStorage.setItem('mira_partner_token', token);
        },
        { token, api: portalApiBase },
      );
      await page.goto(`${origin}/dashboard.html?api-base=${encodeURIComponent(portalApiBase)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForFunction(
        () => {
          const err = document.getElementById('loadError');
          if (err && !err.classList.contains('hidden')) return true;
          const list = document.getElementById('catalogList');
          return Boolean(list && (list.querySelector('.list-item') || /لا عناصر/.test(list.textContent || '')));
        },
        { timeout: 45000 },
      );
      const loadErr = await page.evaluate(() => {
        const err = document.getElementById('loadError');
        if (err && !err.classList.contains('hidden')) {
          return document.getElementById('loadErrorText')?.textContent || 'load error';
        }
        return null;
      });
      if (loadErr) throw new Error('dashboard load failed: ' + loadErr);
      return { ctx, page, label, reqs };
    }

    async function openProductForm(page) {
      const openBtn = page.locator('#catalogList .list-item button', { hasText: 'فتح في النموذج' }).first();
      await openBtn.click();
      await page.waitForSelector('#catalogForm-save', { timeout: 20000 });
      // Wait inventory hydrate (variant mode product).
      await page.waitForFunction(
        () => {
          const loading = document.querySelector('[data-testid="inventory-loading"]');
          const err = document.querySelector('[data-testid="inventory-load-error"]');
          const stock = document.querySelector('[data-testid="variant-stock-qty"]');
          const mode = document.querySelector('#catalogForm input[type="checkbox"]');
          return Boolean(stock) || Boolean(err) || (!loading && mode);
        },
        { timeout: 30000 },
      );
      // Ensure variant inventory mode + stock field.
      const hasStock = await page.locator('[data-testid="variant-stock-qty"]').count();
      if (!hasStock) {
        const modeLabel = page.locator('#catalogForm label', { hasText: 'تتبع المخزون لكل تركيبة' });
        if ((await modeLabel.count()) > 0) {
          await modeLabel.locator('input[type="checkbox"]').check();
          await page.waitForSelector('[data-testid="variant-stock-qty"]', { timeout: 15000 });
        }
      }
      await page.waitForSelector('[data-testid="variant-stock-qty"]', { timeout: 20000 });
    }

    async function setStockAndSave(page, qty) {
      const stock = page.locator('[data-testid="variant-stock-qty"]').first();
      await stock.fill(String(qty));
      // Capture revision from in-memory state before save (for diagnostics only — not oracle).
      const before = await page.evaluate(() => {
        const status =
          document.querySelector('#catalogForm [data-inventory-revision-conflict]') ||
          document.querySelector('#catalogForm [data-catalog-persist-status]') ||
          document.querySelector('#catalogForm [role="status"]');
        return {
          statusText: status ? status.textContent : '',
          conflictAttr: status ? status.getAttribute('data-inventory-revision-conflict') : null,
          persistAttr: status ? status.getAttribute('data-catalog-persist-status') : null,
          stockValue: document.querySelector('[data-testid="variant-stock-qty"]')?.value || null,
          saveDisabled: document.querySelector('#catalogForm-save')?.disabled || false,
          saveText: document.querySelector('#catalogForm-save')?.textContent || '',
        };
      });
      const shotBefore = join(outDir, 'shots', `before-save-${randomUUID().slice(0, 8)}.png`);
      await page.screenshot({ path: shotBefore, fullPage: true });

      const saveRespPromise = page.waitForResponse(
        (r) =>
          r.url().includes(`/partners-portal/products/`) &&
          (r.request().method() === 'PATCH' || r.url().includes('variant-inventory')),
        { timeout: 30000 },
      );
      await page.locator('#catalogForm-save').click();
      let saveResp = null;
      try {
        saveResp = await saveRespPromise;
      } catch {
        /* may complete without matching if inventory-only fails after patch */
      }
      // Wait UI settle
      await page.waitForTimeout(1500);
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('#catalogForm-save');
          return btn && !btn.disabled && !btn.getAttribute('aria-busy');
        },
        { timeout: 45000 },
      );
      const after = await page.evaluate(() => {
        const status =
          document.querySelector('#catalogForm [data-inventory-revision-conflict]') ||
          document.querySelector('#catalogForm [data-catalog-persist-status]') ||
          document.querySelector('#catalogForm [data-inventory-partial]') ||
          document.querySelector('#catalogForm [role="status"]');
        const save = document.querySelector('#catalogForm-save');
        return {
          statusText: status ? status.textContent : '',
          conflictAttr: status ? status.getAttribute('data-inventory-revision-conflict') : null,
          persistAttr: status ? status.getAttribute('data-catalog-persist-status') : null,
          partialAttr: status ? status.getAttribute('data-inventory-partial') : null,
          stockValue: document.querySelector('[data-testid="variant-stock-qty"]')?.value || null,
          saveDisabled: save?.disabled || false,
          saveText: save?.textContent || '',
          hasSuccessClass: save?.classList?.contains('is-success') || false,
          formWiped: !document.querySelector('[data-testid="variant-stock-qty"]'),
        };
      });
      const shotAfter = join(outDir, 'shots', `after-save-${randomUUID().slice(0, 8)}.png`);
      await page.screenshot({ path: shotAfter, fullPage: true });
      return { before, after, shotBefore, shotAfter, saveStatus: saveResp ? saveResp.status() : null };
    }

    async function runConflictPair(labelPrefix) {
      const a = await openSession(tokenA, `${labelPrefix}-A`);
      const b = await openSession(tokenB, `${labelPrefix}-B`);
      await openProductForm(a.page);
      await openProductForm(b.page);
      // Both hold same revision after hydrate — verify via API independently.
      const invBefore = await fetch(`${apiBase}/partners-portal/products/${productId}/variant-inventory`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      }).then((r) => r.json());
      const row = (invBefore.rows || []).find((r) => !variantId || r.variantId === variantId) || (invBefore.rows || [])[0];
      record(`${labelPrefix}_SHARED_REVISION`, Boolean(row && row.revision != null), {
        revision: row?.revision,
        stockQty: row?.stockQty,
        variantId: row?.variantId,
      });

      const saveA = await setStockAndSave(a.page, EXPECT_A);
      record(`${labelPrefix}_A_SAVE_UI`, !saveA.after.conflictAttr, {
        after: saveA.after,
        saveStatus: saveA.saveStatus,
        shotAfter: saveA.shotAfter,
      });

      const saveB = await setStockAndSave(b.page, EXPECT_B_LOCAL);
      const conflictUi =
        saveB.after.conflictAttr === '1' &&
        saveB.after.persistAttr === 'partial-inventory-conflict' &&
        /تعارض مراجعة|حفظ جزئي|لم يُحفظ بسبب تعارض/.test(saveB.after.statusText || '');
      const localKept = String(saveB.after.stockValue) === String(EXPECT_B_LOCAL);
      const noFullSuccess = saveB.after.hasSuccessClass !== true;
      const saveReenabled = saveB.after.saveDisabled === false && !saveB.after.formWiped;
      const noSilentAdvance = conflictUi; // conflict path must not look like full success

      record(`${labelPrefix}_B_CONFLICT_UI`, conflictUi, {
        after: saveB.after,
        shotBefore: saveB.shotBefore,
        shotAfter: saveB.shotAfter,
        note: 'attrs/message must come from app persistListing — not test inject',
      });
      record(`${labelPrefix}_B_LOCAL_QTY_KEPT`, localKept, { stockValue: saveB.after.stockValue, expect: EXPECT_B_LOCAL });
      record(`${labelPrefix}_B_NO_FULL_SUCCESS`, noFullSuccess, { hasSuccessClass: saveB.after.hasSuccessClass });
      record(`${labelPrefix}_B_SAVE_REENABLED`, saveReenabled, {
        saveDisabled: saveB.after.saveDisabled,
        formWiped: saveB.after.formWiped,
        saveText: saveB.after.saveText,
      });
      record(`${labelPrefix}_B_NO_SILENT_OVERWRITE`, noSilentAdvance && localKept, {});

      // Real review/publish paths from api.js / catalog-journey: POST .../submit-review
      const REVIEW_URL_RE = /\/partners-portal\/(products|services)\/[^/]+\/submit-review(?:\?|$)/;
      const mark = Date.now();
      // Control: prove the request monitor can see a real submit-review POST (session A, outside conflict).
      const control = await a.page.evaluate(async (pid) => {
        try {
          const r = await PartnersApi.submitReview('products', pid);
          return { ok: true, r };
        } catch (e) {
          return { ok: false, status: e && e.status, code: e && e.code, message: String(e && e.message).slice(0, 120) };
        }
      }, productId);
      await a.page.waitForTimeout(300);
      const controlHits = networkLog.filter(
        (n) => n.label === `${labelPrefix}-A` && n.phase === 'request' && n.method === 'POST' && REVIEW_URL_RE.test(n.url) && n.t >= mark,
      );
      record(`${labelPrefix}_MONITOR_CATCHES_SUBMIT_REVIEW`, controlHits.length >= 1, {
        controlHits,
        controlApi: control,
        note: 'Monitor must observe POST submit-review; API may 4xx if review preconditions unmet',
      });

      const bWrites = networkLog.filter(
        (n) =>
          n.label === `${labelPrefix}-B` &&
          n.phase === 'request' &&
          (n.url.includes('/variant-inventory') || /\/products\/[^/?]+$/.test(n.url)),
      );
      const bWindowStart = bWrites.length ? bWrites[0].t : 0;
      const reviewAfterConflict = networkLog.filter(
        (n) =>
          n.label === `${labelPrefix}-B` &&
          n.phase === 'request' &&
          n.method === 'POST' &&
          REVIEW_URL_RE.test(n.url) &&
          n.t >= bWindowStart,
      );
      record(`${labelPrefix}_B_NO_REVIEW_AFTER_CONFLICT`, reviewAfterConflict.length === 0, {
        reviewAfterConflict,
        bWriteCount: bWrites.length,
      });

      // expectedRevision on B's inventory PUT must equal the shared pre-A revision (no silent bump to A's tip).
      const invPutBodies = networkLog.filter(
        (n) =>
          n.label === `${labelPrefix}-B` &&
          n.phase === 'request' &&
          n.method === 'PUT' &&
          n.url.includes('/variant-inventory'),
      );
      const expectedRevs = [];
      for (const put of invPutBodies) {
        const rows = (put.postJson && put.postJson.rows) || [];
        for (const r of rows) {
          if (r && Object.prototype.hasOwnProperty.call(r, 'expectedRevision')) expectedRevs.push(r.expectedRevision);
        }
      }
      // B must still send the shared pre-A revision — never the advanced tip after A's save.
      const revOk =
        expectedRevs.length > 0 && expectedRevs.every((r) => Number(r) === Number(row.revision));
      record(`${labelPrefix}_B_EXPECTED_REVISION_STALE`, revOk, {
        expectedRevs,
        sharedRevision: row?.revision,
        invPutReqCount: invPutBodies.length,
      });

      const invAfter = await fetch(`${apiBase}/partners-portal/products/${productId}/variant-inventory`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      }).then((r) => r.json());
      const finalRow =
        (invAfter.rows || []).find((r) => r.variantId === (row?.variantId || variantId)) || (invAfter.rows || [])[0];
      record(`${labelPrefix}_SERVER_KEEPS_A`, finalRow?.stockQty === EXPECT_SERVER_AFTER, {
        stockQty: finalRow?.stockQty,
        expect: EXPECT_SERVER_AFTER,
        revision: finalRow?.revision,
      });
      record(
        `${labelPrefix}_B_DID_NOT_ADVANCE_TO_SERVER_TIP`,
        revOk && finalRow?.revision != null && !expectedRevs.includes(finalRow.revision),
        { serverTip: finalRow?.revision, expectedRevs },
      );

      await a.ctx.close();
      await b.ctx.close();
      return { conflictUi, finalRow };
    }

    await runConflictPair('BRAND');

    if (coverDeveloper) {
      const dev = await seedFixture(prisma, { developer: true });
      cleanups.push(dev.cleanup);
      tokenA = dev.token;
      tokenB = dev.token;
      productId = dev.productId;
      variantId = dev.variantId;
      record('SEED_DEVELOPER', true, { productIdSuffix: productId.slice(-8) });
      await runConflictPair('DEV');
    }

    await browser.close().catch(() => undefined);
    server.close();
  } finally {
    for (const c of cleanups.reverse()) {
      try {
        await c();
      } catch {
        /* ignore */
      }
    }
    await prisma.$disconnect().catch(() => undefined);
  }

  writeFileSync(join(outDir, 'network', 'trace.json'), JSON.stringify(networkLog, null, 2));
  const failed = steps.filter((s) => s.ok === false);
  const summary = {
    ok: failed.length === 0,
    blocked: false,
    id: 'P31_UI_INVENTORY_CONFLICT_BROWSER',
    commit,
    runId,
    startedUtc,
    finishedUtc: new Date().toISOString(),
    steps,
    outDir,
    method: 'real-form-save-dual-session',
    shaEvidenceNote: 'Screenshots + network trace retained; success requires conflict attrs from app code',
  };
  writeFileSync(join(outDir, 'inventory-conflict-browser.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, 'verdict.txt'), summary.ok ? 'PASS\n' : 'FAIL\n');
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), outDir, runId }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  writeFileSync(
    join(outDir, 'inventory-conflict-browser.json'),
    JSON.stringify({ ok: false, error: String(e?.stack || e), runId }, null, 2),
  );
  writeFileSync(join(outDir, 'verdict.txt'), 'FAIL\n');
  process.exit(2);
});
