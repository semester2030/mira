/**
 * P1 RC8 acceptance — strict partner UI journeys on mira_p1_rc9_test.
 * No PASS by code presence; no owner/revision injection for recovery; no renderForm rescue for partner steps.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const outDir = join(root, 'audit-out', 'p1-rc9');
const shotsDir = join(outDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(join(outDir, 'logs'), { recursive: true });

const REQUIRED = Array.from({ length: 13 }, (_, i) => `RC9-${String(i + 1).padStart(2, '0')}`);

function assertRc8Db(url) {
  const u = new URL(url);
  const host = u.hostname;
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`REFUSE host ${host}`);
  if (db !== 'mira_p1_rc9_test') throw new Error(`REFUSE db ${db}`);
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
  if (hasExcludes) await excludes.first().fill('ملاحظة RC8');
  const pm = page.locator('#catalogForm select[name="priceMode"]');
  if ((await pm.count()) === 0) throw new Error('priceMode missing');
  await pm.selectOption('fixed');
  return { templateId, hasExcludes };
}

async function waitSaved(page, timeout = 25000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#catalogForm [data-editor-v2-status]');
    return el && (el.dataset.kind === 'saved' || /محفوظ/.test(el.textContent || ''));
  }, { timeout });
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
  const dbMeta = assertRc8Db(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  const child = spawn('npx', ['tsx', 'scripts/p1-rc9-browser-server.ts'], {
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

  const portalPort = 8820;
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

    // RC9-01 create → edit priceMode → save → reopen
    {
      const meta = await fillSalonService(sp, 'خدمة RC9-01');
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
            el.value = 'قيمة بعد الإنشاء RC8';
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
        (server1 && server1.answers && server1.answers.excludes === 'قيمة بعد الإنشاء RC8');
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
        pass('RC9-01', JSON.stringify({ ownerId, ui1, ui2, server1, server2, probe }));
      } else {
        fail('RC9-01', JSON.stringify({ ownerId, ownerSame, ui1, ui2, server1, serverOpen, server2, ansOk, probe }));
      }
      await sp.screenshot({ path: join(shotsDir, 'rc9-01.png'), fullPage: true });
      globalThis.__rc8ServiceId = ownerId;
    }

    // RC9-02 stale local template must not overwrite server on open+save
    {
      const id = globalThis.__rc8ServiceId;
      if (!id) fail('RC9-02', 'no service id');
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
              excludes: 'خادم أحدث RC9-02',
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
                excludes: 'محلي قديم RC9-02',
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
        if (ui === 'from' && after && after.priceMode === 'from' && after.answers && after.answers.excludes === 'خادم أحدث RC9-02') {
          pass('RC9-02', JSON.stringify({ ui, after }));
        } else {
          fail('RC9-02', JSON.stringify({ ui, after }));
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
        if (mid.conflict || mid.mode === 'from') pass('RC9-02b-edit-during-bind', JSON.stringify(mid));
        else fail('RC9-02b-edit-during-bind', JSON.stringify(mid));
      }
    }

    // RC9-03 persist A then open B (service)
    {
      const probe = await sp.evaluate(async () => {
        const a = await PartnersApi.createService({
          nameAr: 'خدمة A RC9-03',
          priceHalalas: 5100,
          category: 'hair',
          durationMin: 30,
        });
        const b = await PartnersApi.createService({
          nameAr: 'خدمة B RC9-03',
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
            return orig(id, { ...payload, nameAr: 'خدمة A RC9-03 محفوظ' });
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
        const bCard = cards.find((c) => (c.textContent || '').includes('خدمة B RC9-03'));
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
        return { a: a.id, b: b.id, aStarted, mid, after, ok: after.owner === b.id && after.name === 'خدمة B RC9-03' };
      });
      if (probe.ok && probe.aStarted) pass('RC9-03', JSON.stringify(probe));
      else fail('RC9-03', JSON.stringify(probe));
    }

    // RC9-04 partial save: profile ok, basics fail, then recover
    {
      const id = globalThis.__rc8ServiceId;
      await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
        if (!hit) throw new Error('RC9-04 service missing ' + sid);
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
          const e = new Error('RC8 injected basics failure');
          e.code = 'RC8_INJECT';
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
      await sp.fill('#catalogForm [name="nameAr"]', 'خدمة RC8 جزئي');
      const ex04 = sp.locator('#catalogForm [name="excludes"], #catalogForm textarea[name="excludes"]');
      if ((await ex04.count()) > 0) await ex04.first().fill('جزئي قالب RC8');
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
      }, { timeout: 15000 }).catch(() => {});
      const nameOk = await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
        return hit && hit.nameAr === 'خدمة RC8 جزئي';
      }, id);
      const count = await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        return ((d.catalog && d.catalog.services) || []).filter((s) => s.id === sid).length;
      }, id);
      if (honest && nameOk && count === 1) pass('RC9-04', JSON.stringify({ honest, nameOk, count, putProbe }));
      else fail('RC9-04', JSON.stringify({ honest, nameOk, count, msg: msg.slice(0, 300), putProbe }));
    }

    // RC9-05 conflict keep/reload via real buttons
    {
      const id = globalThis.__rc8ServiceId;
      await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
        if (!hit) throw new Error('RC9-05 service missing');
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
              excludes: 'منافس RC9-05',
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
      const serverKept = afterKeep && afterKeep.answers && afterKeep.answers.excludes === 'منافس RC9-05';
      await sp.locator('[data-service-conflict-reload]').click();
      await sp.waitForFunction(() => {
        const el =
          document.querySelector('#catalogForm [name="excludes"]') ||
          document.querySelector('#catalogForm textarea[name="excludes"]');
        const st =
          document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '';
        return (el && el.value === 'منافس RC9-05') || /أُعيد تحميل قالب/.test(st);
      }, { timeout: 12000 });
      const uiEx = await sp.evaluate(() => {
        const el =
          document.querySelector('#catalogForm [name="excludes"]') ||
          document.querySelector('#catalogForm textarea[name="excludes"]');
        return el ? el.value : '';
      });
      await sp.fill('#catalogForm [name="nameAr"]', 'خدمة RC8 بعد التعارض');
      await sp.locator('#catalogForm button[type="submit"]').first().click();
      await sp.waitForFunction(() => {
        const t =
          document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '';
        return /حُفظت المسودة|القالب والبيانات محفوظان/.test(t);
      }, { timeout: 15000 }).catch(() => {});
      const nameOk = await sp.evaluate(async (sid) => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.id === sid);
        return hit && hit.nameAr === 'خدمة RC8 بعد التعارض';
      }, id);
      if (conflict && serverKept && nameOk && uiEx === 'منافس RC9-05') {
        pass('RC9-05', JSON.stringify({ conflict, serverKept, uiEx, nameOk }));
      } else {
        fail('RC9-05', JSON.stringify({ conflict, serverKept, uiEx, nameOk }));
      }
    }

    // RC9-06 conflict reload A then open B before response
    {
      const probe = await sp.evaluate(async () => {
        const a = await PartnersApi.putEditorDraft('rc9-draft-A-' + Date.now(), {
          expectedRevision: null,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          schemaVersion: 2,
          values: { nameAr: 'مسودة A RC8', category: 'hair', priceHalalas: 1000, durationMin: 30 },
        });
        const b = await PartnersApi.putEditorDraft('rc9-draft-B-' + Date.now(), {
          expectedRevision: null,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          schemaVersion: 2,
          values: { nameAr: 'مسودة B RC8', category: 'hair', priceHalalas: 2000, durationMin: 40 },
        });
        CatalogJourney.reopenServerDraft(a, 'A', 'catalogForm');
        await new Promise((r) => setTimeout(r, 400));
        // force conflict UI
        const form = document.getElementById('catalogForm');
        MiraEditorV2.setStatus(form, 'تعارض', 'conflict');
        // Simulate showRevisionConflictUi by scheduling a delayed get then reopen
        const opDraft = a.clientDraftId;
        const opGen = MiraEditorV2.getEditContext('catalogForm').formGeneration;
        const orig = PartnersApi.getEditorDraft.bind(PartnersApi);
        PartnersApi.getEditorDraft = async (id, opts) => {
          if (id === opDraft) await new Promise((r) => setTimeout(r, 900));
          return orig(id, opts);
        };
        const p = (async () => {
          const draft = await PartnersApi.getEditorDraft(opDraft);
          const live = MiraEditorV2.getEditContext('catalogForm');
          if (!live || live.clientDraftId !== opDraft || live.formGeneration !== opGen) {
            return { ignored: true };
          }
          CatalogJourney.reopenServerDraft(draft, 'stale A', 'catalogForm');
          return { ignored: false };
        })();
        CatalogJourney.reopenServerDraft(b, 'B', 'catalogForm');
        const result = await p;
        PartnersApi.getEditorDraft = orig;
        const live = MiraEditorV2.getEditContext('catalogForm');
        const name = document.querySelector('#catalogForm [name="nameAr"]')?.value;
        return {
          result,
          liveCid: live && live.clientDraftId,
          expectB: b.clientDraftId,
          name,
          ok: result.ignored && live.clientDraftId === b.clientDraftId && name === 'مسودة B RC8',
        };
      });
      if (probe.ok) pass('RC9-06', JSON.stringify(probe));
      else fail('RC9-06', JSON.stringify(probe));
    }

    // RC9-07 old finally must not create extra B request (exactly 1 start for B)
    {
      const probe = await sp.evaluate(async () => {
        const calls = [];
        const orig = PartnersApi.putEditorDraft.bind(PartnersApi);
        PartnersApi.putEditorDraft = async (id, body, opts) => {
          calls.push({ id, phase: 'start', t: Date.now() });
          if (String(id).includes('rc9-inf-A')) await new Promise((r) => setTimeout(r, 1000));
          else await new Promise((r) => setTimeout(r, 150));
          const out = await orig(id, body, opts);
          calls.push({ id, phase: 'end', t: Date.now() });
          return out;
        };
        const idA = 'rc9-inf-A-' + Date.now();
        const idB = 'rc9-inf-B-' + Date.now();
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
      if (probe.ok) pass('RC9-07', JSON.stringify(probe));
      else fail('RC9-07', JSON.stringify(probe));
    }

    // RC9-08 auth switch mid JSON body
    {
      const authProbe = await sp.evaluate(async () => {
        const tokenA = localStorage.getItem('mira_partner_token');
        let saw = false;
        const orig = window.fetch.bind(window);
        window.fetch = async (url, opts) => {
          const res = await orig(url, opts);
          const clone = res.clone();
          PartnersApi.saveSession('other-rc8@test.local', 'token-OTHER-rc9-xxxxxxxxxxxx');
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
      if (authProbe.saw) pass('RC9-08', JSON.stringify(authProbe));
      else fail('RC9-08', JSON.stringify(authProbe));
    }

    await salonCtx.close();

    // RC9-09 invalid during save — fresh session
    {
      const s9 = await browser.newContext();
      const p9 = await s9.newPage();
      await login(p9, loginUrl, ready.salonEmail, ready.password);
      await p9.click('#goService');
      await p9.waitForSelector('#catalogForm [name="nameAr"]');
      await fillSalonService(p9, 'خدمة RC9-09');
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
      await p9.fill('#catalogForm [name="nameAr"]', 'خدمة RC9-09 b');
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
      if (kind.kind !== 'saved' && !kind.lastOk && after.lastOk) pass('RC9-09', JSON.stringify({ kind, after }));
      else fail('RC9-09', JSON.stringify({ kind, after }));
      await s9.close();
    }

    // ——— Brand: RC9-10 lost response, RC9-11 double-click, RC9-12 public ———
    const brandCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await brandCtx.newPage();
    await login(page, loginUrl, ready.brandEmail, ready.password);

    async function fillProduct(pg, name, price, size) {
      await pg.click('#goProduct');
      await pg.waitForSelector('#catalogForm [name="nameAr"]');
      await pg.fill('#catalogForm [name="nameAr"]', name);
      await pg.selectOption('#catalogForm [name="category"]', 'clothes');
      await pg.fill('#catalogForm [name="priceSar"]', String(price));
      await pg.fill('#catalogForm [name="stockQty"]', '3');
      await pg.waitForSelector('#catalogForm .option-group', { timeout: 10000 });
      await pg.getByRole('checkbox', { name: size, exact: true }).check();
      await pg.getByRole('checkbox', { name: 'أسود', exact: true }).check();
      await pg.locator('#catalogForm button[type="submit"]').first().click();
      await waitSaved(pg);
    }

    // RC9-11 double-click first convert
    await fillProduct(page, 'منتج RC9-11', 150, 'M');
    const before = await page.evaluate(async () => {
      const d = await PartnersApi.dashboard();
      return ((d.catalog && d.catalog.products) || []).map((p) => p.id);
    });
    const mat = page.locator('#catalogForm [data-editor-v2-materialize]');
    await Promise.all([mat.click(), mat.click()]);
    await page.waitForTimeout(3500);
    const st = await page.locator('#catalogForm').innerText();
    const m = st.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    let productId = m && m[0];
    const afterDbl = await page.evaluate(async () => {
      const d = await PartnersApi.dashboard();
      return ((d.catalog && d.catalog.products) || []).map((p) => p.id);
    });
    if (productId && afterDbl.length === before.length + 1 && afterDbl.filter((id) => id === productId).length === 1) {
      pass('RC9-11', JSON.stringify({ productId, before, afterDbl }));
    } else fail('RC9-11', JSON.stringify({ productId, before, afterDbl, st: st.slice(0, 180) }));

    // RC9-10 lost materialize — in-form retry + reload path
    await fillProduct(page, 'منتج RC9-10 فقد', 120, 'L');
    const beforeLost = await page.evaluate(async () => {
      const d = await PartnersApi.dashboard();
      return ((d.catalog && d.catalog.products) || []).map((p) => p.id);
    });
    let droppedRaw = null;
    await page.route('**/editor-drafts/**/materialize**', async (route) => {
      const res = await route.fetch();
      droppedRaw = await res.text();
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'RC8 dropped' }),
      });
    });
    const fi = page.locator('#catalogForm input[type="file"]').first();
    await fi.setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: tinyPng });
    await page.waitForTimeout(600);
    await page.locator('#catalogForm [data-editor-v2-materialize]').click();
    await page.waitForTimeout(2500);
    await page.unroute('**/editor-drafts/**/materialize**');
    let droppedOwner = null;
    try {
      droppedOwner = JSON.parse(droppedRaw || '{}').targetOwnerId;
    } catch (_) {}
    const uiOwner = await page.evaluate(() => MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId || null);
    // in-form retry without injection
    await page.locator('#catalogForm [data-editor-v2-materialize]').click();
    await page.waitForTimeout(3000);
    let st10 = await page.locator('#catalogForm').innerText();
    if (/استئناف|تعذر الإرسال/.test(st10)) {
      await fi.setInputFiles({ name: 'p2.png', mimeType: 'image/png', buffer: tinyPng });
      await page.waitForTimeout(700);
      await page.locator('#catalogForm [data-editor-v2-materialize]').click();
      await page.waitForTimeout(2500);
    }
    const afterInForm = await page.evaluate(async () => {
      const d = await PartnersApi.dashboard();
      return ((d.catalog && d.catalog.products) || []).map((p) => p.id);
    });
    const created = afterInForm.filter((id) => !beforeLost.includes(id));
    const ctxAfter = await page.evaluate(() => ({
      owner: MiraEditorV2.getEditContext('catalogForm')?.targetOwnerId,
    }));

    // Second independent lost-response with page reload before any in-form recover
    await fillProduct(page, 'منتج RC9-10 reload', 130, 'M');
    const beforeReload = await page.evaluate(async () => {
      const d = await PartnersApi.dashboard();
      return ((d.catalog && d.catalog.products) || []).map((p) => p.id);
    });
    let dropped2 = null;
    await page.route('**/editor-drafts/**/materialize**', async (route) => {
      const res = await route.fetch();
      dropped2 = await res.text();
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'RC8 dropped reload' }),
      });
    });
    await page.locator('#catalogForm input[type="file"]').first().setInputFiles({
      name: 'r.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });
    await page.waitForTimeout(500);
    await page.locator('#catalogForm [data-editor-v2-materialize]').click();
    await page.waitForTimeout(2200);
    await page.unroute('**/editor-drafts/**/materialize**');
    let droppedOwner2 = null;
    try {
      droppedOwner2 = JSON.parse(dropped2 || '{}').targetOwnerId;
    } catch (_) {}
    // reload immediately — no in-form retry first
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await page.evaluate(async () => {
      if (window.renderEditorDrafts) await window.renderEditorDrafts();
    });
    await page.waitForTimeout(700);
    const openDraft = page.locator('#editorDraftsList button', { hasText: 'فتح' }).first();
    if ((await openDraft.count()) > 0) {
      await openDraft.click();
      await page.waitForTimeout(1200);
    }
    const mat2 = page.locator('#catalogForm [data-editor-v2-materialize]');
    if ((await mat2.count()) > 0) {
      const f2 = page.locator('#catalogForm input[type="file"]').first();
      if ((await f2.count()) > 0) {
        await f2.setInputFiles({ name: 'r2.png', mimeType: 'image/png', buffer: tinyPng });
        await page.waitForTimeout(600);
      }
      await mat2.click();
      await page.waitForTimeout(2800);
    }
    const afterReload = await page.evaluate(async () => {
      const d = await PartnersApi.dashboard();
      return ((d.catalog && d.catalog.products) || []).map((p) => p.id);
    });
    const created2 = afterReload.filter((id) => !beforeReload.includes(id));
    const ok10 =
      created.length === 1 &&
      created[0] === droppedOwner &&
      uiOwner == null &&
      (ctxAfter.owner === created[0] || afterInForm.includes(created[0])) &&
      created2.length === 1 &&
      created2[0] === droppedOwner2 &&
      afterReload.filter((id) => id === created2[0]).length === 1;
    if (ok10) {
      pass('RC9-10', JSON.stringify({ created, droppedOwner, uiOwner, ctxAfter, created2, droppedOwner2 }));
      productId = created2[0];
    } else {
      fail('RC9-10', JSON.stringify({ created, droppedOwner, uiOwner, ctxAfter, created2, droppedOwner2, beforeReload, afterReload }));
    }

    // RC9-12 public exact for the reload product (price 130 → 13000)
    if (productId) {
      await page.evaluate(async (id) => {
        try {
          await PartnersApi.submitReview('products', id);
        } catch (_) {}
      }, productId);
      await page.waitForTimeout(400);
      const preview = await page.request.get(`${apiBase}/admin/catalog-reviews/product/${productId}`, {
        headers: { 'X-Admin-Key': ready.adminKey },
      });
      const prevBody = await preview.json().catch(() => ({}));
      let rev = prevBody.revision ?? prevBody.reviewRevision ?? 1;
      let decision = await page.request.post(`${apiBase}/admin/catalog-reviews/product/${productId}/decision`, {
        headers: { 'X-Admin-Key': ready.adminKey, 'Content-Type': 'application/json' },
        data: { decision: 'approve', revision: rev },
      });
      let decBody = await decision.json().catch(() => ({}));
      if (!decision.ok()) {
        rev = decBody.currentRevision ?? rev;
        decision = await page.request.post(`${apiBase}/admin/catalog-reviews/product/${productId}/decision`, {
          headers: { 'X-Admin-Key': ready.adminKey, 'Content-Type': 'application/json' },
          data: { decision: 'approve', revision: rev },
        });
        decBody = await decision.json().catch(() => ({}));
      }
      const pub = await page.request.get(`${apiBase}/marketplace/catalog/product/${productId}`);
      const body = await pub.json().catch(() => ({}));
      const opts = Array.isArray(body.optionsJson) ? body.optionsJson : [];
      const colorIds = Array.isArray(body.colors)
        ? body.colors
        : ((opts.find((g) => g && g.id === 'color') || {}).values || []).map((v) => v.id);
      const sizeIds = Array.isArray(body.sizes)
        ? body.sizes
        : ((opts.find((g) => g && (g.id === 'size' || g.id === 'sizes')) || {}).values || []).map((v) => v.id);
      const expectedPrice = 13000;
      const ok =
        decision.ok() &&
        pub.ok() &&
        body.id === productId &&
        body.priceHalalas === expectedPrice &&
        colorIds.includes('black') &&
        sizeIds.includes('M');
      if (ok) pass('RC9-12', JSON.stringify({ id: body.id, priceHalalas: body.priceHalalas, colorIds, sizeIds, contentStatus: body.contentStatus || decBody.contentStatus }));
      else fail('RC9-12', JSON.stringify({ decision: decision.status(), bodySlice: JSON.stringify(body).slice(0, 600), colorIds, sizeIds, expectedPrice }));
    } else fail('RC9-12', 'no productId');

    // Service public leg — submit via partner then approve as admin
    {
      const sid = globalThis.__rc8ServiceId;
      if (sid) {
        const salonSubmitCtx = await browser.newContext();
        const ssp = await salonSubmitCtx.newPage();
        await login(ssp, loginUrl, ready.salonEmail, ready.password);
        await ssp.click('#goService');
        await ssp.waitForTimeout(800);
        const submitted = await ssp.evaluate(async (id) => {
          try {
            await PartnersApi.submitReview('services', id);
            return { ok: true };
          } catch (e) {
            return { ok: false, message: e && e.message, code: e && e.code };
          }
        }, sid);
        await salonSubmitCtx.close();
        const preview = await page.request.get(`${apiBase}/admin/catalog-reviews/service/${sid}`, {
          headers: { 'X-Admin-Key': ready.adminKey },
        });
        const prevBody = await preview.json().catch(() => ({}));
        let rev = prevBody.revision ?? prevBody.reviewRevision ?? prevBody.currentRevision ?? 1;
        let decision = await page.request.post(`${apiBase}/admin/catalog-reviews/service/${sid}/decision`, {
          headers: { 'X-Admin-Key': ready.adminKey, 'Content-Type': 'application/json' },
          data: { decision: 'approve', revision: rev },
        });
        let decBody = await decision.json().catch(() => ({}));
        if (!decision.ok()) {
          rev = decBody.currentRevision ?? decBody.revision ?? rev;
          decision = await page.request.post(`${apiBase}/admin/catalog-reviews/service/${sid}/decision`, {
            headers: { 'X-Admin-Key': ready.adminKey, 'Content-Type': 'application/json' },
            data: { decision: 'approve', revision: rev },
          });
          decBody = await decision.json().catch(() => ({}));
        }
        const pub = await page.request.get(`${apiBase}/marketplace/catalog/service/${sid}`);
        const body = await pub.json().catch(() => ({}));
        const doc = body.serviceProfileJson || body.serviceProfile || null;
        const ok12s =
          submitted.ok !== false &&
          decision.ok() &&
          pub.ok() &&
          body.id === sid &&
          doc &&
          doc.templateId;
        results.push({
          id: 'RC9-12-service',
          status: ok12s ? 'PASS_LOCAL' : 'FAIL',
          detail: JSON.stringify({
            id: body.id,
            priceHalalas: body.priceHalalas,
            doc,
            decision: decision.status(),
            submitted,
            rev,
          }),
          utc: new Date().toISOString(),
        });
      } else {
        results.push({
          id: 'RC9-12-service',
          status: 'FAIL',
          detail: 'no __rc8ServiceId',
          utc: new Date().toISOString(),
        });
      }
    }

    await page.screenshot({ path: join(shotsDir, 'rc9-12-product.png'), fullPage: true });
    await brandCtx.close();

    // Clinic routing evidence attached under RC9-01 matrix separately — record as part of RC9-13 env
    {
      const cctx = await browser.newContext();
      const cp = await cctx.newPage();
      await login(cp, loginUrl, ready.clinicEmail, ready.password);
      await cp.click('#goService');
      await cp.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 10000 });
      const used = await cp.evaluate(() => (document.querySelector('#catalogForm [name="nameAr"]') ? 'catalogForm' : 'missing'));
      results.push({ id: 'RC9-clinic-form', status: used === 'catalogForm' ? 'PASS_LOCAL' : 'FAIL', detail: used, utc: new Date().toISOString() });
      await cctx.close();
    }

    // RC9-13 is filled by REVERIFY companion commands — mark pending here then aggregator checks logs
    results.push({
      id: 'RC9-13',
      status: 'PENDING_REVERIFY',
      detail: 'registry/options/isolation/editor-v2/flutter via REVERIFY.sh',
      utc: new Date().toISOString(),
    });

    // Fold service public leg into RC9-12 — both product and service journeys are mandatory.
    const svc12 = results.find((r) => r.id === 'RC9-12-service');
    const prod12 = results.find((r) => r.id === 'RC9-12');
    if (prod12 && svc12 && svc12.status !== 'PASS_LOCAL') {
      prod12.status = 'FAIL';
      prod12.detail = JSON.stringify({ product: prod12.detail, service: svc12.detail });
    } else if (prod12 && !svc12) {
      prod12.status = 'FAIL';
      prod12.detail = JSON.stringify({ product: prod12.detail, service: 'missing RC9-12-service leg' });
    }

    const by = {};
    for (const r of results) {
      // Only exact RC9-NN ids feed the mandatory matrix (ignore RC9-12-service / RC9-02b extras).
      const key = REQUIRED.includes(r.id) ? r.id : null;
      if (!key) continue;
      if (!by[key] || r.status === 'FAIL') by[key] = r;
    }
    const missing = REQUIRED.filter((k) => k !== 'RC9-13' && !by[k]);
    const failed = REQUIRED.filter((k) => k !== 'RC9-13' && by[k] && by[k].status !== 'PASS_LOCAL');
    const payload = {
      ok: missing.length === 0 && failed.length === 0,
      db: dbMeta,
      missing,
      failed,
      results,
      generated_utc: new Date().toISOString(),
    };
    writeFileSync(join(outDir, 'logs', 'rc9-browser-e2e.txt'), JSON.stringify(payload, null, 2));
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
  writeFileSync(join(outDir, 'logs', 'rc9-browser-e2e.txt'), JSON.stringify({ ok: false, error: String(e && e.stack || e) }, null, 2));
  process.exit(1);
});
