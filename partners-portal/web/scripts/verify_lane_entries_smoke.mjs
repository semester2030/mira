/**
 * Smoke acceptance for independent lane entries (no preview-page substitute).
 * Uses dashboard?ui-fixture=labeled so login is bypassed for CTA presence + lane lock.
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

const base = process.env.MIRA_PORTAL_BASE || 'http://127.0.0.1:8765';
const rows = [];

function row(section, entry, saved, visible, filter) {
  rows.push({ section, entry, saved, visible, filter });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const report = { ok: true, checks: [] };

function check(name, cond, detail) {
  report.checks.push({ name, ok: !!cond, detail: detail || null });
  if (!cond) report.ok = false;
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
}

try {
  await page.goto(base + '/dashboard.html?ui-fixture=labeled&cb=' + Date.now(), {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(800);

  // Inject a brand partner so product lane CTAs paint; force host visible (portal shell may hide home card).
  await page.evaluate(() => {
    window.sessionPartner = {
      id: 'fixture-brand',
      type: 'brand',
      nameAr: 'ماركة اختبار',
      city: 'الرياض',
      canSellProducts: true,
    };
    document.body.dataset.partnerType = 'brand';
    var host = document.getElementById('laneEntries');
    if (host) {
      host.style.display = 'block';
      host.hidden = false;
      var card = host.closest('.card');
      if (card) {
        card.classList.remove('hidden');
        card.style.display = 'block';
      }
    }
    if (window.MiraLaneEntries) MiraLaneEntries.paintLaneEntries();
  });
  await page.waitForTimeout(200);

  const jewelry = page.locator('[data-testid="lane-entry-jewelry"]');
  const children = page.locator('[data-testid="lane-entry-children"]');
  const gifts = page.locator('[data-testid="lane-entry-gifts"]');
  check('lane-cta-jewelry', await jewelry.count() === 1);
  check('lane-cta-children', await children.count() === 1);
  check('lane-cta-gifts', await gifts.count() === 1);

  async function openLane(fnName, arg) {
    await page.evaluate(
      async ({ fnName, arg }) => {
        const api = window.MiraLaneEntries;
        if (!api || typeof api[fnName] !== 'function') throw new Error('missing ' + fnName);
        await api[fnName](arg);
      },
      { fnName, arg },
    );
    await page.waitForTimeout(400);
  }

  await openLane('openProductLane', 'jewelry');
  await page.waitForTimeout(900);
  const laneAfterJewelry = await page.evaluate(() => window.__MIRA_TAXONOMY_LANE__);
  const profileAfterJewelry = await page.evaluate(() => window.__MIRA_LANE_PROFILE_ID__);
  check('jewelry-lane-lock', laneAfterJewelry === 'jewelry', laneAfterJewelry);
  check('jewelry-profile-lock', profileAfterJewelry === 'product.jewelry', profileAfterJewelry);
  const jewelryVisibleErrors = await page.evaluate(() => {
    const visible = (el) => !!(el && el.offsetParent !== null && !el.hidden && !el.closest('[hidden]'));
    const texts = [];
    document.querySelectorAll('[data-testid="taxonomy-load-error"], [data-testid="e2b-taxonomy-load-error"]').forEach((el) => {
      if (visible(el)) texts.push(el.textContent || '');
    });
    return texts;
  });
  check(
    'jewelry-no-sim-block',
    !jewelryVisibleErrors.some((t) => /محاكاة:\s*لم يُرسل طلب|Failed to fetch|تعذر تحميل التصنيفات/.test(t)),
    JSON.stringify(jewelryVisibleErrors),
  );
  const jewelryOrbIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#e2bMainCircles [data-category-id]')).map((el) =>
      el.getAttribute('data-category-id'),
    ),
  );
  check(
    'jewelry-orbs-lane',
    jewelryOrbIds.length > 0 && jewelryOrbIds.every((id) => String(id).startsWith('jewelry')),
    JSON.stringify(jewelryOrbIds),
  );
  await page.screenshot({ path: join(evidenceDir, 'portal_jewelry_entry.png'), fullPage: true });
  row('مجوهرات', 'lane-entry-jewelry', 'profileId=product.jewelry sticky', 'محرر منتج + lane=jewelry', 'metal/purity من product.jewelry');

  await openLane('openProductLane', 'children');
  check('children-lane-lock', (await page.evaluate(() => window.__MIRA_TAXONOMY_LANE__)) === 'children');
  check('children-profile-lock', (await page.evaluate(() => window.__MIRA_LANE_PROFILE_ID__)) === 'product.kids');
  await page.screenshot({ path: join(evidenceDir, 'portal_children_entry.png'), fullPage: true });
  row('أطفال', 'lane-entry-children', 'profileId=product.kids sticky', 'محرر منتج + lane=children', 'ألوان/مقاسات + عمر');

  await openLane('openProductLane', 'gifts');
  check('gifts-lane-lock', (await page.evaluate(() => window.__MIRA_TAXONOMY_LANE__)) === 'gifts');
  check('gifts-profile-lock', (await page.evaluate(() => window.__MIRA_LANE_PROFILE_ID__)) === 'product.gifts');
  await page.screenshot({ path: join(evidenceDir, 'portal_gifts_entry.png'), fullPage: true });
  row('هدايا', 'lane-entry-gifts', 'profileId=product.gifts sticky', 'محرر منتج + lane=gifts', 'خيارات الصندوق');

  // Switch to event_planner / salon for occasions service CTA.
  await page.evaluate(() => {
    window.sessionPartner = {
      id: 'fixture-planner',
      type: 'event_planner',
      nameAr: 'منسّقة مناسبات',
      city: 'جدة',
      canSellProducts: true,
    };
    document.body.dataset.partnerType = 'event_planner';
    if (window.MiraLaneEntries) MiraLaneEntries.paintLaneEntries();
  });
  await page.waitForTimeout(200);
  const occ = page.locator('[data-testid="lane-entry-occasions"]');
  check('lane-cta-occasions', await occ.count() === 1);
  await openLane('openOccasionsService', null);
  check('occasions-lane-lock', (await page.evaluate(() => window.__MIRA_TAXONOMY_LANE__)) === 'occasions');
  check('occasions-profile-lock', (await page.evaluate(() => window.__MIRA_LANE_PROFILE_ID__)) === 'service.occasions');
  const occasionsOrbIds = await page.evaluate(() => {
    const visible = (el) => !!(el && el.offsetParent !== null && !el.hidden && !el.closest('[hidden]'));
    return Array.from(document.querySelectorAll('[data-testid="e2c-main-circle"]'))
      .filter(visible)
      .map((el) => el.getAttribute('data-category-id'));
  });
  const beautyLeak = ['hair', 'skin', 'laser', 'teeth', 'makeup', 'nails'];
  check(
    'occasions-orbs-not-beauty',
    occasionsOrbIds.length > 0 &&
      occasionsOrbIds.every((id) => String(id) === 'occasions' || String(id).startsWith('occasions.')) &&
      !occasionsOrbIds.some((id) => beautyLeak.includes(String(id))),
    JSON.stringify(occasionsOrbIds),
  );
  const catalogVisible = await page.evaluate(() => {
    const cat = document.getElementById('catalogSection');
    const svc = document.getElementById('serviceSection');
    const catShown = cat && !cat.hidden && !cat.classList.contains('hidden');
    const svcShown = svc && !svc.hidden && !svc.classList.contains('hidden');
    return { catShown: !!catShown, svcShown: !!svcShown, view: document.body.getAttribute('data-portal-view') };
  });
  check(
    'occasions-uses-catalog-section',
    catalogVisible.catShown && !catalogVisible.svcShown,
    JSON.stringify(catalogVisible),
  );
  await page.screenshot({ path: join(evidenceDir, 'portal_occasions_service_entry.png'), fullPage: true });
  row(
    'مناسباتك',
    'lane-entry-occasions',
    'profileId=service.occasions + occasionTypeIds/offer',
    'محرر خدمة حجز',
    'occasionType + occasionServiceOffer + availableOn',
  );

  const favors = page.locator('[data-testid="lane-entry-occasions-favors"]');
  check('lane-cta-favors-sell', await favors.count() === 1);
  await openLane('openOccasionsProductSell', 'occasions.favors');
  check(
    'favors-profile-lock',
    (await page.evaluate(() => window.__MIRA_LANE_PROFILE_ID__)) === 'product.occasions_favors' ||
      (await page.evaluate(() => window.__MIRA_TAXONOMY_LANE__)) === 'occasions',
  );
  await page.screenshot({ path: join(evidenceDir, 'portal_occasions_favors_entry.png'), fullPage: true });
  row('مناسباتك (بيع)', 'lane-entry-occasions-favors', 'product.occasions_favors', 'محرر منتج استثناء بيع', 'شراء لا حجز');
} catch (e) {
  report.ok = false;
  report.error = String(e && e.stack || e);
  console.error(report.error);
} finally {
  await browser.close();
}

const tableMd = [
  '| القسم/الفرع | المدخل | المحفوظ | الظاهر | الفلتر |',
  '|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.section} | ${r.entry} | ${r.saved} | ${r.visible} | ${r.filter} |`),
].join('\n');

writeFileSync(join(evidenceDir, 'acceptance-table.md'), tableMd + '\n');
writeFileSync(join(evidenceDir, 'portal-lane-smoke.json'), JSON.stringify(report, null, 2) + '\n');
console.log(tableMd);
console.log(report.ok ? 'VERDICT PASS_LOCAL_PORTAL_SMOKE' : 'VERDICT FAIL_PORTAL_SMOKE');
process.exit(report.ok ? 0 : 1);
