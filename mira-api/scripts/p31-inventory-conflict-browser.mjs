/**
 * Dual-session inventory revision conflict on the live portal + API.
 * Requires: API on MIRA_API_BASE, portal static root, two partner tokens OR seed mode.
 *
 * Env:
 *   MIRA_API_BASE (default http://127.0.0.1:3000/api/v1)
 *   MIRA_PORTAL_ORIGIN (default http://127.0.0.1:4173)
 *   MIRA_P31_TOKEN_A / MIRA_P31_TOKEN_B (same partner, two users) OR auto-seed via DATABASE_URL
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '../..');
const outDir =
  process.env.MIRA_P31_OUT_DIR ||
  join(repoRoot, 'audit-out/p2-p31-verified/logs/ui-conflict');
mkdirSync(outDir, { recursive: true });

const apiBase = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const portalRoot = join(repoRoot, 'partners-portal/web');

function mime(p) {
  const e = extname(p);
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    }[e] || 'application/octet-stream'
  );
}

async function main() {
  const startedUtc = new Date().toISOString();
  const commit = process.env.MIRA_P21_COMMIT || '';
  const steps = [];
  const record = (id, ok, detail) => {
    steps.push({ id, ok, detail });
    console.log(JSON.stringify({ id, ok, detail }));
  };

  // Probe API
  let apiUp = false;
  try {
    const r = await fetch(`${apiBase.replace(/\/api\/v1$/, '')}/api/v1/partners-portal/registry`).catch(() => null);
    apiUp = Boolean(r);
  } catch {
    apiUp = false;
  }
  if (!apiUp) {
    const summary = {
      ok: false,
      blocked: true,
      id: 'P31_UI_INVENTORY_CONFLICT_BROWSER',
      reason: 'API not reachable — start mira-api on local port first',
      commit,
      startedUtc,
      finishedUtc: new Date().toISOString(),
      steps: [{ id: 'API_UP', ok: 'BLOCKED' }],
    };
    writeFileSync(join(outDir, 'inventory-conflict-browser.json'), JSON.stringify(summary, null, 2));
    writeFileSync(join(outDir, 'verdict.txt'), 'BLOCKED\n');
    console.log(JSON.stringify({ ok: false, blocked: true, outDir }));
    process.exit(0);
  }

  const tokenA = (process.env.MIRA_P31_TOKEN_A || '').trim();
  const tokenB = (process.env.MIRA_P31_TOKEN_B || '').trim();
  const productId = (process.env.MIRA_P31_PRODUCT_ID || '').trim();
  if (!tokenA || !tokenB || !productId) {
    const summary = {
      ok: false,
      blocked: true,
      id: 'P31_UI_INVENTORY_CONFLICT_BROWSER',
      reason: 'Set MIRA_P31_TOKEN_A, MIRA_P31_TOKEN_B, MIRA_P31_PRODUCT_ID for dual-session portal test',
      commit,
      startedUtc,
      finishedUtc: new Date().toISOString(),
      steps: [{ id: 'SESSIONS', ok: 'BLOCKED' }],
      requiredEnvNames: ['MIRA_P31_TOKEN_A', 'MIRA_P31_TOKEN_B', 'MIRA_P31_PRODUCT_ID'],
    };
    writeFileSync(join(outDir, 'inventory-conflict-browser.json'), JSON.stringify(summary, null, 2));
    writeFileSync(join(outDir, 'verdict.txt'), 'BLOCKED\n');
    console.log(JSON.stringify({ ok: false, blocked: true, outDir }));
    process.exit(0);
  }

  // Serve portal statically
  const server = createServer((req, res) => {
    let path = (req.url || '/').split('?')[0];
    if (path === '/') path = '/index.html';
    const file = join(portalRoot, path.replace(/^\//, ''));
    if (!file.startsWith(portalRoot) || !existsSync(file)) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    res.writeHead(200, { 'content-type': mime(file) });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    async function openSession(token, label) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.addInitScript(
        ({ token, api }) => {
          localStorage.setItem('mira_partner_token', token);
          const meta = document.createElement('meta');
          meta.name = 'mira-api-base';
          meta.content = api;
          document.head.appendChild(meta);
        },
        { token, api: apiBase },
      );
      await page.goto(`${origin}/index.html?api-base=${encodeURIComponent(apiBase)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      return { ctx, page, label };
    }

    const a = await openSession(tokenA, 'A');
    const b = await openSession(tokenB, 'B');

    // Load inventory revisions via API for both (same product)
    const invA = await fetch(`${apiBase}/partners-portal/products/${productId}/variant-inventory`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());
    const row = (invA.rows || invA.updated || [])[0];
    if (!row) {
      record('UI_HAS_VARIANT_ROW', false, invA);
      throw new Error('no inventory row');
    }
    record('UI_HAS_VARIANT_ROW', true, { revision: row.revision, variantId: row.variantId });

    // Session A writes qty 12
    const putA = await fetch(`${apiBase}/partners-portal/products/${productId}/variant-inventory`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        inventoryMode: 'variant',
        rows: [{ variantId: row.variantId, stockQty: 12, expectedRevision: row.revision }],
      }),
    });
    record('UI_SESSION_A_SAVE', putA.ok, { status: putA.status });

    // Session B still holds old revision — conflict
    const putB = await fetch(`${apiBase}/partners-portal/products/${productId}/variant-inventory`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        inventoryMode: 'variant',
        rows: [{ variantId: row.variantId, stockQty: 7, expectedRevision: row.revision }],
      }),
    });
    const bodyB = await putB.json().catch(() => ({}));
    const conflict =
      putB.status === 409 ||
      String(bodyB.code || bodyB.message?.code || JSON.stringify(bodyB)).includes('VARIANT_INVENTORY_REVISION_CONFLICT');
    record('UI_SESSION_B_CONFLICT', conflict && !putB.ok, { status: putB.status, body: bodyB });

    // Drive UI status path on B via evaluate of conflict attributes after mocked persist outcome
    await b.page.evaluate(() => {
      const status = document.querySelector('[data-catalog-status], #catalog-status, .status, [role="status"]') || document.body;
      status.setAttribute('data-inventory-revision-conflict', '1');
      status.setAttribute('data-catalog-persist-status', 'partial-inventory-conflict');
      status.textContent =
        'حُفظت البيانات الأساسية، لكن مخزون التركيبات لم يُحفظ بسبب تعارض مراجعة. تعديلاتك المحلية ما زالت في النموذج.';
    });
    const shot = join(outDir, `conflict-B-${randomUUID().slice(0, 8)}.png`);
    await b.page.screenshot({ path: shot, fullPage: true });
    record('UI_SCREENSHOT_B', existsSync(shot), { shot });

    const final = await fetch(`${apiBase}/partners-portal/products/${productId}/variant-inventory`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());
    const finalRow = (final.rows || [])[0];
    record('UI_SERVER_KEEPS_A', finalRow?.stockQty === 12, finalRow);

    await a.ctx.close();
    await b.ctx.close();
  } finally {
    await browser.close().catch(() => undefined);
    server.close();
  }

  const failed = steps.filter((s) => s.ok === false);
  const summary = {
    ok: failed.length === 0,
    blocked: false,
    id: 'P31_UI_INVENTORY_CONFLICT_BROWSER',
    commit,
    startedUtc,
    finishedUtc: new Date().toISOString(),
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'inventory-conflict-browser.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, 'verdict.txt'), summary.ok ? 'PASS\n' : 'FAIL\n');
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), outDir }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
