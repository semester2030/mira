/**
 * P1 RC3 browser journey: real login → draft → second-tab reopen → auth switch isolation.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const outDir = join(root, 'audit-out', 'p1-rc3');
const shotsDir = join(outDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(join(outDir, 'logs'), { recursive: true });

function assertRc3Db(url) {
  const u = new URL(url);
  const host = u.hostname;
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`REFUSE host ${host}`);
  if (db !== 'mira_p1_rc3_test') throw new Error(`REFUSE db ${db}`);
  return { host, db };
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveStatic(port) {
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/') rel = '/index.html';
      const file = join(webRoot, rel.replace(/^\//, ''));
      if (!file.startsWith(webRoot) || !existsSync(file)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const dbMeta = assertRc3Db(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';

  const child = spawn('npx', ['tsx', 'scripts/p1-rc3-browser-server.ts'], {
    cwd: join(root, 'mira-api'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const ready = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('API start timeout\n' + buf)), 90000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      for (const line of buf.split('\n')) {
        if (!line.includes('"ready"')) continue;
        try {
          const j = JSON.parse(line.trim());
          if (j.ready) {
            clearTimeout(timer);
            resolve(j);
          }
        } catch (_) {}
      }
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (code) => reject(new Error('API exited early ' + code + '\n' + buf)));
  });

  const portalPort = 8765;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const dashUrl = `http://127.0.0.1:${portalPort}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`;

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const results = [];
  const pass = (id, detail) => results.push({ id, status: 'PASS_LOCAL', detail });
  const fail = (id, detail) => results.push({ id, status: 'FAIL', detail });

  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="email"]', ready.email);
    await page.fill('input[name="password"]', ready.password);
    await Promise.all([
      page.waitForURL(/dashboard\.html/, { timeout: 25000 }),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(2000);
    pass('browser-login');
    await page.screenshot({ path: join(shotsDir, 'rc3-desktop-dashboard.png'), fullPage: true });

    // Salon dashboard may hide brand catalog — force product form for P1 product journey.
    await page.evaluate(() => {
      if (window.CatalogJourney) {
        window.CatalogJourney.renderForm('brand', null, 'catalogForm', 'catalogTitle', 'RC3 browser product');
      }
    });
    await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 10000 });
    await page.fill('#catalogForm [name="nameAr"]', 'مسودة متصفح RC3');
    await page.fill('#catalogForm [name="nameEn"]', 'Browser Draft');
    await page.fill('#catalogForm [name="descriptionAr"]', 'وصف من المتصفح');
    await page.selectOption('#catalogForm [name="category"]', { value: 'clothes' }).catch(async () => {
      await page.selectOption('#catalogForm select[name="category"]', 'clothes');
    });
    await page.fill('#catalogForm [name="priceSar"]', '42');
    await page.waitForTimeout(1200);
    await page.waitForFunction(() => {
      const el = document.querySelector('#catalogForm [data-editor-v2-status]');
      return el && /محفوظ/.test(el.textContent || '');
    }, { timeout: 20000 });
    pass('browser-product-draft-autosave');
    await page.screenshot({ path: join(shotsDir, 'rc3-desktop-product-draft.png'), fullPage: true });

    // Service + template answers
    await page.evaluate(() => {
      const sec = document.getElementById('serviceSection');
      if (sec) sec.classList.remove('hidden');
      if (window.CatalogJourney) {
        window.CatalogJourney.renderForm('salon', null, 'serviceForm', 'serviceTitle', 'RC3 browser service');
      }
    });
    await page.waitForSelector('#serviceForm [name="nameAr"]', { timeout: 10000 });
    await page.fill('#serviceForm [name="nameAr"]', 'خدمة متصفح RC3');
    await page.selectOption('#serviceForm [name="category"]', 'hair').catch(() => {});
    await page.fill('#serviceForm [name="priceSar"]', '80');
    await page.waitForTimeout(500);
    const tplSelect = page.locator('#serviceForm select[name="serviceTemplateId"]');
    if ((await tplSelect.count()) > 0) {
      const vals = await tplSelect.locator('option').evaluateAll((nodes) =>
        nodes.map((n) => n.value).filter(Boolean),
      );
      const prefer = vals.find((v) => v === 'salon_hair_cut') || vals[0];
      if (prefer) {
        await tplSelect.selectOption(prefer);
        await page.waitForTimeout(500);
      }
      // Prefer simple answers: session_kind=single avoids package_sessions rules.
      const single = page.locator('#serviceForm input[type="radio"][value="single"]').first();
      if ((await single.count()) > 0) await single.check();
    }
    const serviceSave = await page.evaluate(async () => {
      const form = document.getElementById('serviceForm');
      if (!(window.MiraEditorV2 && MiraEditorV2.state.enabled)) {
        return { ok: false, reason: 'editor-disabled', mismatch: MiraEditorV2 && MiraEditorV2.state.registryMismatch };
      }
      // Trigger coordinated autosave then flush.
      form.querySelector('[name="nameAr"]').dispatchEvent(new Event('input', { bubbles: true }));
      const saved = await MiraEditorV2.flushUntilSettled(form);
      return saved;
    });
    if (!serviceSave || !serviceSave.ok) {
      fail('browser-service-draft-autosave', JSON.stringify(serviceSave));
    } else {
      pass('browser-service-draft-autosave', JSON.stringify(serviceSave));
    }
    await page.screenshot({ path: join(shotsDir, 'rc3-desktop-service-draft.png'), fullPage: true });

    // Flush-gate: force save failure then ensure materialize blocked
    const gate = await page.evaluate(async () => {
      const form = document.getElementById('catalogForm');
      MiraEditorV2.cancelAllPending('before-forced-fail');
      const real = PartnersApi.putEditorDraft.bind(PartnersApi);
      PartnersApi.putEditorDraft = async () => {
        throw Object.assign(new Error('forced network fail'), { code: 'NETWORK' });
      };
      MiraEditorV2.scheduleAutosave(form, () => ({
        clientDraftId: MiraEditorV2.getEditContext(form.id).clientDraftId,
        kind: 'product',
        profileId: 'product.clothes',
        values: { nameAr: 'فشل متعمد' },
      }));
      const saved = await MiraEditorV2.flushUntilSettled(form);
      MiraEditorV2.cancelAllPending('after-forced-fail');
      PartnersApi.putEditorDraft = real;
      return saved;
    });
    if (gate && gate.ok) fail('browser-flush-fail-blocks-ok', JSON.stringify(gate));
    else pass('browser-flush-fail-not-ok', JSON.stringify(gate));

    // Re-assert a known good save before second-session reopen.
    await page.fill('#catalogForm [name="nameAr"]', 'مسودة متصفح RC3 نهائية');
    await page.fill('#catalogForm [name="nameEn"]', 'Browser Draft Final');
    await page.waitForTimeout(900);
    await page.waitForFunction(() => {
      const el = document.querySelector('#catalogForm [data-editor-v2-status]');
      return el && /محفوظ/.test(el.textContent || '');
    }, { timeout: 20000 });

    // Materialize from UI (may fail submit-review without media — must stay honest / resumable).
    const mat = await page.evaluate(async () => {
      const form = document.getElementById('catalogForm');
      const saved = await MiraEditorV2.flushUntilSettled(form);
      if (!saved || !saved.ok) return { blocked: true, saved };
      const ctx = MiraEditorV2.getEditContext(form.id);
      const clientDraftId = ctx.clientDraftId;
      const key = 'mat-browser:' + clientDraftId + ':' + saved.revision;
      try {
        const result = await MiraEditorV2.materialize(clientDraftId, saved.revision, true, key);
        return { ok: true, result };
      } catch (error) {
        return {
          ok: false,
          message: String(error && error.message ? error.message : error),
          code: error && error.code,
          body: error && error.body,
        };
      }
    });
    const ownerId =
      (mat.result && mat.result.targetOwnerId) ||
      (mat.body && mat.body.targetOwnerId) ||
      null;
    if (mat.blocked) fail('browser-materialize-gated', JSON.stringify(mat));
    else if (ownerId) {
      if (mat.ok) pass('browser-materialize', JSON.stringify(mat.result));
      else pass('browser-materialize-submit-failed-honest', JSON.stringify({ code: mat.code, ownerId }));
      const media = await page.evaluate(async (id) => {
        const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        try {
          await PartnersApi.addMedia('products', id, 'image/png', png, 'main');
          // Resume materialize submit with same key if draft still resumable; else direct submitReview.
          try {
            const sub = await PartnersApi.submitReview('products', id);
            return { ok: true, via: 'submitReview', sub };
          } catch (error) {
            return { ok: false, message: String(error && error.message ? error.message : error), code: error && error.code };
          }
        } catch (error) {
          return { ok: false, stage: 'media', message: String(error && error.message ? error.message : error) };
        }
      }, ownerId);
      if (media.ok) pass('browser-media-and-submit-review', JSON.stringify(media));
      else fail('browser-media-and-submit-review', JSON.stringify(media));
    } else {
      fail('browser-materialize', JSON.stringify(mat));
    }

    // Second session same account — open remaining drafts / verify values path still works via list API
    // (product may already be materialized; service draft should still open).
    const page2 = await context.newPage();
    await page2.goto(dashUrl, { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(2500);
    await page2.evaluate(async () => {
      if (window.renderEditorDrafts) await window.renderEditorDrafts();
    });
    await page2.waitForTimeout(1000);
    const openBtn = page2.locator('#editorDraftsList button', { hasText: 'فتح' }).first();
    if ((await openBtn.count()) > 0) {
      await openBtn.click();
      await page2.waitForTimeout(1200);
      const nameVal = await page2.inputValue('#catalogForm [name="nameAr"]');
      const enVal = await page2.inputValue('#catalogForm [name="nameEn"]');
      if (nameVal !== 'مسودة متصفح RC3 نهائية' || enVal !== 'Browser Draft Final') {
        fail('browser-second-session-reopen', JSON.stringify({ nameVal, enVal }));
      } else {
        pass('browser-second-session-reopen', nameVal + ' / ' + enVal);
      }
    } else {
      fail('browser-second-session-reopen', 'no open button');
    }
    await page2.screenshot({ path: join(shotsDir, 'rc3-desktop-draft-reopen.png'), fullPage: true });
    await page2.setViewportSize({ width: 390, height: 844 });
    await page2.screenshot({ path: join(shotsDir, 'rc3-mobile-rtl-draft.png'), fullPage: true });
    pass('browser-screenshots');

    // Auth switch via real saveSession after schedule
    const iso = await page2.evaluate(async () => {
      const calls = [];
      const real = PartnersApi.putEditorDraft.bind(PartnersApi);
      PartnersApi.putEditorDraft = async (id, payload, opts) => {
        calls.push({
          id,
          token: localStorage.getItem('mira_partner_token'),
          partnerId: localStorage.getItem('mira_partner_id'),
          nameAr: payload && payload.values && payload.values.nameAr,
        });
        return real(id, payload, opts);
      };
      const form = document.getElementById('catalogForm') || document.createElement('form');
      if (!form.id) form.id = 'isoForm';
      MiraEditorV2.state.enabled = true;
      MiraEditorV2.state.registryReady = true;
      MiraEditorV2.state.registryMismatch = false;
      if (!MiraEditorV2.state.partnerId) MiraEditorV2.state.partnerId = localStorage.getItem('mira_partner_id');
      MiraEditorV2.state.authGeneration = PartnersApi.authGeneration();
      MiraEditorV2.state.tokenFingerprint = PartnersApi.authTokenFingerprint();
      MiraEditorV2.scheduleAutosave(form, () => ({
        clientDraftId: 'isolation-probe-A',
        kind: 'product',
        profileId: 'product.clothes',
        values: { nameAr: 'يجب ألا يُرسل' },
      }));
      PartnersApi.saveSession('other@test.local', 'token-OTHER-otherother');
      await new Promise((r) => setTimeout(r, 1000));
      PartnersApi.putEditorDraft = real;
      return { calls, partnerId: localStorage.getItem('mira_partner_id') };
    });
    const leaked = (iso.calls || []).filter((c) => c.nameAr === 'يجب ألا يُرسل');
    if (leaked.length) fail('browser-auth-switch-zero-leaks', JSON.stringify(iso));
    else pass('browser-auth-switch-zero-leaks', JSON.stringify(iso));

    const payload = { ok: results.every((r) => r.status === 'PASS_LOCAL'), db: dbMeta, email: ready.email, apiPort: ready.port, portalPort, results };
    writeFileSync(join(outDir, 'logs', 'rc3-browser-e2e.txt'), JSON.stringify(payload, null, 2) + '\n');
    console.log(JSON.stringify(payload, null, 2));
    if (!payload.ok) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    staticServer.close();
    child.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  writeFileSync(join(outDir, 'logs', 'rc3-browser-e2e.txt'), JSON.stringify({ ok: false, error: String(e && e.stack || e) }, null, 2));
  process.exit(1);
});
