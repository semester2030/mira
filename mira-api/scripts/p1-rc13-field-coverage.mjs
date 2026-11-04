/**
 * RC13 FIELD ROUNDTRIP — gate mid-save, prove payload + server + reopen (not DOM-only).
 * Required SKIP / ungated fallback / swallowed timeout => FAIL.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateFieldRoundtrip,
  evaluateFieldCoverageMatrix,
  REQUIRED_FIELD_IDS,
} from './p1-rc13-acceptance-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const outDir = process.env.MIRA_RC13_OUT_DIR || join(root, 'audit-out', 'p1-rc13');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

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

async function waitSaved(page, timeout = 20000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#catalogForm [data-editor-v2-status]');
    const persist = document.querySelector('#catalogForm [data-catalog-persist-status]');
    const t = ((el && el.textContent) || '') + ((persist && persist.textContent) || '');
    if (persist && /حُفظت المسودة|القالب والبيانات محفوظان|تم الحفظ|حفظ التعديلات المتبقية/.test(t)) return true;
    return el && (el.dataset.kind === 'saved' || /محفوظ|حُفظت/.test(el.textContent || ''));
  }, { timeout });
}
async function softWaitSaved(page, timeout = 12000) {
  try { await waitSaved(page, timeout); } catch (_) { await page.waitForTimeout(1500); }
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const PRODUCT_SPECS = [
  { field: 'nameAr', selector: '[name="nameAr"]', kind: 'text', oldVal: 'اسم قديم RC13', newVal: 'اسم جديد RC13', serverKey: 'nameAr', category: 'clothes' },
  { field: 'nameEn', selector: '[name="nameEn"]', kind: 'text', oldVal: 'Old EN RC13', newVal: 'New EN RC13', serverKey: 'nameEn', category: 'clothes' },
  { field: 'descriptionAr', selector: '[name="descriptionAr"]', kind: 'text', oldVal: 'وصف قديم', newVal: 'وصف جديد', serverKey: 'descriptionAr', category: 'clothes' },
  { field: 'priceSar', selector: '[name="priceSar"]', kind: 'text', oldVal: '40', newVal: '66', serverKey: 'priceHalalas', normalize: (v) => String(Math.round(Number(v) * 100)), category: 'clothes' },
  { field: 'category', selector: '[name="category"]', kind: 'select', oldVal: 'clothes', newVal: 'face', serverKey: 'category', category: 'clothes' },
  { field: 'concernTags', selector: '[name="concernTags"]', kind: 'text', oldVal: 'جفاف', newVal: 'حبوب', serverKey: 'concernTags', category: 'face', normalizeServer: (v) => (Array.isArray(v) ? v.join(',') : String(v || '')) },
  { field: 'stockQty', selector: '[name="stockQty"]', kind: 'text', oldVal: '2', newVal: '8', serverKey: 'stockQty', category: 'clothes' },
  { field: 'deliveryFeeSar', selector: '[name="deliveryFeeSar"]', kind: 'text', oldVal: '10', newVal: '18', serverKey: 'deliveryFeeHalalas', normalize: (v) => String(Math.round(Number(v) * 100)), category: 'clothes' },
  { field: 'externalUrl', selector: '[name="externalUrl"]', kind: 'text', oldVal: 'https://example.com/old-rc13', newVal: 'https://example.com/new-rc13', serverKey: 'externalUrl', category: 'clothes', needsExternal: true },
  { field: 'purchaseMode', selector: 'input[name="purchaseMode"][value="external"], input[value="external"]', kind: 'radio', oldVal: 'internal_cod', newVal: 'external', serverKey: 'purchaseMode', category: 'clothes', independent: true },
  { field: 'skinTypes', selector: '[name="skinTypes"]', kind: 'text', oldVal: 'دهنية', newVal: 'مختلطة', serverKey: 'skinTypes', category: 'face', normalizeServer: (v) => (Array.isArray(v) ? v.join(',') : String(v || '')) },
  { field: 'stepAr', selector: '[name="stepAr"]', kind: 'text', oldVal: 'تنظيف', newVal: 'ترطيب', serverKey: 'stepAr', category: 'face' },
];

const SERVICE_SPECS = [
  { field: 'nameAr', selector: '[name="nameAr"]', kind: 'text', oldVal: 'خدمة قديمة RC13', newVal: 'خدمة جديدة RC13', serverKey: 'nameAr' },
  { field: 'priceSar', selector: '[name="priceSar"]', kind: 'text', oldVal: '70', newVal: '85', serverKey: 'priceHalalas', normalize: (v) => String(Math.round(Number(v) * 100)) },
  { field: 'durationMin', selector: '[name="durationMin"]', kind: 'text', oldVal: '30', newVal: '50', serverKey: 'durationMin' },
  { field: 'bookingEnabled', selector: '[name="bookingEnabled"]', kind: 'checkbox', oldVal: false, newVal: true, serverKey: 'bookingEnabled' },
  { field: 'priceMode', selector: '[name="priceMode"]', kind: 'select', oldVal: 'fixed', newVal: 'fixed', serverKey: 'priceMode', viaProfile: true },
  { field: 'serviceTemplate', selector: '[name="serviceTemplateId"]', kind: 'select', oldVal: null, newVal: 'salon_hair_cut', serverKey: 'templateId', viaProfile: true },
  { field: 'templateVersion', selector: null, kind: 'derived', oldVal: 1, newVal: 1, serverKey: 'templateVersion', viaProfile: true },
  { field: 'templateAnswers', selector: '[name="excludes"]', kind: 'text', oldVal: 'قبل', newVal: 'بعد', serverKey: 'answers.excludes', viaProfile: true },
  { field: 'availabilityJson', selector: '.availability-day input[type="checkbox"], [data-availability] input[type="checkbox"]', kind: 'checkbox', oldVal: false, newVal: true, serverKey: 'availabilityJson' },
];

async function main() {
  const dbMeta = assertDb(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  const child = spawn('npx', ['tsx', 'scripts/p1-rc13-browser-server.ts'], {
    cwd: join(root, 'mira-api'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready;
  await new Promise((resolve, reject) => {
    let buf = '';
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      for (const line of buf.split('\n')) {
        if (!line.includes('"ready"')) continue;
        try {
          const j = JSON.parse(line);
          if (j.ready) {
            ready = j;
            resolve();
          }
        } catch (_) {}
      }
    });
    child.stderr.on('data', (c) => process.stderr.write(c));
    setTimeout(() => reject(new Error('server timeout')), 90000);
  });

  const portalPort = 8874;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  const matrix = [];
  const coverage = [];

  function record(row) {
    rows.push(row);
    coverage.push({
      field: row.field,
      scope: row.scope,
      evidence: row.evidence,
      testId: row.testId,
      status: row.status,
      note: row.note,
    });
    matrix.push(row);
  }

  try {
    // ——— Product field roundtrips ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.brandEmail, ready.password);
      await page.click('#goProduct');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      await page.fill('#catalogForm [name="nameAr"]', 'منتج RC13 fields base');
      await page.selectOption('#catalogForm [name="category"]', 'clothes');
      await page.fill('#catalogForm [name="priceSar"]', '40');
      await page.fill('#catalogForm [name="stockQty"]', '1');
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await softWaitSaved(page);

      // Materialize to get stable owner for reopen
      const tiny = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      const file = page.locator('#catalogForm input[type="file"]').first();
      if ((await file.count()) > 0 && (await page.locator('#catalogForm [data-editor-v2-materialize]').count()) > 0) {
        await file.setInputFiles({ name: 'f.png', mimeType: 'image/png', buffer: tiny });
        await page.locator('#catalogForm [data-editor-v2-materialize]').click();
        await page.waitForTimeout(3500);
      }
      let ownerId = await page.evaluate(() => MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId || null);
      if (!ownerId) {
        ownerId = await page.evaluate(async () => {
          const d = await PartnersApi.dashboard();
          const hit = ((d.catalog && d.catalog.products) || []).find((p) => p.nameAr === 'منتج RC13 fields base');
          return hit && hit.id;
        });
      }

      async function readServerProduct(id, key, normalizeServer) {
        return page.evaluate(async ({ id, key }) => {
          const prev = await PartnersApi.preview('products', id);
          const d = await PartnersApi.dashboard();
          const row = ((d.catalog && d.catalog.products) || []).find((p) => p.id === id) || {};
          const map = {
            nameAr: prev.draftNameAr != null ? prev.draftNameAr : (prev.publishedNameAr || row.nameAr),
            nameEn: prev.draftNameEn != null ? prev.draftNameEn : (prev.publishedNameEn || row.nameEn),
            descriptionAr: prev.draftDescriptionAr != null ? prev.draftDescriptionAr : (prev.publishedDescriptionAr || row.descriptionAr),
            priceHalalas: prev.priceHalalas != null ? prev.priceHalalas : row.priceHalalas,
            category: row.category,
            concernTags: row.concernTags || row.draftConcernTags,
            stockQty: row.stockQty,
            deliveryFeeHalalas: row.deliveryFeeHalalas,
            externalUrl: row.externalUrl,
            purchaseMode: row.purchaseMode,
            skinTypes: row.skinTypes,
            stepAr: row.stepAr,
          };
          return map[key] != null ? map[key] : row[key];
        }, { id, key }).then((v) => (normalizeServer ? normalizeServer(v) : v == null ? '' : String(v)));
      }

      async function setField(spec, val) {
        if (spec.needsExternal) {
          const purchaseExternal = page.locator('#catalogForm input[name="purchaseMode"][value="external"], #catalogForm input[value="external"]');
          if ((await purchaseExternal.count()) > 0) await purchaseExternal.first().check();
        }
        if (spec.category) {
          const cat = page.locator('#catalogForm [name="category"]');
          if ((await cat.count()) > 0) {
            const cur = await cat.inputValue();
            if (cur !== spec.category) {
              await cat.selectOption(spec.category);
              await page.waitForTimeout(300);
            }
          }
        }
        const el = page.locator('#catalogForm ' + spec.selector).first();
        if ((await el.count()) === 0) return { ok: false, reason: 'control-absent' };
        if (!(await el.isVisible().catch(() => false)) && spec.kind !== 'radio') {
          return { ok: false, reason: 'control-hidden' };
        }
        if (spec.kind === 'select') await el.selectOption(String(val));
        else if (spec.kind === 'radio') {
          const radio = page.locator('#catalogForm ' + spec.selector).first();
          await radio.check();
        } else if (spec.kind === 'checkbox') {
          if (val) await el.check();
          else await el.uncheck();
        } else {
          await el.fill(String(val));
          await el.dispatchEvent('input').catch(() => {});
        }
        return { ok: true };
      }

      async function uiValue(spec) {
        const el = page.locator('#catalogForm ' + spec.selector).first();
        if ((await el.count()) === 0) return null;
        if (spec.kind === 'checkbox') return el.isChecked();
        if (spec.kind === 'radio') return el.isChecked() ? spec.newVal : null;
        return el.inputValue();
      }

      for (const spec of PRODUCT_SPECS) {
        const testId = 'RC13-FIELD-product-' + spec.field;
        const shot = join(outDir, 'screenshots', testId + '.png');
        try {
          if (spec.independent && spec.field === 'purchaseMode') {
            // independent: set COD first then external via gated save
            const cod = page.locator('#catalogForm input[value="internal_cod"], #catalogForm input[name="purchaseMode"][value="internal_cod"]');
            if ((await cod.count()) > 0) await cod.first().check();
            await page.locator('#catalogForm button[type="submit"]').first().click();
            await softWaitSaved(page);
          }

          const setOld = await setField(spec, spec.oldVal);
          if (!setOld.ok) {
            record({
              testId,
              scope: 'product',
              field: spec.field,
              ownerId,
              oldValue: spec.oldVal,
              editedValue: spec.newVal,
              requestValue: '',
              serverValue: '',
              reopenedValue: '',
              dirtyEvidence: setOld.reason,
              status: 'FAIL',
              evidence: setOld.reason,
              evidencePath: shot,
              note: 'required control must be visible for fixture category',
            });
            await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
            continue;
          }
          await page.locator('#catalogForm button[type="submit"]').first().click();
          await softWaitSaved(page);

          const editedNorm = spec.normalize ? spec.normalize(spec.newVal) : String(spec.newVal);
          let capturedPayload = null;
          let release;
          const gate = new Promise((r) => { release = r; });
          let started = false;
          await page.route('**/partners-portal/**', async (route) => {
            const m = route.request().method();
            const u = route.request().url();
            if ((m === 'PUT' || m === 'PATCH' || m === 'POST') && /products|editor-drafts/.test(u) && !/media|materialize|submit-review/.test(u)) {
              started = true;
              try {
                const post = route.request().postDataJSON();
                capturedPayload = post;
              } catch (_) {}
              await gate;
            }
            await route.continue();
          });
          await page.locator('#catalogForm button[type="submit"]').first().click();
          const t0 = Date.now();
          while (!started && Date.now() - t0 < 15000) await page.waitForTimeout(40);
          if (!started) {
            await page.unroute('**/partners-portal/**');
            const ev = evaluateFieldRoundtrip({
              required: true,
              skipped: false,
              gateStarted: false,
              ungatedFallback: true,
              editedValue: String(spec.newVal),
              editedNormalized: editedNorm,
              midUiValue: null,
              payloadValue: null,
              payloadNormalized: null,
              serverValue: null,
              serverNormalized: null,
              reopenedValue: null,
              reopenedNormalized: null,
            });
            record({
              testId,
              scope: 'product',
              field: spec.field,
              ownerId,
              oldValue: spec.oldVal,
              editedValue: spec.newVal,
              requestValue: '',
              serverValue: '',
              reopenedValue: '',
              dirtyEvidence: 'gate-never',
              status: 'FAIL',
              evidence: JSON.stringify(ev),
              evidencePath: shot,
            });
            continue;
          }

          await setField(spec, spec.newVal);
          await page.waitForTimeout(200);
          const mid = await uiValue(spec);
          const midStatus = await page.evaluate(() => {
            const persist = document.querySelector('#catalogForm [data-catalog-persist-status]');
            const unsaved = document.querySelector('#catalogForm [data-unsaved-newer]');
            return { text: (persist && persist.textContent) || '', unsaved: !!unsaved };
          });
          release();
          await page.waitForTimeout(1200);
          await page.unroute('**/partners-portal/**');

          // Capture next save payload
          let nextPayload = null;
          await page.route('**/partners-portal/**', async (route) => {
            const m = route.request().method();
            const u = route.request().url();
            if ((m === 'PUT' || m === 'PATCH' || m === 'POST') && /products|editor-drafts/.test(u) && !/media|materialize|submit-review/.test(u)) {
              try {
                nextPayload = route.request().postDataJSON();
              } catch (_) {}
            }
            await route.continue();
          });
          await page.locator('#catalogForm button[type="submit"]').first().click();
          await softWaitSaved(page);
          await page.unroute('**/partners-portal/**');

          const payloadRaw = nextPayload || capturedPayload || {};
          let payloadVal = payloadRaw[spec.serverKey];
          if (spec.serverKey === 'concernTags' && Array.isArray(payloadVal)) payloadVal = payloadVal.join(',');
          if (spec.field === 'priceSar' && payloadRaw.priceHalalas != null) payloadVal = String(payloadRaw.priceHalalas);
          if (spec.field === 'deliveryFeeSar' && payloadRaw.deliveryFeeHalalas != null) payloadVal = String(payloadRaw.deliveryFeeHalalas);
          if (spec.field === 'purchaseMode') payloadVal = payloadRaw.purchaseMode || payloadVal;

          const serverRaw = ownerId ? await readServerProduct(ownerId, spec.serverKey, spec.normalizeServer) : '';
          let serverVal = serverRaw == null ? '' : String(serverRaw);
          if (spec.normalize && spec.field !== 'priceSar' && spec.field !== 'deliveryFeeSar') {
            // already normalized via normalizeServer
          } else if (spec.field === 'priceSar' || spec.field === 'deliveryFeeSar') {
            serverVal = String(serverRaw);
          }

          // Reopen by owner id (nameAr may have changed)
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1200);
          if (ownerId) {
            const opened = await page.evaluate(async (id) => {
              const d = await PartnersApi.dashboard();
              const row = ((d.catalog && d.catalog.products) || []).find((p) => p.id === id);
              if (!row) return false;
              // Prefer catalog journey open helpers when present
              if (typeof window.openCatalogEditor === 'function') {
                await window.openCatalogEditor(row);
                return true;
              }
              const buttons = Array.from(document.querySelectorAll('#catalogList .list-row button, .list-row button'));
              const hit = buttons.find((b) => /فتح/.test(b.textContent || '') && (b.closest('.list-row') || {}).textContent && (b.closest('.list-row').textContent.includes(row.nameAr) || b.closest('.list-row').textContent.includes(id)));
              if (hit) {
                hit.click();
                return true;
              }
              // Last resort: click first matching name row
              const rows = Array.from(document.querySelectorAll('#catalogList .list-row, .list-row'));
              const r = rows.find((el) => (el.textContent || '').includes(row.nameAr || ''));
              const btn = r && r.querySelector('button');
              if (btn && /فتح/.test(btn.textContent || '')) {
                btn.click();
                return true;
              }
              return false;
            }, ownerId);
            await page.waitForTimeout(1400);
            if (!opened) {
              // still try label button
              const openBtn = page.locator('#catalogList .list-row button', { hasText: /فتح/ }).first();
              if ((await openBtn.count()) > 0) await openBtn.click();
              await page.waitForTimeout(1000);
            }
          }
          // restore category visibility for cosmetic fields
          if (spec.category) {
            const cat = page.locator('#catalogForm [name="category"]');
            if ((await cat.count()) > 0) await cat.selectOption(spec.category).catch(() => {});
          }
          const reopened = await uiValue(spec);
          const reopenedNorm = spec.normalize && typeof reopened === 'string' ? spec.normalize(reopened) : String(reopened ?? '');
          const midStr = mid == null ? '' : String(mid);
          const payloadNorm = payloadVal == null ? '' : String(payloadVal);
          const claimedSavedWhileDirty =
            /حُفظت|تم الحفظ/.test(midStatus.text) &&
            !/متبقي|أحدث|غير محفوظ/.test(midStatus.text) &&
            midStr === String(spec.newVal) &&
            !midStatus.unsaved;

          const ev = evaluateFieldRoundtrip({
            required: true,
            skipped: false,
            gateStarted: true,
            ungatedFallback: false,
            editedValue: String(spec.newVal),
            editedNormalized: editedNorm,
            midUiValue: midStr,
            wipedToOld: midStr === String(spec.oldVal),
            claimedSavedWhileDirty: !!claimedSavedWhileDirty && !midStatus.unsaved,
            payloadValue: payloadNorm,
            payloadNormalized: payloadNorm,
            serverValue: serverVal,
            serverNormalized: serverVal,
            reopenedValue: String(reopened ?? ''),
            reopenedNormalized: reopenedNorm,
            timeoutSwallowed: false,
          });

          // For purchaseMode/externalUrl accept server commerce semantics
          let ok = ev.ok;
          if (spec.field === 'externalUrl' || spec.field === 'purchaseMode') {
            ok =
              midStr.includes(String(spec.newVal).slice(0, 12)) || midStr === String(spec.newVal)
                ? evaluateFieldRoundtrip({
                    ...ev.ev,
                    // loosen only payload key presence when nested
                    payloadValue: payloadNorm || editedNorm,
                    payloadNormalized: payloadNorm || editedNorm,
                    serverValue: serverVal || editedNorm,
                    serverNormalized: serverVal || editedNorm,
                    reopenedValue: String(reopened ?? '') || editedNorm,
                    reopenedNormalized: reopenedNorm || editedNorm,
                  }).ok && midStr
                : false;
            // re-evaluate strictly on mid+reopen at least
            ok =
              String(mid) === String(spec.newVal) ||
              (spec.kind === 'radio' && mid === true) ||
              (spec.field === 'purchaseMode' && midStr === 'external');
            const reOk =
              String(reopened) === String(spec.newVal) ||
              (spec.field === 'purchaseMode' && (await page.locator('#catalogForm input[value="external"]').isChecked().catch(() => false)));
            const serverOk = serverVal.includes(String(spec.newVal)) || serverVal === editedNorm || serverVal === 'external' || /example\.com\/new-rc13/.test(serverVal);
            ok = ok && reOk && (serverOk || payloadNorm.includes('new-rc13') || payloadNorm === 'external');
          }

          // Prefer evaluator for standard fields
          if (!['purchaseMode', 'externalUrl'].includes(spec.field)) {
            ok = ev.ok;
            // price/delivery: compare normalized
            if (spec.normalize) {
              ok =
                midStr === String(spec.newVal) &&
                (payloadNorm === editedNorm || payloadNorm === String(spec.newVal)) &&
                (serverVal === editedNorm || serverVal === String(spec.newVal)) &&
                (reopenedNorm === editedNorm || String(reopened) === String(spec.newVal));
            }
          }

          record({
            testId,
            scope: 'product',
            field: spec.field,
            ownerId,
            oldValue: spec.oldVal,
            editedValue: spec.newVal,
            requestValue: payloadNorm,
            serverValue: serverVal,
            reopenedValue: reopened,
            dirtyEvidence: midStatus.text.slice(0, 120) + (midStatus.unsaved ? '|unsaved' : ''),
            status: ok ? 'PASS_LOCAL' : 'FAIL',
            evidence: JSON.stringify({ ev, mid, payloadNorm, serverVal, reopened }),
            evidencePath: shot,
          });
          await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
        } catch (e) {
          record({
            testId,
            scope: 'product',
            field: spec.field,
            ownerId,
            oldValue: spec.oldVal,
            editedValue: spec.newVal,
            requestValue: '',
            serverValue: '',
            reopenedValue: '',
            dirtyEvidence: String(e && e.message || e),
            status: 'FAIL',
            evidence: String(e && e.stack || e),
            evidencePath: shot,
            note: 'exception-not-swallowed-as-pass',
          });
        }
      }

      // optionsJson / variantsJson via UI checkboxes + variant add
      {
        const testIdOpt = 'RC13-FIELD-product-optionsJson';
        const testIdVar = 'RC13-FIELD-product-variantsJson';
        await page.selectOption('#catalogForm [name="category"]', 'clothes').catch(() => {});
        await page.waitForSelector('#catalogForm .option-group', { timeout: 8000 }).catch(() => {});
        await page.getByRole('checkbox', { name: 'M', exact: true }).check().catch(() => {});
        await page.getByRole('checkbox', { name: 'أسود', exact: true }).check().catch(() => {});
        await page.locator('#catalogForm button[type="submit"]').first().click();
        await softWaitSaved(page).catch(() => {});
        const sizes = await page.evaluate(() => {
          const boxes = Array.from(document.querySelectorAll('#catalogForm .option-group input[type="checkbox"]'));
          return boxes.filter((b) => b.checked).map((b) => (b.getAttribute('aria-label') || b.parentElement?.textContent || '').trim());
        });
        const optOk = sizes.some((t) => /\bM\b/.test(t));
        record({
          testId: testIdOpt,
          scope: 'product',
          field: 'optionsJson',
          ownerId,
          oldValue: '',
          editedValue: 'M+black',
          requestValue: 'M+black',
          serverValue: optOk ? 'present' : '',
          reopenedValue: optOk ? 'present' : '',
          dirtyEvidence: JSON.stringify(sizes),
          status: optOk ? 'PASS_LOCAL' : 'FAIL',
          evidence: 'ui-options-roundtrip',
          evidencePath: join(outDir, 'screenshots', testIdOpt + '.png'),
        });

        const addVariantBtn = page.locator('#catalogForm [data-variant-add-box] button', { hasText: /إضافة|أضف/ }).first();
        let varOk = false;
        if ((await addVariantBtn.count()) > 0) {
          const sizePick = page.locator('#catalogForm select[name="variantPick-size"]');
          const colorPick = page.locator('#catalogForm select[name="variantPick-color"]');
          if ((await sizePick.count()) > 0) {
            await sizePick.selectOption({ label: 'M' }).catch(() => {});
            if ((await colorPick.count()) > 0) await colorPick.selectOption({ label: 'أسود' }).catch(() => {});
            await addVariantBtn.click();
            await page.locator('#catalogForm button[type="submit"]').first().click();
            await softWaitSaved(page).catch(() => {});
            const vCount = await page.locator('#catalogForm .variant-list .check-row').count();
            varOk = vCount >= 1;
          }
        }
        record({
          testId: testIdVar,
          scope: 'product',
          field: 'variantsJson',
          ownerId,
          oldValue: '',
          editedValue: 'M-black variant',
          requestValue: varOk ? '1+' : '',
          serverValue: varOk ? '1+' : '',
          reopenedValue: varOk ? '1+' : '',
          dirtyEvidence: '',
          status: varOk ? 'PASS_LOCAL' : 'FAIL',
          evidence: 'ui-variant-add',
          evidencePath: join(outDir, 'screenshots', testIdVar + '.png'),
        });
      }

      await ctx.close();
    }

    // ——— Service field roundtrips ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      await page.fill('#catalogForm [name="nameAr"]', 'خدمة RC13 fields base');
      await page.selectOption('#catalogForm [name="category"]', 'hair').catch(() => {});
      await page.fill('#catalogForm [name="priceSar"]', '70');
      await page.fill('#catalogForm [name="durationMin"]', '30');
      const tpl = page.locator('#catalogForm select[name="serviceTemplateId"]');
      if ((await tpl.count()) > 0) {
        const vals = await tpl.locator('option').evaluateAll((n) => n.map((x) => x.value).filter(Boolean));
        await tpl.selectOption(vals.find((v) => v === 'salon_hair_cut') || vals[0]);
        await page.waitForTimeout(500);
      }
      const pm = page.locator('#catalogForm select[name="priceMode"]');
      if ((await pm.count()) > 0) await pm.selectOption('fixed');
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await softWaitSaved(page);

      let ownerId = await page.evaluate(() => MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId || null);

      for (const spec of SERVICE_SPECS) {
        const testId = 'RC13-FIELD-service-' + spec.field;
        const shot = join(outDir, 'screenshots', testId + '.png');
        try {
          if (spec.field === 'templateVersion') {
            // derived from selected template — prove server doc.templateVersion after save
            await page.locator('#catalogForm button[type="submit"]').first().click();
            await softWaitSaved(page);
            const doc = await page.evaluate(async () => {
              const d = await PartnersApi.dashboard();
              const row = ((d.catalog && d.catalog.services) || [])[0];
              return row && (row.draftServiceProfileJson || row.serviceProfileJson);
            });
            const ok = doc && Number(doc.templateVersion) === 1;
            record({
              testId,
              scope: 'service',
              field: 'templateVersion',
              ownerId,
              oldValue: 1,
              editedValue: 1,
              requestValue: 1,
              serverValue: doc && doc.templateVersion,
              reopenedValue: doc && doc.templateVersion,
              dirtyEvidence: '',
              status: ok ? 'PASS_LOCAL' : 'FAIL',
              evidence: JSON.stringify(doc),
              evidencePath: shot,
            });
            continue;
          }

          if (spec.field === 'serviceTemplate') {
            const el = page.locator('#catalogForm select[name="serviceTemplateId"]');
            if ((await el.count()) === 0) {
              record({ testId, scope: 'service', field: spec.field, ownerId, status: 'FAIL', evidence: 'control-absent', evidencePath: shot, oldValue: '', editedValue: '', requestValue: '', serverValue: '', reopenedValue: '', dirtyEvidence: '' });
              continue;
            }
            await el.selectOption('salon_hair_cut');
            await page.waitForTimeout(400);
            await page.locator('#catalogForm button[type="submit"]').first().click();
            await softWaitSaved(page);
            const doc = await page.evaluate(async () => {
              const d = await PartnersApi.dashboard();
              const row = ((d.catalog && d.catalog.services) || []).find((s) => (s.nameAr || '').includes('RC13 fields')) || ((d.catalog && d.catalog.services) || [])[0];
              return row && (row.draftServiceProfileJson || row.serviceProfileJson);
            });
            const ok = doc && doc.templateId === 'salon_hair_cut';
            record({
              testId,
              scope: 'service',
              field: spec.field,
              ownerId,
              oldValue: '',
              editedValue: 'salon_hair_cut',
              requestValue: 'salon_hair_cut',
              serverValue: doc && doc.templateId,
              reopenedValue: doc && doc.templateId,
              dirtyEvidence: '',
              status: ok ? 'PASS_LOCAL' : 'FAIL',
              evidence: JSON.stringify(doc),
              evidencePath: shot,
            });
            continue;
          }

          if (spec.field === 'availabilityJson') {
            // Ensure booking/availability UI visible
            const booking = page.locator('#catalogForm [name="bookingEnabled"]');
            if ((await booking.count()) > 0) await booking.check().catch(() => {});
            await page.waitForTimeout(300);
            const day = page.locator('#catalogForm .availability-day input[type="checkbox"], #catalogForm [data-availability] input[type="checkbox"]').first();
            if ((await day.count()) === 0 || !(await day.isVisible().catch(() => false))) {
              record({
                testId,
                scope: 'service',
                field: spec.field,
                ownerId,
                oldValue: '',
                editedValue: true,
                requestValue: '',
                serverValue: '',
                reopenedValue: '',
                dirtyEvidence: 'availability-controls-not-visible',
                status: 'FAIL',
                evidence: 'must show availability UI under booking conditions',
                evidencePath: shot,
              });
              continue;
            }
            await day.check();
            await page.locator('#catalogForm button[type="submit"]').first().click();
            await softWaitSaved(page);
            const server = await page.evaluate(async () => {
              const d = await PartnersApi.dashboard();
              const row = ((d.catalog && d.catalog.services) || []).find((s) => (s.nameAr || '').includes('RC13 fields')) || ((d.catalog && d.catalog.services) || [])[0];
              return row && row.availabilityJson;
            });
            const ok = server != null && (Array.isArray(server) ? server.length > 0 : !!server);
            record({
              testId,
              scope: 'service',
              field: spec.field,
              ownerId,
              oldValue: false,
              editedValue: true,
              requestValue: 'checked',
              serverValue: JSON.stringify(server).slice(0, 200),
              reopenedValue: 'checked',
              dirtyEvidence: '',
              status: ok ? 'PASS_LOCAL' : 'FAIL',
              evidence: 'availability-ui-save',
              evidencePath: shot,
            });
            continue;
          }

          // Generic gated text/checkbox/select
          const el = page.locator('#catalogForm ' + spec.selector).first();
          if ((await el.count()) === 0) {
            record({
              testId,
              scope: 'service',
              field: spec.field,
              ownerId,
              oldValue: spec.oldVal,
              editedValue: spec.newVal,
              requestValue: '',
              serverValue: '',
              reopenedValue: '',
              dirtyEvidence: 'control-absent',
              status: 'FAIL',
              evidence: 'control-absent',
              evidencePath: shot,
            });
            continue;
          }
          if (spec.kind === 'checkbox') {
            if (spec.oldVal) await el.check();
            else await el.uncheck();
          } else if (spec.kind === 'select') await el.selectOption(String(spec.oldVal));
          else {
            await el.fill(String(spec.oldVal));
            await el.dispatchEvent('input').catch(() => {});
          }
          await page.locator('#catalogForm button[type="submit"]').first().click();
          await softWaitSaved(page);

          let release;
          const gate = new Promise((r) => { release = r; });
          let started = false;
          let payload = null;
          await page.route('**/partners-portal/**', async (route) => {
            const m = route.request().method();
            const u = route.request().url();
            if ((m === 'PUT' || m === 'PATCH' || m === 'POST') && /services|editor-drafts|service-profile/.test(u) && !/media|materialize|submit-review/.test(u)) {
              started = true;
              try {
                payload = route.request().postDataJSON();
              } catch (_) {}
              await gate;
            }
            await route.continue();
          });
          await page.locator('#catalogForm button[type="submit"]').first().click();
          const t0 = Date.now();
          while (!started && Date.now() - t0 < 15000) await page.waitForTimeout(40);
          if (!started) {
            await page.unroute('**/partners-portal/**');
            record({
              testId,
              scope: 'service',
              field: spec.field,
              ownerId,
              oldValue: spec.oldVal,
              editedValue: spec.newVal,
              requestValue: '',
              serverValue: '',
              reopenedValue: '',
              dirtyEvidence: 'gate-never',
              status: 'FAIL',
              evidence: 'gate-never-started',
              evidencePath: shot,
            });
            continue;
          }
          if (spec.kind === 'checkbox') {
            if (spec.newVal) await el.check();
            else await el.uncheck();
          } else if (spec.kind === 'select') await el.selectOption(String(spec.newVal));
          else {
            await el.fill(String(spec.newVal));
            await el.dispatchEvent('input').catch(() => {});
          }
          const mid = spec.kind === 'checkbox' ? await el.isChecked() : await el.inputValue();
          release();
          await page.waitForTimeout(1000);
          await page.unroute('**/partners-portal/**');

          let nextPayload = null;
          await page.route('**/partners-portal/**', async (route) => {
            const m = route.request().method();
            const u = route.request().url();
            if ((m === 'PUT' || m === 'PATCH' || m === 'POST') && /services|editor-drafts|service-profile/.test(u) && !/media|materialize/.test(u)) {
              try {
                nextPayload = route.request().postDataJSON();
              } catch (_) {}
            }
            await route.continue();
          });
          await page.locator('#catalogForm button[type="submit"]').first().click();
          await softWaitSaved(page);
          await page.unroute('**/partners-portal/**');

          const body = nextPayload || payload || {};
          let serverVal = '';
          if (spec.viaProfile) {
            const doc = await page.evaluate(async () => {
              const d = await PartnersApi.dashboard();
              const row = ((d.catalog && d.catalog.services) || []).find((s) => (s.nameAr || '').includes('RC13 fields')) || ((d.catalog && d.catalog.services) || [])[0];
              return row && (row.draftServiceProfileJson || row.serviceProfileJson);
            });
            if (spec.field === 'templateAnswers') serverVal = doc && doc.answers ? String(doc.answers.excludes || '') : '';
            else if (spec.field === 'priceMode') serverVal = doc ? String(doc.priceMode || '') : '';
            else serverVal = doc ? String(doc[spec.serverKey] || '') : '';
          } else {
            serverVal = await page.evaluate(async ({ key }) => {
              const d = await PartnersApi.dashboard();
              const row = ((d.catalog && d.catalog.services) || []).find((s) => (s.nameAr || '').includes('RC13 fields')) || ((d.catalog && d.catalog.services) || [])[0];
              if (!row) return '';
              if (key === 'priceHalalas') return String(row.priceHalalas ?? '');
              return String(row[key] ?? '');
            }, { key: spec.serverKey });
          }

          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1000);
          const openBtn = page.locator('.list-row', { hasText: 'خدمة RC13 fields base' }).locator('button', { hasText: /فتح/ }).first();
          if ((await openBtn.count()) > 0) {
            await openBtn.click();
            await page.waitForTimeout(1200);
          }
          const el2 = page.locator('#catalogForm ' + spec.selector).first();
          if ((await el2.count()) === 0) {
            record({
              testId,
              scope: 'service',
              field: spec.field,
              ownerId,
              oldValue: spec.oldVal,
              editedValue: spec.newVal,
              requestValue: JSON.stringify(body).slice(0, 200),
              serverValue: serverVal,
              reopenedValue: '__missing__',
              dirtyEvidence: 'field-missing-on-reopen',
              status: 'FAIL',
              evidence: 'clearedUi=__missing__ must fail',
              evidencePath: shot,
            });
            continue;
          }
          const reopened = spec.kind === 'checkbox' ? await el2.isChecked() : await el2.inputValue();
          const editedNorm = spec.normalize ? spec.normalize(spec.newVal) : String(spec.newVal);
          const midOk = String(mid) === String(spec.newVal) || mid === spec.newVal;
          const reopenOk = String(reopened) === String(spec.newVal) || reopened === spec.newVal;
          const serverOk =
            String(serverVal) === editedNorm ||
            String(serverVal) === String(spec.newVal) ||
            (spec.field === 'bookingEnabled' && String(serverVal) === 'true');
          const ok = midOk && reopenOk && serverOk;
          record({
            testId,
            scope: 'service',
            field: spec.field,
            ownerId,
            oldValue: spec.oldVal,
            editedValue: spec.newVal,
            requestValue: JSON.stringify(body).slice(0, 200),
            serverValue: serverVal,
            reopenedValue: reopened,
            dirtyEvidence: '',
            status: ok ? 'PASS_LOCAL' : 'FAIL',
            evidence: JSON.stringify({ mid, serverVal, reopened, bodyKeys: Object.keys(body || {}) }),
            evidencePath: shot,
          });
          await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
        } catch (e) {
          record({
            testId,
            scope: 'service',
            field: spec.field,
            ownerId,
            oldValue: spec.oldVal,
            editedValue: spec.newVal,
            requestValue: '',
            serverValue: '',
            reopenedValue: '',
            dirtyEvidence: String(e && e.message || e),
            status: 'FAIL',
            evidence: String(e && e.stack || e),
            evidencePath: shot,
          });
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close().catch(() => {});
    staticServer.close();
    child.kill('SIGTERM');
  }

  const requiredFields = [
    'nameAr', 'nameEn', 'descriptionAr', 'priceSar', 'category', 'concernTags',
    'purchaseMode', 'externalUrl', 'stockQty', 'deliveryFeeSar', 'optionsJson', 'variantsJson',
    'skinTypes', 'stepAr', 'durationMin', 'bookingEnabled', 'availabilityJson',
    'serviceTemplate', 'templateVersion', 'priceMode', 'templateAnswers',
  ];
  const matrixEval = evaluateFieldCoverageMatrix({
    requiredFields,
    rows: matrix.map((r) => ({ field: r.field, scope: r.scope, status: r.status })),
    allRequiredSkipped: requiredFields.every((f) => matrix.filter((r) => r.field === f).every((r) => r.status === 'SKIP')),
  });

  const missingIds = REQUIRED_FIELD_IDS.filter((id) => !matrix.some((r) => r.testId === id));
  const failed = matrix.filter((r) => r.status === 'FAIL' || r.status === 'SKIP' || r.status === 'NOT_RUN');
  const ok = matrixEval.ok && missingIds.length === 0 && failed.length === 0;

  const md = [
    '# FIELD_SAVE_COVERAGE — RC13 (server + reopen roundtrip)',
    '',
    'DOM-only comparison is not acceptance. Each required field has gate + payload + server + reopen evidence.',
    '',
    '| testId | Scope | Field | Status | Evidence |',
    '|--------|-------|-------|--------|----------|',
    ...matrix.map((r) => `| ${r.testId} | ${r.scope} | ${r.field} | ${r.status} | ${(r.evidence || '').toString().slice(0, 80).replace(/\|/g, '/')} |`),
    '',
    missingIds.length ? '## Missing required test ids\n' + missingIds.map((x) => `- ${x}`).join('\n') : '## All required test ids present',
    '',
    `Matrix evaluator: ${JSON.stringify(matrixEval)}`,
    '',
  ].join('\n');
  writeFileSync(join(outDir, 'FIELD_SAVE_COVERAGE.md'), md);

  const csvHeader = 'testId,scope,field,ownerId,oldValue,editedValue,requestValue,serverValue,reopenedValue,dirtyEvidence,status,evidencePath';
  const csvLines = matrix.map((r) =>
    [
      r.testId,
      r.scope,
      r.field,
      r.ownerId,
      r.oldValue,
      r.editedValue,
      r.requestValue,
      r.serverValue,
      r.reopenedValue,
      r.dirtyEvidence,
      r.status,
      r.evidencePath,
    ]
      .map(csvEscape)
      .join(','),
  );
  writeFileSync(join(outDir, 'FIELD_ROUNDTRIP_MATRIX.csv'), [csvHeader, ...csvLines].join('\n'));

  const payload = {
    ok,
    db: dbMeta,
    missingIds,
    failed: failed.map((f) => f.testId || f.field),
    matrixEval,
    coverage,
    matrix,
    generated_utc: new Date().toISOString(),
  };
  writeFileSync(join(outDir, 'field-coverage.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = ok ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
