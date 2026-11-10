/**
 * Browser acceptance for portal shell layout (labeled fixture — no auth).
 * Viewports: 1366×768, 1440×900, 390×844.
 *
 * Run from mira-api (has playwright): 
 *   NODE_PATH=mira-api/node_modules node partners-portal/web/js/portal-shell.browser-acceptance.mjs
 * Or: node /tmp/run-portal-shell-acc.mjs (see CI notes).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const miraApiPkg = path.resolve(__dirname, '../../../mira-api/package.json');
const require = createRequire(pathToFileURL(miraApiPkg).href);
const { chromium } = require('playwright');

const evidenceDir = path.resolve(__dirname, '../../../../.portal-shell-acceptance');
fs.mkdirSync(evidenceDir, { recursive: true });

const BASE = process.env.PORTAL_BASE || 'http://127.0.0.1:4173';
const url = BASE + '/dashboard.html?ui-fixture=labeled';

const results = { ok: true, checks: [], screenshots: [], failures: [] };

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
  return file;
}

async function runViewport(browser, size) {
  const context = await browser.newContext({
    viewport: { width: size.w, height: size.h },
    locale: 'ar-SA',
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid="portal-shell"]', { timeout: 15000 });

  const prefix = size.label;

  check(
    prefix + ':shell',
    await page.locator('[data-testid="portal-shell"]').count(),
    'shell present',
  );

  // List mode: products
  await page.evaluate(() => MiraPortalShell.navigate('products', 'list', { force: true }));
  await page.waitForTimeout(200);
  const listMode = await page.evaluate(() => {
    const body = document.body;
    const list = document.getElementById('e2bListPanel');
    const editor = document.getElementById('e2bEditorPanel');
    const drafts = document.getElementById('editorDraftsSection');
    const commerce = document.getElementById('commerceSection');
    const visible = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && !el.hidden;
    };
    return {
      view: body.getAttribute('data-portal-view'),
      mode: body.getAttribute('data-portal-mode'),
      listVisible: visible(list),
      editorVisible: visible(editor),
      draftsVisible: visible(drafts),
      commerceVisible: visible(commerce),
      navActive: !!document.querySelector('[data-portal-nav="products"].is-active'),
    };
  });
  check(prefix + ':list-view', listMode.view === 'products' && listMode.mode === 'list');
  check(prefix + ':list-not-editor', listMode.listVisible !== false && !listMode.editorVisible, listMode);
  check(prefix + ':list-hides-drafts', !listMode.draftsVisible, listMode);
  check(prefix + ':list-hides-commerce', !listMode.commerceVisible, listMode);
  check(prefix + ':nav-products', listMode.navActive);
  await shot(page, prefix + '-products-list');

  // Open editor
  await page.evaluate(() => MiraPortalShell.navigate('products', 'edit', { force: true }));
  await page.waitForTimeout(250);
  if (await page.evaluate(() => !!(window.MiraE2BProductShell && MiraE2BProductShell.enableProductMode))) {
    await page.evaluate(() => MiraE2BProductShell.enableProductMode());
  }
  // Seed minimal form sections so tabs can mount
  await page.evaluate(() => {
    const form = document.getElementById('catalogForm');
    if (!form) return;
    if (!form.querySelector('[data-section-role="basics"]')) {
      const mk = (role, text) => {
        const s = document.createElement('section');
        s.setAttribute('data-section-role', role);
        s.innerHTML = '<label>حقل ' + text + '<input name="x_' + role + '" /></label>';
        form.appendChild(s);
      };
      mk('basics', 'أساسي');
      mk('options', 'خيارات');
      mk('attributes', 'خصائص');
      mk('main-media', 'وسائط');
      mk('details', 'تفاصيل');
      const actions = document.createElement('div');
      actions.setAttribute('data-section-role', 'editor-actions');
      actions.setAttribute('data-testid', 'e2b-editor-actions');
      actions.innerHTML = '<button type="button" class="btn btn-primary">حفظ المسودة</button>';
      form.appendChild(actions);
    }
    if (window.MiraE2BProductShell && MiraE2BProductShell.composeCatalogLayout) {
      MiraE2BProductShell.composeCatalogLayout();
    }
  });
  await page.waitForTimeout(300);

  const editMode = await page.evaluate(() => {
    const body = document.body;
    const list = document.getElementById('e2bListPanel');
    const editor = document.getElementById('e2bEditorPanel');
    const drafts = document.getElementById('editorDraftsSection');
    const visible = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && !el.hidden;
    };
    const form = document.getElementById('catalogForm');
    const tabs = Array.from(form ? form.querySelectorAll('[data-testid^="e2b-mobile-step-"]') : []);
    const basics = form && form.querySelector('[data-section-role="basics"]');
    const options = form && form.querySelector('[data-section-role="options"]');
    const details = form && form.querySelector('[data-section-role="details"]');
    const actions = form && form.querySelector('[data-testid="e2b-editor-actions"]');
    const step = form && form.dataset.e2bMobileStep;
    return {
      view: body.getAttribute('data-portal-view'),
      mode: body.getAttribute('data-portal-mode'),
      listVisible: visible(list),
      editorVisible: visible(editor),
      draftsVisible: visible(drafts),
      tabCount: tabs.length,
      step,
      basicsVisible: basics ? visible(basics) : null,
      optionsVisible: options ? visible(options) : null,
      detailsVisible: details ? visible(details) : null,
      actionsVisible: actions ? visible(actions) : null,
      hash: location.hash,
    };
  });
  check(prefix + ':edit-mode', editMode.mode === 'edit' && editMode.view === 'products', editMode);
  check(prefix + ':edit-hides-list', !editMode.listVisible, editMode);
  check(prefix + ':edit-shows-editor', editMode.editorVisible !== false, editMode);
  check(prefix + ':edit-hides-drafts', !editMode.draftsVisible, editMode);
  check(prefix + ':edit-hash', editMode.hash.includes('/products/edit'), editMode.hash);
  check(prefix + ':tabs-present', editMode.tabCount >= 4, editMode);
  check(prefix + ':single-tab-fields', editMode.basicsVisible === true && editMode.optionsVisible === false, editMode);
  check(prefix + ':actions-visible', editMode.actionsVisible === true, editMode);
  await shot(page, prefix + '-products-edit-basics');

  // Switch offer tab — details still hidden
  const offerBtn = page.locator('[data-testid="e2b-mobile-step-offer"]');
  if (await offerBtn.count()) {
    await offerBtn.click();
    await page.waitForTimeout(200);
    const offerState = await page.evaluate(() => {
      const form = document.getElementById('catalogForm');
      const visible = (el) => {
        if (!el) return false;
        const st = getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden' && !el.hidden;
      };
      return {
        step: form.dataset.e2bMobileStep,
        basics: visible(form.querySelector('[data-section-role="basics"]')),
        options: visible(form.querySelector('[data-section-role="options"]')),
        details: visible(form.querySelector('[data-section-role="details"]')),
      };
    });
    check(prefix + ':offer-hides-basics', !offerState.basics && offerState.options, offerState);
    check(prefix + ':offer-hides-details', !offerState.details, offerState);
    await shot(page, prefix + '-products-edit-offer');
  }

  // Navigate to drafts via side nav
  await page.locator('[data-testid="portal-nav-drafts"]').click();
  await page.waitForTimeout(200);
  const draftsView = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && !el.hidden;
    };
    return {
      view: document.body.getAttribute('data-portal-view'),
      drafts: visible(document.getElementById('editorDraftsSection')),
      catalog: visible(document.getElementById('catalogSection')),
      nav: !!document.querySelector('[data-portal-nav="drafts"].is-active'),
      hash: location.hash,
    };
  });
  check(prefix + ':drafts-alone', draftsView.view === 'drafts' && draftsView.drafts && !draftsView.catalog, draftsView);
  check(prefix + ':drafts-nav', draftsView.nav, draftsView);
  await shot(page, prefix + '-drafts');

  // History back
  await page.goBack();
  await page.waitForTimeout(250);
  const afterBack = await page.evaluate(() => ({
    view: document.body.getAttribute('data-portal-view'),
    mode: document.body.getAttribute('data-portal-mode'),
    hash: location.hash,
  }));
  check(prefix + ':history-back', afterBack.view !== 'drafts' || afterBack.hash.includes('products'), afterBack);

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const size of [
    { w: 1366, h: 768, label: 'd1366' },
    { w: 1440, h: 900, label: 'd1440' },
    { w: 390, h: 844, label: 'm390' },
  ]) {
    await runViewport(browser, size);
  }
} finally {
  await browser.close();
}

const out = path.join(evidenceDir, 'results.json');
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ ok: results.ok, failures: results.failures.length, evidence: out }, null, 2));
if (!results.ok) process.exit(1);
