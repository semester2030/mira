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
  // Cover image via approved partners-portal upload path (stores bytes + DB row).
  // Do NOT insert a catalogMedia row pointing at a missing storage object.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const mediaRes = await fetch(`${apiBase}/partners-portal/products/${product.id}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      mimeType: 'image/png',
      dataBase64: png.toString('base64'),
      placement: 'main',
    }),
  });
  const mediaBody = await mediaRes.json().catch(() => ({}));
  if (!mediaRes.ok || !mediaBody?.id) {
    throw new Error(`cover upload failed status=${mediaRes.status} body=${JSON.stringify(mediaBody).slice(0, 200)}`);
  }
  // Partner media GET must return real bytes (proves storage object exists).
  const readRes = await fetch(`${apiBase}/partners-portal/media/${mediaBody.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const readBuf = Buffer.from(await readRes.arrayBuffer());
  if (!readRes.ok || readBuf.length !== png.length || readBuf.compare(png) !== 0) {
    throw new Error(
      `cover not readable status=${readRes.status} len=${readBuf.length} expect=${png.length}`,
    );
  }
  return {
    token,
    productId: product.id,
    variantId,
    partnerId: partner.id,
    partnerUserId: pu.id,
    email: pu.email,
    developer: Boolean(developer),
    hasCoverImage: true,
    coverMediaId: mediaBody.id,
    coverSha256: createHash('sha256').update(png).digest('hex'),
    coverBytes: png.length,
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
        coverMediaId: seeded.coverMediaId,
        coverBytes: seeded.coverBytes,
        coverSha256: seeded.coverSha256,
      });
      record('BRAND_COVER_MEDIA_READABLE_API', true, {
        mediaId: seeded.coverMediaId,
        bytes: seeded.coverBytes,
        sha256: seeded.coverSha256,
        note: 'GET /partners-portal/media/:id matched PNG fixture bytes',
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
      // Cover image must load in UI (element alone is insufficient — require naturalWidth / completed).
      const coverUi = await a.page.evaluate(async () => {
        const imgs = [...document.querySelectorAll('#catalogForm img, #catalogForm [data-testid="catalog-media"] img')];
        const results = [];
        for (const img of imgs) {
          if (!(img instanceof HTMLImageElement)) continue;
          if (!img.complete) {
            await new Promise((res) => {
              img.addEventListener('load', () => res(null), { once: true });
              img.addEventListener('error', () => res(null), { once: true });
              setTimeout(() => res(null), 4000);
            });
          }
          results.push({
            src: String(img.currentSrc || img.src || '').slice(0, 120),
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          });
        }
        return results;
      });
      const coverLoaded = coverUi.some((i) => i.complete && i.naturalWidth > 0);
      record(`${labelPrefix}_COVER_IMAGE_LOADED_UI`, coverLoaded, { coverUi });

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

      // Real review/publish paths: POST .../submit-review (UI button — not page.evaluate as sole proof).
      const REVIEW_URL_RE = /\/partners-portal\/(products|services)\/[^/]+\/submit-review(?:\?|$)/;
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

      // Healthy control AFTER conflict window: prove monitor sees real UI-triggered submit-review
      // on a publish-eligible product (cover image seeded). Conflict must not be why review is absent.
      const mark = Date.now();
      let controlOk = false;
      let controlDetail = {};
      try {
        // Image must decode in the UI — presence of an <img> tag alone is insufficient.
        const imgOk = await a.page.evaluate(async () => {
          const imgs = [...document.querySelectorAll('#catalogForm img, [data-testid="catalog-media"] img, .media-thumb img')];
          if (!imgs.length) return { ok: false, reason: 'no-img' };
          const results = await Promise.all(
            imgs.slice(0, 4).map(
              (img) =>
                new Promise((resolve) => {
                  const done = () =>
                    resolve({
                      src: String(img.getAttribute('src') || '').slice(0, 120),
                      complete: img.complete,
                      naturalWidth: img.naturalWidth,
                    });
                  if (img.complete) done();
                  else {
                    img.addEventListener('load', done, { once: true });
                    img.addEventListener('error', () => resolve({ src: String(img.src || '').slice(0, 120), complete: true, naturalWidth: 0 }), {
                      once: true,
                    });
                    setTimeout(done, 4000);
                  }
                }),
            ),
          );
          return { ok: results.some((r) => r.naturalWidth > 0), results };
        });
        record(`${labelPrefix}_COVER_IMAGE_DECODED_IN_UI`, Boolean(imgOk && imgOk.ok), imgOk || { ok: false });

        // Exact CTAs only — do NOT match MiraEditorV2 «تحويل المسودة…وإرسال للمراجعة» (false positive).
        // Developer primary is #catalogForm-save (label may be «نشر الآن» or «تم الحفظ» after prior publish).
        const isDev = labelPrefix === 'DEV';
        const publishBtn = isDev
          ? a.page.locator('#catalogForm-save').first()
          : a.page.locator('#catalogForm button.btn-ghost', { hasText: /^إرسال للمراجعة$/ }).first();
        await publishBtn.waitFor({ state: 'visible', timeout: 10000 });
        // Align stock with server tip so inventory PUT succeeds and review can proceed.
        await a.page.locator('[data-testid="variant-stock-qty"]').first().fill(String(EXPECT_A));
        const reviewRespPromise = a.page.waitForResponse(
          (r) =>
            r.request().method() === 'POST' &&
            /\/partners-portal\/(products|services)\/[^/]+\/submit-review(?:\?|$)/.test(r.url()),
          { timeout: 20000 },
        );
        await publishBtn.click();
        let reviewResp = null;
        try {
          reviewResp = await reviewRespPromise;
        } catch {
          reviewResp = null;
        }
        await a.page.waitForTimeout(800);
        const controlHits = networkLog.filter(
          (n) =>
            n.label === `${labelPrefix}-A` &&
            n.phase === 'request' &&
            n.method === 'POST' &&
            REVIEW_URL_RE.test(n.url) &&
            n.t >= mark,
        );
        const controlResps = networkLog.filter(
          (n) =>
            n.label === `${labelPrefix}-A` &&
            n.phase === 'response' &&
            n.method === 'POST' &&
            REVIEW_URL_RE.test(n.url) &&
            n.t >= mark,
        );
        const reviewStatus = reviewResp ? reviewResp.status() : null;
        controlOk =
          controlHits.length >= 1 &&
          ((reviewStatus != null && reviewStatus >= 200 && reviewStatus < 300) ||
            controlResps.some((r) => r.status >= 200 && r.status < 300));
        controlDetail = {
          controlHits,
          controlResps,
          reviewStatus,
          btnMode: isDev ? 'developer-save-publish' : 'brand-ghost-submit-review',
          note: 'UI button must trigger submit-review with 2xx on publish-eligible product',
        };
      } catch (e) {
        controlDetail = { error: String(e?.message || e).slice(0, 200) };
      }
      record(`${labelPrefix}_MONITOR_CATCHES_SUBMIT_REVIEW`, controlOk, controlDetail);
      // Conflict path must still show zero review posts in B's write window (independent of control).
      record(
        `${labelPrefix}_CONFLICT_BLOCKED_REVIEW_NOT_IMAGE`,
        reviewAfterConflict.length === 0 && controlOk,
        { reviewAfterConflict, controlOk },
      );

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
      record('SEED_DEVELOPER', true, {
        productIdSuffix: productId.slice(-8),
        coverMediaId: dev.coverMediaId,
        coverBytes: dev.coverBytes,
        coverSha256: dev.coverSha256,
      });
      record('DEV_COVER_MEDIA_READABLE_API', true, {
        mediaId: dev.coverMediaId,
        bytes: dev.coverBytes,
        sha256: dev.coverSha256,
      });
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
