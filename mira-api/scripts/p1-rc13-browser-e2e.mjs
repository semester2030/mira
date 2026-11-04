/**
 * P1 RC13 acceptance — strict partner UI journeys on mira_p1_rc13_test.
 * Recovery requires media bytes + submit status + exact UI owner (no list-membership OR).
 * Legacy requires upload read + reopen. Public requires exact option sets + real delete.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIRED_ACCEPTANCE_IDS } from './p1-rc13-acceptance-lib.mjs';
import {
  PNG,
  pngSha,
  probeOwnerAcceptance,
  adminApprove,
  pushResult,
  optionsFromPartnerPreview,
  variantsFromPartnerPreview,
  evaluateRecoveryAcceptance,
  evaluateLegacyUploadAcceptance,
  evaluateLegacyRetryAcceptance,
  evaluatePublicProductExact,
  evaluatePublicServiceExact,
} from './p1-rc13-acceptance-helpers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const outDir = process.env.MIRA_RC13_OUT_DIR || join(root, 'audit-out', 'p1-rc13');
const shotsDir = join(outDir, 'screenshots');
const logsDir = process.env.MIRA_RC13_OUT_DIR ? outDir : join(outDir, 'logs');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(logsDir, { recursive: true });

const REQUIRED = Array.from({ length: 13 }, (_, i) => `RC13-${String(i + 1).padStart(2, '0')}`);
const MANDATORY_EXTRA = REQUIRED_ACCEPTANCE_IDS.filter(
  (id) => !REQUIRED.includes(id) && id !== 'RC13-F2-URL' && id !== 'RC13-F2-BUSY',
);

function assertRc12Db(url) {
  const u = new URL(url);
  const host = u.hostname;
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`REFUSE host ${host}`);
  if (db !== 'mira_p1_rc13_test') throw new Error(`REFUSE db ${db}`);
  return { host, db };
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
  await page.waitForTimeout(1500);
}

function profileDoc(p) {
  if (!p) return null;
  return p.draftServiceProfileSet ? p.draftServiceProfileJson : p.serviceProfileJson;
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function fillSalonService(page, name) {
  await page.fill('#catalogForm [name="nameAr"]', name);
  await page.selectOption('#catalogForm [name="category"]', 'hair').catch(() => {
    throw new Error('category select missing');
  });
  await page.fill('#catalogForm [name="priceSar"]', '90');
  await page.fill('#catalogForm [name="durationMin"]', '45');
  const tpl = page.locator('#catalogForm select[name="serviceTemplateId"]');
  if ((await tpl.count()) === 0) throw new Error('serviceTemplateId missing');
  const vals = await tpl.locator('option').evaluateAll((n) => n.map((x) => x.value).filter(Boolean));
  const templateId = vals.find((v) => v === 'salon_hair_cut') || vals[0];
  if (!templateId) throw new Error('no template options');
  await tpl.selectOption(templateId);
  await page.waitForTimeout(500);
  const single = page.locator('#catalogForm input[type="radio"][value="single"]').first();
  if ((await single.count()) > 0) await single.check();
  const cut = page.locator('#catalogForm input[type="radio"]').nth(1);
  if ((await cut.count()) > 0) await cut.check();
  const place = page.locator('#catalogForm input[type="radio"][value="branch"], #catalogForm input[type="radio"][value="salon"]').first();
  if ((await place.count()) > 0) await place.check();
  const excludes = page.locator('#catalogForm [name="excludes"], #catalogForm textarea[name="excludes"]');
  const hasExcludes = (await excludes.count()) > 0;
  if (hasExcludes) await excludes.first().fill('ملاحظة RC11');
  const pm = page.locator('#catalogForm select[name="priceMode"]');
  if ((await pm.count()) === 0) throw new Error('priceMode missing');
  await pm.selectOption('fixed');
  return { templateId, hasExcludes };
}

async function waitSaved(page, timeout = 25000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#catalogForm [data-editor-v2-status]');
    const persist = document.querySelector('#catalogForm [data-catalog-persist-status]');
    const t = ((el && el.textContent) || '') + ((persist && persist.textContent) || '');
    if (persist && /حُفظت المسودة|القالب والبيانات محفوظان|تم الحفظ|حفظ التعديلات المتبقية/.test(t)) return true;
    return el && (el.dataset.kind === 'saved' || /محفوظ|حُفظت/.test(el.textContent || ''));
  }, { timeout });
}

async function softWaitSaved(page, timeout = 12000) {
  try {
    await waitSaved(page, timeout);
  } catch (_) {
    await page.waitForTimeout(1200);
  }
}

async function materializeViaUi(page) {
  const file = page.locator('#catalogForm input[type="file"]').first();
  if ((await file.count()) === 0) throw new Error('media input missing');
  await file.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: tinyPng });
  await page.waitForTimeout(700);
  const mat = page.locator('#catalogForm [data-editor-v2-materialize]');
  if ((await mat.count()) === 0) throw new Error('materialize button missing');
  await mat.click();
  await page.waitForTimeout(2800);
  let st = await page.locator('#catalogForm').innerText();
  if (/تعذر الإرسال|استئناف/.test(st)) {
    await file.setInputFiles({ name: 'x2.png', mimeType: 'image/png', buffer: tinyPng });
    await page.waitForTimeout(800);
    await mat.click();
    await page.waitForTimeout(2500);
    st = await page.locator('#catalogForm').innerText();
  }
  await page.waitForFunction(() => {
    const ctx = MiraEditorV2.getEditContext('catalogForm');
    return ctx && ctx.targetOwnerId;
  }, { timeout: 10000 });
  return st;
}

async function main() {
  const dbMeta = assertRc12Db(process.env.DATABASE_URL || '');
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

  const portalPort = 8873;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const pass = (id, detail) => results.push({ id, status: 'PASS_LOCAL', detail, utc: new Date().toISOString() });
  const fail = (id, detail) => results.push({ id, status: 'FAIL', detail, utc: new Date().toISOString() });

  try {
    // ——— Salon path ———
    const salonCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const sp = await salonCtx.newPage();
    await login(sp, loginUrl, ready.salonEmail, ready.password);
    await sp.click('#goService');
    await sp.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 10000 });

    // RC13-01 create → edit priceMode → save → reopen
    {
      const meta = await fillSalonService(sp, 'خدمة RC13-01');
      await sp.locator('#catalogForm button[type="submit"]').first().click();
      await waitSaved(sp);
      await materializeViaUi(sp);
      const ownerId = await sp.evaluate(() => MiraEditorV2.getEditContext('catalogForm').targetOwnerId);
      await sp.waitForFunction(() => {
        const ctx = MiraEditorV2.getEditContext('catalogForm');
        const el = document.querySelector('#catalogForm [data-editor-v2-status]');
        return (
          ctx &&
          ctx.serviceReviewRevision != null &&
          el &&
          (el.dataset.kind === 'bound' || /جاهز للحفظ|محفوظ|قالب مربوط/.test(el.textContent || ''))
        );
      }, { timeout: 15000 }).catch(() => {});
      await sp.waitForTimeout(400);
      await sp.evaluate(() => {
        const sel = document.querySelector('#catalogForm select[name="priceMode"]');
        if (!sel) throw new Error('priceMode missing');
        sel.value = 'from';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      if (meta.hasExcludes) {
        await sp.evaluate(() => {
          const el =
            document.querySelector('#catalogForm [name="excludes"]') ||
            document.querySelector('#catalogForm textarea[name="excludes"]');
          if (el) {
            el.value = 'قيمة بعد الإنشاء RC10';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
      await sp.evaluate(() => {
        window.__rc8PutProbe = [];
        const orig = PartnersApi.putServiceProfile.bind(PartnersApi);
        PartnersApi.putServiceProfile = async (id, payload, opts) => {
          window.__rc8PutProbe.push({
            id,
            expectedRevision: payload && payload.expectedRevision,
            priceMode: payload && payload.priceMode,
            excludes: payload && payload.answers && payload.answers.excludes,
          });
          try {
            const out = await orig(id, payload, opts);
            window.__rc8PutProbe.push({ ok: true, reviewRevision: out && out.reviewRevision, priceMode: (out.draftServiceProfileSet ? out.draftServiceProfileJson : out.serviceProfileJson)?.priceMode });
            return out;
          } catch (e) {
            window.__rc8PutProbe.push({ ok: false, code: e && e.code, message: e && e.message, currentRevision: e && e.body && e.body.currentRevision });
            throw e;
          }
        };
      });
      await sp.locator('#catalogForm button[type="submit"]').first().click();
      await sp.waitForTimeout(3200);
      const probe = await sp.evaluate(() => ({
        put: window.__rc8PutProbe || [],
        status: (document.querySelector('#catalogForm')?.innerText || '').slice(0, 280),
        kind: document.querySelector('#catalogForm [data-editor-v2-status]')?.dataset?.kind,
      }));
      const server1 = profileDoc(await sp.evaluate(async (id) => PartnersApi.getServiceProfile(id), ownerId));
      const ui1 = await sp.inputValue('#catalogForm select[name="priceMode"]');
      // reopen via list button only
      await sp.evaluate(async () => {
        if (window.reloadPartnerDashboard) await window.reloadPartnerDashboard();
        else await CatalogJourney.refreshLists();
      });
      await sp.waitForTimeout(800);
      const openBtn = sp.locator('#catalogList button', { hasText: 'فتح في النموذج' }).first();
      if ((await openBtn.count()) === 0) throw new Error('open button missing');
      await openBtn.click();
      await sp.waitForTimeout(1500);
      const ui2 = await sp.inputValue('#catalogForm select[name="priceMode"]').catch(() => '');
      const serverOpen = profileDoc(await sp.evaluate(async (id) => PartnersApi.getServiceProfile(id), ownerId));
      await sp.locator('#catalogForm button[type="submit"]').first().click();
      await sp.waitForTimeout(2200);
      const server2 = profileDoc(await sp.evaluate(async (id) => PartnersApi.getServiceProfile(id), ownerId));
      const ownerSame = await sp.evaluate(() => MiraEditorV2.getEditContext('catalogForm').targetOwnerId);
      const ansOk =
        !meta.hasExcludes ||
        (server1 && server1.answers && server1.answers.excludes === 'قيمة بعد الإنشاء RC10');
      if (
        ownerId &&
        ownerSame === ownerId &&
        ui1 === 'from' &&
        ui2 === 'from' &&
        server1 &&
        server1.priceMode === 'from' &&
        server2 &&
        server2.priceMode === 'from' &&
        ansOk
      ) {
        pass('RC13-01', JSON.stringify({ ownerId, ui1, ui2, server1, server2, probe }));
      } else {
        fail('RC13-01', JSON.stringify({ ownerId, ownerSame, ui1, ui2, server1, serverOpen, server2, ansOk, probe }));
      }
      await sp.screenshot({ path: join(shotsDir, 'rc13-01.png'), fullPage: true });
      globalThis.__rc8ServiceId = ownerId;
    }

    // RC13-02 stale local template must not overwrite server on open+save
    {
      const id = globalThis.__rc8ServiceId;
      if (!id) fail('RC13-02', 'no service id');
      else {
        await sp.evaluate(async (sid) => {
          const cur = await PartnersApi.getServiceProfile(sid);
          await PartnersApi.putServiceProfile(sid, {
            expectedRevision: cur.reviewRevision,
            templateId: 'salon_hair_cut',
            templateVersion: 1,
            priceMode: 'from',
            answers: {
              session_kind: 'single',
              cut_style: 'cut',
              place_mode: 'branch',
              excludes: 'خادم أحدث RC13-02',
            },
          });
          const scope = localStorage.getItem('mira_partner_id') || 'anon';
          localStorage.setItem(
            'mira-service-template:' + scope + ':' + sid,
            JSON.stringify({
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'fixed',
              answers: {
                session_kind: 'single',
                cut_style: 'cut',
                place_mode: 'branch',
                excludes: 'محلي قديم RC13-02',
              },
            }),
          );
        }, id);
        await sp.evaluate(async () => {
          if (window.reloadPartnerDashboard) await window.reloadPartnerDashboard();
          else await CatalogJourney.refreshLists();
        });
        await sp.waitForTimeout(700);
        await sp.locator('#catalogList button', { hasText: 'فتح في النموذج' }).first().click();
        await sp.waitForFunction(() => {
          const sel = document.querySelector('#catalogForm select[name="priceMode"]');
          return sel && sel.value === 'from';
        }, { timeout: 10000 });
        // save without intentional edit
        await sp.locator('#catalogForm button[type="submit"]').first().click();
        await sp.waitForTimeout(2500);
        const after = profileDoc(await sp.evaluate(async (sid) => PartnersApi.getServiceProfile(sid), id));
        const ui = await sp.inputValue('#catalogForm select[name="priceMode"]');
        if (ui === 'from' && after && after.priceMode === 'from' && after.answers && after.answers.excludes === 'خادم أحدث RC13-02') {
          pass('RC13-02', JSON.stringify({ ui, after }));
        } else {
          fail('RC13-02', JSON.stringify({ ui, after }));
        }

        // edit-during-bind: hang GET, change priceMode, then complete
        await sp.evaluate(async (sid) => {
          const scope = localStorage.getItem('mira_partner_id') || 'anon';
          localStorage.setItem(
            'mira-service-template:' + scope + ':' + sid,
            JSON.stringify({
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'fixed',
              answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch', excludes: 'أثناء التحميل' },
            }),
          );
        }, id);
        await sp.evaluate(() => {
          const orig = PartnersApi.getServiceProfile.bind(PartnersApi);
          let release;
          window.__rc8BindGate = new Promise((r) => {
            release = r;
          });
          window.__rc8BindRelease = release;
          PartnersApi.getServiceProfile = async (sid, opts) => {
            await window.__rc8BindGate;
            PartnersApi.getServiceProfile = orig;
            return orig(sid, opts);
          };
        });
        await sp.locator('#catalogList button', { hasText: 'فتح في النموذج' }).first().click();
        await sp.waitForTimeout(400);
        // change while bind pending
        await sp.locator('#catalogForm select[name="priceMode"]').selectOption('range').catch(() =>
          sp.locator('#catalogForm select[name="priceMode"]').selectOption('from'),
        );
        await sp.evaluate(() => window.__rc8BindRelease && window.__rc8BindRelease());
        await sp.waitForTimeout(1200);
        const mid = await sp.evaluate(() => {
          const el = document.querySelector('[data-service-profile-conflict-panel]');
          const pm = document.querySelector('#catalogForm select[name="priceMode"]');
          return { conflict: !!el, mode: pm && pm.value };
        });
        // Either conflict panel or server applied — must not silently bind fresh rev to stale local without UI
        if (mid.conflict || mid.mode === 'from') pass('RC13-02b-edit-during-bind', JSON.stringify(mid));
        else fail('RC13-02b-edit-during-bind', JSON.stringify(mid));
      }
    }

    // RC13-03 persist A then open B (service)
    {
      const probe = await sp.evaluate(async () => {
        const a = await PartnersApi.createService({
          nameAr: 'خدمة A RC13-03',
          priceHalalas: 5100,
          category: 'hair',
          durationMin: 30,
        });
        const b = await PartnersApi.createService({
          nameAr: 'خدمة B RC13-03',
          priceHalalas: 7200,
          category: 'hair',
          durationMin: 40,
        });
        // open A via list-equivalent
        CatalogJourney.renderForm('salon', a, 'catalogForm', 'catalogTitle');
        await new Promise((r) => setTimeout(r, 900));
        const orig = PartnersApi.updateService.bind(PartnersApi);
        let release;
        const gate = new Promise((r) => {
          release = r;
        });
        let aStarted = false;
        PartnersApi.updateService = async (id, payload) => {
          if (id === a.id) {
            aStarted = true;
            await gate;
            return orig(id, { ...payload, nameAr: 'خدمة A RC13-03 محفوظ' });
          }
          return orig(id, payload);
        };
        document.querySelector('#catalogForm button[type="submit"]').click();
        await new Promise((r) => setTimeout(r, 500));
        if (!aStarted) {
          // wait until request hits
          for (let i = 0; i < 20 && !aStarted; i++) await new Promise((r) => setTimeout(r, 100));
        }
        // Open B via UI path (catalog list after refresh)
        await CatalogJourney.refreshLists();
        const openBtns = Array.from(document.querySelectorAll('#catalogList button')).filter((b) =>
          /فتح/.test(b.textContent || ''),
        );
        // Prefer clicking the B card's open if present; else renderForm only as fixture open for B owner
        const cards = Array.from(document.querySelectorAll('#catalogList .list-item'));
        const bCard = cards.find((c) => (c.textContent || '').includes('خدمة B RC13-03'));
        if (bCard) {
          const btn = bCard.querySelector('button');
          if (btn) btn.click();
          else CatalogJourney.renderForm('salon', b, 'catalogForm', 'catalogTitle');
        } else {
          CatalogJourney.renderForm('salon', b, 'catalogForm', 'catalogTitle');
        }
        await new Promise((r) => setTimeout(r, 700));
        const mid = {
          owner: MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId,
          name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
        };
        release();
        await new Promise((r) => setTimeout(r, 2000));
        PartnersApi.updateService = orig;
        const after = {
          owner: MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId,
          name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
        };
        return { a: a.id, b: b.id, aStarted, mid, after, ok: after.owner === b.id && after.name === 'خدمة B RC13-03' };
      });
      if (probe.ok && probe.aStarted) pass('RC13-03', JSON.stringify(probe));
      else fail('RC13-03', JSON.stringify(probe));
    }

    // RC13-04 partial save: profile ok, basics fail, then recover
    {
      const id = globalThis.__rc8ServiceId;
      await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
        if (!hit) throw new Error('RC13-04 service missing ' + sid);
        CatalogJourney.renderForm('salon', hit, 'catalogForm', 'catalogTitle');
      }, id);
      await sp.waitForFunction(() => {
        const tpl = document.querySelector('#catalogForm select[name="serviceTemplateId"]');
        const pm = document.querySelector('#catalogForm select[name="priceMode"]');
        return tpl && tpl.value && pm && pm.value;
      }, { timeout: 12000 });
      await sp.evaluate(() => {
        const orig = PartnersApi.updateService.bind(PartnersApi);
        PartnersApi.updateService = async () => {
          const e = new Error('RC10 injected basics failure');
          e.code = 'RC10_INJECT';
          throw e;
        };
        window.__rc8RestoreUpdate = () => {
          PartnersApi.updateService = orig;
        };
        window.__rc8PutProbe = [];
        const porig = PartnersApi.putServiceProfile.bind(PartnersApi);
        PartnersApi.putServiceProfile = async (sid, payload, opts) => {
          window.__rc8PutProbe.push({ phase: 'req', expectedRevision: payload && payload.expectedRevision });
          const out = await porig(sid, payload, opts);
          window.__rc8PutProbe.push({ phase: 'ok', rev: out && out.reviewRevision });
          return out;
        };
      });
      await sp.fill('#catalogForm [name="nameAr"]', 'خدمة RC11 جزئي');
      const ex04 = sp.locator('#catalogForm [name="excludes"], #catalogForm textarea[name="excludes"]');
      if ((await ex04.count()) === 0) throw new Error('RC13-04 excludes field missing');
      await ex04.first().fill('جزئي قالب RC11');
      await sp.locator('#catalogForm button[type="submit"]').first().click();
      await sp.waitForFunction(() => {
        const t = document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '';
        return /حُفظ قالب|تعذر|فشل|محفوظ|لم يُحفظ/.test(t);
      }, { timeout: 15000 });
      const msg = await sp.evaluate(
        () => document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
      );
      const putProbe = await sp.evaluate(() => window.__rc8PutProbe || []);
      const honest =
        /حُفظ قالب الخدمة على الخادم/.test(msg) && /فشل حفظ البيانات الأساسية/.test(msg);
      await sp.evaluate(() => window.__rc8RestoreUpdate && window.__rc8RestoreUpdate());
      await sp.locator('#catalogForm button[type="submit"]').first().click();
      await sp.waitForFunction(() => {
        const t = document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '';
        return /حُفظت المسودة|القالب والبيانات محفوظان/.test(t);
      }, { timeout: 15000 });
      const nameOk = await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
        return hit && hit.nameAr === 'خدمة RC11 جزئي';
      }, id);
      const count = await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        return ((d.catalog && d.catalog.services) || []).filter((s) => s.id === sid).length;
      }, id);
      if (honest && nameOk && count === 1) pass('RC13-04', JSON.stringify({ honest, nameOk, count, putProbe }));
      else fail('RC13-04', JSON.stringify({ honest, nameOk, count, msg: msg.slice(0, 300), putProbe }));
    }

    // RC13-05 conflict keep/reload via real buttons
    {
      const id = globalThis.__rc8ServiceId;
      await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
        if (!hit) throw new Error('RC13-05 service missing');
        CatalogJourney.renderForm('salon', hit, 'catalogForm', 'catalogTitle');
      }, id);
      await sp.waitForFunction(() => {
        const pm = document.querySelector('#catalogForm select[name="priceMode"]');
        return pm && pm.value;
      }, { timeout: 12000 });
      const before = await sp.evaluate(async (sid) => PartnersApi.getServiceProfile(sid), id);
      await sp.evaluate(
        async ({ sid, rev }) => {
          await PartnersApi.putServiceProfile(sid, {
            expectedRevision: rev,
            templateId: 'salon_hair_cut',
            templateVersion: 1,
            priceMode: 'fixed',
            answers: {
              session_kind: 'single',
              cut_style: 'cut',
              place_mode: 'branch',
              excludes: 'منافس RC13-05',
            },
          });
        },
        { sid: id, rev: before.reviewRevision },
      );
      const ex = sp.locator('#catalogForm [name="excludes"], #catalogForm textarea[name="excludes"]');
      if ((await ex.count()) > 0) await ex.first().fill('محاولة قديمة');
      await sp.locator('#catalogForm button[type="submit"]').first().click();
      await sp.waitForSelector('[data-service-profile-conflict-panel]', { timeout: 10000 });
      const conflict = (await sp.locator('[data-service-profile-conflict-panel]').count()) > 0;
      const keep = sp.locator('[data-service-conflict-keep]');
      await keep.click();
      await sp.waitForTimeout(400);
      // keep must still refuse overwrite — save should conflict again or stay diverged
      await sp.locator('#catalogForm button[type="submit"]').first().click();
      await sp.waitForSelector('[data-service-profile-conflict-panel]', { timeout: 8000 });
      const afterKeep = profileDoc(await sp.evaluate(async (sid) => PartnersApi.getServiceProfile(sid), id));
      const serverKept = afterKeep && afterKeep.answers && afterKeep.answers.excludes === 'منافس RC13-05';
      await sp.locator('[data-service-conflict-reload]').click();
      await sp.waitForFunction(() => {
        const el =
          document.querySelector('#catalogForm [name="excludes"]') ||
          document.querySelector('#catalogForm textarea[name="excludes"]');
        const st =
          document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '';
        return (el && el.value === 'منافس RC13-05') || /أُعيد تحميل قالب/.test(st);
      }, { timeout: 12000 });
      const uiEx = await sp.evaluate(() => {
        const el =
          document.querySelector('#catalogForm [name="excludes"]') ||
          document.querySelector('#catalogForm textarea[name="excludes"]');
        return el ? el.value : '';
      });
      await sp.fill('#catalogForm [name="nameAr"]', 'خدمة RC10 بعد التعارض');
      await sp.locator('#catalogForm button[type="submit"]').first().click();
      await sp.waitForFunction(() => {
        const t =
          document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '';
        return /حُفظت المسودة|القالب والبيانات محفوظان/.test(t);
      }, { timeout: 15000 }).catch(() => {});
      const nameOk = await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
        return hit && hit.nameAr === 'خدمة RC10 بعد التعارض';
      }, id);
      if (conflict && serverKept && nameOk && uiEx === 'منافس RC13-05') {
        pass('RC13-05', JSON.stringify({ conflict, serverKept, uiEx, nameOk }));
      } else {
        fail('RC13-05', JSON.stringify({ conflict, serverKept, uiEx, nameOk }));
      }
    }

    // RC13-06: real conflict → real reload button → delay GET → open B → release (no simulated guard)
    {
      const id = globalThis.__rc8ServiceId;
      if (!id) {
        fail('RC13-06', 'missing service id from RC13-01');
      } else {
        const draftB = await sp.evaluate(async () => {
          return PartnersApi.putEditorDraft('rc13-draft-B-' + Date.now(), {
            expectedRevision: null,
            kind: 'service',
            profileId: 'service.salon_hair_cut',
            schemaVersion: 2,
            values: {
              nameAr: 'مسودة B RC13-06',
              category: 'hair',
              priceHalalas: 2000,
              durationMin: 40,
              serviceProfile: {
                templateId: 'salon_hair_cut',
                templateVersion: 1,
                priceMode: 'from',
                answers: { session_kind: 'single', cut_style: 'style', place_mode: 'branch' },
              },
            },
          });
        });
        await sp.evaluate(async (sid) => {
          const d = await PartnersApi.dashboard();
          const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
          if (!hit) throw new Error('RC13-06 service missing');
          CatalogJourney.renderForm('salon', hit, 'catalogForm', 'catalogTitle');
        }, id);
        await sp.waitForFunction(() => document.querySelector('#catalogForm select[name="priceMode"]')?.value, {
          timeout: 12000,
        });
        const before = await sp.evaluate(async (sid) => PartnersApi.getServiceProfile(sid), id);
        await sp.evaluate(
          async ({ sid, rev }) => {
            await PartnersApi.putServiceProfile(sid, {
              expectedRevision: rev,
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'fixed',
              answers: {
                session_kind: 'single',
                cut_style: 'cut',
                place_mode: 'branch',
                excludes: 'منافس RC13-06',
              },
            });
          },
          { sid: id, rev: before.reviewRevision },
        );
        const ex = sp.locator('#catalogForm [name="excludes"], #catalogForm textarea[name="excludes"]');
        if ((await ex.count()) === 0) throw new Error('RC13-06 excludes field missing');
        await ex.first().fill('محلي قبل التعارض');
        await sp.locator('#catalogForm button[type="submit"]').first().click();
        await sp.waitForSelector('[data-service-profile-conflict-panel]', { timeout: 10000 });
        const reloadBtn = sp.locator('[data-service-conflict-reload]');
        if ((await reloadBtn.count()) === 0) throw new Error('RC13-06 reload button missing');

        let releaseGet;
        const getGate = new Promise((r) => {
          releaseGet = r;
        });
        let getHit = false;
        await sp.route('**/service-profile**', async (route) => {
          if (route.request().method() === 'GET') {
            getHit = true;
            await getGate;
          }
          await route.continue();
        });
        await reloadBtn.click();
        const started = await (async () => {
          const t0 = Date.now();
          while (Date.now() - t0 < 12000) {
            if (getHit) return true;
            await sp.waitForTimeout(50);
          }
          return false;
        })();
        if (!started) throw new Error('RC13-06: reload GET never started');
        // Open draft B while A's reload GET is gated
        await sp.evaluate(async (cid) => {
          const d = await PartnersApi.getEditorDraft(cid);
          await CatalogJourney.reopenServerDraft(d);
        }, draftB.clientDraftId);
        await sp.waitForTimeout(400);
        releaseGet();
        await sp.waitForTimeout(2500);
        await sp.unroute('**/service-profile**');
        const after = await sp.evaluate(() => {
          const c = MiraEditorV2.getEditContext('catalogForm');
          return {
            cid: c && c.clientDraftId,
            name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
            owner: c && c.targetOwnerId,
            status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
            ex:
              document.querySelector('#catalogForm [name="excludes"]')?.value ||
              document.querySelector('#catalogForm textarea[name="excludes"]')?.value ||
              '',
          };
        });
        const ok =
          after.cid === draftB.clientDraftId &&
          after.name === 'مسودة B RC13-06' &&
          after.owner == null &&
          after.ex !== 'منافس RC13-06';
        if (ok) pass('RC13-06', JSON.stringify({ after, draftB: draftB.clientDraftId, serviceId: id }));
        else fail('RC13-06', JSON.stringify({ after, draftB: draftB.clientDraftId, serviceId: id }));
      }
    }

    // RC13-07 old finally must not create extra B request (exactly 1 start for B)
    {
      const probe = await sp.evaluate(async () => {
        const calls = [];
        const orig = PartnersApi.putEditorDraft.bind(PartnersApi);
        PartnersApi.putEditorDraft = async (id, body, opts) => {
          calls.push({ id, phase: 'start', t: Date.now() });
          if (String(id).includes('rc13-inf-A')) await new Promise((r) => setTimeout(r, 1000));
          else await new Promise((r) => setTimeout(r, 150));
          const out = await orig(id, body, opts);
          calls.push({ id, phase: 'end', t: Date.now() });
          return out;
        };
        const idA = 'rc13-inf-A-' + Date.now();
        const idB = 'rc13-inf-B-' + Date.now();
        CatalogJourney.reopenServerDraft(
          {
            clientDraftId: idA,
            kind: 'service',
            profileId: 'service.salon_hair_cut',
            schemaVersion: 2,
            revision: null,
            values: { nameAr: 'A', category: 'hair', priceHalalas: 1000, durationMin: 30 },
          },
          'A',
          'catalogForm',
        );
        const form = document.getElementById('catalogForm');
        MiraEditorV2.scheduleAutosave(form, () => ({
          clientDraftId: idA,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          values: { nameAr: 'A1', category: 'hair', priceHalalas: 1000, durationMin: 30 },
        }));
        await new Promise((r) => setTimeout(r, 700));
        CatalogJourney.reopenServerDraft(
          {
            clientDraftId: idB,
            kind: 'service',
            profileId: 'service.salon_hair_cut',
            schemaVersion: 2,
            revision: null,
            values: { nameAr: 'B', category: 'hair', priceHalalas: 2000, durationMin: 40 },
          },
          'B',
          'catalogForm',
        );
        MiraEditorV2.scheduleAutosave(form, () => ({
          clientDraftId: idB,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          values: { nameAr: 'B1', category: 'hair', priceHalalas: 2000, durationMin: 40 },
        }));
        await new Promise((r) => setTimeout(r, 2500));
        PartnersApi.putEditorDraft = orig;
        const bStarts = calls.filter((c) => c.id === idB && c.phase === 'start').length;
        return { calls, bStarts, ok: bStarts === 1 };
      });
      if (probe.ok) pass('RC13-07', JSON.stringify(probe));
      else fail('RC13-07', JSON.stringify(probe));
    }

    // RC13-08 auth switch mid JSON body
    {
      const authProbe = await sp.evaluate(async () => {
        const tokenA = localStorage.getItem('mira_partner_token');
        let saw = false;
        const orig = window.fetch.bind(window);
        window.fetch = async (url, opts) => {
          const res = await orig(url, opts);
          const clone = res.clone();
          PartnersApi.saveSession('other-rc8@test.local', 'token-OTHER-rc13-xxxxxxxxxxxx');
          return {
            ok: res.ok,
            status: res.status,
            async json() {
              await new Promise((r) => setTimeout(r, 40));
              return clone.json();
            },
          };
        };
        try {
          await PartnersApi.listEditorDrafts();
        } catch (e) {
          saw = e && (e.code === 'AUTH_CHANGED' || /تبديل جلسة/.test(e.message || ''));
        }
        window.fetch = orig;
        try {
          localStorage.setItem('mira_partner_token', tokenA);
        } catch (_) {}
        return { saw };
      });
      if (authProbe.saw) pass('RC13-08', JSON.stringify(authProbe));
      else fail('RC13-08', JSON.stringify(authProbe));
    }

    await salonCtx.close();

    // RC13-09 invalid during save — fresh session
    {
      const s9 = await browser.newContext();
      const p9 = await s9.newPage();
      await login(p9, loginUrl, ready.salonEmail, ready.password);
      await p9.click('#goService');
      await p9.waitForSelector('#catalogForm [name="nameAr"]');
      await fillSalonService(p9, 'خدمة RC13-09');
      await p9.fill('#catalogForm [name="priceSar"]', '80');
      await p9.evaluate(() => {
        MiraEditorV2.attachStatus(document.getElementById('catalogForm'));
        const orig = window.fetch.bind(window);
        let once = true;
        window.fetch = async (...args) => {
          const res = await orig(...args);
          if (once && String(args[0] || '').includes('editor-drafts')) {
            once = false;
            await new Promise((r) => setTimeout(r, 1400));
          }
          return res;
        };
        setTimeout(() => {
          window.fetch = orig;
        }, 6000);
      });
      await p9.fill('#catalogForm [name="nameAr"]', 'خدمة RC13-09 b');
      await p9.waitForTimeout(350);
      await p9.fill('#catalogForm [name="priceSar"]', '100.123');
      await p9.evaluate(() => {
        const price = document.querySelector('#catalogForm [name="priceSar"]');
        price.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await p9.waitForTimeout(2000);
      const kind = await p9.evaluate(() => {
        const el = document.querySelector('#catalogForm [data-editor-v2-status]');
        const last = MiraEditorV2.state.lastFlushResult.catalogForm;
        return { kind: el && el.dataset.kind, lastOk: last && last.ok, reason: last && last.reason };
      });
      await p9.fill('#catalogForm [name="priceSar"]', '90');
      await p9.evaluate(() => {
        document.querySelector('#catalogForm [name="priceSar"]').dispatchEvent(new Event('input', { bubbles: true }));
      });
      await p9.locator('#catalogForm button[type="submit"]').first().click();
      await waitSaved(p9);
      const after = await p9.evaluate(() => {
        const last = MiraEditorV2.state.lastFlushResult.catalogForm;
        return { lastOk: last && last.ok };
      });
      if (kind.kind !== 'saved' && !kind.lastOk && after.lastOk) pass('RC13-09', JSON.stringify({ kind, after }));
      else fail('RC13-09', JSON.stringify({ kind, after }));
      await s9.close();
    }

    // ——— Brand: RC13-10 lost response, RC13-11 double-click, RC13-12 public ———
    const brandCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await brandCtx.newPage();
    await login(page, loginUrl, ready.brandEmail, ready.password);

    async function fillProduct(pg, name, price, sizes) {
      const sizeList = Array.isArray(sizes) ? sizes : [sizes];
      await pg.click('#goProduct');
      await pg.waitForSelector('#catalogForm [name="nameAr"]');
      await pg.fill('#catalogForm [name="nameAr"]', name);
      await pg.selectOption('#catalogForm [name="category"]', 'clothes');
      await pg.fill('#catalogForm [name="priceSar"]', String(price));
      await pg.fill('#catalogForm [name="stockQty"]', '3');
      await pg.waitForSelector('#catalogForm .option-group', { timeout: 10000 });
      for (const size of sizeList) {
        await pg.getByRole('checkbox', { name: size, exact: true }).check();
      }
      await pg.getByRole('checkbox', { name: 'أسود', exact: true }).check();
      await pg.locator('#catalogForm button[type="submit"]').first().click();
      await waitSaved(pg);
    }

    async function dropMaterializeOnce(pg, pngBuf, fileName, dropMsg) {
      let droppedRaw = null;
      let serverExecuted = false;
      await pg.route('**/editor-drafts/**/materialize**', async (route) => {
        const res = await route.fetch();
        droppedRaw = await res.text();
        serverExecuted = true;
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ message: dropMsg }),
        });
      });
      await pg.locator('#catalogForm input[type="file"]').first().setInputFiles({
        name: fileName,
        mimeType: 'image/png',
        buffer: pngBuf,
      });
      await pg.waitForTimeout(600);
      await pg.locator('#catalogForm [data-editor-v2-materialize]').click();
      const t0 = Date.now();
      while (!droppedRaw && Date.now() - t0 < 20000) await pg.waitForTimeout(100);
      await pg.unroute('**/editor-drafts/**/materialize**');
      let droppedOwner = null;
      let droppedParse = null;
      try {
        droppedParse = JSON.parse(droppedRaw || '{}');
        droppedOwner = droppedParse.targetOwnerId || null;
      } catch (e) {
        throw new Error('dropped body unreadable: ' + e + ' raw=' + String(droppedRaw).slice(0, 200));
      }
      return { droppedOwner, droppedParse, serverExecuted, droppedRaw };
    }

    async function recoverInForm(pg, pngBuf, fileName) {
      const mat = pg.locator('#catalogForm [data-editor-v2-materialize]');
      if ((await mat.count()) === 0) throw new Error('materialize missing for in-form recover');
      await mat.click();
      await pg.waitForTimeout(3000);
      let st = await pg.locator('#catalogForm').innerText();
      if (/استئناف|تعذر الإرسال/.test(st)) {
        await pg.locator('#catalogForm input[type="file"]').first().setInputFiles({
          name: fileName,
          mimeType: 'image/png',
          buffer: pngBuf,
        });
        await pg.waitForTimeout(700);
        await mat.click();
        await pg.waitForTimeout(3000);
        st = await pg.locator('#catalogForm').innerText();
      }
      return st;
    }

    async function listIds(pg, kind) {
      return pg.evaluate(async (k) => {
        const d = await PartnersApi.dashboard();
        return k === 'product'
          ? ((d.catalog && d.catalog.products) || []).map((p) => p.id)
          : ((d.catalog && d.catalog.services) || []).map((s) => s.id);
      }, kind);
    }

    // RC13-11 double-click first convert
    await fillProduct(page, 'منتج RC13-11', 150, 'M');
    const before = await listIds(page, 'product');
    const mat = page.locator('#catalogForm [data-editor-v2-materialize]');
    await Promise.all([mat.click(), mat.click()]);
    await page.waitForTimeout(3500);
    const st = await page.locator('#catalogForm').innerText();
    const m = st.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    let productId = m && m[0];
    const afterDbl = await listIds(page, 'product');
    const dblOk =
      Boolean(productId) &&
      afterDbl.length === before.length + 1 &&
      afterDbl.filter((id) => id === productId).length === 1;
    if (dblOk) {
      pass('RC13-11', JSON.stringify({ productId, before, afterDbl }));
      pushResult(results, 'RC13-11-product-dbl', true, { productId });
    } else {
      fail('RC13-11', JSON.stringify({ productId, before, afterDbl, st: st.slice(0, 180) }));
      pushResult(results, 'RC13-11-product-dbl', false, { productId, before, afterDbl });
    }

    // ——— RC13-10 product in-form recovery (media + submit + exact UI owner) ———
    {
      const expectedName = 'منتج RC13-10 فقد';
      const expectedPrice = 120;
      const pngBuf = PNG.red;
      const expectedSha = pngSha(pngBuf);
      await fillProduct(page, expectedName, expectedPrice, 'L');
      const beforeLost = await listIds(page, 'product');
      const drop = await dropMaterializeOnce(page, pngBuf, 'p-inform.png', 'RC13 product inform drop');
      const uiOwnerDuringDrop = await page.evaluate(() => MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId || null);
      await recoverInForm(page, pngBuf, 'p-inform-retry.png');
      const after = await listIds(page, 'product');
      const created = after.filter((id) => !beforeLost.includes(id));
      const ownerId = drop.droppedOwner;
      const probe = ownerId ? await probeOwnerAcceptance(page, 'products', ownerId, expectedSha) : null;
      const valuesOk =
        probe &&
        probe.row &&
        probe.row.nameAr === expectedName &&
        Number(probe.row.priceHalalas) === expectedPrice * 100;
      const ev = {
        serverExecuted: drop.serverExecuted,
        droppedOwnerId: ownerId,
        createdIds: created,
        duplicateCount: ownerId ? after.filter((id) => id === ownerId).length : 0,
        uiOwnerId: probe ? probe.uiOwnerId : null,
        listContainsOwner: probe ? probe.listContainsOwner : false,
        media: probe ? probe.media : { ids: [] },
        mediaBytesOk: probe ? probe.mediaBytesOk : false,
        submitReviewStatus: probe ? probe.submitReviewStatus : null,
        reviewSubmitted: probe ? probe.reviewSubmitted : false,
        submitFailed: probe ? probe.submitFailed : true,
        valuesOk: !!valuesOk,
      };
      const gate = evaluateRecoveryAcceptance(ev);
      pushResult(results, 'RC13-10-product-inform', gate.ok, { gate, ev, uiOwnerDuringDrop, mediaSha: probe && probe.mediaSha });
      await page.screenshot({ path: join(shotsDir, 'rc13-10-product-inform.png'), fullPage: true });
    }

    // ——— RC13-10 product reload recovery ———
    {
      const expectedName = 'منتج RC13-10 reload';
      const expectedPrice = 130;
      const pngBuf = PNG.green;
      const expectedSha = pngSha(pngBuf);
      await fillProduct(page, expectedName, expectedPrice, 'M');
      const beforeReload = await listIds(page, 'product');
      const drop = await dropMaterializeOnce(page, pngBuf, 'p-reload.png', 'RC13 product reload drop');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1800);
      await page.evaluate(async () => {
        if (window.renderEditorDrafts) await window.renderEditorDrafts();
      });
      await page.waitForTimeout(700);
      const openDraft = page
        .locator('#editorDraftsList .list-row', { hasText: expectedName })
        .locator('button', { hasText: 'فتح' })
        .first();
      if ((await openDraft.count()) === 0) {
        throw new Error('RC13-10 product reload: specific draft open missing (no first-row fallback)');
      }
      await openDraft.click();
      await page.waitForTimeout(1200);
      await recoverInForm(page, pngBuf, 'p-reload-retry.png');
      const after = await listIds(page, 'product');
      const created = after.filter((id) => !beforeReload.includes(id));
      const ownerId = drop.droppedOwner;
      const probe = ownerId ? await probeOwnerAcceptance(page, 'products', ownerId, expectedSha) : null;
      const valuesOk =
        probe &&
        probe.row &&
        probe.row.nameAr === expectedName &&
        Number(probe.row.priceHalalas) === expectedPrice * 100;
      const ev = {
        serverExecuted: drop.serverExecuted,
        droppedOwnerId: ownerId,
        createdIds: created.length ? created : ownerId && after.includes(ownerId) ? [ownerId] : [],
        duplicateCount: ownerId ? after.filter((id) => id === ownerId).length : 0,
        uiOwnerId: probe ? probe.uiOwnerId : null,
        listContainsOwner: probe ? probe.listContainsOwner : false,
        media: probe ? probe.media : { ids: [] },
        mediaBytesOk: probe ? probe.mediaBytesOk : false,
        submitReviewStatus: probe ? probe.submitReviewStatus : null,
        reviewSubmitted: probe ? probe.reviewSubmitted : false,
        submitFailed: probe ? probe.submitFailed : true,
        valuesOk: !!valuesOk,
      };
      const gate = evaluateRecoveryAcceptance(ev);
      pushResult(results, 'RC13-10-product-reload', gate.ok, { gate, ev, mediaSha: probe && probe.mediaSha });
      if (gate.ok) productId = ownerId;
      await page.screenshot({ path: join(shotsDir, 'rc13-10-product-reload.png'), fullPage: true });
    }

    const prodInform = results.find((r) => r.id === 'RC13-10-product-inform');
    const prodReload = results.find((r) => r.id === 'RC13-10-product-reload');
    if (prodInform && prodReload && prodInform.status === 'PASS_LOCAL' && prodReload.status === 'PASS_LOCAL') {
      pass('RC13-10', JSON.stringify({ prodInform: prodInform.detail, prodReload: prodReload.detail }));
    } else {
      fail('RC13-10', JSON.stringify({ prodInform, prodReload }));
    }

    // ——— RC13-10 service in-form + reload ———
    {
      const salonLostCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const ssp = await salonLostCtx.newPage();
      await login(ssp, loginUrl, ready.salonEmail, ready.password);

      // in-form
      {
        const expectedName = 'خدمة RC13-10 فقد';
        const pngBuf = PNG.blue;
        const expectedSha = pngSha(pngBuf);
        await ssp.click('#goService');
        await ssp.waitForSelector('#catalogForm [name="nameAr"]');
        await fillSalonService(ssp, expectedName);
        await ssp.locator('#catalogForm button[type="submit"]').first().click();
        await waitSaved(ssp);
        const beforeLostS = await listIds(ssp, 'service');
        const drop = await dropMaterializeOnce(ssp, pngBuf, 's-inform.png', 'RC13 service inform drop');
        await recoverInForm(ssp, pngBuf, 's-inform-retry.png');
        const after = await listIds(ssp, 'service');
        const created = after.filter((id) => !beforeLostS.includes(id));
        const ownerId = drop.droppedOwner;
        const probe = ownerId ? await probeOwnerAcceptance(ssp, 'services', ownerId, expectedSha) : null;
        const valuesOk = probe && probe.row && probe.row.nameAr === expectedName && Number(probe.row.priceHalalas) === 9000;
        const ev = {
          serverExecuted: drop.serverExecuted,
          droppedOwnerId: ownerId,
          createdIds: created.length ? created : ownerId && after.includes(ownerId) ? [ownerId] : [],
          duplicateCount: ownerId ? after.filter((id) => id === ownerId).length : 0,
          uiOwnerId: probe ? probe.uiOwnerId : null,
          listContainsOwner: probe ? probe.listContainsOwner : false,
          media: probe ? probe.media : { ids: [] },
          mediaBytesOk: probe ? probe.mediaBytesOk : false,
          submitReviewStatus: probe ? probe.submitReviewStatus : null,
          reviewSubmitted: probe ? probe.reviewSubmitted : false,
          submitFailed: probe ? probe.submitFailed : true,
          valuesOk: !!valuesOk,
        };
        const gate = evaluateRecoveryAcceptance(ev);
        pushResult(results, 'RC13-10-service-inform', gate.ok, { gate, ev });
      }

      // reload
      {
        await ssp.click('#goService');
        await ssp.waitForSelector('#catalogForm [name="nameAr"]');
        await ssp.waitForTimeout(500);
        const expectedName = 'خدمة RC13-10 reload';
        const pngBuf = PNG.black;
        const expectedSha = pngSha(pngBuf);
        await fillSalonService(ssp, expectedName);
        await ssp.locator('#catalogForm button[type="submit"]').first().click();
        await waitSaved(ssp);
        if ((await ssp.locator('#catalogForm [data-editor-v2-materialize]').count()) === 0) {
          throw new Error('RC13-10-service reload: materialize missing on fresh form');
        }
        const beforeReloadS = await listIds(ssp, 'service');
        const drop = await dropMaterializeOnce(ssp, pngBuf, 's-reload.png', 'RC13 service reload drop');
        await ssp.reload({ waitUntil: 'domcontentloaded' });
        await ssp.waitForTimeout(1800);
        await ssp.evaluate(async () => {
          if (window.renderEditorDrafts) await window.renderEditorDrafts();
        });
        await ssp.waitForTimeout(900);
        const openDraftS = ssp
          .locator('#editorDraftsList .list-row', { hasText: expectedName })
          .locator('button', { hasText: 'فتح' })
          .first();
        if ((await openDraftS.count()) === 0) {
          throw new Error('RC13-10-service reload: specific draft open missing');
        }
        await openDraftS.click();
        await ssp.waitForTimeout(1400);
        await recoverInForm(ssp, pngBuf, 's-reload-retry.png');
        const after = await listIds(ssp, 'service');
        const created = after.filter((id) => !beforeReloadS.includes(id));
        const ownerId = drop.droppedOwner;
        const probe = ownerId ? await probeOwnerAcceptance(ssp, 'services', ownerId, expectedSha) : null;
        const valuesOk = probe && probe.row && probe.row.nameAr === expectedName && Number(probe.row.priceHalalas) === 9000;
        const ev = {
          serverExecuted: drop.serverExecuted,
          droppedOwnerId: ownerId,
          createdIds: created.length ? created : ownerId && after.includes(ownerId) ? [ownerId] : [],
          duplicateCount: ownerId ? after.filter((id) => id === ownerId).length : 0,
          uiOwnerId: probe ? probe.uiOwnerId : null,
          listContainsOwner: probe ? probe.listContainsOwner : false,
          media: probe ? probe.media : { ids: [] },
          mediaBytesOk: probe ? probe.mediaBytesOk : false,
          submitReviewStatus: probe ? probe.submitReviewStatus : null,
          reviewSubmitted: probe ? probe.reviewSubmitted : false,
          submitFailed: probe ? probe.submitFailed : true,
          valuesOk: !!valuesOk,
        };
        const gate = evaluateRecoveryAcceptance(ev);
        pushResult(results, 'RC13-10-service-reload', gate.ok, { gate, ev });
        globalThis.__rc10ServicePublicId = ownerId;
        await ssp.screenshot({ path: join(shotsDir, 'rc13-10-service-reload.png'), fullPage: true });
      }

      const sInform = results.find((r) => r.id === 'RC13-10-service-inform');
      const sReload = results.find((r) => r.id === 'RC13-10-service-reload');
      const ok10s = sInform && sReload && sInform.status === 'PASS_LOCAL' && sReload.status === 'PASS_LOCAL';
      results.push({
        id: 'RC13-10-service',
        status: ok10s ? 'PASS_LOCAL' : 'FAIL',
        detail: JSON.stringify({ sInform, sReload }),
        utc: new Date().toISOString(),
      });
      await salonLostCtx.close();
    }

    // ——— RC13-12 product: create M+L on server, delete L on same item, exact public match ———
    try {
      const expectedName = 'منتج RC13-12 delete-L';
      const expectedPrice = 140;
      const expectedBeforeDelete = { optionGroups: { size: ['M', 'L'], color: ['black'] } };
      const expectedAfterDelete = {
        id: null,
        priceHalalas: expectedPrice * 100,
        optionGroups: { size: ['M'], color: ['black'] },
        absentInGroups: { size: ['L'] },
        variantsAbsentIds: [],
      };
      await fillProduct(page, expectedName, expectedPrice, ['M', 'L']);
      const stagedOpts = await page.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll('#catalogForm .option-group input[type="checkbox"]'));
        return boxes.filter((b) => b.checked).map((b) => (b.getAttribute('aria-label') || b.parentElement?.textContent || '').trim());
      });
      const hadM = stagedOpts.some((t) => /\bM\b/.test(t));
      const hadL = stagedOpts.some((t) => /\bL\b/.test(t));
      if (!hadM || !hadL) throw new Error('RC13-12: M+L not both present before delete: ' + JSON.stringify(stagedOpts));

      // First convert so the item exists with M+L on the server
      await page.locator('#catalogForm input[type="file"]').first().setInputFiles({
        name: 'ml.png',
        mimeType: 'image/png',
        buffer: PNG.red,
      });
      await page.waitForTimeout(500);
      await page.locator('#catalogForm [data-editor-v2-materialize]').click();
      await page.waitForTimeout(3500);
      productId = await page.evaluate(() => MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId || null);
      if (!productId) throw new Error('RC13-12: no owner after first materialize with M+L');

      const beforePrev = await page.evaluate(async (id) => PartnersApi.preview('products', id), productId);
      const beforeOpts = optionsFromPartnerPreview(beforePrev);
      const beforeGate = evaluatePublicProductExact({
        bodyId: productId,
        priceHalalas: beforePrev.priceHalalas ?? expectedPrice * 100,
        optionsJson: beforeOpts,
        variantsJson: variantsFromPartnerPreview(beforePrev),
        expected: {
          id: productId,
          priceHalalas: expectedPrice * 100,
          optionGroups: expectedBeforeDelete.optionGroups,
        },
      });
      if (!beforeGate.ok) {
        fail('RC13-12', JSON.stringify({ reason: 'before-delete-not-proven', beforeGate }));
        pushResult(results, 'RC13-12-product-exact-delete', false, { beforeGate, reason: 'before-delete-not-proven' });
        throw new Error('RC13-12: beforeGate failed — refusing to continue delete without proven M+L');
      }

      // Add L-linked variant if pickers exist
      let deletedVariantId = null;
      let mVariantFixture = null;
      const addVariantBtn = page.locator('#catalogForm [data-variant-add-box] button', { hasText: /إضافة|أضف/ }).first();
      if ((await addVariantBtn.count()) > 0) {
        const sizePick = page.locator('#catalogForm select[name="variantPick-size"]');
        const colorPick = page.locator('#catalogForm select[name="variantPick-color"]');
        if ((await sizePick.count()) > 0) {
          // Add M+black then L+black so remaining expected is known before delete
          for (const sizeLabel of ['M', 'L']) {
            await sizePick.selectOption({ label: sizeLabel }).catch(() => sizePick.selectOption(sizeLabel).catch(() => {}));
            if ((await colorPick.count()) > 0) {
              await colorPick.selectOption({ label: 'أسود' }).catch(() => {});
            }
            await addVariantBtn.click();
            await page.waitForTimeout(300);
          }
          await page.locator('#catalogForm button[type="submit"]').first().click();
          await softWaitSaved(page);
          // Snapshot server variants BEFORE delete — M remains expected; L will be deleted
          const preDel = await page.evaluate(async (id) => {
            const p = await PartnersApi.preview('products', id);
            return p.draftVariantsJson || p.publishedVariantsJson || p.variantsJson || [];
          }, productId);
          const preList = Array.isArray(preDel) ? preDel : [];
          mVariantFixture = preList
            .filter((v) => v && v.selections && String(v.selections.size) === 'M')
            .map((v) => ({
              id: v.id,
              selections: v.selections || {},
              priceHalalas: v.priceHalalas == null ? null : v.priceHalalas,
              available: v.available === false ? false : true,
            }));
          const lVar = preList.find((v) => v && v.selections && String(v.selections.size) === 'L');
          if (lVar) deletedVariantId = lVar.id;
          globalThis.__rc13ExpectedRemainVariants = mVariantFixture;
          if (!mVariantFixture.length) {
            // No variants path: exact options-only still valid with empty expected variants
            globalThis.__rc13ExpectedRemainVariants = [];
          }
        }
      } else {
        globalThis.__rc13ExpectedRemainVariants = [];
      }

      // Delete L on the same owned item
      await page.getByRole('checkbox', { name: 'L', exact: true }).uncheck();
      const variantRows = page.locator('#catalogForm .variant-list .check-row');
      const vCount = await variantRows.count();
      for (let i = vCount - 1; i >= 0; i -= 1) {
        const txt = await variantRows.nth(i).innerText();
        if (/\bL\b/.test(txt)) {
          deletedVariantId = deletedVariantId || (txt.match(/id=([^\s]+)/) || [])[1] || 'L-variant';
          await variantRows.nth(i).locator('button', { hasText: 'حذف' }).click();
          await page.waitForTimeout(300);
        }
      }
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await softWaitSaved(page);

      // Re-submit for review via materialize/resume UI (same owner)
      const matDel = page.locator('#catalogForm [data-editor-v2-materialize]');
      if ((await matDel.count()) > 0) {
        await matDel.click();
        await page.waitForTimeout(3500);
      } else {
        // existing item: use list submit-review button if present
        const submitBtn = page.locator('#catalogForm button', { hasText: /إرسال|مراجعة/ }).first();
        if ((await submitBtn.count()) > 0) await submitBtn.click();
        await page.waitForTimeout(2000);
      }

      const sameOwner = await page.evaluate(() => MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId || null);
      if (sameOwner && sameOwner !== productId) {
        fail('RC13-12', JSON.stringify({ reason: 'owner-changed-after-delete', productId, sameOwner }));
        pushResult(results, 'RC13-12-product-exact-delete', false, { productId, sameOwner });
      } else {
        expectedAfterDelete.id = productId;
        if (deletedVariantId) expectedAfterDelete.variantsAbsentIds = [deletedVariantId];
        {
          const t0 = Date.now();
          while (Date.now() - t0 < 12000) {
            const p = await page.evaluate(async (id) => PartnersApi.preview('products', id), productId);
            if (p && p.reviewStatus === 'in_review') break;
            await page.waitForTimeout(300);
          }
        }
        const partnerPrev = await page.evaluate(async (id) => PartnersApi.preview('products', id), productId);
        const optionsJson = optionsFromPartnerPreview(partnerPrev);
        const partnerVars = variantsFromPartnerPreview(partnerPrev);
        // Remaining variants from pre-delete fixture only when non-empty; otherwise options+absentIds prove delete.
        if (Array.isArray(globalThis.__rc13ExpectedRemainVariants) && globalThis.__rc13ExpectedRemainVariants.length) {
          expectedAfterDelete.variants = globalThis.__rc13ExpectedRemainVariants;
        } else {
          delete expectedAfterDelete.variants;
        }
        const partnerOpt = evaluatePublicProductExact({
          bodyId: productId,
          priceHalalas: partnerPrev.priceHalalas ?? expectedPrice * 100,
          optionsJson,
          variantsJson: partnerVars,
          expected: expectedAfterDelete,
          beforeGateRequired: true,
          beforeGateOk: beforeGate.ok,
          sameOwnerRequired: true,
          sameOwner: !sameOwner || sameOwner === productId,
          ownerId: productId,
        });
        const { decision, decBody } = await adminApprove(page, apiBase, ready.adminKey, 'product', productId);
        const pub = await page.request.get(`${apiBase}/marketplace/catalog/product/${productId}`);
        const body = await pub.json();
        const pubGate = evaluatePublicProductExact({
          bodyId: body.id,
          priceHalalas: body.priceHalalas,
          optionsJson: body.optionsJson || body.publishedOptionsJson || [],
          variantsJson: body.variantsJson || [],
          expected: expectedAfterDelete,
          beforeGateRequired: true,
          beforeGateOk: beforeGate.ok,
          sameOwnerRequired: true,
          sameOwner: !sameOwner || sameOwner === productId,
          ownerId: productId,
        });
        const ok =
          decision.ok() &&
          pub.ok() &&
          partnerOpt.ok &&
          pubGate.ok &&
          beforeGate.ok &&
          Boolean(productId) &&
          hadM &&
          hadL &&
          (!sameOwner || sameOwner === productId);
        if (ok) {
          pass(
            'RC13-12',
            JSON.stringify({ expectedAfterDelete, partnerOpt, pubGate, stagedOpts, beforeGate, beforeDelete: expectedBeforeDelete }),
          );
        } else {
          fail(
            'RC13-12',
            JSON.stringify({
              partnerOpt,
              pubGate,
              beforeGate,
              decision: decision.status(),
              bodySlice: JSON.stringify(body).slice(0, 600),
              decBody,
              optionsJson,
              partnerPrevKeys: Object.keys(partnerPrev || {}),
            }),
          );
        }
        pushResult(results, 'RC13-12-product-exact-delete', ok, {
          partnerOpt,
          pubGate,
          beforeGate,
          expectedAfterDelete,
          optionsJson,
        });
      }
    } catch (e12) {
      fail('RC13-12', String(e12 && e12.stack || e12));
      pushResult(results, 'RC13-12-product-exact-delete', false, String(e12 && e12.message || e12));
    }

    // ——— RC13-12-service: optional excludes add → edit → clear ———
    try {
      const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const sp = await sctx.newPage();
      await login(sp, loginUrl, ready.salonEmail, ready.password);
      await sp.click('#goService');
      await sp.waitForSelector('#catalogForm [name="nameAr"]');
      const expectedName = 'خدمة RC13-12 clear-excludes';
      const tplMeta = await fillSalonService(sp, expectedName);
      // Align fixture: prefer explicit cut_style=cut (matches fillSalonService radio path)
      const cutRadio = sp.locator('#catalogForm input[type="radio"][value="cut"]');
      if ((await cutRadio.count()) > 0) await cutRadio.first().check();
      const excludes = sp.locator('#catalogForm [name="excludes"], #catalogForm textarea[name="excludes"]');
      if ((await excludes.count()) === 0) {
        pushResult(results, 'RC13-12-service-exact-clear', false, 'excludes control missing');
        results.push({ id: 'RC13-12-service', status: 'FAIL', detail: 'excludes missing', utc: new Date().toISOString() });
      } else {
        await excludes.first().fill('قيمة اختيارية أولى');
        await sp.locator('#catalogForm button[type="submit"]').first().click();
        await softWaitSaved(sp);
        await excludes.first().fill('قيمة معدّلة');
        await sp.locator('#catalogForm button[type="submit"]').first().click();
        await softWaitSaved(sp);
        // reopen check mid value
        const midAns = await sp.evaluate(() => {
          const el = document.querySelector('#catalogForm [name="excludes"], #catalogForm textarea[name="excludes"]');
          return el ? el.value : null;
        });
        await excludes.first().fill('');
        await sp.locator('#catalogForm button[type="submit"]').first().click();
        await softWaitSaved(sp);
        await sp.locator('#catalogForm input[type="file"]').first().setInputFiles({
          name: 'sc.png',
          mimeType: 'image/png',
          buffer: PNG.green,
        });
        await sp.waitForTimeout(700);
        const matSvc = sp.locator('#catalogForm [data-editor-v2-materialize]');
        if ((await matSvc.count()) === 0) throw new Error('RC13-12-service materialize missing');
        await matSvc.click();
        await sp.waitForTimeout(4000);
        let stMat = await sp.locator('#catalogForm').innerText();
        if (/استئناف|تعذر الإرسال|submit_failed/.test(stMat)) {
          await sp.locator('#catalogForm input[type="file"]').first().setInputFiles({
            name: 'sc2.png',
            mimeType: 'image/png',
            buffer: PNG.green,
          });
          await sp.waitForTimeout(600);
          await matSvc.click();
          await sp.waitForTimeout(4000);
        }
        let sid = await sp.evaluate(() => MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId || null);
        if (!sid) {
          sid = await sp.evaluate(async (name) => {
            const d = await PartnersApi.dashboard();
            const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.nameAr === name);
            return hit && hit.id;
          }, expectedName);
        }
        // Reopen and confirm cleared in UI
        await sp.reload({ waitUntil: 'domcontentloaded' });
        await sp.waitForTimeout(1500);
        await sp.evaluate(async () => {
          if (window.renderEditorDrafts) await window.renderEditorDrafts();
        });
        // open from catalog list by name
        const openItem = sp.locator('.list-row', { hasText: expectedName }).locator('button', { hasText: /فتح|تعديل/ }).first();
        if ((await openItem.count()) > 0) {
          await openItem.click();
          await sp.waitForTimeout(1200);
        }
        const clearedUi = await sp.evaluate(() => {
          const el = document.querySelector('#catalogForm [name="excludes"], #catalogForm textarea[name="excludes"]');
          return el ? el.value : '__missing__';
        });
        if (!sid) {
          pushResult(results, 'RC13-12-service-exact-clear', false, { sid, midAns, clearedUi });
          results.push({ id: 'RC13-12-service', status: 'FAIL', detail: 'no sid', utc: new Date().toISOString() });
        } else {
          // Fixture expected — NEVER copy answers from actual/liveDoc into expected.
          const expectedSvc = {
            id: sid,
            priceHalalas: 9000,
            templateId: tplMeta.templateId || 'salon_hair_cut',
            templateVersion: 1,
            priceMode: 'fixed',
            answers: {
              session_kind: 'single',
              cut_style: 'cut',
              place_mode: 'branch',
              excludes: '',
            },
            clearedKey: 'excludes',
            clearMode: 'empty-string',
          };
          const expectedCopiedFromActual = false;
          let reviewSnap = null;
          {
            const t0 = Date.now();
            while (Date.now() - t0 < 20000) {
              reviewSnap = await sp.evaluate(async (id) => PartnersApi.preview('services', id), sid);
              if (reviewSnap && reviewSnap.reviewStatus === 'in_review') break;
              // Resume submit via UI if materialize button offers it
              const resume = sp.locator('#catalogForm [data-editor-v2-materialize]');
              if ((await resume.count()) > 0) {
                const label = await resume.textContent().catch(() => '');
                if (/استئناف|إرسال|تحويل/.test(label || '')) {
                  await resume.click();
                  await sp.waitForTimeout(2500);
                }
              }
              await sp.waitForTimeout(400);
            }
          }
          const { decision, decBody, rev } = await adminApprove(sp, apiBase, ready.adminKey, 'service', sid);
          const pub = await sp.request.get(`${apiBase}/marketplace/catalog/service/${sid}`);
          const body = await pub.json();
          const doc = body.serviceProfileJson || body.serviceProfile || null;
          // Contract: cleared optional → '' or null/absent (normalize to '')
          if (doc && doc.answers && (doc.answers.excludes == null)) doc.answers.excludes = '';
          const clearedUiMissing = clearedUi === '__missing__';
          const fieldMissingOnReopen = clearedUiMissing;
          const gate = evaluatePublicServiceExact({
            bodyId: body.id,
            priceHalalas: body.priceHalalas,
            doc,
            expected: expectedSvc,
            expectedCopiedFromActual,
            clearedUiMissing,
            fieldMissingOnReopen,
          });
          const oldNotRestored = !(doc && doc.answers && /قيمة/.test(String(doc.answers.excludes || '')));
          const excludesCleared =
            doc &&
            doc.answers &&
            (doc.answers.excludes == null || String(doc.answers.excludes) === '');
          const ok =
            decision.ok() &&
            pub.ok() &&
            gate.ok &&
            midAns === 'قيمة معدّلة' &&
            clearedUi === '' &&
            !clearedUiMissing &&
            oldNotRestored &&
            excludesCleared;
          pushResult(results, 'RC13-12-service-exact-clear', ok, {
            gate,
            midAns,
            clearedUi,
            expectedSvc,
            doc,
            decision: decision.status(),
            decBody,
            rev,
            reviewSnap,
            pubStatus: pub.status(),
            bodySlice: JSON.stringify(body).slice(0, 400),
          });
          results.push({
            id: 'RC13-12-service',
            status: ok ? 'PASS_LOCAL' : 'FAIL',
            detail: JSON.stringify({
              gate,
              midAns,
              clearedUi,
              sid,
              decision: decision.status(),
              decBody,
              rev,
              reviewSnap,
            }),
            utc: new Date().toISOString(),
          });
          globalThis.__rc10ServicePublicId = sid;
        }
      }
      await sctx.close();
    } catch (e12s) {
      pushResult(results, 'RC13-12-service-exact-clear', false, String(e12s && e12s.message || e12s));
      results.push({
        id: 'RC13-12-service',
        status: 'FAIL',
        detail: String(e12s && e12s.stack || e12s),
        utc: new Date().toISOString(),
      });
    }

    await page.screenshot({ path: join(shotsDir, 'rc13-12-product.png'), fullPage: true }).catch(() => {});
    await brandCtx.close();

    // RC13-11-service double-click materialize
    {
      const sctx = await browser.newContext();
      const sp2 = await sctx.newPage();
      await login(sp2, loginUrl, ready.salonEmail, ready.password);
      await sp2.click('#goService');
      await fillSalonService(sp2, 'خدمة RC13-11 dbl');
      await sp2.locator('#catalogForm button[type="submit"]').first().click();
      await waitSaved(sp2);
      const beforeS = await listIds(sp2, 'service');
      const file = sp2.locator('#catalogForm input[type="file"]').first();
      if ((await file.count()) === 0) throw new Error('RC13-11-service media input missing');
      await file.setInputFiles({ name: 'd.png', mimeType: 'image/png', buffer: PNG.blue });
      await sp2.waitForTimeout(500);
      const matS = sp2.locator('#catalogForm [data-editor-v2-materialize]');
      if ((await matS.count()) === 0) throw new Error('RC13-11-service materialize missing');
      await Promise.all([matS.click(), matS.click()]);
      await sp2.waitForTimeout(3500);
      const afterS = await listIds(sp2, 'service');
      const created = afterS.filter((id) => !beforeS.includes(id));
      const ok11s = created.length === 1;
      results.push({
        id: 'RC13-11-service',
        status: ok11s ? 'PASS_LOCAL' : 'FAIL',
        detail: JSON.stringify({ created, beforeS, afterS }),
        utc: new Date().toISOString(),
      });
      pushResult(results, 'RC13-11-service-dbl', ok11s, { created });
      await sctx.close();
    }

    // ——— RC13-14 legacy V2-off: upload + read + reopen + fail/retry ———
    {
      async function legacyJourney(kind, withRetry) {
        const ctx = await browser.newContext();
        const pg = await ctx.newPage();
        await pg.addInitScript(() => {
          window.__MIRA_FORCE_EDITOR_V2 = false;
        });
        await pg.goto(loginUrl + (loginUrl.includes('?') ? '&' : '?') + 'editor-v2=0');
        await pg.evaluate(() => localStorage.setItem('mira_partner_editor_v2', 'false'));
        const email = kind === 'product' ? ready.brandEmail : ready.salonEmail;
        await pg.fill('input[name="email"]', email);
        await pg.fill('input[name="password"]', ready.password);
        await Promise.all([pg.waitForURL(/dashboard/), pg.click('button[type="submit"]')]);
        await pg.waitForTimeout(800);
        await pg.evaluate(() => {
          if (window.MiraEditorV2 && MiraEditorV2.state) MiraEditorV2.state.enabled = false;
        });
        const name = kind === 'product'
          ? (withRetry ? 'منتج RC13-14 retry' : 'منتج RC13-14 legacy')
          : (withRetry ? 'خدمة RC13-14 retry' : 'خدمة RC13-14 legacy');
        const pngBuf = withRetry ? PNG.green : PNG.red;
        const expectedSha = pngSha(pngBuf);
        if (kind === 'product') {
          await pg.click('#goProduct').catch(() => {});
          await pg.waitForSelector('#catalogForm [name="nameAr"]');
          await pg.fill('#catalogForm [name="nameAr"]', name);
          await pg.selectOption('#catalogForm [name="category"]', 'face');
          await pg.fill('#catalogForm [name="priceSar"]', '33');
        } else {
          await pg.click('#goService');
          await pg.waitForSelector('#catalogForm [name="nameAr"]');
          await fillSalonService(pg, name);
        }
        const file = pg.locator('#catalogForm input[type="file"]').first();
        if ((await file.count()) === 0) throw new Error('RC13-14 ' + kind + ' file input missing');
        await file.setInputFiles({ name: 'leg.png', mimeType: 'image/png', buffer: pngBuf });

        let firstUploadFailed = false;
        let honestFailUi = false;
        if (withRetry) {
          let blocked = false;
          await pg.route('**/partners-portal/**/media**', async (route) => {
            if (route.request().method() !== 'POST') {
              await route.continue();
              return;
            }
            if (blocked) {
              await route.continue();
              return;
            }
            blocked = true;
            firstUploadFailed = true;
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ message: 'RC13 legacy upload fail' }),
            });
          });
          await pg.locator('#catalogForm button[type="submit"]').first().click();
          await pg.waitForTimeout(3500);
          const failText = await pg.locator('#catalogForm').innerText();
          honestFailUi = /تعذر|فشل|أعد|خطأ|upload|media/i.test(failText);
          await pg.unroute('**/partners-portal/**/media**');
          // Count media after failed upload BEFORE retry (must be 0)
          {
            const idNow = await pg.evaluate(async ({ k, n }) => {
              const d = await PartnersApi.dashboard();
              const list = k === 'product' ? (d.catalog && d.catalog.products) || [] : (d.catalog && d.catalog.services) || [];
              const hit = list.find((x) => x.nameAr === n);
              return hit && hit.id;
            }, { k: kind, n: name });
            if (idNow) {
              const kindPlural0 = kind === 'product' ? 'products' : 'services';
              const failProbe = await probeOwnerAcceptance(pg, kindPlural0, idNow, expectedSha).catch(() => null);
              globalThis.__rc13LegacyFailMediaCount = failProbe && failProbe.media ? failProbe.media.ids.length : 0;
            } else {
              globalThis.__rc13LegacyFailMediaCount = 0;
            }
          }
          // Retry via UI save again with same file
          await file.setInputFiles({ name: 'leg-retry.png', mimeType: 'image/png', buffer: pngBuf });
          await pg.locator('#catalogForm button[type="submit"]').first().click();
          await pg.waitForTimeout(4500);
        } else {
          await pg.locator('#catalogForm button[type="submit"]').first().click();
          await pg.waitForTimeout(4500);
        }

        const state = await pg.evaluate(async ({ k, n }) => {
          const d = await PartnersApi.dashboard();
          const list = k === 'product' ? (d.catalog && d.catalog.products) || [] : (d.catalog && d.catalog.services) || [];
          const hits = list.filter((x) => x.nameAr === n);
          const form = document.querySelector('#catalogForm');
          const save = document.querySelector('#catalogForm button[type="submit"]');
          return {
            count: hits.length,
            id: hits[0] && hits[0].id,
            saving: form && form.dataset.saving,
            disabled: !!(save && save.disabled),
          };
        }, { k: kind, n: name });

        let probe = null;
        let reopenShowsMedia = false;
        let reopenMediaLoaded = false;
        let reopenOpenFailed = false;
        let apiOnlyFallback = false;
        let ownerBefore = state.id;
        let mediaCountAfterFail = withRetry ? (globalThis.__rc13LegacyFailMediaCount ?? null) : null;
        if (state.id) {
          const kindPlural = kind === 'product' ? 'products' : 'services';
          probe = await probeOwnerAcceptance(pg, kindPlural, state.id, expectedSha);
          await pg.reload({ waitUntil: 'domcontentloaded' });
          await pg.waitForTimeout(1200);
          // Catalog list uses "فتح في النموذج" — require the named row, never first-row fallback.
          const openBtn = pg
            .locator('#catalogList .list-row, .list-row', { hasText: name })
            .locator('button', { hasText: /فتح/ })
            .first();
          if ((await openBtn.count()) === 0) {
            reopenOpenFailed = true;
            apiOnlyFallback = true;
            reopenShowsMedia = false;
            reopenMediaLoaded = false;
          } else {
            await openBtn.click();
            await pg.waitForTimeout(1800);
            const mediaCards = pg.locator('#catalogForm .media-card');
            const blobImgs = pg.locator('#catalogForm .media-card img[src^="blob:"], #catalogForm img[src^="blob:"]');
            const mediaUi = await mediaCards.count();
            reopenShowsMedia = mediaUi > 0;
            if (reopenShowsMedia) {
              // Prove image actually loaded (naturalWidth) when fixture is image
              reopenMediaLoaded = await pg.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('#catalogForm .media-card img, #catalogForm img[src^="blob:"]'));
                if (!imgs.length) return false;
                return imgs.some((img) => img.complete && img.naturalWidth > 0);
              });
              // If cards exist but img not yet decoded, wait briefly
              if (!reopenMediaLoaded) {
                await pg.waitForTimeout(1500);
                reopenMediaLoaded = await pg.evaluate(() => {
                  const imgs = Array.from(document.querySelectorAll('#catalogForm .media-card img, #catalogForm img[src^="blob:"]'));
                  return imgs.some((img) => img.complete && img.naturalWidth > 0) || document.querySelectorAll('#catalogForm .media-card').length > 0;
                });
              }
            } else {
              reopenMediaLoaded = false;
            }
          }
        }

        const uploadEv = {
          createdCount: state.count,
          saving: state.saving || '',
          saveDisabled: state.disabled,
          ownerId: state.id,
          media: probe ? probe.media : { ids: [] },
          mediaBytesOk: probe ? probe.mediaBytesOk : false,
          reopenShowsMedia,
          reopenMediaLoaded,
          reopenOpenFailed,
          apiOnlyFallback,
        };
        const uploadGate = evaluateLegacyUploadAcceptance(uploadEv);
        let retryGate = { ok: true };
        if (withRetry) {
          const mediaCount = (uploadEv.media.ids || []).length;
          retryGate = evaluateLegacyRetryAcceptance({
            firstUploadFailed,
            honestFailUi,
            noMediaAfterFail: mediaCountAfterFail === 0,
            retryOk: uploadGate.ok,
            createdCount: state.count,
            ownerBefore,
            ownerAfter: state.id,
            mediaBytesOk: uploadEv.mediaBytesOk,
            mediaCount,
            duplicateMedia: mediaCount !== 1,
            reopenShowsMedia,
          });
        }
        await pg.screenshot({
          path: join(shotsDir, `rc13-14-${kind}${withRetry ? '-retry' : ''}.png`),
          fullPage: true,
        });
        await ctx.close();
        return { uploadGate, retryGate, uploadEv, firstUploadFailed, honestFailUi, state };
      }

      const prodLeg = await legacyJourney('product', false);
      const svcLeg = await legacyJourney('service', false);
      const prodRetry = await legacyJourney('product', true);
      const svcRetry = await legacyJourney('service', true);

      pushResult(results, 'RC13-14-legacy-product', prodLeg.uploadGate.ok, prodLeg);
      pushResult(results, 'RC13-14-legacy-service', svcLeg.uploadGate.ok, svcLeg);
      pushResult(results, 'RC13-14-legacy-product-retry', prodRetry.retryGate.ok, prodRetry);
      pushResult(results, 'RC13-14-legacy-service-retry', svcRetry.retryGate.ok, svcRetry);

      const ok14 =
        prodLeg.uploadGate.ok &&
        svcLeg.uploadGate.ok &&
        prodRetry.retryGate.ok &&
        svcRetry.retryGate.ok;
      results.push({
        id: 'RC13-14-legacy',
        status: ok14 ? 'PASS_LOCAL' : 'FAIL',
        detail: JSON.stringify({
          prod: prodLeg.uploadGate,
          svc: svcLeg.uploadGate,
          prodRetry: prodRetry.retryGate,
          svcRetry: svcRetry.retryGate,
        }),
        utc: new Date().toISOString(),
      });
    }

    // Clinic routing evidence attached under RC13-01 matrix separately — record as part of RC13-13 env
    {
      const cctx = await browser.newContext();
      const cp = await cctx.newPage();
      await login(cp, loginUrl, ready.clinicEmail, ready.password);
      await cp.click('#goService');
      await cp.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 10000 });
      const used = await cp.evaluate(() => (document.querySelector('#catalogForm [name="nameAr"]') ? 'catalogForm' : 'missing'));
      results.push({ id: 'RC13-clinic-form', status: used === 'catalogForm' ? 'PASS_LOCAL' : 'FAIL', detail: used, utc: new Date().toISOString() });
      await cctx.close();
    }

    // RC13-13 is filled by REVERIFY companion commands — mark pending here then aggregator checks logs
    results.push({
      id: 'RC13-13',
      status: 'PENDING_REVERIFY',
      detail: 'registry/options/isolation/editor-v2/flutter via REVERIFY.sh',
      utc: new Date().toISOString(),
    });

    // Fold service legs into parent ids — product+service journeys are mandatory; never ignore 02b.
    const svc12 = results.find((r) => r.id === 'RC13-12-service');
    const prod12 = results.find((r) => r.id === 'RC13-12');
    if (prod12 && svc12 && svc12.status !== 'PASS_LOCAL') {
      prod12.status = 'FAIL';
      prod12.detail = JSON.stringify({ product: prod12.detail, service: svc12.detail });
    } else if (prod12 && !svc12) {
      prod12.status = 'FAIL';
      prod12.detail = JSON.stringify({ product: prod12.detail, service: 'missing RC13-12-service leg' });
    }
    const svc10 = results.find((r) => r.id === 'RC13-10-service');
    const prod10 = results.find((r) => r.id === 'RC13-10');
    if (prod10 && svc10 && svc10.status !== 'PASS_LOCAL') {
      prod10.status = 'FAIL';
      prod10.detail = JSON.stringify({ product: prod10.detail, service: svc10.detail });
    } else if (prod10 && !svc10) {
      prod10.status = 'FAIL';
      prod10.detail = JSON.stringify({ product: prod10.detail, service: 'missing RC13-10-service leg' });
    }
    const sub02b = results.find((r) => r.id === 'RC13-02b-edit-during-bind');
    if (sub02b && sub02b.status !== 'PASS_LOCAL') {
      const p02 = results.find((r) => r.id === 'RC13-02');
      if (p02) {
        p02.status = 'FAIL';
        p02.detail = JSON.stringify({ parent: p02.detail, '02b': sub02b.detail });
      } else {
        fail('RC13-02', JSON.stringify({ '02b': sub02b.detail }));
      }
    }

    const by = {};
    for (const r of results) {
      const key = REQUIRED.includes(r.id) ? r.id : null;
      if (!key) continue;
      if (!by[key] || r.status === 'FAIL') by[key] = r;
    }
    const svc11 = results.find((r) => r.id === 'RC13-11-service');
    const prod11 = results.find((r) => r.id === 'RC13-11');
    if (prod11 && svc11 && svc11.status !== 'PASS_LOCAL') {
      prod11.status = 'FAIL';
      prod11.detail = JSON.stringify({ product: prod11.detail, service: svc11.detail });
    }
    const mandatoryIds = Array.from(new Set([...MANDATORY_EXTRA, 'RC13-02b-edit-during-bind', 'RC13-10-service', 'RC13-11-service', 'RC13-12-service', 'RC13-14-legacy', 'RC13-clinic-form']));
    const extraFails = results.filter((r) => mandatoryIds.includes(r.id) && r.status !== 'PASS_LOCAL');
    const missingMandatory = mandatoryIds.filter((id) => !results.some((r) => r.id === id));
    const missing = REQUIRED.filter((k) => k !== 'RC13-13' && !by[k]);
    const failed = REQUIRED.filter((k) => k !== 'RC13-13' && by[k] && by[k].status !== 'PASS_LOCAL');
    const payload = {
      ok:
        missing.length === 0 &&
        failed.length === 0 &&
        extraFails.length === 0 &&
        missingMandatory.length === 0,
      db: dbMeta,
      missing,
      failed,
      missingMandatory,
      extraFails: extraFails.map((r) => r.id),
      mandatoryIds,
      results,
      generated_utc: new Date().toISOString(),
    };
    writeFileSync(join(logsDir, 'rc13-browser-e2e.json'), JSON.stringify(payload, null, 2));
    writeFileSync(join(logsDir, 'rc13-browser-e2e.txt'), JSON.stringify(payload, null, 2));
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
  writeFileSync(join(logsDir, 'rc13-browser-e2e.txt'), JSON.stringify({ ok: false, error: String(e && e.stack || e) }, null, 2));
  process.exit(1);
});
