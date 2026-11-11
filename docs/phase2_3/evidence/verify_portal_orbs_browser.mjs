/**
 * Phase2 portal orb acceptance against the real e2b shell paint path.
 * - Serves partners-portal/web
 * - Opens phase2-orb-acceptance.html (uses MiraE2BProductShell)
 * - Navigates jewelry/children/occasions/gifts + branches
 * - Decodes the actual background image shown on each circle and compares
 *   SHA-256 to the approved portal orb file (matrix), not to the element's own URL alone.
 * - Negative case: swap jewelry_rings.png bytes with jewelry_earrings.png → rings must FAIL.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../../partners-portal/web');
const evidenceDir = __dirname;

const EXPECTED = [
  { categoryId: 'jewelry', imageKey: 'jewelry', expectedRel: 'assets/e2b-ref/orbs/jewelry.png', lane: 'jewelry', kind: 'main' },
  { categoryId: 'jewelry.rings', imageKey: 'jewelry.rings', expectedRel: 'assets/e2b-ref/orbs/jewelry_rings.png', lane: 'jewelry', kind: 'sub', parent: 'jewelry' },
  { categoryId: 'jewelry.necklaces', imageKey: 'jewelry.necklaces', expectedRel: 'assets/e2b-ref/orbs/jewelry_necklaces.png', lane: 'jewelry', kind: 'sub', parent: 'jewelry' },
  { categoryId: 'jewelry.bracelets', imageKey: 'jewelry.bracelets', expectedRel: 'assets/e2b-ref/orbs/jewelry_bracelets.png', lane: 'jewelry', kind: 'sub', parent: 'jewelry' },
  { categoryId: 'jewelry.earrings', imageKey: 'jewelry.earrings', expectedRel: 'assets/e2b-ref/orbs/jewelry_earrings.png', lane: 'jewelry', kind: 'sub', parent: 'jewelry' },
  { categoryId: 'children', imageKey: 'children', expectedRel: 'assets/e2b-ref/orbs/children.png', lane: 'children', kind: 'main' },
  { categoryId: 'children.clothes', imageKey: 'children.clothes', expectedRel: 'assets/e2b-ref/orbs/children_clothes.png', lane: 'children', kind: 'sub', parent: 'children' },
  { categoryId: 'children.shoes', imageKey: 'children.shoes', expectedRel: 'assets/e2b-ref/orbs/children_shoes.png', lane: 'children', kind: 'sub', parent: 'children' },
  { categoryId: 'children.newborn', imageKey: 'children.newborn', expectedRel: 'assets/e2b-ref/orbs/children_newborn.png', lane: 'children', kind: 'sub', parent: 'children' },
  { categoryId: 'occasions', imageKey: 'occasions', expectedRel: 'assets/e2b-ref/orbs/occasions.png', lane: 'occasions', kind: 'main' },
  { categoryId: 'occasions.favors', imageKey: 'occasions.favors', expectedRel: 'assets/e2b-ref/orbs/occasions_favors.png', lane: 'occasions', kind: 'sub', parent: 'occasions' },
  { categoryId: 'occasions.decor', imageKey: 'occasions.decor', expectedRel: 'assets/e2b-ref/orbs/occasions_decor.png', lane: 'occasions', kind: 'sub', parent: 'occasions' },
  { categoryId: 'occasions.styling', imageKey: 'occasions.styling', expectedRel: 'assets/e2b-ref/orbs/occasions_styling.png', lane: 'occasions', kind: 'sub', parent: 'occasions' },
  { categoryId: 'gifts', imageKey: 'gifts', expectedRel: 'assets/e2b-ref/orbs/gifts.png', lane: 'gifts', kind: 'main' },
  { categoryId: 'gifts.boxes', imageKey: 'gifts.boxes', expectedRel: 'assets/e2b-ref/orbs/gifts_boxes.png', lane: 'gifts', kind: 'sub', parent: 'gifts' },
];

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function contentType(p) {
  if (p.endsWith('.html')) return 'text/html; charset=utf-8';
  if (p.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (p.endsWith('.css')) return 'text/css; charset=utf-8';
  if (p.endsWith('.json')) return 'application/json';
  if (p.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const filePath = path.join(root, urlPath.replace(/^\//, '') || 'index.html');
      if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      const buf = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-store' });
      res.end(buf);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function decodeBgImage(page, handle) {
  return page.evaluate(async (el) => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundImage || '';
    const m = bg.match(/url\(["']?(.*?)["']?\)/);
    if (!m) return { ok: false, reason: 'no-background-image', bg };
    const url = m[1];
    const res = await fetch(url, { cache: 'no-store' });
    const buf = new Uint8Array(await res.arrayBuffer());
    // PNG magic
    const png = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    // SHA-256 in browser
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return {
      ok: res.status === 200 && png && buf.length > 1000,
      url,
      status: res.status,
      bytes: buf.length,
      png,
      hash,
    };
  }, handle);
}

async function runPass(page, base, label) {
  const rows = [];
  let failed = 0;
  const byLane = {};
  for (const item of EXPECTED) {
    (byLane[item.lane] ||= []).push(item);
  }

  for (const [lane, items] of Object.entries(byLane)) {
    await page.click(`#phase2LaneBar button[data-lane="${lane}"]`);
    await page.waitForSelector('#e2bMainCircles [data-testid="e2b-main-circle"]');
    await page.waitForTimeout(200);

    for (const item of items) {
      const expectedPath = path.join(root, item.expectedRel);
      const expectedBuf = fs.readFileSync(expectedPath);
      const expectedHash = sha256(expectedBuf);

      if (item.kind === 'main') {
        const main = page.locator(`#e2bMainCircles [data-category-id="${item.categoryId}"]`);
        await main.waitFor({ state: 'visible' });
        const orb = main.locator('.e2b-circle-orb');
        const decoded = await decodeBgImage(page, await orb.elementHandle());
        const match = decoded.ok && decoded.hash === expectedHash;
        if (!match) failed += 1;
        rows.push({
          pass: label,
          categoryId: item.categoryId,
          imageKey: item.imageKey,
          expected: item.expectedRel,
          expectedHash,
          shownUrl: decoded.url || '',
          shownHash: decoded.hash || '',
          bytes: decoded.bytes || 0,
          result: match ? 'PASS' : 'FAIL',
          reason: match ? '' : JSON.stringify(decoded),
        });
      } else {
        const parent = page.locator(`#e2bMainCircles [data-category-id="${item.parent}"]`);
        await parent.click();
        await page.waitForSelector(`#e2bSubCircles [data-subcategory-id="${item.categoryId}"]`);
        const sub = page.locator(`#e2bSubCircles [data-subcategory-id="${item.categoryId}"]`);
        const orb = sub.locator('.e2b-circle-orb');
        const decoded = await decodeBgImage(page, await orb.elementHandle());
        const match = decoded.ok && decoded.hash === expectedHash;
        if (!match) failed += 1;
        rows.push({
          pass: label,
          categoryId: item.categoryId,
          imageKey: item.imageKey,
          expected: item.expectedRel,
          expectedHash,
          shownUrl: decoded.url || '',
          shownHash: decoded.hash || '',
          bytes: decoded.bytes || 0,
          result: match ? 'PASS' : 'FAIL',
          reason: match ? '' : JSON.stringify(decoded),
        });
      }
    }
  }
  return { rows, failed };
}

async function main() {
  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${base}/phase2-orb-acceptance.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PHASE2_ORB_READY__ === true, null, { timeout: 15000 });

  // --- Negative: swap rings ↔ earrings file bytes while both URLs stay valid ---
  const ringsPath = path.join(root, 'assets/e2b-ref/orbs/jewelry_rings.png');
  const earringsPath = path.join(root, 'assets/e2b-ref/orbs/jewelry_earrings.png');
  const ringsBak = ringsPath + '.bak_phase2';
  const ringsOrig = fs.readFileSync(ringsPath);
  const earringsOrig = fs.readFileSync(earringsPath);
  fs.writeFileSync(ringsBak, ringsOrig);
  fs.writeFileSync(ringsPath, earringsOrig);

  let negativeFailedCorrectly = false;
  try {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__PHASE2_ORB_READY__ === true, null, { timeout: 15000 });
    await page.click('#phase2LaneBar button[data-lane="jewelry"]');
    await page.waitForSelector('#e2bMainCircles [data-category-id="jewelry"]');
    await page.click('#e2bMainCircles [data-category-id="jewelry"]');
    await page.waitForSelector('#e2bSubCircles [data-subcategory-id="jewelry.rings"]');
    const orb = page.locator('#e2bSubCircles [data-subcategory-id="jewelry.rings"] .e2b-circle-orb');
    const decoded = await decodeBgImage(page, await orb.elementHandle());
    const expectedHash = sha256(ringsOrig);
    // URL may still end with jewelry_rings.png and HTTP 200, but content hash must differ.
    negativeFailedCorrectly = decoded.ok && decoded.hash !== expectedHash && decoded.url.includes('jewelry_rings.png');
    fs.writeFileSync(
      path.join(evidenceDir, 'PORTAL_ORB_NEGATIVE.json'),
      JSON.stringify({ decoded, expectedHash, negativeFailedCorrectly }, null, 2),
    );
  } finally {
    fs.writeFileSync(ringsPath, ringsOrig);
    fs.rmSync(ringsBak, { force: true });
  }

  if (!negativeFailedCorrectly) {
    await browser.close();
    server.close();
    console.error('NEGATIVE_TEST_DID_NOT_FAIL_AS_REQUIRED');
    process.exit(2);
  }

  // Restore + final acceptance
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PHASE2_ORB_READY__ === true, null, { timeout: 15000 });
  const { rows, failed } = await runPass(page, base, 'final');

  await browser.close();
  server.close();

  const md = [
    '| categoryId | imageKey | expected | shownHash==expected | result |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.categoryId} | ${r.imageKey} | ${r.expected} | ${r.shownHash === r.expectedHash} | ${r.result} |`),
    '',
    `failed=${failed}`,
    `negative_swap_detected=${negativeFailedCorrectly}`,
  ].join('\n');
  fs.writeFileSync(path.join(evidenceDir, 'PORTAL_ORB_BROWSER_RESULTS.md'), md);
  fs.writeFileSync(path.join(evidenceDir, 'PORTAL_ORB_BROWSER_RESULTS.json'), JSON.stringify({ failed, negativeFailedCorrectly, rows }, null, 2));
  console.log(md);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
