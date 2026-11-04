/**
 * RC10 F2/F3 defect proofs (+ F1/F4 smoke).
 * --expect-bugs: require defects present (RC9 baseline).
 * Default: require defects absent (RC10 fixed).
 * Exit 0 only when all assertions match mode. Never || true.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const expectBugs = process.argv.includes('--expect-bugs');
const outDir = join(root, 'audit-out', 'p1-rc10', expectBugs ? 'sensitivity-rc9' : 'sensitivity-post');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(root, 'audit-out', 'p1-rc10', 'logs'), { recursive: true });

function assertDb(url) {
  const u = new URL(url);
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error('REFUSE host');
  if (db !== 'mira_p1_rc10_test') throw new Error('REFUSE db ' + db);
  return { host: u.hostname, db };
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

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

async function login(page, loginUrl, email, password) {
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL(/dashboard\.html/, { timeout: 25000 }), page.click('button[type="submit"]')]);
  await page.waitForTimeout(1000);
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function waitSignal(getFlag, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await getFlag()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

async function main() {
  const startedUtc = new Date().toISOString();
  const dbMeta = assertDb(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';

  const child = spawn('npx', ['tsx', 'scripts/p1-rc10-browser-server.ts'], {
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
    child.on('exit', (c) => reject(new Error('API exit ' + c)));
  });

  const portalPort = expectBugs ? 8831 : 8832;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const findings = [];
  const commit = process.env.RC10_TESTED_COMMIT || 'WORKING_TREE';

  try {
    // ——— F2-A: stock 3 → 99 during save ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.brandEmail, ready.password);
      await page.click('#goProduct, #goBrand, a[href*="product"]').catch(() => {});
      // brand dashboard usually shows catalog form directly
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 10000 }).catch(async () => {
        await page.goto(loginUrl.replace('login.html', 'dashboard.html'));
        await page.waitForTimeout(800);
      });
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 });

      const id = await page.evaluate(async () => {
        const p = await PartnersApi.createProduct({
          nameAr: 'منتج RC10-F2A',
          priceHalalas: 5000,
          category: 'face',
          purchaseMode: 'internal_cod',
          stockQty: 3,
          deliveryFeeHalalas: 1000,
        });
        return p.id;
      });
      await page.evaluate((pid) => {
        CatalogJourney.renderForm(
          'brand',
          {
            id: pid,
            nameAr: 'منتج RC10-F2A',
            priceHalalas: 5000,
            category: 'face',
            purchaseMode: 'internal_cod',
            stockQty: 3,
            deliveryFeeHalalas: 1000,
          },
          'catalogForm',
          'catalogTitle',
        );
      }, id);
      await page.waitForSelector('#catalogForm [name="stockQty"]', { timeout: 8000 });
      await page.fill('#catalogForm [name="stockQty"]', '3');

      let release;
      const gate = new Promise((r) => {
        release = r;
      });
      let putStarted = false;
      await page.route('**/products/**', async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          putStarted = true;
          await gate;
        }
        await route.continue();
      });

      await page.locator('#catalogForm button[type="submit"]').first().click();
      await waitSignal(() => putStarted, 12000);
      await page.fill('#catalogForm [name="stockQty"]', '99');
      release();
      await page.waitForTimeout(2500);
      await page.unroute('**/products/**');

      const ui = await page.evaluate(() => ({
        stock: document.querySelector('#catalogForm [name="stockQty"]')?.value,
        status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
        unsaved: document.querySelector('#catalogForm [data-unsaved-newer]') != null,
        saveLabel: document.querySelector('#catalogForm button[type="submit"]')?.textContent || '',
      }));
      // Bug: UI shows 3 again and claims fully saved without unsaved notice
      const wiped =
        ui.stock === '3' ||
        (ui.stock === '99' && !ui.unsaved && !/غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel));
      // On fixed: stock stays 99, unsaved visible
      const fixedOk = ui.stock === '99' && (ui.unsaved || /غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel));

      // Save remaining and reopen
      let afterReopen = null;
      if (!expectBugs && fixedOk) {
        await page.locator('#catalogForm button[type="submit"]').first().click();
        await page.waitForTimeout(2200);
        afterReopen = await page.evaluate(async (pid) => {
          const d = await PartnersApi.dashboard();
          const hit = ((d.catalog && d.catalog.products) || []).find((p) => p.id === pid);
          CatalogJourney.renderForm('brand', hit, 'catalogForm', 'catalogTitle');
          await new Promise((r) => setTimeout(r, 800));
          return {
            serverStock: hit && hit.stockQty,
            uiStock: document.querySelector('#catalogForm [name="stockQty"]')?.value,
          };
        }, id);
      }

      findings.push({
        id: 'RC10-F2-A',
        reproduced: expectBugs ? wiped : !fixedOk || (afterReopen && afterReopen.serverStock !== 99),
        ui,
        afterReopen,
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F2-D: name edit during refreshLists ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');

      const id = await page.evaluate(async () => {
        const s = await PartnersApi.createService({
          nameAr: 'خدمة RC10-F2D قبل',
          priceHalalas: 7000,
          category: 'hair',
          durationMin: 30,
        });
        const cur = await PartnersApi.getServiceProfile(s.id);
        await PartnersApi.putServiceProfile(s.id, {
          expectedRevision: cur.reviewRevision,
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch' },
        });
        return s.id;
      });
      await page.evaluate((sid) => {
        CatalogJourney.renderForm(
          'salon',
          { id: sid, nameAr: 'خدمة RC10-F2D قبل', priceHalalas: 7000, category: 'hair', durationMin: 30 },
          'catalogForm',
          'catalogTitle',
        );
      }, id);
      await page.waitForFunction(() => document.querySelector('#catalogForm select[name="priceMode"]')?.value, {
        timeout: 12000,
      });

      let releaseDash;
      const dashGate = new Promise((r) => {
        releaseDash = r;
      });
      let dashHit = false;
      // refreshLists uses GET /partners-portal/me
      await page.route('**/partners-portal/me**', async (route) => {
        if (route.request().method() === 'GET') {
          dashHit = true;
          await dashGate;
        }
        await route.continue();
      });

      await page.locator('#catalogForm button[type="submit"]').first().click();
      const hit = await waitSignal(() => dashHit, 20000);
      if (!hit) throw new Error('RC10-F2-D: dashboard/me request never started');
      await page.fill('#catalogForm [name="nameAr"]', 'خدمة RC10-F2D أحدث');
      // Also bump via change to be sure
      await page.locator('#catalogForm [name="nameAr"]').dispatchEvent('input');
      releaseDash();
      await page.waitForTimeout(2500);
      await page.unroute('**/partners-portal/me**');

      const ui = await page.evaluate(() => ({
        name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
        status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
        unsaved: document.querySelector('#catalogForm [data-unsaved-newer]') != null,
        saveLabel: document.querySelector('#catalogForm button[type="submit"]')?.textContent || '',
        claimsSaved:
          /تم الحفظ/.test(document.querySelector('#catalogForm button[type="submit"]')?.textContent || '') &&
          !/متبقي|غير محفوظ|أحدث/.test(
            (document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '') +
              (document.querySelector('#catalogForm button[type="submit"]')?.textContent || ''),
          ),
      }));
      // Bug: name kept but button/status still say fully saved
      const bug = ui.name === 'خدمة RC10-F2D أحدث' && ui.claimsSaved;
      const fixedOk =
        ui.name === 'خدمة RC10-F2D أحدث' &&
        (ui.unsaved || /غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel)) &&
        !ui.claimsSaved;

      findings.push({
        id: 'RC10-F2-D',
        reproduced: expectBugs ? bug || ui.name !== 'خدمة RC10-F2D أحدث' : !fixedOk,
        ui,
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F3-A: delay getEditorDraft then open B; A must not PUT B ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');

      const drafts = await page.evaluate(async () => {
        const a = await PartnersApi.putEditorDraft('rc10-A-' + Date.now(), {
          expectedRevision: null,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          schemaVersion: 2,
          values: {
            nameAr: 'مسودة A RC10-F3',
            category: 'hair',
            priceHalalas: 4000,
            durationMin: 20,
            serviceProfile: {
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'fixed',
              answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch' },
            },
          },
        });
        const b = await PartnersApi.putEditorDraft('rc10-B-' + Date.now(), {
          expectedRevision: null,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          schemaVersion: 2,
          values: {
            nameAr: 'مسودة B RC10-F3',
            category: 'hair',
            priceHalalas: 6000,
            durationMin: 25,
            serviceProfile: {
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'from',
              answers: { session_kind: 'single', cut_style: 'style', place_mode: 'branch' },
            },
          },
        });
        return { a, b };
      });

      await page.evaluate(async (cid) => {
        const d = await PartnersApi.getEditorDraft(cid);
        await CatalogJourney.reopenServerDraft(d);
      }, drafts.a.clientDraftId);
      await page.waitForTimeout(600);

      const puts = [];
      await page.exposeFunction('__rc10RecordPut', (info) => {
        puts.push(info);
      });
      await page.evaluate(() => {
        const orig = PartnersApi.putEditorDraft.bind(PartnersApi);
        PartnersApi.putEditorDraft = async (id, payload, opts) => {
          window.__rc10Puts = window.__rc10Puts || [];
          window.__rc10Puts.push({ id, nameAr: payload && payload.values && payload.values.nameAr });
          if (window.__rc10RecordPut) {
            window.__rc10RecordPut({ id, nameAr: payload && payload.values && payload.values.nameAr });
          }
          return orig(id, payload, opts);
        };
      });

      let releaseGet;
      const getGate = new Promise((r) => {
        releaseGet = r;
      });
      let getStarted = false;
      let getCount = 0;
      await page.route('**/editor-drafts/**', async (route) => {
        const req = route.request();
        if (req.method() === 'GET' && !req.url().includes('materialize')) {
          getCount += 1;
          // Gate the first GET after materialize click (preflight getEditorDraft)
          if (getCount >= 1 && !getStarted) {
            getStarted = true;
            await getGate;
          }
        }
        await route.continue();
      });

      const file = page.locator('#catalogForm input[type="file"]').first();
      if ((await file.count()) > 0) {
        await file.setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: tinyPng });
        await page.waitForTimeout(400);
      }
      const mat = page.locator('#catalogForm [data-editor-v2-materialize]');
      if ((await mat.count()) === 0) throw new Error('materialize button missing');
      await mat.click();
      await waitSignal(() => getStarted, 12000);

      // Open B while A's getEditorDraft is gated
      await page.evaluate(async (cid) => {
        const d = await PartnersApi.getEditorDraft(cid);
        await CatalogJourney.reopenServerDraft(d);
      }, drafts.b.clientDraftId);
      await page.waitForTimeout(500);

      releaseGet();
      await page.waitForTimeout(3500);
      await page.unroute('**/editor-drafts/**');

      const after = await page.evaluate(() => {
        const c = MiraEditorV2.getEditContext('catalogForm');
        return {
          cid: c && c.clientDraftId,
          owner: c && c.targetOwnerId,
          name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
          puts: window.__rc10Puts || [],
        };
      });

      const pollutedPut = (after.puts || []).some(
        (p) => p.id === drafts.b.clientDraftId && /مسودة A|A RC10/.test(String(p.nameAr || '')),
      );
      const ownerPollute = after.cid === drafts.b.clientDraftId && after.owner != null;

      findings.push({
        id: 'RC10-F3-A',
        reproduced: Boolean(pollutedPut || ownerPollute),
        after,
        aId: drafts.a.clientDraftId,
        bId: drafts.b.clientDraftId,
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F2-B: options add/remove during save ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.brandEmail, ready.password);
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 }).catch(async () => {
        await page.goto(loginUrl.replace('login.html', 'dashboard.html'));
        await page.waitForTimeout(800);
      });
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 });
      const id = await page.evaluate(async () => {
        const p = await PartnersApi.createProduct({
          nameAr: 'منتج RC10-F2B',
          priceHalalas: 4000,
          category: 'clothes',
          purchaseMode: 'internal_cod',
          stockQty: 2,
          optionsJson: [
            { id: 'size', labelAr: 'المقاس', values: [{ id: 'M', labelAr: 'M' }] },
            { id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }] },
          ],
        });
        return p.id;
      });
      await page.evaluate((pid) => {
        CatalogJourney.renderForm(
          'brand',
          {
            id: pid,
            nameAr: 'منتج RC10-F2B',
            priceHalalas: 4000,
            category: 'clothes',
            purchaseMode: 'internal_cod',
            stockQty: 2,
            optionsJson: [
              { id: 'size', labelAr: 'المقاس', values: [{ id: 'M', labelAr: 'M' }] },
              { id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }] },
            ],
          },
          'catalogForm',
          'catalogTitle',
        );
      }, id);
      await page.waitForSelector('#catalogForm .option-group, #catalogForm [name="optionsJson"]', { timeout: 10000 });
      let release;
      const gate = new Promise((r) => {
        release = r;
      });
      let putStarted = false;
      const payloads = [];
      await page.route('**/products/**', async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          putStarted = true;
          try {
            payloads.push(JSON.parse(route.request().postData() || '{}'));
          } catch (_) {}
          await gate;
        }
        await route.continue();
      });
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await waitSignal(() => putStarted, 12000);
      // Mid-save: check L and uncheck black if available
      const sizeL = page.getByRole('checkbox', { name: 'L', exact: true });
      if ((await sizeL.count()) > 0) await sizeL.check();
      const black = page.getByRole('checkbox', { name: 'أسود', exact: true });
      if ((await black.count()) > 0 && (await black.isChecked())) await black.uncheck();
      const red = page.getByRole('checkbox', { name: 'أحمر', exact: true });
      if ((await red.count()) > 0) await red.check();
      release();
      await page.waitForTimeout(2500);
      await page.unroute('**/products/**');
      const ui = await page.evaluate(() => ({
        status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
        unsaved: document.querySelector('#catalogForm [data-unsaved-newer]') != null,
        saveLabel: document.querySelector('#catalogForm button[type="submit"]')?.textContent || '',
        lChecked: !!document.querySelector('#catalogForm input[type="checkbox"][value="L"]')?.checked ||
          Array.from(document.querySelectorAll('#catalogForm label')).some(
            (l) => /L/.test(l.textContent || '') && l.querySelector('input')?.checked,
          ),
      }));
      let after = null;
      if (!expectBugs) {
        await page.locator('#catalogForm button[type="submit"]').first().click();
        await page.waitForTimeout(2200);
        after = await page.evaluate(async (pid) => {
          const d = await PartnersApi.dashboard();
          const hit = ((d.catalog && d.catalog.products) || []).find((p) => p.id === pid);
          const opts = hit && hit.optionsJson;
          CatalogJourney.renderForm('brand', hit, 'catalogForm', 'catalogTitle');
          await new Promise((r) => setTimeout(r, 700));
          return { opts, uiOpts: document.querySelector('#catalogForm [name="optionsJson"]')?.value || null };
        }, id);
      }
      const wipedOrLied =
        (!ui.unsaved && !/غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel)) ||
        (after && Array.isArray(after.opts) && !JSON.stringify(after.opts).includes('L') && ui.lChecked);
      const fixedOk =
        (ui.unsaved || /غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel)) &&
        (!after || JSON.stringify(after.opts || '').includes('L') || ui.lChecked);
      findings.push({
        id: 'RC10-F2-B',
        reproduced: expectBugs ? wipedOrLied : !fixedOk,
        ui,
        after,
        payloads: payloads.slice(0, 2),
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F2-C: service template edit during multi-step save ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      const id = await page.evaluate(async () => {
        const s = await PartnersApi.createService({
          nameAr: 'خدمة RC10-F2C',
          priceHalalas: 5500,
          category: 'hair',
          durationMin: 30,
        });
        const cur = await PartnersApi.getServiceProfile(s.id);
        await PartnersApi.putServiceProfile(s.id, {
          expectedRevision: cur.reviewRevision,
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch', excludes: 'قبل' },
        });
        return s.id;
      });
      await page.evaluate((sid) => {
        CatalogJourney.renderForm(
          'salon',
          { id: sid, nameAr: 'خدمة RC10-F2C', priceHalalas: 5500, category: 'hair', durationMin: 30 },
          'catalogForm',
          'catalogTitle',
        );
      }, id);
      await page.waitForFunction(() => document.querySelector('#catalogForm select[name="priceMode"]')?.value, {
        timeout: 12000,
      });
      let releaseProf;
      const profGate = new Promise((r) => {
        releaseProf = r;
      });
      let profHit = false;
      const puts = [];
      await page.route('**/service-profile**', async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          profHit = true;
          try {
            puts.push(JSON.parse(route.request().postData() || '{}'));
          } catch (_) {}
          await profGate;
        }
        await route.continue();
      });
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await waitSignal(() => profHit, 15000);
      const ex = page.locator('#catalogForm [name="excludes"], #catalogForm textarea[name="excludes"]');
      if ((await ex.count()) > 0) await ex.first().fill('أحدث أثناء الحفظ F2C');
      await page.fill('#catalogForm [name="durationMin"]', '55');
      releaseProf();
      await page.waitForTimeout(2800);
      await page.unroute('**/service-profile**');
      const ui = await page.evaluate(() => ({
        ex:
          document.querySelector('#catalogForm [name="excludes"]')?.value ||
          document.querySelector('#catalogForm textarea[name="excludes"]')?.value ||
          '',
        duration: document.querySelector('#catalogForm [name="durationMin"]')?.value,
        status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
        unsaved: document.querySelector('#catalogForm [data-unsaved-newer]') != null,
        saveLabel: document.querySelector('#catalogForm button[type="submit"]')?.textContent || '',
      }));
      let next = null;
      if (!expectBugs) {
        await page.locator('#catalogForm button[type="submit"]').first().click();
        await page.waitForTimeout(2500);
        next = await page.evaluate(async (sid) => {
          const p = await PartnersApi.getServiceProfile(sid);
          const doc = p.draftServiceProfileSet ? p.draftServiceProfileJson : p.serviceProfileJson;
          const d = await PartnersApi.dashboard();
          const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
          return { doc, duration: hit && hit.durationMin, rev: p.reviewRevision };
        }, id);
      }
      const wiped =
        ui.ex !== 'أحدث أثناء الحفظ F2C' ||
        ui.duration !== '55' ||
        (!ui.unsaved && !/غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel));
      const fixedOk =
        ui.ex === 'أحدث أثناء الحفظ F2C' &&
        ui.duration === '55' &&
        (ui.unsaved || /غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel)) &&
        (!next ||
          (next.doc &&
            next.doc.answers &&
            next.doc.answers.excludes === 'أحدث أثناء الحفظ F2C' &&
            next.duration === 55));
      findings.push({
        id: 'RC10-F2-C',
        reproduced: expectBugs ? wiped : !fixedOk,
        ui,
        next,
        puts: puts.slice(0, 2),
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F2-E: partial failure then retry same owner ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      const id = await page.evaluate(async () => {
        const s = await PartnersApi.createService({
          nameAr: 'خدمة RC10-F2E',
          priceHalalas: 3300,
          category: 'hair',
          durationMin: 20,
        });
        const cur = await PartnersApi.getServiceProfile(s.id);
        await PartnersApi.putServiceProfile(s.id, {
          expectedRevision: cur.reviewRevision,
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch' },
        });
        return s.id;
      });
      await page.evaluate((sid) => {
        CatalogJourney.renderForm(
          'salon',
          { id: sid, nameAr: 'خدمة RC10-F2E', priceHalalas: 3300, category: 'hair', durationMin: 20 },
          'catalogForm',
          'catalogTitle',
        );
      }, id);
      await page.waitForFunction(() => document.querySelector('#catalogForm select[name="priceMode"]')?.value, {
        timeout: 12000,
      });
      let failOnce = true;
      await page.route('**/partners-portal/services/**', async (route) => {
        if ((route.request().method() === 'PUT' || route.request().method() === 'PATCH') && failOnce) {
          failOnce = false;
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'RC10-F2E forced basics fail' }),
          });
          return;
        }
        await route.continue();
      });
      await page.fill('#catalogForm [name="nameAr"]', 'خدمة RC10-F2E جزئي');
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForTimeout(2200);
      const mid = await page.evaluate(() => ({
        name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
        status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
      }));
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForTimeout(2500);
      await page.unroute('**/partners-portal/services/**');
      const after = await page.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        const hits = ((d.catalog && d.catalog.services) || []).filter((s) => s.id === sid || /RC10-F2E/.test(s.nameAr || ''));
        const hit = hits.find((s) => s.id === sid);
        return {
          name: hit && hit.nameAr,
          countSameId: hits.filter((s) => s.id === sid).length,
          totalNamed: hits.length,
        };
      }, id);
      const lostOrDup =
        mid.name !== 'خدمة RC10-F2E جزئي' ||
        after.name !== 'خدمة RC10-F2E جزئي' ||
        after.countSameId !== 1;
      findings.push({
        id: 'RC10-F2-E',
        reproduced: expectBugs ? false : lostOrDup, // residual F2-E is correctness on fixed tree
        mid,
        after,
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F3-B: switch draft during flush ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      const drafts = await page.evaluate(async () => {
        const a = await PartnersApi.putEditorDraft('rc10-f3b-A-' + Date.now(), {
          expectedRevision: null,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          schemaVersion: 2,
          values: {
            nameAr: 'مسودة A F3B',
            category: 'hair',
            priceHalalas: 4100,
            durationMin: 20,
            serviceProfile: {
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'fixed',
              answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch' },
            },
          },
        });
        const b = await PartnersApi.putEditorDraft('rc10-f3b-B-' + Date.now(), {
          expectedRevision: null,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          schemaVersion: 2,
          values: {
            nameAr: 'مسودة B F3B',
            category: 'hair',
            priceHalalas: 6100,
            durationMin: 25,
            serviceProfile: {
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'from',
              answers: { session_kind: 'single', cut_style: 'style', place_mode: 'branch' },
            },
          },
        });
        return { a, b };
      });
      await page.evaluate(async (cid) => {
        const d = await PartnersApi.getEditorDraft(cid);
        await CatalogJourney.reopenServerDraft(d);
      }, drafts.a.clientDraftId);
      await page.waitForTimeout(500);
      const puts = [];
      await page.exposeFunction('__rc10F3bPut', (info) => puts.push(info));
      await page.evaluate(() => {
        const orig = PartnersApi.putEditorDraft.bind(PartnersApi);
        PartnersApi.putEditorDraft = async (id, payload, opts) => {
          if (window.__rc10F3bPut) {
            window.__rc10F3bPut({
              id,
              nameAr: payload && payload.values && payload.values.nameAr,
              rev: payload && payload.expectedRevision,
            });
          }
          return orig(id, payload, opts);
        };
      });
      let releasePut;
      const putGate = new Promise((r) => {
        releasePut = r;
      });
      let putHit = false;
      await page.route('**/editor-drafts/**', async (route) => {
        const req = route.request();
        if ((req.method() === 'PUT' || req.method() === 'PATCH') && !req.url().includes('materialize')) {
          putHit = true;
          await putGate;
        }
        await route.continue();
      });
      const file = page.locator('#catalogForm input[type="file"]').first();
      if ((await file.count()) > 0) {
        await file.setInputFiles({ name: 'f3b.png', mimeType: 'image/png', buffer: tinyPng });
        await page.waitForTimeout(300);
      }
      // Force a flushable dirty state then materialize
      await page.fill('#catalogForm [name="nameAr"]', 'مسودة A F3B dirty');
      const mat = page.locator('#catalogForm [data-editor-v2-materialize]');
      if ((await mat.count()) === 0) throw new Error('materialize missing F3B');
      await mat.click();
      const hitFlush = await waitSignal(() => putHit, 8000);
      await page.evaluate(async (cid) => {
        const d = await PartnersApi.getEditorDraft(cid);
        await CatalogJourney.reopenServerDraft(d);
      }, drafts.b.clientDraftId);
      await page.waitForTimeout(400);
      releasePut();
      await page.waitForTimeout(3500);
      await page.unroute('**/editor-drafts/**');
      const after = await page.evaluate(() => {
        const c = MiraEditorV2.getEditContext('catalogForm');
        return {
          cid: c && c.clientDraftId,
          name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
          rev: c && c.revision,
        };
      });
      const badPut = puts.some(
        (p) =>
          p.id === drafts.b.clientDraftId &&
          (/مسودة A|A F3B/.test(String(p.nameAr || '')) || p.rev === drafts.b.revision),
      );
      // Using B's revision for A's materialize is also a bug — check materialize body if any later puts carry B rev on A id
      const polluted =
        badPut ||
        (after.cid === drafts.b.clientDraftId && after.name !== 'مسودة B F3B' && /A F3B/.test(after.name || ''));
      findings.push({
        id: 'RC10-F3-B',
        reproduced: Boolean(polluted),
        after,
        puts,
        hitFlush,
        aId: drafts.a.clientDraftId,
        bId: drafts.b.clientDraftId,
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F3-C: late materialize success/fail after B open ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      const drafts = await page.evaluate(async () => {
        const mk = async (label, price) =>
          PartnersApi.putEditorDraft('rc10-f3c-' + label + '-' + Date.now(), {
            expectedRevision: null,
            kind: 'service',
            profileId: 'service.salon_hair_cut',
            schemaVersion: 2,
            values: {
              nameAr: 'مسودة ' + label + ' F3C',
              category: 'hair',
              priceHalalas: price,
              durationMin: 22,
              serviceProfile: {
                templateId: 'salon_hair_cut',
                templateVersion: 1,
                priceMode: 'fixed',
                answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch' },
              },
            },
          });
        return { a: await mk('A', 4200), b: await mk('B', 6200) };
      });
      await page.evaluate(async (cid) => {
        const d = await PartnersApi.getEditorDraft(cid);
        await CatalogJourney.reopenServerDraft(d);
      }, drafts.a.clientDraftId);
      await page.waitForTimeout(400);
      let releaseMat;
      const matGate = new Promise((r) => {
        releaseMat = r;
      });
      let matHit = false;
      await page.route('**/materialize**', async (route) => {
        matHit = true;
        await matGate;
        await route.continue();
      });
      const file = page.locator('#catalogForm input[type="file"]').first();
      if ((await file.count()) > 0) {
        await file.setInputFiles({ name: 'f3c.png', mimeType: 'image/png', buffer: tinyPng });
        await page.waitForTimeout(300);
      }
      await page.locator('#catalogForm [data-editor-v2-materialize]').click();
      await waitSignal(() => matHit, 15000);
      await page.evaluate(async (cid) => {
        const d = await PartnersApi.getEditorDraft(cid);
        await CatalogJourney.reopenServerDraft(d);
      }, drafts.b.clientDraftId);
      const bBefore = await page.evaluate(() => ({
        cid: MiraEditorV2.getEditContext('catalogForm')?.clientDraftId,
        name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
        owner: MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId,
      }));
      releaseMat();
      await page.waitForTimeout(3500);
      await page.unroute('**/materialize**');
      const bAfter = await page.evaluate(() => ({
        cid: MiraEditorV2.getEditContext('catalogForm')?.clientDraftId,
        name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
        owner: MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId,
        staged: (window.CatalogJourney && CatalogJourney.__testStaged && CatalogJourney.__testStaged('catalogForm')) || null,
      }));
      const polluted =
        bAfter.cid !== drafts.b.clientDraftId ||
        bAfter.name !== 'مسودة B F3C' ||
        (bAfter.owner != null && bBefore.owner == null && bAfter.cid === drafts.b.clientDraftId);
      findings.push({
        id: 'RC10-F3-C',
        reproduced: Boolean(polluted),
        bBefore,
        bAfter,
        aId: drafts.a.clientDraftId,
        bId: drafts.b.clientDraftId,
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F3-D: late failed recover + account isolation sketch ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      const draftA = await page.evaluate(async () => {
        return PartnersApi.putEditorDraft('rc10-f3d-A-' + Date.now(), {
          expectedRevision: null,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          schemaVersion: 2,
          values: {
            nameAr: 'مسودة A F3D',
            category: 'hair',
            priceHalalas: 3000,
            durationMin: 15,
            serviceProfile: {
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'fixed',
              answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch' },
            },
          },
        });
      });
      await page.evaluate(async (cid) => {
        const d = await PartnersApi.getEditorDraft(cid);
        await CatalogJourney.reopenServerDraft(d);
      }, draftA.clientDraftId);
      let releaseMat;
      const matGate = new Promise((r) => {
        releaseMat = r;
      });
      let matHit = false;
      await page.route('**/materialize**', async (route) => {
        matHit = true;
        await matGate;
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'RC10-F3D late fail' }),
        });
      });
      const file = page.locator('#catalogForm input[type="file"]').first();
      if ((await file.count()) > 0) {
        await file.setInputFiles({ name: 'f3d.png', mimeType: 'image/png', buffer: tinyPng });
      }
      await page.locator('#catalogForm [data-editor-v2-materialize]').click();
      await waitSignal(() => matHit, 12000);
      // Switch session token mid-flight
      await page.evaluate(() => {
        PartnersApi.saveSession('other-rc10-f3d@test.local', 'token-OTHER-rc10-xxxxxxxxxxxx');
      });
      releaseMat();
      await page.waitForTimeout(2000);
      await page.unroute('**/materialize**');
      const after = await page.evaluate(() => {
        const c = MiraEditorV2.getEditContext('catalogForm');
        return {
          email: localStorage.getItem('mira_partner_email'),
          cid: c && c.clientDraftId,
          owner: c && c.targetOwnerId,
          status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
        };
      });
      // Must not bind owner onto wrong-account context; email switched
      const polluted = after.owner != null && after.email === 'other-rc10-f3d@test.local';
      findings.push({
        id: 'RC10-F3-D',
        reproduced: Boolean(polluted),
        after,
        aId: draftA.clientDraftId,
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F1 smoke: early save must not put stale local ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      const created = await page.evaluate(async () => {
        const svc = await PartnersApi.createService({
          nameAr: 'خدمة RC10-F1',
          priceHalalas: 9000,
          category: 'hair',
          durationMin: 45,
        });
        let rev = 0;
        for (let i = 0; i < 9; i++) {
          const cur = await PartnersApi.getServiceProfile(svc.id);
          await PartnersApi.putServiceProfile(svc.id, {
            expectedRevision: cur.reviewRevision,
            templateId: 'salon_hair_cut',
            templateVersion: 1,
            priceMode: i === 8 ? 'from' : 'fixed',
            answers: {
              session_kind: 'single',
              cut_style: 'cut',
              place_mode: 'branch',
              excludes: i === 8 ? 'خادم F1' : 'قديم',
            },
          });
          rev = (await PartnersApi.getServiceProfile(svc.id)).reviewRevision;
        }
        return { id: svc.id, rev };
      });
      let releaseBind;
      const bindGate = new Promise((r) => {
        releaseBind = r;
      });
      await page.route('**/service-profile**', async (route) => {
        if (route.request().method() === 'GET') await bindGate;
        await route.continue();
      });
      await page.evaluate(({ id, rev }) => {
        localStorage.setItem(
          'mira-service-template:' + id,
          JSON.stringify({
            templateId: 'salon_hair_cut',
            templateVersion: 1,
            priceMode: 'fixed',
            answers: {
              session_kind: 'single',
              cut_style: 'cut',
              place_mode: 'branch',
              excludes: 'محلي قديم F1',
            },
          }),
        );
        if (window.MiraEditorV2 && MiraEditorV2.scopedTemplateKey) {
          localStorage.setItem(
            MiraEditorV2.scopedTemplateKey(id),
            JSON.stringify({
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'fixed',
              answers: {
                session_kind: 'single',
                cut_style: 'cut',
                place_mode: 'branch',
                excludes: 'محلي قديم F1',
              },
            }),
          );
        }
        CatalogJourney.renderForm(
          'salon',
          { id, nameAr: 'خدمة RC10-F1', priceHalalas: 9000, category: 'hair', durationMin: 45, reviewRevision: rev },
          'catalogForm',
          'catalogTitle',
        );
      }, created);
      await page.evaluate(() => {
        window.__puts = [];
        const o = PartnersApi.putServiceProfile.bind(PartnersApi);
        PartnersApi.putServiceProfile = async (id, payload, opts) => {
          window.__puts.push({ mode: payload.priceMode, ex: payload.answers && payload.answers.excludes, rev: payload.expectedRevision });
          return o(id, payload, opts);
        };
      });
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForTimeout(400);
      releaseBind();
      await page.waitForTimeout(2500);
      await page.unroute('**/service-profile**');
      const puts = await page.evaluate(() => window.__puts || []);
      const stale = puts.some((p) => p.mode === 'fixed' && /محلي قديم/.test(String(p.ex || '')));
      findings.push({ id: 'RC10-F1', reproduced: stale, puts, expectBugs });
      await ctx.close();
    }

    // ——— F4 smoke: legacy create ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__MIRA_FORCE_EDITOR_V2 = false;
      });
      await page.goto(loginUrl + (loginUrl.includes('?') ? '&' : '?') + 'editor-v2=0');
      await page.evaluate(() => localStorage.setItem('mira_partner_editor_v2', 'false'));
      await page.fill('input[name="email"]', ready.salonEmail);
      await page.fill('input[name="password"]', ready.password);
      await Promise.all([page.waitForURL(/dashboard/), page.click('button[type="submit"]')]);
      await page.waitForTimeout(900);
      await page.evaluate(() => {
        if (window.MiraEditorV2 && MiraEditorV2.state) MiraEditorV2.state.enabled = false;
      });
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      await page.fill('#catalogForm [name="nameAr"]', 'خدمة RC10-F4');
      await page.selectOption('#catalogForm [name="category"]', 'hair').catch(() => {});
      await page.fill('#catalogForm [name="priceSar"]', '40');
      await page.fill('#catalogForm [name="durationMin"]', '20').catch(() => {});
      const tpl = page.locator('#catalogForm select[name="serviceTemplateId"]');
      if ((await tpl.count()) > 0) {
        const vals = await tpl.locator('option').evaluateAll((n) => n.map((x) => x.value).filter(Boolean));
        if (vals[0]) await tpl.selectOption(vals.find((v) => v === 'salon_hair_cut') || vals[0]);
      }
      const file = page.locator('#catalogForm input[type="file"]').first();
      if ((await file.count()) > 0) {
        await file.setInputFiles({ name: 'f4.png', mimeType: 'image/png', buffer: tinyPng });
      }
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForTimeout(3500);
      const state = await page.evaluate(async () => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.nameAr === 'خدمة RC10-F4');
        const form = document.querySelector('#catalogForm');
        const save = document.querySelector('#catalogForm button[type="submit"]');
        return {
          created: Boolean(hit),
          saving: form && form.dataset.saving,
          saveDisabled: save && save.disabled,
        };
      });
      const stuck = state.created && (state.saving === '1' || state.saveDisabled === true);
      findings.push({ id: 'RC10-F4', reproduced: stuck || !state.created, state, expectBugs });
      await ctx.close();
    }
  } finally {
    await browser.close().catch(() => {});
    staticServer.close();
    child.kill('SIGTERM');
  }

  const finishedUtc = new Date().toISOString();
  let ok;
  if (expectBugs) {
    // Require core residual bugs on RC9; F1/F4 already closed there.
    const need = ['RC10-F2-A', 'RC10-F2-D', 'RC10-F3-A'];
    ok = need.every((id) => {
      const f = findings.find((x) => x.id === id);
      return f && f.reproduced === true;
    });
  } else {
    // Fixed tree: every case must show defect absent (reproduced === false).
    const requiredFixed = [
      'RC10-F2-A',
      'RC10-F2-B',
      'RC10-F2-C',
      'RC10-F2-D',
      'RC10-F2-E',
      'RC10-F3-A',
      'RC10-F3-B',
      'RC10-F3-C',
      'RC10-F3-D',
      'RC10-F1',
      'RC10-F4',
    ];
    ok = requiredFixed.every((id) => {
      const f = findings.find((x) => x.id === id);
      return f && f.reproduced === false;
    });
  }

  const payload = {
    ok,
    expectBugs,
    commit,
    db: dbMeta,
    startedUtc,
    finishedUtc,
    findings,
    exitCode: ok ? 0 : 2,
  };
  writeFileSync(join(outDir, 'f2-f3-defects.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = ok ? 0 : 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
