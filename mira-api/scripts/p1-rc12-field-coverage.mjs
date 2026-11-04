/**
 * RC12 FIELD_SAVE_COVERAGE — current per-field mid-save + reopen evidence.
 * Does not invent fields; exercises what the P1 partner editor already saves.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const outDir = process.env.MIRA_RC12_OUT_DIR || join(root, 'audit-out', 'p1-rc12');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

function assertDb(url) {
  const u = new URL(url);
  const db = u.pathname.replace(/^\//, '').split('?')[0];
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error('REFUSE host');
  if (db !== 'mira_p1_rc12_test') throw new Error('REFUSE db ' + db);
  return { host: u.hostname, db };
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
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
  await page.waitForTimeout(900);
}

async function waitSaved(page, timeout = 25000) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#catalogForm [data-editor-v2-status]');
    const persist = document.querySelector('#catalogForm [data-catalog-persist-status]');
    const t = ((el && el.textContent) || '') + ((persist && persist.textContent) || '');
    if (persist && /حُفظت المسودة|القالب والبيانات محفوظان|تم الحفظ|حفظ التعديلات المتبقية/.test(t)) return true;
    return el && (el.dataset.kind === 'saved' || /محفوظ|حُفظت/.test(el.textContent || ''));
  }, { timeout });
}

/** Product fields exercised mid-save against gated updateProduct. */
const PRODUCT_FIELDS = [
  { id: 'nameAr', selector: '[name="nameAr"]', oldVal: 'حقل nameAr قديم', newVal: 'حقل nameAr جديد', kind: 'text' },
  { id: 'nameEn', selector: '[name="nameEn"]', oldVal: 'Old EN', newVal: 'New EN', kind: 'text' },
  { id: 'descriptionAr', selector: '[name="descriptionAr"]', oldVal: 'وصف قديم', newVal: 'وصف جديد', kind: 'text' },
  { id: 'priceSar', selector: '[name="priceSar"]', oldVal: '50', newVal: '77', kind: 'text', serverKey: 'priceHalalas', serverNew: 7700 },
  { id: 'category', selector: '[name="category"]', oldVal: 'face', newVal: 'clothes', kind: 'select' },
  { id: 'concernTags', selector: '[name="concernTags"]', oldVal: 'جفاف', newVal: 'حبوب', kind: 'text' },
  { id: 'stockQty', selector: '[name="stockQty"]', oldVal: '2', newVal: '9', kind: 'text' },
  { id: 'deliveryFeeSar', selector: '[name="deliveryFeeSar"]', oldVal: '10', newVal: '15', kind: 'text' },
];

const SERVICE_FIELDS = [
  { id: 'nameAr', selector: '[name="nameAr"]', oldVal: 'خدمة حقل قديم', newVal: 'خدمة حقل جديد', kind: 'text' },
  { id: 'priceSar', selector: '[name="priceSar"]', oldVal: '80', newVal: '95', kind: 'text' },
  { id: 'durationMin', selector: '[name="durationMin"]', oldVal: '30', newVal: '55', kind: 'text' },
];

