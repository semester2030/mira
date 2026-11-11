/**
 * Real-connection gate for jewelry taxonomy.
 * PASS only when taxonomy comes from the API server (not static fallback),
 * jewelry branches paint, and no visible fetch/sim error remains.
 *
 * Negative mode (MIRA_EXPECT_FAIL=1): forces static fallback / error path and
 * asserts this gate FAILS — even if orbs still paint from bundled JSON.
 */
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const evidenceDir = join(root, '../../docs/evidence/independent-lane-entries');
mkdirSync(evidenceDir, { recursive: true });
const requireFromApi = createRequire(join(root, '../../mira-api/package.json'));
const { chromium } = requireFromApi('playwright');

const portalBase = (process.env.MIRA_PORTAL_BASE || 'http://127.0.0.1:8765').replace(/\/$/, '');
// Same-origin proxy default avoids CORS when portal is local and API is Render.
const apiBase = (process.env.MIRA_API_BASE || `${portalBase}/api/v1`).replace(/\/$/, '');
const expectFail = process.env.MIRA_EXPECT_FAIL === '1';
const report = { ok: true, expectFail, checks: [], apiBase, portalBase };

function check(name, cond, detail) {
  report.checks.push({ name, ok: !!cond, detail: detail || null });
  if (!cond) report.ok = false;
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  const qs = new URLSearchParams({
    'api-base': apiBase,
    'taxonomy-source': 'server',
    // Labeled boots scripts without partner login; taxonomy-source=server still forces API.
    'ui-fixture': 'labeled',
  });
  const url = `${portalBase}/dashboard.html?${qs.toString()}&cb=${Date.now()}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => typeof window.MiraLaneEntries !== 'undefined', null, {
    timeout: 15000,
  });
  await page.waitForTimeout(400);

  // Probe API directly first (independent of portal session).
  const apiProbe = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/marketplace/taxonomy?lane=jewelry&audience=partner`, {
      headers: { Accept: 'application/json' },
    });
    const body = await res.json().catch(() => ({}));
    const ids = Array.isArray(body.nodes) ? body.nodes.map((n) => n.id) : [];
    return { status: res.status, lane: body.lane, ids };
  }, apiBase);
  check('api-jewelry-200', apiProbe.status === 200, JSON.stringify({ status: apiProbe.status, lane: apiProbe.lane }));
  check(
    'api-jewelry-branches',
    ['jewelry.rings', 'jewelry.necklaces', 'jewelry.bracelets', 'jewelry.earrings'].every((id) =>
      apiProbe.ids.includes(id),
    ),
    JSON.stringify(apiProbe.ids.filter((id) => String(id).startsWith('jewelry'))),
  );

  await page.evaluate(() => {
    window.sessionPartner = {
      id: 'real-conn-brand',
      type: 'brand',
      nameAr: 'ماركة اتصال حقيقي',
      city: 'الرياض',
      canSellProducts: true,
    };
    document.body.dataset.partnerType = 'brand';
    const host = document.getElementById('laneEntries');
    if (host) {
      host.style.display = 'block';
      host.hidden = false;
      const card = host.closest('.card');
      if (card) card.classList.remove('hidden');
    }
    if (window.MiraLaneEntries) MiraLaneEntries.paintLaneEntries();
  });
  await page.waitForTimeout(200);

  if (expectFail) {
    // Force product shell to pretend server failed → static fallback (must fail real gate).
    await page.evaluate(async () => {
      const orig = window.PartnersApi && window.PartnersApi.taxonomy;
      if (window.PartnersApi) {
        window.PartnersApi.taxonomy = async () => {
          throw Object.assign(new Error('Failed to fetch'), { messageAr: 'Failed to fetch' });
        };
      }
      try {
        await MiraLaneEntries.openProductLane('jewelry');
      } finally {
        if (window.PartnersApi && orig) window.PartnersApi.taxonomy = orig;
      }
    });
  } else {
    await page.evaluate(async () => {
      await MiraLaneEntries.openProductLane('jewelry');
    });
  }
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => {
    const visible = (el) => !!(el && el.offsetParent !== null && !el.hidden && !el.closest('[hidden]'));
    const errs = [];
    document
      .querySelectorAll('[data-testid="taxonomy-load-error"], [data-testid="e2b-taxonomy-load-error"]')
      .forEach((el) => {
        if (visible(el)) errs.push(el.textContent || '');
      });
    const form = document.getElementById('catalogForm');
    const subIds = [...(form ? form.querySelectorAll('select[name="subcategory"] option') : [])]
      .map((o) => o.value)
      .filter(Boolean);
    const orbs = [...document.querySelectorAll('#e2bMainCircles [data-category-id]')].map((el) =>
      el.getAttribute('data-category-id'),
    );
    return {
      source: window.__MIRA_TAXONOMY_SOURCE__ || document.body.dataset.taxonomySource || null,
      lane: window.__MIRA_TAXONOMY_LANE__,
      orbs,
      subIds,
      errs,
    };
  });

  check('jewelry-lane', state.lane === 'jewelry', state.lane);
  check('jewelry-orbs', state.orbs.includes('jewelry'), JSON.stringify(state.orbs));
  check(
    'jewelry-subbranches',
    ['jewelry.rings', 'jewelry.necklaces', 'jewelry.bracelets', 'jewelry.earrings'].every((id) =>
      state.subIds.includes(id),
    ) && state.subIds.every((id) => String(id).startsWith('jewelry.')),
    JSON.stringify(state.subIds),
  );
  check('no-visible-taxonomy-error', state.errs.length === 0, JSON.stringify(state.errs));
  check('taxonomy-source-server', state.source === 'server', state.source);

  await page.screenshot({
    path: join(evidenceDir, expectFail ? 'portal_jewelry_negative_fallback.png' : 'portal_jewelry_real_server.png'),
    fullPage: true,
  });

  report.state = state;
  report.apiProbe = apiProbe;
} catch (e) {
  report.ok = false;
  report.error = String(e && e.stack ? e.stack : e);
  console.error(report.error);
} finally {
  await browser.close();
}

if (expectFail) {
  // Negative: real-connection criteria must NOT all pass.
  const serverOk = report.checks.find((c) => c.name === 'taxonomy-source-server');
  const noErr = report.checks.find((c) => c.name === 'no-visible-taxonomy-error');
  const negativePass = !(serverOk && serverOk.ok && noErr && noErr.ok);
  report.negativeGate = { ok: negativePass, detail: 'fallback/error must fail real-connection gate' };
  console.log((negativePass ? 'PASS' : 'FAIL') + ' negative-real-connection-rejects-fallback');
  report.ok = negativePass;
} else {
  report.verdict = report.ok ? 'PASS_REAL_JEWELRY_CONNECTION' : 'FAIL_REAL_JEWELRY_CONNECTION';
  console.log('VERDICT ' + report.verdict);
}

writeFileSync(
  join(evidenceDir, expectFail ? 'jewelry-real-connection-negative.json' : 'jewelry-real-connection.json'),
  JSON.stringify(report, null, 2),
);
process.exit(report.ok ? 0 : 1);
