/**
 * P2.1/P2.2 strict partners-portal journeys + real multi-part resume after reload.
 *
 * Rules (independent review):
 * - User steps run via portal UI only (click/type/file). No CatalogJourney.renderForm /
 *   PartnersApi.uploadViaSession as substitutes for those steps.
 * - API allowed for setup accounts, admin approve, and read-back verification.
 * - Resume must prove interrupt BEFORE ready (completedParts > 0 && < totalParts).
 * - Real page.reload(); reopen via «فتح في النموذج»; re-pick same file if needed.
 * - Missing UI / unexpected 4xx-5xx / silent catch → FAIL. No submitViaUi hardcoded true.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const fixturesDir = join(root, 'mira-api', 'src', 'partners-portal', 'upload-sessions', 'fixtures');
const outDir = process.env.MIRA_P21_OUT_DIR || join(root, 'audit-out', 'p2-1-p2-2', 'logs', 'portal-journey');
const shotsDir = join(outDir, 'screens');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PNG2 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF+FAP5IDveKW/d6AAAAAElFTkSuQmCC',
  'base64',
);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

function assertLocalDb(url) {
  const u = new URL(url);
  if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') throw new Error(`REFUSE host ${u.hostname}`);
  return { host: u.hostname, db: u.pathname.replace(/^\//, '').split('?')[0] };
}

function serveStatic(port) {
  const server = createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
    if (rel === '/') rel = '/index.html';
    const file = join(webRoot, rel.replace(/^\//, ''));
    if (!file.startsWith(webRoot) || !existsSync(file)) {
      res.writeHead(404);
      res.end('nf');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

function attachNet(page, apiBase) {
  const net = [];
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/api/v1/')) {
      net.push({
        t: new Date().toISOString(),
        method: req.method(),
        url: u.replace(apiBase, ''),
        status: null,
      });
    }
  });
  page.on('response', (res) => {
    const u = res.url();
    if (!u.includes('/api/v1/')) return;
    const path = u.replace(apiBase, '');
    const hit = [...net].reverse().find((n) => path === n.url || u.includes(n.url.replace(/^\//, '')));
    if (hit && hit.status == null) hit.status = res.status();
  });
  return net;
}

async function login(page, loginUrl, email, password) {
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL(/dashboard\.html/, { timeout: 25000 }), page.click('button[type="submit"]')]);
  await page.waitForTimeout(800);
}

async function requireClick(page, locator, label) {
  const n = await locator.count();
  if (n === 0) throw new Error(`UI missing required control: ${label}`);
  await locator.first().click();
}

async function openInForm(page, nameAr) {
  const item = page.locator('#catalogList .list-item').filter({ hasText: nameAr });
  if ((await item.count()) === 0) throw new Error(`list item missing for ${nameAr}`);
  const open = item.locator('button').filter({ hasText: /^فتح في النموذج$/ });
  if ((await open.count()) === 0) throw new Error('فتح في النموذج button missing');
  await open.first().click();
  await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 });
}

async function materializeOwner(page) {
  const mat = page.locator('#catalogForm [data-editor-v2-materialize]');
  if ((await mat.count()) === 0) throw new Error('materialize button missing — required UI step');
  await mat.click();
  await page.waitForFunction(() => {
    try {
      const ctx = window.MiraEditorV2 && MiraEditorV2.getEditContext('catalogForm');
      return ctx && ctx.targetOwnerId;
    } catch {
      return false;
    }
  }, { timeout: 45000 });
  await page.waitForTimeout(1200);
  return page.evaluate(() => MiraEditorV2.getEditContext('catalogForm').targetOwnerId);
}

async function uiUploadPng(page, name, buffer) {
  const file = page.locator('#catalogForm input[type="file"]').first();
  if ((await file.count()) === 0) throw new Error('media input missing');
  await file.setInputFiles({ name, mimeType: 'image/png', buffer });
  await page.waitForTimeout(2500);
}

async function uiUploadVideo(page, name, buffer) {
  const videoInput = page.locator('#catalogForm input[type="file"][accept*="video"], #catalogForm input[type="file"]').nth(1);
  const file = (await videoInput.count()) > 0 ? videoInput.first() : page.locator('#catalogForm input[type="file"]').first();
  if ((await file.count()) === 0) throw new Error('video/file input missing');
  await file.setInputFiles({ name, mimeType: 'video/mp4', buffer });
}

async function waitReadyMedia(apiBase, token, kind, id, min = 1, timeout = 180000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeout) {
    const preview = await (
      await fetch(`${apiBase}/partners-portal/${kind}/${id}/preview`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).json();
    last = preview;
    const ready = (preview.media || []).filter((m) => m.ready === true && !m.pendingRemoval);
    if (ready.length >= min) return { preview, ready };
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`READY timeout for ${kind}/${id} media=${JSON.stringify((last && last.media) || [])}`);
}

async function getSession(apiBase, token, sessionId) {
  const res = await fetch(`${apiBase}/partners-portal/upload-sessions/${sessionId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`getSession HTTP ${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function uiSubmitReview(page, net) {
  const before = net.length;
  let submitBtn = page.locator('#catalogForm button').filter({
    hasText: /^(إرسال للمراجعة|نشر الآن|استئناف الإرسال للمراجعة)$/,
  });
  if ((await submitBtn.count()) === 0) {
    submitBtn = page.locator('#catalogForm [data-editor-v2-materialize]').filter({
      hasText: /استئناف الإرسال للمراجعة/,
    });
  }
  if ((await submitBtn.count()) === 0) throw new Error('submit/publish button missing');
  const btn = submitBtn.last();
  await btn.scrollIntoViewIfNeeded();
  const [resp] = await Promise.all([
    page
      .waitForResponse((r) => r.request().method() === 'POST' && /submit-review|materialize/.test(r.url()), {
        timeout: 25000,
      })
      .catch(() => null),
    btn.click({ force: true }),
  ]);
  await page.waitForTimeout(2000);
  const posts = net.slice(before).filter((n) => n.method === 'POST' && /submit-review|\/materialize/.test(n.url));
  const submitPosts = posts.filter((n) => /submit-review/.test(n.url));
  if (!submitPosts.length && !posts.some((n) => /materialize/.test(n.url))) {
    throw new Error('UI submit did not issue submit-review/materialize; resp=' + (resp ? resp.status() : 'null'));
  }
  const status = submitPosts.length
    ? submitPosts[submitPosts.length - 1].status
    : resp
      ? resp.status()
      : posts[posts.length - 1].status;
  if (status == null) throw new Error('submit response status unknown');
  if (status >= 400) throw new Error(`submit-review HTTP ${status}`);
  return { status, viaUi: true, posts: submitPosts.length ? submitPosts : posts };
}

async function adminApprove(apiBase, adminKey, kind, id, token) {
  const me = await (await fetch(`${apiBase}/partners-portal/me`, { headers: { authorization: `Bearer ${token}` } })).json();
  const list =
    kind === 'product' ? me.partner?.products || me.catalog?.products : me.partner?.services || me.catalog?.services;
  const live = (list || []).find((x) => x.id === id);
  const rev = live?.submittedRevision ?? live?.reviewRevision;
  if (rev == null) throw new Error('no submittedRevision for approve');
  const res = await fetch(`${apiBase}/admin/catalog-reviews/${kind}/${id}/decision`, {
    method: 'POST',
    headers: { 'x-admin-key': adminKey, 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'approve', revision: rev }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`approve HTTP ${res.status} ${JSON.stringify(body)}`);
  return { status: res.status, body, rev };
}

async function saveDraft(page) {
  const save = page.locator('#catalogForm button[type="submit"], #catalogForm-save').filter({ hasText: /حفظ المسودة|نشر الآن/ });
  if ((await save.count()) === 0) throw new Error('save draft button missing');
  await save.first().click();
  await page.waitForTimeout(2000);
}

async function assertPreviewPanel(page, expectName) {
  const panel = page.locator('#catalogForm').locator('text=المعاينة والنشر').locator('..');
  const body = page.locator('#catalogForm').getByText(new RegExp(expectName));
  if ((await body.count()) === 0) {
    // preview is live-updated on input — read preview section text
    const text = await page.locator('#catalogForm').innerText();
    if (!text.includes(expectName)) throw new Error('preview panel missing expected name: ' + expectName);
  }
  return true;
}

async function mediaOrderAndCover(preview) {
  const ready = (preview.media || []).filter((m) => m.ready && !m.pendingRemoval);
  const sorted = [...ready].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const cover = ready.find((m) => m.draftIsPrimary === true || (m.draftIsPrimary == null && m.isPrimary));
  return {
    ids: sorted.map((m) => m.id),
    coverId: cover ? cover.id : null,
  };
}

async function main() {
  const dbMeta = assertLocalDb(process.env.DATABASE_URL || '');
  const commit = process.env.MIRA_P21_COMMIT || 'unknown';
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
  process.env.MIRA_UPLOAD_PART_SIZE_BYTES = process.env.MIRA_UPLOAD_PART_SIZE_BYTES || '262144';
  process.env.MIRA_UPLOAD_FINALIZE_MAX_ATTEMPTS = process.env.MIRA_UPLOAD_FINALIZE_MAX_ATTEMPTS || '3';
  process.env.MIRA_UPLOAD_FINALIZE_RETRY_BASE_MS = process.env.MIRA_UPLOAD_FINALIZE_RETRY_BASE_MS || '200';
  process.env.MIRA_UPLOAD_FINALIZE_RETRY_MAX_MS = process.env.MIRA_UPLOAD_FINALIZE_RETRY_MAX_MS || '800';

  const startedUtc = new Date().toISOString();
  const child = spawn('npx', ['tsx', 'scripts/p2-closure-browser-server.ts'], {
    cwd: join(root, 'mira-api'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('API timeout\n' + buf)), 90000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      for (const line of buf.split('\n')) {
        if (!line.includes('"ready"')) continue;
        try {
          const j = JSON.parse(line.trim());
          if (j.ready) {
            clearTimeout(t);
            resolve(j);
          }
        } catch (_) {}
      }
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (c) => reject(new Error('API exit ' + c + '\n' + buf)));
  });

  const portalPort = 8878;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const dashUrl = `http://127.0.0.1:${portalPort}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const cases = [];
  const record = (id, ok, detail) => {
    cases.push({ id, ok: ok ? 'PASS' : 'FAIL', detail, utc: new Date().toISOString(), commit });
    console.log(JSON.stringify({ id, ok: ok ? 'PASS' : 'FAIL', detail }));
  };

  const videoPath = join(fixturesDir, 'valid-multipart.mp4');
  if (!existsSync(videoPath)) throw new Error('missing fixture valid-multipart.mp4 — see README / generate-u11-video.sh siblings');
  const videoBuf = readFileSync(videoPath);
  const videoSha = createHash('sha256').update(videoBuf).digest('hex');
  const partSize = Number(process.env.MIRA_UPLOAD_PART_SIZE_BYTES || 262144);
  const expectedParts = Math.ceil(videoBuf.length / partSize);
  if (expectedParts < 2) throw new Error(`fixture too small for multi-part: bytes=${videoBuf.length} partSize=${partSize}`);

  try {
    // ========== PRODUCT JOURNEY (UI only) ==========
    {
      const productName = 'منتج رحلة P2';
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      const net = attachNet(page, apiBase);
      await login(page, loginUrl, ready.brandEmail, ready.password);
      await requireClick(page, page.locator('#goProduct'), '#goProduct');
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 });
      await page.fill('#catalogForm [name="nameAr"]', productName);
      await page.fill('#catalogForm [name="priceSar"]', '55');
      const cat = page.locator('#catalogForm [name="category"]');
      if ((await cat.count()) === 0) throw new Error('category missing');
      await cat.selectOption('clothes');

      // Options + one variant via UI (clothes → size presets)
      const sizeM = page.locator('#catalogForm .option-group label').filter({ hasText: /^\s*M\s*$/ });
      if ((await sizeM.count()) === 0) throw new Error('size M checkbox missing for clothes');
      await sizeM.locator('input[type="checkbox"]').check();
      await page.waitForTimeout(400);
      const pick = page.locator('#catalogForm select[name="variantPick-size"]');
      if ((await pick.count()) === 0) throw new Error('variant size picker missing');
      await pick.selectOption({ index: 1 });
      const addVar = page.locator('#catalogForm button').filter({ hasText: /^إضافة التركيبة$/ });
      if ((await addVar.count()) === 0) throw new Error('إضافة التركيبة missing');
      await addVar.click();
      await page.waitForTimeout(400);
      // Flush options/variant into server draft before materialize (dedicated save, not API substitute).
      await saveDraft(page);

      const productId = await materializeOwner(page);
      const token = await page.evaluate(() => localStorage.getItem('mira_partner_token'));

      await uiUploadPng(page, 'p2-a.png', PNG);
      await waitReadyMedia(apiBase, token, 'products', productId, 1);
      const submitBefore = net.filter((n) => n.method === 'POST' && /submit-review/.test(n.url)).length;
      await uiUploadPng(page, 'p2-b.png', PNG2);
      await page.waitForTimeout(8000);
      let { preview, ready: readyMedia } = await waitReadyMedia(apiBase, token, 'products', productId, 2);
      const submitAfterUpload = net.filter((n) => n.method === 'POST' && /submit-review/.test(n.url)).length;
      if (submitAfterUpload > submitBefore) throw new Error('auto submit-review on upload');

      // Cover = last READY image; reorder so cover moves if needed
      const coverBtn = page.locator('#catalogForm button').filter({ hasText: /^غلاف$/ });
      if ((await coverBtn.count()) === 0) throw new Error('cover button missing');
      await coverBtn.last().click();
      await page.waitForTimeout(1000);
      const enabledUp = await page.locator('#catalogForm button:not([disabled])').filter({ hasText: /^أعلى$/ }).count();
      if (enabledUp > 0) {
        await page.locator('#catalogForm button:not([disabled])').filter({ hasText: /^أعلى$/ }).first().click();
      } else {
        const down = page.locator('#catalogForm button:not([disabled])').filter({ hasText: /^أسفل$/ });
        if ((await down.count()) === 0) throw new Error('reorder أعلى/أسفل unavailable');
        await down.first().click();
      }
      await page.waitForTimeout(1000);

      preview = (
        await (
          await fetch(`${apiBase}/partners-portal/products/${productId}/preview`, {
            headers: { authorization: `Bearer ${token}` },
          })
        ).json()
      );
      const beforePersist = await mediaOrderAndCover(preview);
      if (!beforePersist.coverId) throw new Error('cover id not set after غلاف click');
      if (beforePersist.ids.length < 2) throw new Error('need 2 ready media for order proof');

      // Bind known media to variant via UI
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await openInForm(page, productName);
      await page.waitForTimeout(1500);
      const bindSelect = page.locator('.variant-media-row select, select[aria-label*="تركيبة"]');
      if ((await bindSelect.count()) === 0) throw new Error('variant media select missing');
      const bindMediaId = beforePersist.coverId;
      await bindSelect.first().evaluate((sel, id) => {
        let found = false;
        for (const o of sel.options) {
          o.selected = o.value === id;
          if (o.value === id) found = true;
        }
        if (!found) throw new Error('ready media not in select options');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }, bindMediaId);
      const saveBind = page.locator('button').filter({ hasText: /حفظ ربط التركيبة/ });
      if ((await saveBind.count()) === 0) throw new Error('save bind button missing');
      const [bindResp] = await Promise.all([
        page
          .waitForResponse((r) => r.request().method() === 'PATCH' && /variants\/.+\/media/.test(r.url()), {
            timeout: 15000,
          })
          .catch(() => null),
        saveBind.first().click(),
      ]);
      if (!bindResp) throw new Error('bind save did not issue variants/.../media PATCH');
      if (bindResp.status() >= 400) throw new Error(`bind PATCH HTTP ${bindResp.status()}`);
      await page.waitForTimeout(1000);
      // Do NOT general-save after bind — persistListing can rewrite variants without mediaIds.
      await assertPreviewPanel(page, productName);
      const midBind = await (
        await fetch(`${apiBase}/partners-portal/products/${productId}/preview`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).json();
      const boundNow = (midBind.draftVariantsJson || midBind.publishedVariantsJson || midBind.variantsJson || []).some(
        (v) => (v.mediaIds || []).includes(bindMediaId),
      );
      if (!boundNow) {
        throw new Error(
          'bind not visible on preview immediately after save: ' +
            JSON.stringify({
              draftSet: midBind.draftVariantsSet,
              draft: midBind.draftVariantsJson,
              published: midBind.publishedVariantsJson,
              variants: midBind.variantsJson,
            }),
        );
      }

      // Reload + reopen via list button; compare cover/order/bind
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await openInForm(page, productName);
      await page.waitForTimeout(1500);
      const after = await (
        await fetch(`${apiBase}/partners-portal/products/${productId}/preview`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).json();
      const afterPersist = await mediaOrderAndCover(after);
      if (afterPersist.coverId !== beforePersist.coverId) {
        throw new Error(`cover not persisted: before=${beforePersist.coverId} after=${afterPersist.coverId}`);
      }
      if (afterPersist.ids.join(',') !== beforePersist.ids.join(',')) {
        throw new Error(`order not persisted: before=${beforePersist.ids} after=${afterPersist.ids}`);
      }
      const bound = (after.draftVariantsJson || after.publishedVariantsJson || after.variantsJson || []).some((v) =>
        (v.mediaIds || []).includes(bindMediaId),
      );
      if (!bound) throw new Error('variant bind not persisted after reload');

      const prePub = await fetch(`${apiBase}/marketplace/media/${bindMediaId}`);
      if (prePub.status !== 404) {
        throw new Error(`unpublished media expected HTTP 404, got ${prePub.status}`);
      }

      const submit = await uiSubmitReview(page, net);
      const approve = await adminApprove(apiBase, ready.adminKey, 'product', productId, token);
      const pubMedia = await fetch(`${apiBase}/marketplace/media/${bindMediaId}`);
      if (!pubMedia.ok) throw new Error(`public media after approve HTTP ${pubMedia.status}`);
      const pubBytes = Buffer.from(await pubMedia.arrayBuffer());
      if (pubBytes.length < 1) throw new Error('public media empty body');
      const meAfter = await (
        await fetch(`${apiBase}/partners-portal/me`, { headers: { authorization: `Bearer ${token}` } })
      ).json();
      const row = (meAfter.partner?.products || meAfter.catalog?.products || []).find((x) => x.id === productId);
      if (!row || (row.contentStatus !== 'published' && row.reviewStatus !== 'approved' && row.publication !== 'published')) {
        // Accept common published markers
        if (!(row && (row.reviewStatus === 'approved' || row.contentStatus === 'live' || row.contentStatus === 'published'))) {
          throw new Error('product not published after approve: ' + JSON.stringify(row && { contentStatus: row.contentStatus, reviewStatus: row.reviewStatus }));
        }
      }

      await page.screenshot({ path: join(shotsDir, 'product-final.png'), fullPage: true });
      record('JOURNEY_PRODUCT', true, {
        productId,
        readyCount: readyMedia.length,
        coverId: afterPersist.coverId,
        orderIds: afterPersist.ids,
        bound,
        approveStatus: approve.status,
        submitViaUi: submit.viaUi === true && submit.status < 400,
        submitHttp: submit.status,
        publicMedia: pubMedia.status,
        publicBytes: pubBytes.length,
        unpublishedBefore: prePub.status,
      });
      await ctx.close();
    }

    // ========== SERVICE JOURNEY (UI only, 2 media for reorder) ==========
    {
      const serviceName = 'خدمة رحلة P2';
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      const net = attachNet(page, apiBase);
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await requireClick(page, page.locator('#goService'), '#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 });
      await page.fill('#catalogForm [name="nameAr"]', serviceName);
      await page.fill('#catalogForm [name="priceSar"]', '90');
      await page.fill('#catalogForm [name="durationMin"]', '45');
      const tpl = page.locator('#catalogForm select[name="serviceTemplateId"]');
      if ((await tpl.count()) === 0) throw new Error('serviceTemplateId missing');
      const vals = await tpl.locator('option').evaluateAll((n) => n.map((x) => x.value).filter(Boolean));
      if (!vals.length) throw new Error('no service templates');
      await tpl.selectOption(vals.find((v) => v === 'salon_hair_cut') || vals[0]);
      await page.waitForTimeout(500);
      const pm = page.locator('#catalogForm select[name="priceMode"]');
      if ((await pm.count()) === 0) throw new Error('priceMode missing');
      await pm.selectOption('fixed');
      const single = page.locator('#catalogForm input[type="radio"][value="single"]').first();
      if ((await single.count()) > 0) await single.check();

      const serviceId = await materializeOwner(page);
      const sToken = await page.evaluate(() => localStorage.getItem('mira_partner_token'));
      await uiUploadPng(page, 'svc-a.png', PNG);
      await waitReadyMedia(apiBase, sToken, 'services', serviceId, 1);
      await uiUploadPng(page, 'svc-b.png', PNG2);
      await waitReadyMedia(apiBase, sToken, 'services', serviceId, 2);

      const coverBtn = page.locator('#catalogForm button').filter({ hasText: /^غلاف$/ });
      if ((await coverBtn.count()) === 0) throw new Error('service cover button missing');
      await coverBtn.last().click();
      await page.waitForTimeout(800);
      const enabledUp = await page.locator('#catalogForm button:not([disabled])').filter({ hasText: /^أعلى$/ }).count();
      if (enabledUp > 0) {
        await page.locator('#catalogForm button:not([disabled])').filter({ hasText: /^أعلى$/ }).first().click();
      } else {
        const down = page.locator('#catalogForm button:not([disabled])').filter({ hasText: /^أسفل$/ });
        if ((await down.count()) === 0) throw new Error('service reorder unavailable');
        await down.first().click();
      }
      await page.waitForTimeout(1000);
      let preview = await (
        await fetch(`${apiBase}/partners-portal/services/${serviceId}/preview`, {
          headers: { authorization: `Bearer ${sToken}` },
        })
      ).json();
      const beforePersist = await mediaOrderAndCover(preview);
      if (!beforePersist.coverId || beforePersist.ids.length < 2) throw new Error('service cover/order not set');

      await saveDraft(page);
      await assertPreviewPanel(page, serviceName);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await openInForm(page, serviceName);
      await page.waitForTimeout(1500);
      preview = await (
        await fetch(`${apiBase}/partners-portal/services/${serviceId}/preview`, {
          headers: { authorization: `Bearer ${sToken}` },
        })
      ).json();
      const afterPersist = await mediaOrderAndCover(preview);
      if (afterPersist.coverId !== beforePersist.coverId) {
        throw new Error(`service cover not persisted: ${beforePersist.coverId}→${afterPersist.coverId}`);
      }
      if (afterPersist.ids.join(',') !== beforePersist.ids.join(',')) {
        throw new Error(`service order not persisted: ${beforePersist.ids}→${afterPersist.ids}`);
      }

      const prePub = await fetch(`${apiBase}/marketplace/media/${afterPersist.coverId}`);
      if (prePub.status !== 404) throw new Error(`service unpublished expected 404 got ${prePub.status}`);

      const submit = await uiSubmitReview(page, net);
      const approve = await adminApprove(apiBase, ready.adminKey, 'service', serviceId, sToken);
      const pub = await fetch(`${apiBase}/marketplace/media/${afterPersist.coverId}`);
      if (!pub.ok) throw new Error(`service public media HTTP ${pub.status}`);
      const pubBytes = Buffer.from(await pub.arrayBuffer());
      if (pubBytes.length < 1) throw new Error('service public media empty');

      await page.screenshot({ path: join(shotsDir, 'service-final.png'), fullPage: true });
      record('JOURNEY_SERVICE', true, {
        serviceId,
        readyCount: afterPersist.ids.length,
        coverId: afterPersist.coverId,
        orderIds: afterPersist.ids,
        approveStatus: approve.status,
        submitViaUi: submit.viaUi === true && submit.status < 400,
        submitHttp: submit.status,
        publicMedia: pub.status,
        publicBytes: pubBytes.length,
        unpublishedBefore: prePub.status,
      });
      await ctx.close();
    }

    // ========== C04 developer: open via UI, file select ≠ publish ==========
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      const dnet = attachNet(page, apiBase);
      await login(page, loginUrl, ready.developerEmail, ready.password);
      const dToken = await page.evaluate(() => localStorage.getItem('mira_partner_token'));
      const created = await (
        await fetch(`${apiBase}/partners-portal/products`, {
          method: 'POST',
          headers: { authorization: `Bearer ${dToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            nameAr: 'منتج مطوّر P2',
            nameEn: 'Dev P2',
            priceHalalas: 4000,
            category: 'face',
            externalUrl: 'https://example.com/dev-p2',
            concernTags: [],
            skinTypes: [],
          }),
        })
      ).json();
      const devOwner = created?.id;
      if (!devOwner) throw new Error('dev create failed');
      await page.goto(dashUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await openInForm(page, 'منتج مطوّر P2');
      await page.waitForSelector('#catalogForm input[type="file"]', { timeout: 15000 });
      const beforeLen = dnet.length;
      await page.locator('#catalogForm input[type="file"]').first().setInputFiles({
        name: 'dev-b.png',
        mimeType: 'image/png',
        buffer: PNG2,
      });
      await page.waitForTimeout(12000);
      const autoPub = dnet.slice(beforeLen).filter((n) => n.method === 'POST' && /submit-review/.test(n.url));
      const statusText = await page.locator('#catalogForm').innerText();
      const draftMsg = /جاهزًا في المسودة|اضغط «نشر الآن»|رُفع/.test(statusText);
      const preview = await (
        await fetch(`${apiBase}/partners-portal/products/${devOwner}/preview`, {
          headers: { authorization: `Bearer ${dToken}` },
        })
      ).json();
      const mediaReady = (preview.media || []).some((m) => m.ready);
      const pubBtn = page.locator('#catalogForm button').filter({ hasText: /نشر الآن/ });
      if ((await pubBtn.count()) === 0) throw new Error('developer publish button missing');
      const before = dnet.length;
      await pubBtn.first().click();
      await page.waitForTimeout(2500);
      const explicitPosts = dnet.slice(before).filter((n) => n.method === 'POST' && /submit-review/.test(n.url));
      const explicit = explicitPosts.length > 0 && explicitPosts.every((p) => p.status != null && p.status < 400);
      await page.screenshot({ path: join(shotsDir, 'developer-c04.png'), fullPage: true });
      record('C04', autoPub.length === 0 && draftMsg && mediaReady && explicit, {
        publishAfterUpload: autoPub.length,
        draftMsg,
        mediaReady,
        explicitPublish: explicit,
        explicitStatuses: explicitPosts.map((p) => p.status),
        openedVia: 'فتح في النموذج',
        devOwner,
      });
      await ctx.close();
    }

    // ========== RESUME: real interrupt + page.reload + UI re-pick ==========
    {
      const productName = 'منتج استئناف P2';
      const timeline = [];
      const pushT = (event, data) => timeline.push({ t: new Date().toISOString(), event, ...data });
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      const net = attachNet(page, apiBase);
      await login(page, loginUrl, ready.brandEmail, ready.password);
      const token = await page.evaluate(() => localStorage.getItem('mira_partner_token'));
      await requireClick(page, page.locator('#goProduct'), '#goProduct');
      await page.fill('#catalogForm [name="nameAr"]', productName);
      await page.fill('#catalogForm [name="priceSar"]', '70');
      await page.locator('#catalogForm [name="category"]').selectOption('face');
      const ownerId = await materializeOwner(page);
      pushT('owner', { ownerId });

      // Deterministic block of parts > 1
      let blockPartsAbove = 1;
      await page.route('**/direct-parts/**', async (route) => {
        const m = route.request().url().match(/direct-parts\/(\d+)/);
        const n = m ? Number(m[1]) : 0;
        if (blockPartsAbove > 0 && n > blockPartsAbove) {
          pushT('part_blocked', { part: n });
          await route.abort('failed');
          return;
        }
        await route.continue();
      });

      // Instrument upload errors for mismatch proof
      await page.evaluate(() => {
        window.__lastUploadError = null;
        const orig = PartnersApi.uploadViaSession.bind(PartnersApi);
        PartnersApi.uploadViaSession = async function wrapped(...args) {
          try {
            return await orig(...args);
          } catch (e) {
            window.__lastUploadError = { code: e && e.code, message: e && e.message, name: e && e.name };
            throw e;
          }
        };
      });

      let sessionId = null;
      page.on('response', async (res) => {
        try {
          const u = res.url();
          if (res.request().method() === 'POST' && /\/upload-sessions\/?$/.test(u.split('?')[0]) && res.ok()) {
            const body = await res.json();
            if (body && body.sessionId) {
              sessionId = body.sessionId;
              pushT('session_created', { sessionId, totalParts: body.totalParts, status: body.status });
            }
          }
        } catch (_) {}
      });

      await uiUploadVideo(page, 'resume.mp4', videoBuf);
      pushT('ui_file_selected', { name: 'resume.mp4', bytes: videoBuf.length, expectedParts });

      // Wait until partial progress is proven — MUST NOT be ready
      const midDeadline = Date.now() + 90000;
      let mid = null;
      while (Date.now() < midDeadline) {
        if (sessionId) {
          try {
            mid = await getSession(apiBase, token, sessionId);
            const done = (mid.completedParts || []).length;
            const total = mid.totalParts || expectedParts;
            pushT('poll_mid', { sessionId, done, total, status: mid.status });
            if (done > 0 && done < total && mid.status !== 'ready' && mid.status !== 'aborted') {
              break;
            }
            if (mid.status === 'ready') {
              throw new Error('INVALID_RESUME_SCENARIO: file became ready before interrupt');
            }
          } catch (e) {
            if (String(e.message || e).includes('INVALID_RESUME')) throw e;
          }
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!mid || !sessionId) throw new Error('no upload session observed before interrupt');
      const completedBefore = (mid.completedParts || []).length;
      const totalParts = mid.totalParts || expectedParts;
      if (!(completedBefore > 0 && completedBefore < totalParts)) {
        throw new Error(`interrupt precondition failed completed=${completedBefore} total=${totalParts} status=${mid.status}`);
      }
      if (mid.status === 'ready') throw new Error('status ready before interrupt — scenario invalid');
      const sessionIdBefore = sessionId;
      const partsBefore = (mid.completedParts || []).map((p) => p.partNumber);
      pushT('pre_reload_assert', {
        sessionIdBefore,
        completedBefore,
        totalParts,
        status: mid.status,
        partsBefore,
      });

      // Real reload
      await page.reload({ waitUntil: 'domcontentloaded' });
      pushT('page_reload', {});
      await page.waitForTimeout(1500);

      // Re-instrument after reload
      await page.evaluate(() => {
        window.__lastUploadError = null;
        const orig = PartnersApi.uploadViaSession.bind(PartnersApi);
        PartnersApi.uploadViaSession = async function wrapped(...args) {
          try {
            return await orig(...args);
          } catch (e) {
            window.__lastUploadError = { code: e && e.code, message: e && e.message, name: e && e.name };
            throw e;
          }
        };
      });

      await openInForm(page, productName);
      await page.waitForTimeout(1000);

      // —— Negative: different content, same name+size → file_mismatch, session intact ——
      const decoy = Buffer.concat([videoBuf.subarray(0, videoBuf.length - 16), randomBytes(16)]);
      if (decoy.length !== videoBuf.length) throw new Error('decoy size mismatch setup');
      await uiUploadVideo(page, 'resume.mp4', decoy);
      await page.waitForTimeout(8000);
      const mismatchErr = await page.evaluate(() => window.__lastUploadError);
      const mismatchCode = mismatchErr && mismatchErr.code;
      const mismatchOk = mismatchCode === 'file_mismatch';
      const sessionAfterMismatch = await getSession(apiBase, token, sessionIdBefore);
      const sessionIntact =
        sessionAfterMismatch &&
        sessionAfterMismatch.sessionId === sessionIdBefore &&
        sessionAfterMismatch.status !== 'aborted' &&
        (sessionAfterMismatch.completedParts || []).length === completedBefore;
      pushT('mismatch_attempt', { mismatchCode, mismatchOk, sessionIntact, status: sessionAfterMismatch.status });
      record('RESUME_FILE_MISMATCH', mismatchOk && sessionIntact, {
        mismatchCode,
        message: mismatchErr && mismatchErr.message,
        sessionIntact,
        sessionId: sessionIdBefore,
        completedParts: (sessionAfterMismatch.completedParts || []).length,
      });

      // Clear last error; unblock remaining parts; resume with correct file
      await page.evaluate(() => {
        window.__lastUploadError = null;
      });
      blockPartsAbove = 0;
      await uiUploadVideo(page, 'resume.mp4', videoBuf);
      pushT('resume_reselect_same_file', {});

      const readyDeadline = Date.now() + 180000;
      let after = null;
      while (Date.now() < readyDeadline) {
        after = await getSession(apiBase, token, sessionIdBefore);
        pushT('poll_after', {
          status: after.status,
          done: (after.completedParts || []).length,
          catalogMediaId: after.catalogMediaId,
        });
        if (after.status === 'ready' && after.catalogMediaId) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      const sameSession = after && after.sessionId === sessionIdBefore;
      const readyOk = after && after.status === 'ready' && !!after.catalogMediaId;
      const partsAfter = (after && after.completedParts) || [];
      const preserved = partsBefore.every((n) => partsAfter.some((p) => p.partNumber === n));
      const preview = await (
        await fetch(`${apiBase}/partners-portal/products/${ownerId}/preview`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).json();
      const mediaCount = after && after.catalogMediaId
        ? (preview.media || []).filter((m) => m.id === after.catalogMediaId).length
        : 0;
      const visibleReady = (preview.media || []).some((m) => m.id === after.catalogMediaId && m.ready);

      writeFileSync(
        join(outDir, 'resume-evidence.json'),
        JSON.stringify(
          {
            commit,
            videoSha,
            partSize,
            expectedParts,
            sessionIdBefore,
            sessionIdAfter: after && after.sessionId,
            completedBefore,
            totalParts,
            statusBefore: mid.status,
            statusAfter: after && after.status,
            partsBefore,
            partsAfter: partsAfter.map((p) => p.partNumber),
            catalogMediaId: after && after.catalogMediaId,
            mediaCount,
            visibleReady,
            timeline,
            netSample: net.filter((n) => /upload-sessions|direct-parts/.test(n.url)).slice(0, 80),
          },
          null,
          2,
        ),
      );

      const resumePass =
        sameSession &&
        readyOk &&
        preserved &&
        mediaCount === 1 &&
        visibleReady &&
        completedBefore > 0 &&
        completedBefore < totalParts &&
        mid.status !== 'ready';
      record('RESUME_MULTIPART', resumePass, {
        sameSession,
        readyOk,
        preserved,
        mediaCount,
        visibleReady,
        sessionId: sessionIdBefore,
        completedBefore,
        totalParts,
        statusBefore: mid.status,
        statusAfter: after && after.status,
        realReload: true,
      });
      await page.screenshot({ path: join(shotsDir, 'resume-final.png'), fullPage: true });

      // ========== FINALIZE transient / permanent (harness inject; no manual CatalogMedia) ==========
      try {
        if (!ready.injectPort) throw new Error('injectPort missing from harness ready payload');
        const injectBase = `http://127.0.0.1:${ready.injectPort}`;
        const meta0 = await fetch(`${injectBase}/finalize-meta`);
        if (!meta0.ok) throw new Error('finalize-meta unavailable ' + meta0.status);
        const meta = await meta0.json();
        const init = await (
          await fetch(`${apiBase}/partners-portal/upload-sessions`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              ownerKind: 'product',
              ownerId,
              clientMediaId: cryptoRandom(),
              idempotencyKey: cryptoRandom(),
              mimeType: 'image/png',
              byteSize: PNG.length,
              checksum: createHash('sha256').update(PNG).digest('hex'),
            }),
          })
        ).json();
        // Put part first, then inject, then complete — mirrors F05_AUTO_RETRY ordering.
        const sign = await (
          await fetch(`${apiBase}/partners-portal/upload-sessions/${init.sessionId}/parts/1/sign`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: '{}',
          })
        ).json();
        const putUrl = sign.url.startsWith('http') ? sign.url : `http://127.0.0.1:${ready.port}${sign.url}`;
        const putRes = await fetch(putUrl, {
          method: 'PUT',
          body: new Uint8Array(PNG),
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/octet-stream',
          },
        });
        const putBody = await putRes.json().catch(() => ({}));
        if (!putRes.ok) throw new Error(`direct-part PUT HTTP ${putRes.status} ${JSON.stringify(putBody)}`);
        const etag = putBody.etag || putRes.headers.get('etag');
        if (!etag) throw new Error('missing etag from part PUT');
        const preComplete = await getSession(apiBase, token, init.sessionId);
        const inj = await fetch(`${injectBase}/inject-head-fail`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ times: 1, sessionId: init.sessionId }),
        });
        if (!inj.ok) throw new Error('inject-head-fail ' + inj.status + ' ' + (await inj.text()));
        const injBody = await inj.json();
        const attemptsBefore = preComplete.finalizeAttempts || 0;
        const completeRes = await fetch(`${apiBase}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ parts: [{ partNumber: 1, etag, size: PNG.length }] }),
        });
        if (!completeRes.ok && completeRes.status !== 202) {
          throw new Error(`complete HTTP ${completeRes.status} ${await completeRes.text()}`);
        }
        let sawRetryable = false;
        let finalRow = null;
        const d2 = Date.now() + 20000;
        while (Date.now() < d2) {
          finalRow = await getSession(apiBase, token, init.sessionId);
          if (finalRow.status === 'failed' && finalRow.failureClass === 'retryable') sawRetryable = true;
          if (finalRow.status === 'ready' && finalRow.catalogMediaId) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        const mediaN = await (
          await fetch(`${apiBase}/partners-portal/products/${ownerId}/preview`, {
            headers: { authorization: `Bearer ${token}` },
          })
        ).json();
        const catCount = (mediaN.media || []).filter((m) => m.id === finalRow.catalogMediaId).length;
        const noEarlyBurn = (finalRow.finalizeAttempts || 0) >= attemptsBefore;
        record(
          'FINALIZE_TRANSIENT_RECOVER',
          !!(finalRow && finalRow.status === 'ready' && finalRow.catalogMediaId && catCount === 1 && sawRetryable),
          {
            sessionId: init.sessionId,
            sawRetryable,
            status: finalRow && finalRow.status,
            attempts: finalRow && finalRow.finalizeAttempts,
            catalogMediaId: finalRow && finalRow.catalogMediaId,
            catCount,
            noEarlyBurn,
            backoffScheduleCount: meta.backoffScheduleCount,
            inject: injBody,
          },
        );

        // Permanent: keep head failing → terminal failed, not infinite loop
        const permInj = await fetch(`${injectBase}/inject-head-fail-permanent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!permInj.ok) throw new Error('inject-head-fail-permanent ' + permInj.status);
        const init2 = await (
          await fetch(`${apiBase}/partners-portal/upload-sessions`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              ownerKind: 'product',
              ownerId,
              clientMediaId: cryptoRandom(),
              idempotencyKey: cryptoRandom(),
              mimeType: 'image/png',
              byteSize: PNG2.length,
              checksum: createHash('sha256').update(PNG2).digest('hex'),
            }),
          })
        ).json();
        const sign2 = await (
          await fetch(`${apiBase}/partners-portal/upload-sessions/${init2.sessionId}/parts/1/sign`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: '{}',
          })
        ).json();
        const putUrl2 = sign2.url.startsWith('http') ? sign2.url : `http://127.0.0.1:${ready.port}${sign2.url}`;
        const put2 = await fetch(putUrl2, {
          method: 'PUT',
          body: new Uint8Array(PNG2),
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/octet-stream',
          },
        });
        const putBody2 = await put2.json().catch(() => ({}));
        if (!put2.ok) throw new Error(`direct-part2 PUT HTTP ${put2.status}`);
        const etag2 = putBody2.etag || put2.headers.get('etag');
        const complete2 = await fetch(`${apiBase}/partners-portal/upload-sessions/${init2.sessionId}/complete`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ parts: [{ partNumber: 1, etag: etag2, size: PNG2.length }] }),
        });
        if (!complete2.ok && complete2.status !== 202) {
          throw new Error(`complete2 HTTP ${complete2.status}`);
        }
        let terminal = null;
        const d3 = Date.now() + 45000;
        while (Date.now() < d3) {
          terminal = await getSession(apiBase, token, init2.sessionId);
          if (terminal.status === 'failed' && terminal.failureClass === 'permanent') break;
          if (terminal.status === 'failed' && (terminal.finalizeAttempts || 0) >= 3) break;
          await new Promise((r) => setTimeout(r, 200));
        }
        const permanentOk =
          terminal &&
          terminal.status === 'failed' &&
          !terminal.catalogMediaId &&
          (terminal.failureClass === 'permanent' || (terminal.finalizeAttempts || 0) >= 3);
        record('FINALIZE_PERMANENT', !!permanentOk, {
          sessionId: init2.sessionId,
          status: terminal && terminal.status,
          failureClass: terminal && terminal.failureClass,
          attempts: terminal && terminal.finalizeAttempts,
          catalogMediaId: terminal && terminal.catalogMediaId,
        });
      } catch (finErr) {
        record('FINALIZE_TRANSIENT_RECOVER', false, String(finErr && finErr.stack ? finErr.stack : finErr));
        record('FINALIZE_PERMANENT', false, 'skipped due to prior finalize error');
      }

      await ctx.close();
    }
  } catch (e) {
    record('JOURNEY_FATAL', false, String(e && e.stack ? e.stack : e));
  } finally {
    await browser.close().catch(() => {});
    staticServer.close();
    child.kill('SIGTERM');
  }

  const finishedUtc = new Date().toISOString();
  const summary = {
    ok: cases.every((c) => c.ok === 'PASS'),
    commit,
    db: dbMeta,
    startedUtc,
    finishedUtc,
    cases,
    pngSha: createHash('sha256').update(PNG).digest('hex'),
    videoSha,
    partSize,
    expectedParts,
  };
  writeFileSync(join(outDir, 'portal-journey.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, commit, cases: cases.map((c) => ({ id: c.id, ok: c.ok })) }, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

function cryptoRandom() {
  return randomBytes(16).toString('hex');
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
