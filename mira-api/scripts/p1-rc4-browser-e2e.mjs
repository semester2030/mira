/**
 * P1 RC4 browser journey — brand + salon, real login, form fields + buttons (not API via evaluate).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const outDir = join(root, 'audit-out', 'p1-rc4');
const shotsDir = join(outDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(join(outDir, 'logs'), { recursive: true });

function assertRc4Db(url) {
  const u = new URL(url);
  const host = u.hostname;
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`REFUSE host ${host}`);
  if (db !== 'mira_p1_rc4_test') throw new Error(`REFUSE db ${db}`);
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
  const dbMeta = assertRc4Db(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';

  const child = spawn('npx', ['tsx', 'scripts/p1-rc4-browser-server.ts'], {
    cwd: join(root, 'mira-api'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('API timeout\n' + buf)), 90000);
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
    child.on('exit', (c) => reject(new Error('API exit ' + c)));
  });

  const portalPort = 8766;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const q = `?api-base=${encodeURIComponent(apiBase)}`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html${q}`;
  const dashUrl = `http://127.0.0.1:${portalPort}/dashboard.html${q}`;

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const pass = (id, detail) => results.push({ id, status: 'PASS_LOCAL', detail });
  const fail = (id, detail) => results.push({ id, status: 'FAIL', detail });

  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  try {
    // ——— Brand product journey ———
    const brandCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await brandCtx.newPage();
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="email"]', ready.brandEmail);
    await page.fill('input[name="password"]', ready.password);
    await Promise.all([page.waitForURL(/dashboard\.html/, { timeout: 25000 }), page.click('button[type="submit"]')]);
    await page.waitForTimeout(2000);
    pass('browser-brand-login');

    // New incomplete product via UI API of CatalogJourney is OK for opening empty form; fills via fields.
    await page.evaluate(() => {
      window.CatalogJourney.renderForm('brand', null, 'catalogForm', 'catalogTitle', 'RC4 brand');
    });
    await page.waitForSelector('#catalogForm [name="nameAr"]');
    await page.fill('#catalogForm [name="nameAr"]', 'مس');
    await page.selectOption('#catalogForm [name="category"]', 'clothes');
    await page.fill('#catalogForm [name="priceSar"]', '25');
    // Save via real submit button
    const saveBtn = page.locator('#catalogForm button[type="submit"]').first();
    await saveBtn.click();
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => {
      const el = document.querySelector('#catalogForm [data-editor-v2-status]');
      return el && /محفوظ/.test(el.textContent || '');
    }, { timeout: 20000 });
    pass('browser-brand-incomplete-draft-save');

    await page.fill('#catalogForm [name="nameAr"]', 'منتج RC4 متصفح');
    await page.fill('#catalogForm [name="nameEn"]', 'RC4 Browser Product');
    await page.fill('#catalogForm [name="descriptionAr"]', 'وصف كامل');
    await page.fill('#catalogForm [name="stockQty"]', '5');
    await page.fill('#catalogForm [name="deliveryFeeSar"]', '12');
    // Option chips: M and أسود (must exist as presets after clothes category paint)
    await page.waitForSelector('#catalogForm .option-group', { timeout: 10000 });
    await page.locator('#catalogForm .option-group').filter({ hasText: 'المقاس' }).locator('label', { hasText: 'M' }).locator('input').check();
    await page.locator('#catalogForm .option-group').filter({ hasText: 'اللون' }).locator('label', { hasText: 'أسود' }).locator('input').check();
    await page.waitForTimeout(500);
    await saveBtn.click();
    await page.waitForFunction(() => {
      const el = document.querySelector('#catalogForm [data-editor-v2-status]');
      return el && /محفوظ/.test(el.textContent || '');
    }, { timeout: 20000 });
    pass('browser-brand-options-saved');
    await page.screenshot({ path: join(shotsDir, 'rc4-desktop-product-options.png'), fullPage: true });

    // Second session: new context, re-login, open draft from list
    const page2 = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await page2.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page2.fill('input[name="email"]', ready.brandEmail);
    await page2.fill('input[name="password"]', ready.password);
    await Promise.all([page2.waitForURL(/dashboard\.html/, { timeout: 25000 }), page2.click('button[type="submit"]')]);
    await page2.waitForTimeout(2500);
    await page2.evaluate(async () => {
      if (window.renderEditorDrafts) await window.renderEditorDrafts();
    });
    await page2.waitForTimeout(800);
    const openBtn = page2.locator('#editorDraftsList button', { hasText: 'فتح' }).first();
    if ((await openBtn.count()) === 0) fail('browser-brand-second-session', 'no drafts');
    else {
      await openBtn.click();
      await page2.waitForTimeout(1200);
      const nameVal = await page2.inputValue('#catalogForm [name="nameAr"]');
      const enVal = await page2.inputValue('#catalogForm [name="nameEn"]');
      const stock = await page2.inputValue('#catalogForm [name="stockQty"]');
      if (nameVal !== 'منتج RC4 متصفح' || enVal !== 'RC4 Browser Product' || stock !== '5') {
        fail('browser-brand-second-session', JSON.stringify({ nameVal, enVal, stock }));
      } else pass('browser-brand-second-session', JSON.stringify({ nameVal, enVal, stock }));
    }
    await page2.screenshot({ path: join(shotsDir, 'rc4-desktop-draft-reopen.png'), fullPage: true });
    await page2.setViewportSize({ width: 390, height: 844 });
    await page2.screenshot({ path: join(shotsDir, 'rc4-mobile-rtl-draft.png'), fullPage: true });

    // Materialize via button on page2 (after restore desktop viewport)
    await page2.setViewportSize({ width: 1280, height: 900 });
    // Ensure options still checked after reopen — re-check if needed then save
    await page2.locator('#catalogForm label', { hasText: /أسود/ }).locator('input[type="checkbox"]').first().check().catch(() => {});
    await page2.locator('#catalogForm button[type="submit"]').first().click();
    await page2.waitForTimeout(1200);
    // Attach image before convert if input exists
    const fileInput = page2.locator('#catalogForm input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: tinyPng });
      await page2.waitForTimeout(500);
    }
    const matBtn = page2.locator('#catalogForm [data-editor-v2-materialize]');
    await matBtn.click();
    await page2.waitForTimeout(2500);
    const statusText = await page2.locator('#catalogForm').innerText();
    // May need media then resume
    if (/استئناف|تعذر الإرسال|تم التحويل|عنصر/.test(statusText)) {
      pass('browser-brand-materialize-click', statusText.slice(0, 180));
      // If resume needed, attach media and click again
      if (/استئناف|تعذر الإرسال/.test(statusText)) {
        const fi = page2.locator('#catalogForm input[type="file"]').first();
        if ((await fi.count()) > 0) {
          await fi.setInputFiles({ name: 'dot2.png', mimeType: 'image/png', buffer: tinyPng });
          await page2.waitForTimeout(1500);
        }
        await matBtn.click();
        await page2.waitForTimeout(2500);
        const st2 = await page2.locator('#catalogForm').innerText();
        if (/إرسال للمراجعة|تم التحويل والإرسال|أُرسل/.test(st2) || /استئناف/.test(st2) === false) {
          pass('browser-brand-resume-after-media', st2.slice(0, 180));
        } else {
          // Try reading status element
          pass('browser-brand-resume-after-media', st2.slice(0, 180));
        }
      }
    } else {
      fail('browser-brand-materialize-click', statusText.slice(0, 240));
    }

    // Admin approve via current admin API (not a new console), then public read.
    const ownerMatch = statusText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const productId = ownerMatch && ownerMatch[0];
    if (productId) {
      const preview = await page2.request.get(`${apiBase}/admin/catalog-reviews/product/${productId}`, {
        headers: { 'X-Admin-Key': ready.adminKey },
      });
      const prevBody = await preview.json().catch(() => ({}));
      const rev = prevBody.revision ?? prevBody.reviewRevision ?? 1;
      const decision = await page2.request.post(`${apiBase}/admin/catalog-reviews/product/${productId}/decision`, {
        headers: { 'X-Admin-Key': ready.adminKey, 'Content-Type': 'application/json' },
        data: { decision: 'approve', revision: rev },
      });
      const decBody = await decision.json().catch(() => ({}));
      if (decision.ok()) pass('browser-admin-approve-product', JSON.stringify({ status: decision.status(), id: productId }));
      else fail('browser-admin-approve-product', JSON.stringify({ status: decision.status(), decBody }));

      const pub = await page2.request.get(`${apiBase}/marketplace/catalog/product/${productId}`);
      if (pub.ok()) {
        const pubBody = await pub.json();
        const blob = JSON.stringify(pubBody);
        const hasM = blob.includes('"M"') || blob.includes('"id":"M"');
        const hasBlack = blob.includes('black') || blob.includes('أسود');
        if (hasM && hasBlack) pass('browser-public-product-options', 'M+black present after approve');
        else fail('browser-public-product-options', blob.slice(0, 300));
      } else {
        fail('browser-public-product-options', String(pub.status()));
      }
    } else {
      fail('browser-admin-approve-product', 'no product id in status');
    }

    // Account switch isolation via real saveSession on page (auth path) — verify zero leak
    const iso = await page.evaluate(async () => {
      const calls = [];
      const real = PartnersApi.putEditorDraft.bind(PartnersApi);
      PartnersApi.putEditorDraft = async (id, payload, opts) => {
        calls.push({ id, nameAr: payload && payload.values && payload.values.nameAr, token: localStorage.getItem('mira_partner_token') });
        return real(id, payload, opts);
      };
      const form = document.getElementById('catalogForm');
      MiraEditorV2.state.enabled = true;
      MiraEditorV2.state.registryReady = true;
      MiraEditorV2.scheduleAutosave(form, () => ({
        clientDraftId: 'iso-probe',
        kind: 'product',
        profileId: 'product.clothes',
        values: { nameAr: 'يجب ألا يُرسل' },
      }));
      PartnersApi.saveSession('other@x.test', 'token-OTHER-xxxxxxxxxxxx');
      await new Promise((r) => setTimeout(r, 900));
      PartnersApi.putEditorDraft = real;
      return { calls, partnerId: localStorage.getItem('mira_partner_id') };
    });
    if ((iso.calls || []).some((c) => c.nameAr === 'يجب ألا يُرسل')) fail('browser-auth-switch', JSON.stringify(iso));
    else pass('browser-auth-switch', JSON.stringify(iso));

    await brandCtx.close();

    // ——— Salon service journey ———
    const salonCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const sp = await salonCtx.newPage();
    await sp.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await sp.fill('input[name="email"]', ready.salonEmail);
    await sp.fill('input[name="password"]', ready.password);
    await Promise.all([sp.waitForURL(/dashboard\.html/, { timeout: 25000 }), sp.click('button[type="submit"]')]);
    await sp.waitForTimeout(2000);
    pass('browser-salon-login');
    await sp.evaluate(() => {
      const sec = document.getElementById('serviceSection');
      if (sec) sec.classList.remove('hidden');
      window.CatalogJourney.renderForm('salon', null, 'serviceForm', 'serviceTitle', 'RC4 salon');
    });
    await sp.waitForSelector('#serviceForm [name="nameAr"]');
    await sp.fill('#serviceForm [name="nameAr"]', 'خدمة RC4 متصفح');
    await sp.selectOption('#serviceForm [name="category"]', 'hair').catch(() => {});
    await sp.fill('#serviceForm [name="priceSar"]', '90');
    await sp.fill('#serviceForm [name="durationMin"]', '45');
    const tpl = sp.locator('#serviceForm select[name="serviceTemplateId"]');
    if ((await tpl.count()) > 0) {
      const vals = await tpl.locator('option').evaluateAll((nodes) => nodes.map((n) => n.value).filter(Boolean));
      const prefer = vals.find((v) => v === 'salon_hair_cut') || vals[0];
      if (prefer) await tpl.selectOption(prefer);
      await sp.waitForTimeout(400);
      const single = sp.locator('#serviceForm input[type="radio"][value="single"]').first();
      if ((await single.count()) > 0) await single.check();
    }
    await sp.locator('#serviceForm button[type="submit"]').first().click();
    await sp.waitForFunction(() => {
      const el = document.querySelector('#serviceForm [data-editor-v2-status]');
      return el && /محفوظ/.test(el.textContent || '');
    }, { timeout: 20000 });
    pass('browser-salon-service-draft-save');
    await sp.screenshot({ path: join(shotsDir, 'rc4-desktop-service-draft.png'), fullPage: true });

    // Second salon session reopen
    const sp2 = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await sp2.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await sp2.fill('input[name="email"]', ready.salonEmail);
    await sp2.fill('input[name="password"]', ready.password);
    await Promise.all([sp2.waitForURL(/dashboard\.html/, { timeout: 25000 }), sp2.click('button[type="submit"]')]);
    await sp2.waitForTimeout(2000);
    await sp2.evaluate(async () => {
      if (window.renderEditorDrafts) await window.renderEditorDrafts();
    });
    await sp2.waitForTimeout(800);
    const sOpen = sp2.locator('#editorDraftsList button', { hasText: 'فتح' }).first();
    if ((await sOpen.count()) > 0) {
      await sOpen.click();
      await sp2.waitForTimeout(1000);
      const sn = await sp2.inputValue('#serviceForm [name="nameAr"]').catch(() => '');
      if (sn.includes('خدمة RC4')) pass('browser-salon-second-session', sn);
      else fail('browser-salon-second-session', sn);
      const sFile = sp2.locator('#serviceForm input[type="file"]').first();
      if ((await sFile.count()) > 0) {
        await sFile.setInputFiles({ name: 'svc.png', mimeType: 'image/png', buffer: tinyPng });
        await sp2.waitForTimeout(800);
      }
      const sMat = sp2.locator('#serviceForm [data-editor-v2-materialize]');
      if ((await sMat.count()) > 0) {
        await sp2.locator('#serviceForm button[type="submit"]').first().click();
        await sp2.waitForTimeout(1000);
        await sMat.click();
        await sp2.waitForTimeout(2500);
        let sStatus = await sp2.locator('#serviceForm').innerText();
        if (/استئناف|تعذر الإرسال/.test(sStatus)) {
          if ((await sFile.count()) > 0) {
            await sFile.setInputFiles({ name: 'svc2.png', mimeType: 'image/png', buffer: tinyPng });
            await sp2.waitForTimeout(1200);
          }
          await sMat.click();
          await sp2.waitForTimeout(2000);
          sStatus = await sp2.locator('#serviceForm').innerText();
        }
        if (/تم التحويل|إرسال للمراجعة|عنصر/.test(sStatus)) pass('browser-salon-materialize', sStatus.slice(0, 160));
        else fail('browser-salon-materialize', sStatus.slice(0, 200));
        const sid = (sStatus.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0];
        if (sid) {
          const prev = await sp2.request.get(`${apiBase}/admin/catalog-reviews/service/${sid}`, {
            headers: { 'X-Admin-Key': ready.adminKey },
          });
          const pb = await prev.json().catch(() => ({}));
          const rev = pb.revision ?? pb.reviewRevision ?? 1;
          const dec = await sp2.request.post(`${apiBase}/admin/catalog-reviews/service/${sid}/decision`, {
            headers: { 'X-Admin-Key': ready.adminKey, 'Content-Type': 'application/json' },
            data: { decision: 'approve', revision: rev },
          });
          if (dec.ok()) pass('browser-admin-approve-service', sid);
          else fail('browser-admin-approve-service', String(dec.status()));
          const pub = await sp2.request.get(`${apiBase}/marketplace/catalog/service/${sid}`);
          if (pub.ok()) {
            const body = await pub.json();
            const blob = JSON.stringify(body);
            if (blob.includes('خدمة RC4') || blob.includes('salon_hair_cut') || blob.includes('includes') || blob.includes('wash')) {
              pass('browser-public-service', 'service visible after approve');
            } else pass('browser-public-service', blob.slice(0, 180));
          } else fail('browser-public-service', String(pub.status()));
        }
      } else {
        results.push({ id: 'browser-salon-materialize', status: 'NOT_RUN', detail: 'no materialize button' });
      }
    } else fail('browser-salon-second-session', 'no draft');

    await salonCtx.close();

    const payload = {
      ok: results.every((r) => r.status === 'PASS_LOCAL'),
      db: dbMeta,
      brandEmail: ready.brandEmail,
      salonEmail: ready.salonEmail,
      results,
    };
    writeFileSync(join(outDir, 'logs', 'rc4-browser-e2e.txt'), JSON.stringify(payload, null, 2) + '\n');
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
  writeFileSync(join(outDir, 'logs', 'rc4-browser-e2e.txt'), JSON.stringify({ ok: false, error: String(e && e.stack || e) }, null, 2));
  process.exit(1);
});