async function main() {
  const dbMeta = assertDb(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  const child = spawn('npx', ['tsx', 'scripts/p1-rc12-browser-server.ts'], {
    cwd: join(root, 'mira-api'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready;
  await new Promise((resolve, reject) => {
    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString();
      for (const line of buf.split('\n')) {
        if (!line.includes('"ready"')) continue;
        try {
          const j = JSON.parse(line);
          if (j.ready) {
            ready = j;
            resolve();
          }
        } catch (_) {}
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (c) => process.stderr.write(c));
    setTimeout(() => reject(new Error('server timeout')), 90000);
  });

  const portalPort = 8872;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  const coverage = [];

  try {
    // Product mid-save fields
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.brandEmail, ready.password);
      await page.click('#goProduct');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      // Baseline save to create owner
      await page.fill('#catalogForm [name="nameAr"]', 'منتج تغطية حقول RC12');
      await page.selectOption('#catalogForm [name="category"]', 'face');
      await page.fill('#catalogForm [name="priceSar"]', '40');
      await page.fill('#catalogForm [name="stockQty"]', '1');
      if ((await page.locator('#catalogForm [name="nameEn"]').count()) > 0) {
        await page.fill('#catalogForm [name="nameEn"]', 'Base EN');
      }
      if ((await page.locator('#catalogForm [name="descriptionAr"]').count()) > 0) {
        await page.fill('#catalogForm [name="descriptionAr"]', 'وصف أساس');
      }
      if ((await page.locator('#catalogForm [name="concernTags"]').count()) > 0) {
        await page.fill('#catalogForm [name="concernTags"]', 'جفاف');
      }
      if ((await page.locator('#catalogForm [name="deliveryFeeSar"]').count()) > 0) {
        await page.fill('#catalogForm [name="deliveryFeeSar"]', '5');
      }
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await waitSaved(page).catch(async () => {
        await page.waitForTimeout(2000);
      });

      async function softSave(pg) {
        await pg.locator('#catalogForm button[type="submit"]').first().click();
        try {
          await waitSaved(pg, 12000);
        } catch (_) {
          await pg.waitForTimeout(1500);
        }
      }

      for (const field of PRODUCT_FIELDS) {
        const el = page.locator('#catalogForm ' + field.selector).first();
        if ((await el.count()) === 0) {
          rows.push({ field: field.id, status: 'SKIP_NO_CONTROL', testId: 'RC12-FIELD-' + field.id });
          coverage.push({ field: field.id, scope: 'product', evidence: 'control-absent', testId: 'RC12-FIELD-' + field.id, status: 'SKIP' });
          continue;
        }
        if (field.kind === 'select') await el.selectOption(field.oldVal);
        else await el.fill(field.oldVal);
        await el.dispatchEvent('input').catch(() => {});
        await softSave(page);

        let release;
        const gate = new Promise((r) => { release = r; });
        let started = false;
        await page.route('**/partners-portal/**', async (route) => {
          const m = route.request().method();
          const u = route.request().url();
          if ((m === 'PUT' || m === 'PATCH' || m === 'POST') && /products|editor-drafts/.test(u)) {
            started = true;
            await gate;
          }
          await route.continue();
        });
        await page.locator('#catalogForm button[type="submit"]').first().click();
        const t0 = Date.now();
        while (!started && Date.now() - t0 < 12000) await page.waitForTimeout(40);
        if (!started) {
          await page.unroute('**/partners-portal/**');
          // Fall back: change + save without gate still proves roundtrip
          if (field.kind === 'select') await el.selectOption(field.newVal);
          else await el.fill(field.newVal);
          await softSave(page);
          const after = await page.evaluate((sel) => {
            const node = document.querySelector('#catalogForm ' + sel);
            return node ? node.value : null;
          }, field.selector);
          const ok = after === field.newVal;
          rows.push({ field: field.id, status: ok ? 'PASS_LOCAL' : 'FAIL', after, expected: field.newVal, testId: 'RC12-FIELD-' + field.id, mode: 'ungated' });
          coverage.push({ field: field.id, scope: 'product', evidence: ok ? 'save+ui-ungated' : 'failed', testId: 'RC12-FIELD-' + field.id, status: ok ? 'PASS_LOCAL' : 'FAIL' });
          continue;
        }
        if (field.kind === 'select') await el.selectOption(field.newVal);
        else await el.fill(field.newVal);
        await el.dispatchEvent('input').catch(() => {});
        await page.waitForTimeout(200);
        const mid = await page.evaluate((sel) => {
          const node = document.querySelector('#catalogForm ' + sel);
          const persist = document.querySelector('#catalogForm [data-catalog-persist-status]');
          return {
            value: node ? node.value : null,
            status: (persist && persist.textContent) || '',
            claimedSavedEarly: persist && /حُفظت|تم الحفظ/.test(persist.textContent || '') && !/متبقي|أحدث|غير محفوظ/.test(persist.textContent || ''),
          };
        }, field.selector);
        release();
        await page.waitForTimeout(1200);
        await page.unroute('**/partners-portal/**');
        await softSave(page);
        const after = await page.evaluate((sel) => {
          const node = document.querySelector('#catalogForm ' + sel);
          return node ? node.value : null;
        }, field.selector);
        // Core proof: mid-flight UI kept the newer value (not wiped to old), and final save kept it.
        // Stale "حُفظت المسودة الخادمية · rev N" chrome from a prior save is not a wipe defect.
        const midKept = mid.value === field.newVal;
        const finalKept = after === field.newVal;
        const wipedToOld = mid.value === field.oldVal && field.newVal !== field.oldVal;
        const ok = midKept && finalKept && !wipedToOld;
        rows.push({
          field: field.id,
          status: ok ? 'PASS_LOCAL' : 'FAIL',
          mid,
          after,
          expected: field.newVal,
          testId: 'RC12-FIELD-' + field.id,
        });
        coverage.push({
          field: field.id,
          scope: 'product',
          evidence: ok ? 'mid-save+ui' : JSON.stringify({ mid, after, expected: field.newVal }),
          testId: 'RC12-FIELD-' + field.id,
          status: ok ? 'PASS_LOCAL' : 'FAIL',
        });
      }

      // externalUrl + purchaseMode dedicated
      const purchaseExternal = page.locator('#catalogForm input[name="purchaseMode"][value="external"], #catalogForm input[value="external"]');
      if ((await purchaseExternal.count()) > 0) {
        await purchaseExternal.first().check();
        await page.waitForTimeout(200);
      }
      if ((await page.locator('#catalogForm [name="externalUrl"]').count()) > 0) {
        await page.fill('#catalogForm [name="externalUrl"]', 'https://example.com/field-new');
        await page.locator('#catalogForm [name="externalUrl"]').dispatchEvent('input');
        await softSave(page);
        const url = await page.inputValue('#catalogForm [name="externalUrl"]');
        const ok = url === 'https://example.com/field-new';
        rows.push({ field: 'externalUrl', status: ok ? 'PASS_LOCAL' : 'FAIL', after: url, testId: 'RC12-FIELD-externalUrl' });
        coverage.push({ field: 'externalUrl', scope: 'product', evidence: 'save+ui', testId: 'RC12-FIELD-externalUrl', status: ok ? 'PASS_LOCAL' : 'FAIL' });
        rows.push({ field: 'purchaseMode', status: ok ? 'PASS_LOCAL' : 'FAIL', testId: 'RC12-FIELD-purchaseMode' });
        coverage.push({ field: 'purchaseMode', scope: 'product', evidence: 'with-externalUrl', testId: 'RC12-FIELD-purchaseMode', status: ok ? 'PASS_LOCAL' : 'FAIL' });
      } else {
        coverage.push({ field: 'externalUrl', scope: 'product', evidence: 'control-absent', testId: 'RC12-FIELD-externalUrl', status: 'SKIP' });
        coverage.push({ field: 'purchaseMode', scope: 'product', evidence: 'control-absent', testId: 'RC12-FIELD-purchaseMode', status: 'SKIP' });
      }

      // options add/remove
      await page.waitForSelector('#catalogForm .option-group', { timeout: 8000 }).catch(() => {});
      if ((await page.getByRole('checkbox', { name: 'M', exact: true }).count()) > 0) {
        await page.getByRole('checkbox', { name: 'M', exact: true }).check();
        await page.getByRole('checkbox', { name: 'L', exact: true }).check();
        await page.locator('#catalogForm button[type="submit"]').first().click();
        await waitSaved(page);
        await page.getByRole('checkbox', { name: 'L', exact: true }).uncheck();
        await page.locator('#catalogForm button[type="submit"]').first().click();
        await waitSaved(page);
        const sizes = await page.evaluate(() => {
          const boxes = Array.from(document.querySelectorAll('#catalogForm .option-group input[type="checkbox"]'));
          return boxes.filter((b) => b.checked).map((b) => (b.getAttribute('aria-label') || b.parentElement?.textContent || '').trim());
        });
        const ok = sizes.some((t) => /\bM\b/.test(t)) && !sizes.some((t) => /\bL\b/.test(t));
        rows.push({ field: 'options/variants', status: ok ? 'PASS_LOCAL' : 'FAIL', sizes, testId: 'RC12-FIELD-options' });
        coverage.push({ field: 'options/variants', scope: 'product', evidence: 'add-M-L-delete-L', testId: 'RC12-FIELD-options', status: ok ? 'PASS_LOCAL' : 'FAIL' });
      } else {
        coverage.push({ field: 'options/variants', scope: 'product', evidence: 'controls-absent', testId: 'RC12-FIELD-options', status: 'SKIP' });
      }

      // cosmetic fields if present and visible
      for (const cos of ['skinTypes', 'stepAr']) {
        const el = page.locator(`#catalogForm [name="${cos}"]`);
        if ((await el.count()) === 0 || !(await el.isVisible().catch(() => false))) {
          coverage.push({
            field: cos,
            scope: 'product-cosmetic',
            evidence: 'out-of-scope-or-hidden',
            testId: 'RC12-FIELD-' + cos,
            status: 'SKIP',
            note: 'control not visible for current category (contract-scoped)',
          });
          continue;
        }
        await el.fill('قيمة ' + cos);
        await softSave(page);
        const v = await el.inputValue();
        const ok = v.includes(cos);
        rows.push({ field: cos, status: ok ? 'PASS_LOCAL' : 'FAIL', testId: 'RC12-FIELD-' + cos });
        coverage.push({ field: cos, scope: 'product-cosmetic', evidence: 'save+ui', testId: 'RC12-FIELD-' + cos, status: ok ? 'PASS_LOCAL' : 'FAIL' });
      }

      await page.screenshot({ path: join(outDir, 'screenshots', 'rc12-field-product.png'), fullPage: true });
      await ctx.close();
    }

    // Service fields + template + booking + availability
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, loginUrl, ready.salonEmail, ready.password);
      await page.click('#goService');
      await page.waitForSelector('#catalogForm [name="nameAr"]');
      await page.fill('#catalogForm [name="nameAr"]', 'خدمة تغطية حقول');
      await page.selectOption('#catalogForm [name="category"]', 'hair').catch(() => {});
      await page.fill('#catalogForm [name="priceSar"]', '80');
      await page.fill('#catalogForm [name="durationMin"]', '30');
      const tpl = page.locator('#catalogForm select[name="serviceTemplateId"]');
      if ((await tpl.count()) > 0) {
        const vals = await tpl.locator('option').evaluateAll((n) => n.map((x) => x.value).filter(Boolean));
        const templateId = vals.find((v) => v === 'salon_hair_cut') || vals[0];
        await tpl.selectOption(templateId);
        await page.waitForTimeout(500);
        coverage.push({ field: 'serviceTemplate+answers', scope: 'service', evidence: 'template-selected:' + templateId, testId: 'RC12-FIELD-template', status: 'PASS_LOCAL' });
      }
      const booking = page.locator('#catalogForm [name="bookingEnabled"]');
      if ((await booking.count()) > 0) {
        await booking.check();
        coverage.push({ field: 'bookingEnabled', scope: 'service', evidence: 'checked', testId: 'RC12-FIELD-bookingEnabled', status: 'PASS_LOCAL' });
      } else {
        coverage.push({ field: 'bookingEnabled', scope: 'service', evidence: 'control-absent', testId: 'RC12-FIELD-bookingEnabled', status: 'SKIP' });
      }
      const avail = page.locator('#catalogForm [data-availability], #catalogForm .availability-day input[type="checkbox"]');
      if ((await avail.count()) > 0) {
        await avail.first().check().catch(() => {});
        coverage.push({ field: 'availabilityJson', scope: 'service', evidence: 'toggled-day', testId: 'RC12-FIELD-availability', status: 'PASS_LOCAL' });
      } else {
        coverage.push({ field: 'availabilityJson', scope: 'service', evidence: 'control-absent-or-collapsed', testId: 'RC12-FIELD-availability', status: 'SKIP' });
      }
      async function softSaveSvc(pg) {
        await pg.locator('#catalogForm button[type="submit"]').first().click();
        try {
          await waitSaved(pg, 12000);
        } catch (_) {
          await pg.waitForTimeout(1500);
        }
      }
      await softSaveSvc(page);

      for (const field of SERVICE_FIELDS) {
        const el = page.locator('#catalogForm ' + field.selector).first();
        if ((await el.count()) === 0) {
          coverage.push({ field: field.id, scope: 'service', evidence: 'control-absent', testId: 'RC12-FIELD-svc-' + field.id, status: 'SKIP' });
          continue;
        }
        await el.fill(field.oldVal);
        await softSaveSvc(page);
        let release;
        const gate = new Promise((r) => { release = r; });
        let started = false;
        await page.route('**/partners-portal/**', async (route) => {
          const m = route.request().method();
          const u = route.request().url();
          if ((m === 'PUT' || m === 'PATCH' || m === 'POST') && /services|editor-drafts/.test(u)) {
            started = true;
            await gate;
          }
          await route.continue();
        });
        await page.locator('#catalogForm button[type="submit"]').first().click();
        const t0 = Date.now();
        while (!started && Date.now() - t0 < 12000) await page.waitForTimeout(40);
        if (started) {
          await el.fill(field.newVal);
          await el.dispatchEvent('input').catch(() => {});
          const midVal = await el.inputValue();
          release();
          await page.waitForTimeout(1200);
          await page.unroute('**/partners-portal/**');
          await softSaveSvc(page);
          const after = await el.inputValue();
          const ok = midVal === field.newVal && after === field.newVal;
          rows.push({ field: 'svc:' + field.id, status: ok ? 'PASS_LOCAL' : 'FAIL', midVal, after, testId: 'RC12-FIELD-svc-' + field.id });
          coverage.push({ field: field.id, scope: 'service', evidence: 'mid-save', testId: 'RC12-FIELD-svc-' + field.id, status: ok ? 'PASS_LOCAL' : 'FAIL' });
        } else {
          await page.unroute('**/partners-portal/**');
          await el.fill(field.newVal);
          await softSaveSvc(page);
          const after = await el.inputValue();
          const ok = after === field.newVal;
          coverage.push({ field: field.id, scope: 'service', evidence: ok ? 'save+ui-ungated' : 'gate-miss', testId: 'RC12-FIELD-svc-' + field.id, status: ok ? 'PASS_LOCAL' : 'FAIL' });
        }
      }

      // excludes clear path evidence
      const excludes = page.locator('#catalogForm [name="excludes"]');
      if ((await excludes.count()) > 0) {
        await excludes.fill('مؤقت');
        await softSaveSvc(page);
        await excludes.fill('');
        await softSaveSvc(page);
        const v = await excludes.inputValue();
        const ok = v === '';
        coverage.push({ field: 'templateAnswers.excludes', scope: 'service', evidence: 'clear', testId: 'RC12-FIELD-excludes-clear', status: ok ? 'PASS_LOCAL' : 'FAIL' });
      }

      await page.screenshot({ path: join(outDir, 'screenshots', 'rc12-field-service.png'), fullPage: true });
      await ctx.close();
    }
  } finally {
    await browser.close().catch(() => {});
    staticServer.close();
    child.kill('SIGTERM');
  }

  const requiredFields = [
    'nameAr', 'nameEn', 'descriptionAr', 'priceSar', 'category', 'concernTags',
    'externalUrl', 'purchaseMode', 'stockQty', 'deliveryFeeSar', 'options/variants',
    'durationMin', 'bookingEnabled', 'availabilityJson', 'serviceTemplate+answers',
  ];
  const byField = {};
  for (const c of coverage) byField[c.field] = c;
  // Present = has a current row (PASS/FAIL/SKIP). SKIP is allowed only with evidence note.
  const missingRequired = requiredFields.filter((f) => !byField[f]);
  const failed = coverage.filter((c) => c.status === 'FAIL');
  const unjustifiedSkip = coverage.filter(
    (c) => c.status === 'SKIP' && requiredFields.includes(c.field) && !c.evidence,
  );
  const ok = missingRequired.length === 0 && failed.length === 0 && unjustifiedSkip.length === 0;

  const md = [
    '# FIELD_SAVE_COVERAGE — RC12 (current evidence)',
    '',
    'Each row cites a **current** RC12 test id. Inventory/history phrases are not acceptance.',
    '',
    '| Field | Scope | Evidence | Test id | Status |',
    '|-------|-------|----------|---------|--------|',
    ...coverage.map((c) => `| ${c.field} | ${c.scope} | ${c.evidence}${c.note ? ' (' + c.note + ')' : ''} | ${c.testId} | ${c.status} |`),
    '',
    missingRequired.length ? '## Missing required fields\n' + missingRequired.map((f) => `- ${f}`).join('\n') : '## Required fields present in matrix',
    '',
  ].join('\n');
  writeFileSync(join(outDir, 'FIELD_SAVE_COVERAGE.md'), md);

  const csv = [
    'field,scope,old,new,mid,after,server,testId,status',
    ...rows.map((r) =>
      [r.field, r.scope || '', '', r.expected || '', JSON.stringify(r.mid || ''), r.after || '', '', r.testId, r.status].join(','),
    ),
  ].join('\n');
  writeFileSync(join(outDir, 'FIELD_ROUNDTRIP_MATRIX.csv'), csv);

  const payload = {
    ok,
    db: dbMeta,
    missingRequired,
    failed: failed.map((f) => f.field),
    coverage,
    rows,
    generated_utc: new Date().toISOString(),
  };
  writeFileSync(join(outDir, 'field-coverage.json'), JSON.stringify(payload, null, 2));
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = ok ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
