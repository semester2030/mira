const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = path.resolve(__dirname);
const base = process.env.RC7_PROBE_BASE || 'http://127.0.0.1:8767';

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const width of [390, 480, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${base}/rc7-portal-form-probe.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__RC7_READY__ === true || window.__RC7_READY__ === false, null, { timeout: 20000 }).catch(() => {});
    const ready = await page.evaluate(() => window.__RC7_READY__);
    const err = await page.evaluate(() => window.__RC7_ERROR__ || null);
    const metrics = await page.evaluate(() => window.__RC7_METRICS__ || {});
    const all = await page.evaluate(() => window.__RC7_RESULTS__ || []);
    const shot = path.join(out, `portal-clear-${width}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    if (ready !== true) {
      console.error(JSON.stringify({ width, ready, err, metrics }, null, 2));
      await browser.close();
      process.exit(1);
    }
    if (metrics.overflowX) {
      console.error(JSON.stringify({ width, fail: 'overflow', metrics }, null, 2));
      await browser.close();
      process.exit(1);
    }
    results.push({ width, tags: all.map((a) => a.tag), metrics, shot });
    await page.close();
  }
  fs.writeFileSync(path.join(out, 'browser-ui-metrics.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(
    path.join(out, 'browser-ui-journey.txt'),
    [
      'RC7 CatalogJourney clear-options UI probe (confirm mocked; PartnersApi save blocked)',
      ...results.map((r) => `width=${r.width} overflowX=${r.metrics.overflowX} tags=${r.tags.join(',')}`),
    ].join('\n') + '\n',
  );
  console.log(JSON.stringify(results.map((r) => ({ width: r.width, tags: r.tags })), null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
