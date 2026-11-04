/** Focused RC8-01 put probe */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
mkdirSync(join(root, 'audit-out', 'p1-rc8', 'logs'), { recursive: true });

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };
function serveStatic(port) {
  const server = createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
    if (rel === '/') rel = '/index.html';
    const file = join(webRoot, rel.replace(/^\//, ''));
    if (!file.startsWith(webRoot) || !existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
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
  await page.waitForTimeout(1500);
}

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function main() {
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  const child = spawn('npx', ['tsx', 'scripts/p1-rc8-browser-server.ts'], { cwd: join(root, 'mira-api'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const ready = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error(buf)), 90000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      for (const line of buf.split('\n')) {
        if (!line.includes('"ready"')) continue;
        try { const j = JSON.parse(line.trim()); if (j.ready) { clearTimeout(t); resolve(j); } } catch (_) {}
      }
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (c) => reject(new Error('exit ' + c)));
  });
  const staticServer = await serveStatic(8799);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:8799/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await login(page, loginUrl, ready.salonEmail, ready.password);
    await page.click('#goService');
    await page.waitForSelector('#catalogForm [name="nameAr"]');
    await page.fill('#catalogForm [name="nameAr"]', 'خدمة probe');
    await page.selectOption('#catalogForm [name="category"]', 'hair');
    await page.fill('#catalogForm [name="priceSar"]', '90');
    await page.fill('#catalogForm [name="durationMin"]', '45');
    await page.selectOption('#catalogForm select[name="serviceTemplateId"]', 'salon_hair_cut');
    await page.waitForTimeout(500);
    await page.locator('#catalogForm input[type="radio"][value="single"]').first().check().catch(()=>{});
    await page.locator('#catalogForm input[type="radio"]').nth(1).check().catch(()=>{});
    await page.locator('#catalogForm input[type="radio"][value="branch"]').first().check().catch(()=>{});
    await page.locator('#catalogForm select[name="priceMode"]').selectOption('fixed');
    await page.locator('#catalogForm button[type="submit"]').first().click();
    await page.waitForFunction(() => document.querySelector('#catalogForm [data-editor-v2-status]')?.dataset?.kind === 'saved', { timeout: 25000 });
    const file = page.locator('#catalogForm input[type="file"]').first();
    await file.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: tinyPng });
    await page.waitForTimeout(700);
    await page.locator('#catalogForm [data-editor-v2-materialize]').click();
    await page.waitForTimeout(2800);
    let st = await page.locator('#catalogForm').innerText();
    if (/استئناف|تعذر/.test(st)) {
      await file.setInputFiles({ name: 'x2.png', mimeType: 'image/png', buffer: tinyPng });
      await page.waitForTimeout(800);
      await page.locator('#catalogForm [data-editor-v2-materialize]').click();
      await page.waitForTimeout(2500);
    }
    await page.waitForFunction(() => MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId, { timeout: 10000 });
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => ({
      rev: MiraEditorV2.getEditContext('catalogForm')?.serviceReviewRevision,
      status: document.querySelector('#catalogForm [data-editor-v2-status]')?.textContent,
      kind: document.querySelector('#catalogForm [data-editor-v2-status]')?.dataset?.kind,
      pm: document.querySelector('#catalogForm select[name="priceMode"]')?.value,
    }));
    await page.evaluate(() => {
      window.__probe = [];
      const orig = PartnersApi.putServiceProfile.bind(PartnersApi);
      PartnersApi.putServiceProfile = async (id, payload, opts) => {
        window.__probe.push({ phase: 'req', ...payload });
        try {
          const out = await orig(id, payload, opts);
          window.__probe.push({ phase: 'ok', rev: out.reviewRevision });
          return out;
        } catch (e) {
          window.__probe.push({ phase: 'err', code: e.code, msg: e.message, body: e.body });
          throw e;
        }
      };
      const sel = document.querySelector('#catalogForm select[name="priceMode"]');
      sel.value = 'from';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.locator('#catalogForm button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
    const after = await page.evaluate(async () => {
      const id = MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId;
      const server = await PartnersApi.getServiceProfile(id);
      const doc = server.draftServiceProfileSet ? server.draftServiceProfileJson : server.serviceProfileJson;
      return {
        probe: window.__probe,
        ui: document.querySelector('#catalogForm select[name="priceMode"]')?.value,
        status: (document.querySelector('#catalogForm')?.innerText || '').slice(0, 300),
        serverMode: doc?.priceMode,
        serverRev: server.reviewRevision,
      };
    });
    const out = { before, after };
    console.log(JSON.stringify(out, null, 2));
    writeFileSync(join(root, 'audit-out', 'p1-rc8', 'logs', 'rc8-probe-01.json'), JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
    staticServer.close();
    child.kill('SIGTERM');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
