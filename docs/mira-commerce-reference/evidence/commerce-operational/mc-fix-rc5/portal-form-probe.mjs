const { chromium } = require('playwright');
const fs = require('fs');
const out = 'docs/mira-commerce-reference/evidence/commerce-operational/mc-fix-rc5';

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const width of [390, 480, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto('http://127.0.0.1:8765/rc5-portal-form-probe.html', { waitUntil: 'networkidle' });
    await page
      .waitForFunction(() => window.__RC5_READY__ === true || window.__RC5_READY__ === false, null, {
        timeout: 15000,
      })
      .catch(() => {});
    await page.waitForTimeout(300);
    const metrics = await page.evaluate(
      () => window.__RC5_METRICS__ || { error: window.__RC5_ERROR__ || 'no-metrics' },
    );
    const shot = `${out}/portal-form-${width}.png`;
    await page.screenshot({ path: shot, fullPage: true });
    results.push({ width, metrics, shot });
    await page.close();
  }
  fs.writeFileSync(`${out}/browser-ui-metrics.json`, JSON.stringify(results, null, 2));
  fs.writeFileSync(
    `${out}/browser-ui-journey.txt`,
    [
      'RC5 real CatalogJourney form probe (dashboard shell; PartnersApi save blocked — no AUTH_SKIP)',
      'modules=catalog-options-core.js + catalog-journey.js',
      'note=Authenticated partner save/submit/admin approve remains NOT_RUN without isolated test credentials',
      ...results.map(
        (r) =>
          `width=${r.width} overflowX=${r.metrics && r.metrics.overflowX} clientWidth=${r.metrics && r.metrics.clientWidth} scrollWidth=${r.metrics && r.metrics.scrollWidth} conflict=${(r.metrics && r.metrics.conflictText) || ''} buttons=${(r.metrics && r.metrics.buttons || [])
            .filter((b) => b.visible)
            .map((b) => b.text)
            .join('|')}`,
      ),
    ].join('\n') + '\n',
  );
  console.log(
    JSON.stringify(
      results.map((r) => ({
        width: r.width,
        overflowX: r.metrics && r.metrics.overflowX,
        buttons: ((r.metrics && r.metrics.buttons) || []).length,
        conflict: r.metrics && r.metrics.conflictText,
        err: r.metrics && r.metrics.error,
        modules: r.metrics && r.metrics.modules,
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
