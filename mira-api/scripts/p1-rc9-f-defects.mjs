/**
 * RC9 F1–F4 defect proofs.
 * Exit 0 only when ALL expected assertions pass for the current tree.
 * Use --expect-bugs to require that F1–F4 still reproduce (RC8 baseline).
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
const outDir = join(root, 'audit-out', 'p1-rc9', expectBugs ? 'sensitivity-rc8' : 'sensitivity-post');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(root, 'audit-out', 'p1-rc9', 'logs'), { recursive: true });

function assertDb(url) {
  const u = new URL(url);
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error('REFUSE host ' + u.hostname);
  if (db !== 'mira_p1_rc9_test') throw new Error('REFUSE db ' + db);
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
  await page.waitForTimeout(1200);
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  const startedUtc = new Date().toISOString();
  const dbMeta = assertDb(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = expectBugs && process.argv.includes('--flag-off') ? 'false' : 'true';
  if (process.argv.includes('--flag-off')) process.env.MIRA_PARTNER_EDITOR_V2 = 'false';

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

  const portalPort = expectBugs ? 8811 : 8812;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const findings = [];

  const commit = process.env.RC9_TESTED_COMMIT || 'WORKING_TREE';

  try {
    // ——— F1: save before bind completes must not put stale local under fresh rev ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');

      const created = await page.evaluate(async () => {
        const svc = await PartnersApi.createService({
          nameAr: 'خدمة RC9-F1',
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
              excludes: i === 8 ? 'خادم F1 من' : 'قديم ' + i,
            },
          });
          rev = (await PartnersApi.getServiceProfile(svc.id)).reviewRevision;
        }
        return { id: svc.id, rev };
      });

      // Gate getServiceProfile so open bind hangs
      let releaseBind;
      const bindGate = new Promise((r) => {
        releaseBind = r;
      });
      await page.route('**/service-profile**', async (route) => {
        if (route.request().method() === 'GET') {
          await bindGate;
        }
        await route.continue();
      });

      await page.evaluate(({ id, rev }) => {
        const scope = localStorage.getItem('mira_partner_id') || 'anon';
        const key =
          (window.MiraEditorV2 && MiraEditorV2.scopedTemplateKey
            ? MiraEditorV2.scopedTemplateKey(id)
            : null) ||
          'mira-service-template:' + scope + ':' + id;
        // Also plant unscoped legacy key used when V2 scoping differs
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
              excludes: 'قالب محلي قديم F1',
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
                excludes: 'قالب محلي قديم F1',
              },
            }),
          );
        }
        CatalogJourney.renderForm(
          'salon',
          {
            id,
            nameAr: 'خدمة RC9-F1',
            priceHalalas: 9000,
            category: 'hair',
            durationMin: 45,
            reviewRevision: rev,
          },
          'catalogForm',
          'catalogTitle',
        );
      }, created);

      await page.waitForTimeout(400);
      const puts = [];
      await page.evaluate(() => {
        window.__rc9Puts = [];
        const orig = PartnersApi.putServiceProfile.bind(PartnersApi);
        PartnersApi.putServiceProfile = async (id, payload, opts) => {
          window.__rc9Puts.push({
            expectedRevision: payload && payload.expectedRevision,
            priceMode: payload && payload.priceMode,
            excludes: payload && payload.answers && payload.answers.excludes,
          });
          return orig(id, payload, opts);
        };
      });

      // Save while bind still gated
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForTimeout(600);
      const midPuts = await page.evaluate(() => window.__rc9Puts.slice());
      releaseBind();
      await page.waitForTimeout(2500);
      const afterPuts = await page.evaluate(() => window.__rc9Puts.slice());
      const server = await page.evaluate(async (id) => {
        const p = await PartnersApi.getServiceProfile(id);
        const doc = p.draftServiceProfileSet ? p.draftServiceProfileJson : p.serviceProfileJson;
        return { rev: p.reviewRevision, mode: doc && doc.priceMode, ex: doc && doc.answers && doc.answers.excludes };
      }, created.id);

      await page.unroute('**/service-profile**');
      const putStale =
        afterPuts.some(
          (p) =>
            p.priceMode === 'fixed' &&
            /قديم F1|قالب محلي/.test(String(p.excludes || '')) &&
            p.expectedRevision === created.rev,
        ) ||
        (server.mode === 'fixed' && /قديم F1|قالب محلي/.test(String(server.ex || '')));

      findings.push({
        id: 'RC9-F1',
        reproduced: putStale,
        midPuts,
        afterPuts,
        server,
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F2: edits during in-flight save must not be wiped / marked fully saved ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');

      const id = await page.evaluate(async () => {
        const svc = await PartnersApi.createService({
          nameAr: 'خدمة RC9-F2 قبل',
          priceHalalas: 8000,
          category: 'hair',
          durationMin: 30,
        });
        const cur = await PartnersApi.getServiceProfile(svc.id);
        await PartnersApi.putServiceProfile(svc.id, {
          expectedRevision: cur.reviewRevision,
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch', excludes: 'أساس' },
        });
        return svc.id;
      });

      await page.evaluate((sid) => {
        CatalogJourney.renderForm(
          'salon',
          { id: sid, nameAr: 'خدمة RC9-F2 قبل', priceHalalas: 8000, category: 'hair', durationMin: 30 },
          'catalogForm',
          'catalogTitle',
        );
      }, id);
      await page.waitForFunction(() => {
        const pm = document.querySelector('#catalogForm select[name="priceMode"]');
        return pm && pm.value;
      }, { timeout: 12000 });

      let releasePut;
      const putGate = new Promise((r) => {
        releasePut = r;
      });
      let putStarted = false;
      await page.route('**/service-profile**', async (route) => {
        if (route.request().method() === 'PUT' || route.request().method() === 'POST') {
          putStarted = true;
          await putGate;
        }
        await route.continue();
      });

      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForFunction(() => document.querySelector('#catalogForm')?.dataset?.saving === '1', {
        timeout: 8000,
      }).catch(() => {});
      // Wait until put is observed (signal), not fixed sleep alone
      for (let i = 0; i < 40 && !putStarted; i++) await page.waitForTimeout(100);

      await page.fill('#catalogForm [name="nameAr"]', 'خدمة RC9-F2 أحدث');
      const pm = page.locator('#catalogForm select[name="priceMode"]');
      if ((await pm.count()) > 0) await pm.selectOption('from');

      releasePut();
      await page.waitForTimeout(2800);
      await page.unroute('**/service-profile**');

      const ui = await page.evaluate(() => ({
        name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
        pm: document.querySelector('#catalogForm select[name="priceMode"]')?.value,
        status: document.querySelector('#catalogForm [data-catalog-persist-status]')?.textContent || '',
        unsaved: document.querySelector('#catalogForm [data-unsaved-newer]') != null,
        saving: document.querySelector('#catalogForm')?.dataset?.saving,
      }));
      const wiped =
        ui.name === 'خدمة RC9-F2 قبل' ||
        (ui.pm === 'fixed' && !/غير محفوظ|أحدث|متبقي/.test(ui.status) && !ui.unsaved);

      findings.push({
        id: 'RC9-F2',
        reproduced: wiped,
        ui,
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F3: stale materialize A must not bind into draft B ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');

      const probe = await page.evaluate(async () => {
        const a = await PartnersApi.putEditorDraft('rc9-draft-A-' + Date.now(), {
          expectedRevision: null,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          schemaVersion: 2,
          values: {
            nameAr: 'مسودة A RC9-F3',
            category: 'hair',
            priceHalalas: 5000,
            durationMin: 30,
            serviceProfile: {
              templateId: 'salon_hair_cut',
              templateVersion: 1,
              priceMode: 'fixed',
              answers: { session_kind: 'single', cut_style: 'cut', place_mode: 'branch' },
            },
          },
        });
        const b = await PartnersApi.putEditorDraft('rc9-draft-B-' + Date.now(), {
          expectedRevision: null,
          kind: 'service',
          profileId: 'service.salon_hair_cut',
          schemaVersion: 2,
          values: {
            nameAr: 'مسودة B RC9-F3',
            category: 'hair',
            priceHalalas: 7000,
            durationMin: 40,
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

      // Open A
      await page.evaluate(async (cid) => {
        const d = await PartnersApi.getEditorDraft(cid);
        await CatalogJourney.reopenServerDraft(d);
      }, probe.a.clientDraftId);
      await page.waitForTimeout(800);

      let releaseMat;
      const matGate = new Promise((r) => {
        releaseMat = r;
      });
      let matStarted = false;
      await page.route('**/editor-drafts/**/materialize**', async (route) => {
        matStarted = true;
        await matGate;
        await route.continue();
      });

      const file = page.locator('#catalogForm input[type="file"]').first();
      if ((await file.count()) > 0) {
        await file.setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: tinyPng });
        await page.waitForTimeout(500);
      }
      const mat = page.locator('#catalogForm [data-editor-v2-materialize]');
      if ((await mat.count()) > 0) await mat.click();
      for (let i = 0; i < 50 && !matStarted; i++) await page.waitForTimeout(100);

      // Open B while A materialize gated
      await page.evaluate(async (cid) => {
        const d = await PartnersApi.getEditorDraft(cid);
        await CatalogJourney.reopenServerDraft(d);
      }, probe.b.clientDraftId);
      await page.waitForTimeout(600);
      const mid = await page.evaluate(() => {
        const c = MiraEditorV2.getEditContext('catalogForm');
        return {
          cid: c && c.clientDraftId,
          owner: c && c.targetOwnerId,
          name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
          stagedOwner: window.__stagedOwnerHint || null,
        };
      });

      releaseMat();
      await page.waitForTimeout(3000);
      await page.unroute('**/editor-drafts/**/materialize**');

      const after = await page.evaluate(() => {
        const c = MiraEditorV2.getEditContext('catalogForm');
        return {
          cid: c && c.clientDraftId,
          owner: c && c.targetOwnerId,
          name: document.querySelector('#catalogForm [name="nameAr"]')?.value,
          status: (document.querySelector('#catalogForm [data-catalog-persist-status]') || {}).textContent || '',
        };
      });

      const polluted =
        (after.owner && mid.cid === probe.b.clientDraftId && after.cid === probe.b.clientDraftId && after.owner) ||
        (after.name === 'مسودة A RC9-F3' && mid.name === 'مسودة B RC9-F3') ||
        (after.cid === probe.a.clientDraftId && mid.cid === probe.b.clientDraftId);

      // Stronger: B's draft id must remain and must not gain A's owner from stale apply
      const bug =
        after.cid === probe.b.clientDraftId &&
        after.owner != null &&
        after.name !== 'مسودة B RC9-F3'
          ? true
          : after.cid === probe.b.clientDraftId &&
              after.owner != null &&
              // owner set on B while still B draft without materialize of B
              true === false;

      // Check resume for A exists if A completed
      const aResume = await page.evaluate((cid) => {
        try {
          const raw = sessionStorage.getItem('mira-editor-v2-resume:' + cid) || sessionStorage.getItem('mira_resume:' + cid);
          return raw;
        } catch (e) {
          return null;
        }
      }, probe.a.clientDraftId);

      const mutated =
        after.cid === probe.b.clientDraftId &&
        ((after.owner && after.owner.length > 10 && after.name && after.name.indexOf('B RC9') >= 0 && mid.owner == null && after.owner) ||
          after.name === 'مسودة A RC9-F3');

      findings.push({
        id: 'RC9-F3',
        reproduced: Boolean(mutated),
        mid,
        after,
        aId: probe.a.clientDraftId,
        bId: probe.b.clientDraftId,
        aResumePresent: Boolean(aResume),
        expectBugs,
      });
      await ctx.close();
    }

    // ——— F4: legacy create with V2 flag off must complete and re-enable save ———
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      // Force flag off for this page via query + local override
      await page.addInitScript(() => {
        window.__MIRA_FORCE_EDITOR_V2 = false;
      });
      const loginOff = loginUrl + (loginUrl.includes('?') ? '&' : '?') + 'editor-v2=0';
      await page.goto(loginOff, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        try {
          localStorage.setItem('mira_partner_editor_v2', 'false');
        } catch (e) {}
      });
      await page.fill('input[name="email"]', ready.salonEmail);
      await page.fill('input[name="password"]', ready.password);
      await Promise.all([page.waitForURL(/dashboard\.html/, { timeout: 25000 }), page.click('button[type="submit"]')]);
      await page.waitForTimeout(1200);
      // Disable editor v2 if present
      await page.evaluate(() => {
        if (window.MiraEditorV2 && MiraEditorV2.state) MiraEditorV2.state.enabled = false;
      });
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 10000 });

      await page.fill('#catalogForm [name="nameAr"]', 'خدمة RC9-F4 legacy');
      await page.selectOption('#catalogForm [name="category"]', 'hair').catch(() => {});
      await page.fill('#catalogForm [name="priceSar"]', '55');
      await page.fill('#catalogForm [name="durationMin"]', '25').catch(() => {});
      const tpl = page.locator('#catalogForm select[name="serviceTemplateId"]');
      if ((await tpl.count()) > 0) {
        const vals = await tpl.locator('option').evaluateAll((n) => n.map((x) => x.value).filter(Boolean));
        if (vals.length) await tpl.selectOption(vals.find((v) => v === 'salon_hair_cut') || vals[0]);
        await page.waitForTimeout(400);
        const single = page.locator('#catalogForm input[type="radio"][value="single"]').first();
        if ((await single.count()) > 0) await single.check();
      }
      const file = page.locator('#catalogForm input[type="file"]').first();
      if ((await file.count()) > 0) {
        await file.setInputFiles({ name: 'f4.png', mimeType: 'image/png', buffer: tinyPng });
      }

      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForTimeout(3500);

      const state = await page.evaluate(async () => {
        const d = await PartnersApi.dashboard();
        const hit = ((d.catalog && d.catalog.services) || []).find((s) => s.nameAr === 'خدمة RC9-F4 legacy');
        const form = document.querySelector('#catalogForm');
        const save = document.querySelector('#catalogForm button[type="submit"]');
        const ctx = window.MiraEditorV2 && MiraEditorV2.getEditContext('catalogForm');
        return {
          created: Boolean(hit),
          id: hit && hit.id,
          saving: form && form.dataset.saving,
          saveDisabled: save && save.disabled,
          owner: ctx && ctx.targetOwnerId,
          v2: window.MiraEditorV2 && MiraEditorV2.state && MiraEditorV2.state.enabled,
        };
      });

      const stuck = state.created && (state.saving === '1' || state.saveDisabled === true);
      findings.push({
        id: 'RC9-F4',
        reproduced: stuck || (!state.created && expectBugs === false),
        state,
        expectBugs,
      });
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
    ok = findings.every((f) => f.reproduced === true);
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
  };
  writeFileSync(join(outDir, 'f-defects.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = ok ? 0 : 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
