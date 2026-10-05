const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const out = path.resolve(
  __dirname,
);
const base = process.env.RC6_PROBE_BASE || 'http://127.0.0.1:8766';

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const width of [390, 480, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${base}/rc6-portal-form-probe.html`, { waitUntil: 'networkidle' });
    await page
      .waitForFunction(() => window.__RC6_READY__ === true || window.__RC6_READY__ === false, null, {
        timeout: 20000,
      })
      .catch(() => {});
    await page.waitForTimeout(200);
    const ready = await page.evaluate(() => window.__RC6_READY__);
    const err = await page.evaluate(() => window.__RC6_ERROR__ || null);
    const metrics = await page.evaluate(
      () => window.__RC6_METRICS__ || { error: window.__RC6_ERROR__ || 'no-metrics' },
    );
    const all = await page.evaluate(() => window.__RC6_RESULTS__ || []);
    const shot = path.join(out, `portal-form-${width}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    if (ready !== true) {
      await browser.close();
      console.error(JSON.stringify({ width, ready, err, metrics }, null, 2));
      process.exit(1);
    }
    if (metrics.overflowX || metrics.formPastViewport || (metrics.clippedButtons || []).length) {
      await browser.close();
      console.error(JSON.stringify({ width, fail: 'overflow', metrics }, null, 2));
      process.exit(1);
    }
    results.push({ width, metrics, allTags: all.map((a) => a.tag), shot });
    await page.close();
  }
  fs.writeFileSync(path.join(out, 'browser-ui-metrics.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(
    path.join(out, 'browser-ui-journey.txt'),
    [
      'RC6 real CatalogJourney form probe — clothes + category conflict + group_removed',
      'modules=catalog-options-core.js + catalog-journey.js',
      'AUTH_SKIP=forbidden; PartnersApi save blocked in probe shell',
      'authenticated partner save/submit/admin approve = separate LIVE_JOURNEY',
      ...results.map(
        (r) =>
          `width=${r.width} overflowX=${r.metrics.overflowX} formOverflowX=${r.metrics.formOverflowX} clientWidth=${r.metrics.clientWidth} scrollWidth=${r.metrics.scrollWidth} tags=${(r.allTags || []).join(',')} conflictSnippet=${(r.metrics.conflictText || '').slice(0, 80)}`,
      ),
    ].join('\n') + '\n',
  );
  console.log(
    JSON.stringify(
      results.map((r) => ({
        width: r.width,
        overflowX: r.metrics.overflowX,
        formOverflowX: r.metrics.formOverflowX,
        tags: r.allTags,
        checked: r.metrics.checked,
      })),
      null,
      2,
    ),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
