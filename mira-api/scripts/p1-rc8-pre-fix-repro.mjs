/**
 * RC8 pre-fix reproduction — proves the two RC7 residual defects still exist on b4e4349.
 * Run against mira_p1_rc8_test before applying RC8 fixes (or on a worktree at RC7).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const outDir = join(root, 'audit-out', 'p1-rc8', 'pre-fix');
mkdirSync(outDir, { recursive: true });

function assertDb(url) {
  const u = new URL(url);
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error('REFUSE host');
  if (db !== 'mira_p1_rc8_test') throw new Error('REFUSE db ' + db);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
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

async function main() {
  assertDb(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  const child8 = spawn('npx', ['tsx', 'scripts/p1-rc8-browser-server.ts'], {
    cwd: join(root, 'mira-api'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready8 = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('timeout8 ' + buf)), 90000);
    child8.stdout.on('data', (d) => {
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
    child8.stderr.on('data', (d) => process.stderr.write(d));
    child8.on('exit', (c) => reject(new Error('exit8 ' + c)));
  });

  const portalPort = 8781;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready8.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const findings = [];

  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, loginUrl, ready8.salonEmail, ready8.password);

    // Create service via API for stable owner
    const created = await page.evaluate(async () => {
      const svc = await PartnersApi.createService({
        nameAr: 'خدمة RC8 repro',
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
            excludes: i === 8 ? 'إجابة الخادم الحديثة RC8' : 'قديمة ' + i,
          },
        });
        rev = (await PartnersApi.getServiceProfile(svc.id)).reviewRevision;
      }
      return { id: svc.id, rev };
    });

    // Plant stale local template (fixed + old answers) then open service
    await page.evaluate(({ id }) => {
      const scope = localStorage.getItem('mira_partner_id') || 'anon';
      const key = 'mira-service-template:' + scope + ':' + id;
      localStorage.setItem(
        key,
        JSON.stringify({
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: {
            session_kind: 'single',
            cut_style: 'cut',
            place_mode: 'branch',
            excludes: 'قالب محلي قديم',
          },
        }),
      );
      CatalogJourney.renderForm('salon', { id, nameAr: 'خدمة RC8 repro', priceHalalas: 9000, category: 'hair', durationMin: 45, reviewRevision: 9 }, 'catalogForm', 'catalogTitle');
    }, created);
    await page.waitForTimeout(1500);

    const beforeSave = await page.evaluate(async (id) => {
      const ctx = MiraEditorV2.getEditContext('catalogForm');
      const server = await PartnersApi.getServiceProfile(id);
      const doc = server.draftServiceProfileSet ? server.draftServiceProfileJson : server.serviceProfileJson;
      const pm = document.querySelector('#catalogForm select[name="priceMode"]');
      return {
        boundRev: ctx && ctx.serviceReviewRevision,
        serverRev: server.reviewRevision,
        serverMode: doc && doc.priceMode,
        serverEx: doc && doc.answers && doc.answers.excludes,
        uiMode: pm && pm.value,
      };
    }, created.id);

    await page.locator('#catalogForm button[type="submit"]').first().click();
    await page.waitForTimeout(2500);

    const afterSave = await page.evaluate(async (id) => {
      const server = await PartnersApi.getServiceProfile(id);
      const doc = server.draftServiceProfileSet ? server.draftServiceProfileJson : server.serviceProfileJson;
      return {
        serverRev: server.reviewRevision,
        serverMode: doc && doc.priceMode,
        serverEx: doc && doc.answers && doc.answers.excludes,
      };
    }, created.id);

    const bug1 =
      beforeSave.serverMode === 'from' &&
      afterSave.serverMode === 'fixed' &&
      /قديم|قالب محلي/.test(String(afterSave.serverEx || ''));
    findings.push({
      id: 'REPRO-local-template-fresh-rev',
      reproduced: bug1,
      beforeSave,
      afterSave,
      note: bug1
        ? 'BUG PRESENT: open+save without edit restored local fixed over server from'
        : 'bug not observed (may already be fixed)',
    });

    // Bug 2: persistListing A then open B — stale success mutates B
    const bug2 = await page.evaluate(async () => {
      const a = await PartnersApi.createService({
        nameAr: 'خدمة A RC8',
        priceHalalas: 5000,
        category: 'hair',
        durationMin: 30,
      });
      const b = await PartnersApi.createService({
        nameAr: 'خدمة B RC8',
        priceHalalas: 7000,
        category: 'hair',
        durationMin: 40,
      });
      CatalogJourney.renderForm('salon', a, 'catalogForm', 'catalogTitle');
      await new Promise((r) => setTimeout(r, 800));
      const origUpdate = PartnersApi.updateService.bind(PartnersApi);
      let release;
      const gate = new Promise((r) => {
        release = r;
      });
      PartnersApi.updateService = async (id, payload) => {
        if (id === a.id) {
          await gate;
          return origUpdate(id, payload);
        }
        return origUpdate(id, payload);
      };
      // start save A (will hang on updateService)
      const savePromise = (async () => {
        const form = document.getElementById('catalogForm');
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        // also call through button path
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.click();
      })();
      await new Promise((r) => setTimeout(r, 400));
      // open B while A in flight
      CatalogJourney.renderForm('salon', b, 'catalogForm', 'catalogTitle');
      await new Promise((r) => setTimeout(r, 600));
      const mid = MiraEditorV2.getEditContext('catalogForm');
      const midOwner = mid && mid.targetOwnerId;
      const midName = document.querySelector('#catalogForm [name="nameAr"]')?.value;
      release();
      await new Promise((r) => setTimeout(r, 2000));
      PartnersApi.updateService = origUpdate;
      const after = MiraEditorV2.getEditContext('catalogForm');
      const afterName = document.querySelector('#catalogForm [name="nameAr"]')?.value;
      return {
        midOwner,
        midName,
        afterOwner: after && after.targetOwnerId,
        afterName,
        bId: b.id,
        aId: a.id,
        mutated: (after && after.targetOwnerId) === a.id || afterName === 'خدمة A RC8',
      };
    });
    findings.push({
      id: 'REPRO-stale-persist-A-over-B',
      reproduced: Boolean(bug2.mutated),
      bug2,
      note: bug2.mutated
        ? 'BUG PRESENT: A response overwrote B context/UI'
        : 'bug not observed (may already be fixed)',
    });

    await ctx.close();
  } finally {
    await browser.close().catch(() => {});
    staticServer.close();
    child8.kill('SIGTERM');
  }

  const payload = {
    commit: 'b4e43490fd875a93a5f696ca9cf8aa3f00409004',
    generated_utc: new Date().toISOString(),
    findings,
    bothReproduced: findings.every((f) => f.reproduced),
  };
  writeFileSync(join(outDir, 'repro.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = payload.bothReproduced ? 0 : 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
