/**
 * RC13 residual defects: externalUrl epoch + persist busy ownership.
 * --expect-bugs: require defects on RC11 baseline UI.
 * Default: require defects absent on RC13.
 * Optional MIRA_RC13_OUT_DIR overrides evidence folder.
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
const outDir =
  process.env.MIRA_RC13_OUT_DIR ||
  join(root, 'audit-out', 'p1-rc13', expectBugs ? 'sensitivity-rc10' : 'sensitivity-post');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(root, 'audit-out', 'p1-rc13', 'logs'), { recursive: true });

function assertDb(url) {
  const u = new URL(url);
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error('REFUSE host');
  if (db !== 'mira_p1_rc13_test') throw new Error('REFUSE db ' + db);
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
  await page.waitForTimeout(900);
}

async function waitSignal(getFlag, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await getFlag()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return false;
}

async function main() {
  const startedUtc = new Date().toISOString();
  const dbMeta = assertDb(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';

  const child = spawn('npx', ['tsx', 'scripts/p1-rc13-browser-server.ts'], {
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

  const portalPort = expectBugs ? 8853 : 8854;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const findings = [];
  const commit = process.env.RC13_TESTED_COMMIT || 'WORKING_TREE';

  try {
    // ——— RC13-F2-URL: externalUrl change during updateProduct ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.brandEmail, ready.password);
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 }).catch(async () => {
        await page.goto(loginUrl.replace('login.html', 'dashboard.html'));
        await page.waitForTimeout(700);
      });
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 });

      const id = await page.evaluate(async () => {
        const p = await PartnersApi.createProduct({
          nameAr: 'منتج RC13-URL',
          priceHalalas: 4500,
          category: 'face',
          purchaseMode: 'external',
          externalUrl: 'https://example.com/old-rc13',
        });
        return p.id;
      });
      await page.evaluate((pid) => {
        CatalogJourney.renderForm(
          'brand',
          {
            id: pid,
            nameAr: 'منتج RC13-URL',
            priceHalalas: 4500,
            category: 'face',
            purchaseMode: 'external',
            externalUrl: 'https://example.com/old-rc13',
          },
          'catalogForm',
          'catalogTitle',
        );
      }, id);
      await page.waitForSelector('#catalogForm [name="externalUrl"]', { timeout: 8000 });
      // Ensure link mode selected
      const linkRadio = page.locator('#catalogForm input[name="purchaseMode"][value="link"]');
      if ((await linkRadio.count()) > 0) await linkRadio.check();
      await page.fill('#catalogForm [name="externalUrl"]', 'https://example.com/old-rc13');

      let release;
      const gate = new Promise((r) => {
        release = r;
      });
      let putStarted = false;
      let putBodies = [];
      await page.route('**/products/**', async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          putStarted = true;
          try {
            putBodies.push(JSON.parse(route.request().postData() || '{}'));
          } catch (_) {}
          await gate;
        }
        await route.continue();
      });

      await page.locator('#catalogForm button[type="submit"]').first().click();
      const started = await waitSignal(() => putStarted, 15000);
      if (!started) throw new Error('RC13-F2-URL: updateProduct never started');
      await page.fill('#catalogForm [name="externalUrl"]', 'https://example.com/new-rc13');
      await page.locator('#catalogForm [name="externalUrl"]').dispatchEvent('input');
      release();
      await page.waitForTimeout(2800);
      await page.unroute('**/products/**');

      const ui = await page.evaluate(() => ({
        url: document.querySelector('#catalogForm [name="externalUrl"]')?.value,
        status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
        unsaved: document.querySelector('#catalogForm [data-unsaved-newer]') != null,
        saveLabel: document.querySelector('#catalogForm button[type="submit"]')?.textContent || '',
        saving: document.querySelector('#catalogForm')?.dataset.saving || '',
      }));
      // Bug: UI reverts to old URL and claims full save without unsaved notice
      const wiped =
        ui.url === 'https://example.com/old-rc13' ||
        (ui.url === 'https://example.com/new-rc13' &&
          !ui.unsaved &&
          !/غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel));
      const fixedOk =
        ui.url === 'https://example.com/new-rc13' &&
        (ui.unsaved || /غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel));

      let after = null;
      if (!expectBugs && fixedOk) {
        await page.locator('#catalogForm button[type="submit"]').first().click();
        await page.waitForTimeout(2500);
        after = await page.evaluate(async (pid) => {
          const d = await PartnersApi.dashboard();
          const hit = ((d.catalog && d.catalog.products) || []).find((p) => p.id === pid);
          CatalogJourney.renderForm('brand', hit, 'catalogForm', 'catalogTitle');
          await new Promise((r) => setTimeout(r, 700));
          const link = document.querySelector('#catalogForm input[name="purchaseMode"][value="link"]');
          if (link && !link.checked) link.checked = true;
          return {
            serverUrl: hit && hit.externalUrl,
            uiUrl: document.querySelector('#catalogForm [name="externalUrl"]')?.value,
          };
        }, id);
      }

      findings.push({
        id: 'RC13-F2-URL',
        reproduced: expectBugs ? wiped : !fixedOk || !after || after.serverUrl !== 'https://example.com/new-rc13' || after.uiUrl !== 'https://example.com/new-rc13',
        ui,
        after,
        putBodies: putBodies.slice(0, 2),
        expectBugs,
      });
      await page.screenshot({ path: join(outDir, 'RC13-F2-URL.png'), fullPage: true }).catch(() => {});
      await ctx.close();
    }

    // ——— RC13-F2-BUSY: first save must keep ownership through refreshLists ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');

      const id = await page.evaluate(async () => {
        const s = await PartnersApi.createService({
          nameAr: 'خدمة RC13-BUSY',
          priceHalalas: 6100,
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
          { id: sid, nameAr: 'خدمة RC13-BUSY', priceHalalas: 6100, category: 'hair', durationMin: 30 },
          'catalogForm',
          'catalogTitle',
        );
      }, id);
      await page.waitForFunction(() => document.querySelector('#catalogForm select[name="priceMode"]')?.value, {
        timeout: 12000,
      });

      let releaseMe;
      const meGate = new Promise((r) => {
        releaseMe = r;
      });
      let meHit = false;
      let nestedPutAfterMe = false;
      let putsDuringMeGate = 0;
      await page.route('**/partners-portal/me**', async (route) => {
        if (route.request().method() === 'GET') {
          meHit = true;
          await meGate;
        }
        await route.continue();
      });
      await page.route('**/partners-portal/services/**', async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
          // Any service write that starts while /me is gated is a nested/overlapping save.
          if (meHit) {
            putsDuringMeGate += 1;
            nestedPutAfterMe = true;
          }
        }
        await route.continue();
      });

      await page.locator('#catalogForm button[type="submit"]').first().click();
      const hit = await waitSignal(() => meHit, 20000);
      if (!hit) throw new Error('RC13-F2-BUSY: refreshLists /me never started');

      const mid = await page.evaluate(() => ({
        saving: document.querySelector('#catalogForm')?.dataset.saving || '',
        disabled: document.querySelector('#catalogForm button[type="submit"]')?.disabled === true,
        label: document.querySelector('#catalogForm button[type="submit"]')?.textContent || '',
        persistToken: document.querySelector('#catalogForm')?.dataset.persistToken || '',
      }));

      // Attempt nested save while first op still in refreshLists (force-click: button should stay owned/busy)
      await page.fill('#catalogForm [name="nameAr"]', 'خدمة RC13-BUSY أحدث');
      await page.locator('#catalogForm [name="nameAr"]').dispatchEvent('input');
      const nested = await page.evaluate(async () => {
        const form = document.querySelector('#catalogForm');
        const beforePuts = window.__rc13ServicePuts || 0;
        // Direct submit path — persistListing must no-op while dataset.saving===1
        const ev = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(ev);
        await new Promise((r) => setTimeout(r, 200));
        // Also try clicking the busy button programmatically
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.click();
        await new Promise((r) => setTimeout(r, 400));
        return {
          saving: form.dataset.saving || '',
          disabled: btn ? btn.disabled === true : null,
          name: form.querySelector('[name="nameAr"]')?.value,
          returnedEarly: form.dataset.saving === '1',
        };
      });
      const afterClick = nested;

      releaseMe();
      await page.waitForTimeout(2500);
      await page.unroute('**/partners-portal/me**');
      await page.unroute('**/partners-portal/services/**');

      const end = await page.evaluate(() => ({
        saving: document.querySelector('#catalogForm')?.dataset.saving || '',
        disabled: document.querySelector('#catalogForm button[type="submit"]')?.disabled === true,
        label: document.querySelector('#catalogForm button[type="submit"]')?.textContent || '',
        name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
        unsaved: document.querySelector('#catalogForm [data-unsaved-newer]') != null,
        status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
      }));

      // Bug on RC11: mid.saving cleared / button enabled during refreshLists; nested put may start
      const bug =
        mid.saving !== '1' ||
        mid.disabled !== true ||
        nestedPutAfterMe === true;

      const fixedOk =
        mid.saving === '1' &&
        mid.disabled === true &&
        nestedPutAfterMe === false &&
        afterClick.name === 'خدمة RC13-BUSY أحدث' &&
        afterClick.returnedEarly === true &&
        end.saving !== '1' &&
        end.disabled === false &&
        (end.unsaved || /غير محفوظ|أحدث|متبقي/.test(end.status + end.label));

      let reopen = null;
      if (!expectBugs && fixedOk) {
        await page.locator('#catalogForm button[type="submit"]').first().click();
        await page.waitForTimeout(2500);
        reopen = await page.evaluate(async (sid) => {
          const d = await PartnersApi.dashboard();
          const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
          return { name: hit && hit.nameAr };
        }, id);
      }

      findings.push({
        id: 'RC13-F2-BUSY',
        reproduced: expectBugs ? bug : !fixedOk || (reopen && reopen.name !== 'خدمة RC13-BUSY أحدث'),
        mid,
        afterClick,
        end,
        nestedPutAfterMe,
        putsDuringMeGate,
        reopen,
        expectBugs,
      });
      await page.screenshot({ path: join(outDir, 'RC13-F2-BUSY.png'), fullPage: true }).catch(() => {});
      await ctx.close();
    }

    // ——— Regression smokes from RC11 ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.brandEmail, ready.password);
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 });
      const id = await page.evaluate(async () => {
        const p = await PartnersApi.createProduct({
          nameAr: 'منتج RC13-F2A',
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
            nameAr: 'منتج RC13-F2A',
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
      await page.waitForTimeout(2200);
      await page.unroute('**/products/**');
      const ui = await page.evaluate(() => ({
        stock: document.querySelector('#catalogForm [name="stockQty"]')?.value,
        unsaved: document.querySelector('#catalogForm [data-unsaved-newer]') != null,
        status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
        saveLabel: document.querySelector('#catalogForm button[type="submit"]')?.textContent || '',
      }));
      const ok = ui.stock === '99' && (ui.unsaved || /غير محفوظ|أحدث|متبقي/.test(ui.status + ui.saveLabel));
      findings.push({ id: 'RC13-REG-F2A', reproduced: !ok, ui, expectBugs });
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
    const need = ['RC13-F2-URL', 'RC13-F2-BUSY'];
    ok = need.every((id) => {
      const f = findings.find((x) => x.id === id);
      return f && f.reproduced === true;
    });
  } else {
    ok = findings.every((f) => f.reproduced === false);
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
    type: 'browser-gated-defects',
  };
  writeFileSync(join(outDir, 'f2-busy-defects.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = ok ? 0 : 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
