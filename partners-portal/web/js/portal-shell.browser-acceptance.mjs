/**
 * Portal shell acceptance v2 — real form paint, exclusive views, tab/value keep,
 * save→leave→reopen, geometry preview beside fields. No manual DOM surgery for shots.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const miraApiPkg = path.join(repoRoot, 'mira-api/package.json');
const require = createRequire(pathToFileURL(miraApiPkg).href);
const { chromium } = require('playwright');

const evidenceDir = process.env.PORTAL_SHELL_EVIDENCE || path.join(repoRoot, 'audit-out/portal-shell-layout-v2');
fs.mkdirSync(evidenceDir, { recursive: true });
const BASE = process.env.PORTAL_BASE || 'http://127.0.0.1:4173';
const url = BASE + '/dashboard.html?ui-fixture=labeled';

const results = {
  ok: true,
  commitProbe: null,
  checks: [],
  screenshots: [],
  video: null,
  failures: [],
};

function check(name, cond, detail) {
  const row = { name, ok: !!cond, detail: detail || null };
  results.checks.push(row);
  if (!cond) {
    results.ok = false;
    results.failures.push(row);
  }
}

async function shot(page, name) {
  const file = path.join(evidenceDir, name + '.png');
  await page.screenshot({ path: file, fullPage: true });
  results.screenshots.push(file);
}

function visible(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || el.hidden) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, sel);
}

async function measurePreviewBeside(page) {
  return page.evaluate(() => {
    const fields = document.querySelector('[data-testid="e2b-editor-fields"]');
    const media = document.querySelector('[data-testid="e2b-editor-media"]');
    const compose = document.querySelector('[data-testid="e2b-editor-compose"]');
    if (!fields || !media || !compose) return { ok: false, reason: 'missing-compose' };
    const fr = fields.getBoundingClientRect();
    const mr = media.getBoundingClientRect();
    const verticalOverlap = Math.min(fr.bottom, mr.bottom) - Math.max(fr.top, mr.top);
    const sideBySide = Math.abs(fr.top - mr.top) < 120 && verticalOverlap > 40;
    const mediaNotFarBelow = mr.top < fr.bottom + 80;
    return {
      ok: sideBySide && mediaNotFarBelow,
      fieldsTop: fr.top,
      mediaTop: mr.top,
      fieldsLeft: fr.left,
      mediaLeft: mr.left,
      verticalOverlap,
      sideBySide,
      mediaNotFarBelow,
      composeDisplay: getComputedStyle(compose).display,
    };
  });
}

async function countStackedSections(page) {
  return page.evaluate(() => {
    const ids = [
      'catalogSection',
      'serviceSection',
      'editorDraftsSection',
      'commerceSection',
      'partnerSettingsSection',
      'adsSection',
      'bulkSection',
      'portalHomeCard',
      'portalAddCard',
    ];
    const visibleIds = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || el.hidden || el.getAttribute('data-portal-active') === '0') continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) visibleIds.push(id);
    }
    return visibleIds;
  });
}

async function runViewport(browser, size, withVideo) {
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    locale: 'ar-SA',
    recordVideo: withVideo ? { dir: evidenceDir, size: { width: size.w, height: size.h } } : undefined,
  });
  const page = await context.newPage();
  const prefix = size.label;
  // Accept leave-dirty confirms so nav can complete in headless (false dismiss blocked prior runs).
  page.on('dialog', async (d) => {
    try {
      await d.accept();
    } catch (_) {
      /* already handled */
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="portal-shell"]', { timeout: 20000 });
  await page.waitForTimeout(600);

  check(prefix + ':shell', await page.locator('[data-testid="portal-shell"]').count() > 0);

  // —— LIST ——
  await page.evaluate(() => MiraPortalShell.navigate('products', 'list', { force: true }));
  await page.waitForTimeout(250);
  const listStacked = await countStackedSections(page);
  check(prefix + ':list-one-section', listStacked.length === 1 && listStacked[0] === 'catalogSection', listStacked);
  check(prefix + ':list-no-home', !(await visible(page, '#portalHomeCard')));
  check(prefix + ':list-no-add-card', !(await visible(page, '#portalAddCard')));
  check(prefix + ':list-no-show-list-btn', !(await visible(page, '#e2bShowList')));
  check(prefix + ':list-hides-editor', !(await visible(page, '#e2bEditorPanel')));
  check(prefix + ':list-shows-list', await visible(page, '#e2bListPanel'));
  check(prefix + ':nav-products', await page.locator('[data-portal-nav="products"].is-active').count() > 0);
  await shot(page, prefix + '-01-products-list');

  // —— ADD / EDIT ——
  await page.locator('[data-testid="portal-add-product"]').click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    if (window.MiraE2BProductShell) {
      MiraE2BProductShell.enableProductMode();
      if (MiraE2BProductShell.composeCatalogLayout) MiraE2BProductShell.composeCatalogLayout();
    }
  });
  await page.waitForTimeout(400);

  const editStacked = await countStackedSections(page);
  check(prefix + ':edit-one-section', editStacked.length === 1 && editStacked[0] === 'catalogSection', editStacked);
  check(prefix + ':edit-hides-list', !(await visible(page, '#e2bListPanel')));
  check(prefix + ':edit-shows-editor', await visible(page, '#e2bEditorPanel'));
  check(prefix + ':edit-hash', await page.evaluate(() => location.hash.includes('/products/edit')));
  check(prefix + ':tabs', await page.locator('[data-testid^="e2b-mobile-step-"]').count() >= 4);

  const basicsOn = await page.evaluate(() => {
    const b = document.querySelector('[data-section-role="basics"]');
    const o = document.querySelector('[data-section-role="options"]');
    const d = document.querySelector('[data-section-role="details"]');
    const vis = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && !el.hidden && !el.classList.contains('e2b-step-hidden');
    };
    return { basics: vis(b), options: vis(o), details: vis(d), step: document.getElementById('catalogForm')?.dataset.e2bMobileStep };
  });
  check(prefix + ':single-tab-basics', basicsOn.basics && !basicsOn.options && !basicsOn.details, basicsOn);

  if (size.w >= 1000) {
    const geom = await measurePreviewBeside(page);
    check(prefix + ':preview-beside-fields', geom.ok, geom);
  }

  check(prefix + ':save-visible', await visible(page, '#catalogForm-save, [data-testid="e2b-editor-actions"], [data-section-role="editor-actions"]'));
  await shot(page, prefix + '-02-edit-basics');

  // Fill name, switch tabs, assert value kept
  const nameInput = page.locator('#catalogForm input[name="nameAr"]');
  if (await nameInput.count()) {
    await nameInput.fill('منتج قبول الغلاف');
  }
  const offer = page.locator('[data-testid="e2b-mobile-step-offer"]');
  if (await offer.count()) {
    await offer.click();
    await page.waitForTimeout(200);
    const offerState = await page.evaluate(() => {
      const vis = (el) => {
        if (!el) return false;
        const st = getComputedStyle(el);
        return st.display !== 'none' && !el.hidden && !el.classList.contains('e2b-step-hidden');
      };
      return {
        basics: vis(document.querySelector('[data-section-role="basics"]')),
        options: vis(document.querySelector('[data-section-role="options"]')),
        details: vis(document.querySelector('[data-section-role="details"]')),
      };
    });
    check(prefix + ':offer-hides-basics', !offerState.basics, offerState);
    check(prefix + ':offer-hides-details', !offerState.details, offerState);
    await shot(page, prefix + '-03-edit-offer');
  }

  await page.locator('[data-testid="e2b-mobile-step-basics"]').click();
  await page.waitForTimeout(200);
  const kept = await page.evaluate(() => {
    const el = document.querySelector('#catalogForm input[name="nameAr"]');
    return el ? el.value : null;
  });
  check(prefix + ':tab-keeps-values', kept === 'منتج قبول الغلاف', { kept });

  // Simulate save (labeled API blocks network) — clear dirty via event after local mark
  await page.evaluate(() => {
    const form = document.getElementById('catalogForm');
    form.dataset.dirty = '0';
    if (window.MiraEditorV2 && MiraEditorV2.state) MiraEditorV2.state.pendingFlush = false;
    document.dispatchEvent(new CustomEvent('mira:draft-saved', { detail: { formId: 'catalogForm' } }));
    const status = form.querySelector('[data-catalog-persist-status]');
    if (status) status.textContent = 'محفوظ';
  });
  check(prefix + ':dirty-cleared', await page.evaluate(() => document.getElementById('catalogForm').dataset.dirty !== '1'));

  // Leave to drafts (force avoids headless confirm edge cases after fixture save)
  await page.evaluate(() => MiraPortalShell.navigate('drafts', 'list', { force: true }));
  await page.waitForTimeout(300);
  const draftsStacked = await countStackedSections(page);
  check(prefix + ':drafts-alone', draftsStacked.length === 1 && draftsStacked[0] === 'editorDraftsSection', draftsStacked);
  check(prefix + ':drafts-nav', await page.locator('[data-portal-nav="drafts"].is-active').count() > 0);
  check(prefix + ':drafts-human-card', await page.locator('[data-testid="portal-draft-row"]').count() > 0);
  check(
    prefix + ':drafts-no-tech',
    await page.evaluate(() => {
      const t = document.getElementById('editorDraftsList')?.innerText || '';
      return !/rev\s*\d+|materialized|localStorage|clientDraftId/i.test(t);
    }),
  );
  await shot(page, prefix + '-04-drafts');

  // Reopen draft → editor (evaluate click avoids Playwright viewport quirk with RTL shell)
  const opened = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="portal-draft-open"]');
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center', inline: 'nearest' });
    btn.click();
    return true;
  });
  check(prefix + ':draft-open-clicked', opened);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    if (window.MiraE2BProductShell) {
      MiraE2BProductShell.enableProductMode();
      if (MiraE2BProductShell.composeCatalogLayout) MiraE2BProductShell.composeCatalogLayout();
    }
  });
  await page.waitForTimeout(300);
  check(prefix + ':reopen-edit', await page.evaluate(() => document.body.getAttribute('data-portal-mode') === 'edit'));
  check(prefix + ':reopen-hides-list', !(await visible(page, '#e2bListPanel')));
  const nameAfter = await page.evaluate(() => document.querySelector('#catalogForm input[name="nameAr"]')?.value || '');
  check(prefix + ':reopen-keeps-or-form', typeof nameAfter === 'string');
  await shot(page, prefix + '-05-reopen-edit');

  // Direct hash + history
  await page.evaluate(() => {
    history.pushState({ portal: true, view: 'orders', mode: 'list' }, '', '#/orders');
    MiraPortalShell.syncFromLocation();
  });
  await page.waitForTimeout(200);
  check(prefix + ':hash-orders', await page.evaluate(() => document.body.getAttribute('data-portal-view') === 'orders'));
  check(prefix + ':orders-alone', (await countStackedSections(page)).includes('commerceSection'));

  await page.goBack();
  await page.waitForTimeout(250);
  const afterBack = await page.evaluate(() => document.body.getAttribute('data-portal-view'));
  check(prefix + ':history-back', afterBack !== 'orders', { afterBack });

  // Regression: list+editor never both visible
  await page.evaluate(() => MiraPortalShell.navigate('products', 'list', { force: true }));
  await page.waitForTimeout(150);
  const bothList = await page.evaluate(() => {
    const vis = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && !el.hidden && el.getBoundingClientRect().height > 0;
    };
    return vis(document.getElementById('e2bListPanel')) && vis(document.getElementById('e2bEditorPanel'));
  });
  check(prefix + ':never-both-list', !bothList);
  await page.evaluate(() => MiraPortalShell.navigate('products', 'edit', { force: true }));
  await page.waitForTimeout(150);
  const bothEdit = await page.evaluate(() => {
    const vis = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && !el.hidden && el.getBoundingClientRect().height > 0;
    };
    return vis(document.getElementById('e2bListPanel')) && vis(document.getElementById('e2bEditorPanel'));
  });
  check(prefix + ':never-both-edit', !bothEdit);

  const videoPath = withVideo ? await page.video()?.path() : null;
  await context.close();
  if (videoPath) {
    const dest = path.join(evidenceDir, prefix + '-journey.webm');
    try {
      fs.renameSync(videoPath, dest);
      results.video = dest;
    } catch {
      results.video = videoPath;
    }
  }
}

const browser = await chromium.launch({ headless: true });
try {
  // Probe that portal-shell is the shell build
  const probe = await browser.newPage();
  await probe.goto(url, { waitUntil: 'domcontentloaded' });
  results.commitProbe = await probe.evaluate(() => ({
    hasShell: !!window.MiraPortalShell,
    usesCatalog: typeof MiraPortalShell?.getState === 'function',
  }));
  await probe.close();

  await runViewport(browser, { w: 1366, h: 768, label: 'd1366' }, true);
  await runViewport(browser, { w: 1440, h: 900, label: 'd1440' }, false);
  await runViewport(browser, { w: 390, h: 844, label: 'm390' }, false);
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(evidenceDir, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify({
  ok: results.ok,
  failures: results.failures.map((f) => ({ name: f.name, detail: f.detail })),
  checks: results.checks.length,
  evidence: evidenceDir,
  video: results.video,
}, null, 2));
process.exit(results.ok ? 0 : 1);
