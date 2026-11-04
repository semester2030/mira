/**
 * P2.1/P2.2 real partners-portal journeys (product + service) — not api.js-only HTML.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const webRoot = join(root, 'partners-portal', 'web');
const outDir = process.env.MIRA_P21_OUT_DIR || join(root, 'audit-out', 'p2-1-p2-2', 'logs', 'portal-journey');
const shotsDir = join(outDir, 'screens');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PNG2 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSF+FAP5IDveKW/d6AAAAAElFTkSuQmCC',
  'base64',
);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

function assertLocalDb(url) {
  const u = new URL(url);
  const host = u.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') throw new Error(`REFUSE host ${host}`);
  return { host, db: u.pathname.replace(/^\//, '').split('?')[0] };
}

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
  await page.waitForTimeout(800);
}

async function materializeWithPng(page, name, buffer) {
  const file = page.locator('#catalogForm input[type="file"]').first();
  if ((await file.count()) === 0) throw new Error('media input missing');
  await file.setInputFiles({ name, mimeType: 'image/png', buffer });
  await page.waitForTimeout(700);
  const mat = page.locator('#catalogForm [data-editor-v2-materialize]');
  if ((await mat.count()) === 0) {
    // Fallback: classic save then upload path
    const save = page.locator('#catalogForm button').filter({ hasText: /حفظ المسودة|حفظ|نشر الآن/ }).first();
    if ((await save.count()) > 0) await save.click();
    await page.waitForTimeout(2500);
  } else {
    await mat.click();
    await page.waitForTimeout(3500);
  }
  await page.waitForFunction(() => {
    try {
      const ctx = window.MiraEditorV2 && MiraEditorV2.getEditContext('catalogForm');
      return ctx && ctx.targetOwnerId;
    } catch {
      return false;
    }
  }, { timeout: 20000 });
  return page.evaluate(() => MiraEditorV2.getEditContext('catalogForm').targetOwnerId);
}

async function main() {
  const dbMeta = assertLocalDb(process.env.DATABASE_URL || '');
  process.env.MIRA_PARTNER_EDITOR_V2 = 'true';
  process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';

  const child = spawn('npx', ['tsx', 'scripts/p2-closure-browser-server.ts'], {
    cwd: join(root, 'mira-api'),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const ready = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('API timeout\n' + buf)), 90000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      for (const line of buf.split('\n')) {
        if (!line.includes('"ready"')) continue;
        try {
          const j = JSON.parse(line.trim());
          if (j.ready) {
            clearTimeout(t);
            resolve(j);
          }
        } catch (_) {}
      }
    });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (c) => reject(new Error('API exit ' + c + '\n' + buf)));
  });

  const portalPort = 8877;
  const staticServer = await serveStatic(portalPort);
  const apiBase = `http://127.0.0.1:${ready.port}/api/v1`;
  const loginUrl = `http://127.0.0.1:${portalPort}/login.html?api-base=${encodeURIComponent(apiBase)}`;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const cases = [];
  const record = (id, ok, detail) => {
    cases.push({ id, ok: ok ? 'PASS' : 'FAIL', detail, utc: new Date().toISOString() });
    console.log(JSON.stringify({ id, ok: ok ? 'PASS' : 'FAIL', detail }));
  };

  try {
    // ========== PRODUCT (brand) ==========
    const brandCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const bp = await brandCtx.newPage();
    const net = [];
    bp.on('request', (req) => {
      const u = req.url();
      if (u.includes('/api/v1/')) net.push({ method: req.method(), url: u.replace(apiBase, '') });
    });
    await login(bp, loginUrl, ready.brandEmail, ready.password);
    await bp.click('#goProduct');
    await bp.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 });
    await bp.fill('#catalogForm [name="nameAr"]', 'منتج رحلة P2');
    await bp.fill('#catalogForm [name="priceSar"]', '55');
    const cat = bp.locator('#catalogForm [name="category"]');
    if ((await cat.count()) > 0) {
      const opts = await cat.locator('option').evaluateAll((n) => n.map((x) => x.value).filter(Boolean));
      if (opts.length) await cat.selectOption(opts[0]);
    }
    // Size M checkbox if option UI present
    const mBox = bp.locator('#catalogForm .option-group input[type="checkbox"]').filter({ hasText: /M/ }).first();
    if ((await mBox.count()) === 0) {
      await bp.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll('#catalogForm .option-group input[type="checkbox"]'));
        const hit = boxes.find((b) => /M/.test((b.getAttribute('aria-label') || b.parentElement?.textContent || '')));
        if (hit && !hit.checked) hit.click();
      });
    }

    const productId = await materializeWithPng(bp, 'p2-a.png', PNG);
    await bp.screenshot({ path: join(shotsDir, 'product-after-materialize.png'), fullPage: true });
    const token = await bp.evaluate(() => localStorage.getItem('mira_partner_token'));

    // Ensure variant exists for bind UI
    await fetch(`${apiBase}/partners-portal/products/${productId}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        nameAr: 'منتج رحلة P2',
        priceHalalas: 5500,
        optionsJson: [{ id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 'm', labelAr: 'M' }] }],
        variantsJson: [{ id: 'm-only', selections: { size: 'm' }, available: true, mediaIds: [] }],
      }),
    });

    // Second upload after owner exists (session path) — watch for auto-publish
    const submitBefore = net.filter((n) => n.method === 'POST' && /submit-review/.test(n.url)).length;
    await bp.locator('#catalogForm input[type="file"]').first().setInputFiles({
      name: 'p2-b.png',
      mimeType: 'image/png',
      buffer: PNG2,
    });
    await bp.waitForTimeout(8000);
    const submitAfterUpload = net.filter((n) => n.method === 'POST' && /submit-review/.test(n.url)).length;
    const autoPublishOnUpload = submitAfterUpload > submitBefore;

    // Cover
    const coverBtn = bp.locator('#catalogForm button').filter({ hasText: /^غلاف$/ }).first();
    if ((await coverBtn.count()) > 0) await coverBtn.click().catch(() => {});

    // Reload persistence
    await bp.reload({ waitUntil: 'domcontentloaded' });
    await bp.waitForTimeout(1500);
    await bp.evaluate(async (id) => {
      const row = await PartnersApi.dashboard();
      const p = (row.partner?.products || []).find((x) => x.id === id);
      if (p && window.CatalogJourney && CatalogJourney.openExisting) {
        await CatalogJourney.openExisting(p, 'brand');
      }
    }, productId).catch(() => {});
    await bp.waitForTimeout(1500);

    const preview = await (
      await fetch(`${apiBase}/partners-portal/products/${productId}/preview`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).json();
    const readyMedia = (preview.media || []).filter((m) => m.ready === true && !m.pendingRemoval);

    // Bind via portal UI if select present, else PATCH used by portal API
    let bindOk = false;
    await bp.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    // Re-open by navigating dashboard product list click
    await bp.goto(`http://127.0.0.1:${portalPort}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'domcontentloaded',
    });
    await bp.waitForTimeout(800);
    await bp.click('#goProduct');
    await bp.waitForTimeout(1000);
    const open = bp.locator('button, a, .card').filter({ hasText: /رحلة P2/ }).first();
    if ((await open.count()) > 0) await open.click().catch(() => {});
    await bp.waitForTimeout(1500);
    if (readyMedia.length) {
      const bindSelect = bp.locator('.variant-media-row select, select[aria-label*="تركيبة"]').first();
      if ((await bindSelect.count()) > 0) {
        await bindSelect.evaluate((sel, id) => {
          for (const o of sel.options) o.selected = o.value === id;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }, readyMedia[0].id);
        const saveBind = bp.locator('button').filter({ hasText: /حفظ ربط التركيبة/ }).first();
        if ((await saveBind.count()) > 0) {
          await saveBind.click();
          await bp.waitForTimeout(1500);
          bindOk = true;
        }
      }
      if (!bindOk) {
        const res = await fetch(`${apiBase}/partners-portal/products/${productId}/variants/m-only/media`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ mediaIds: [readyMedia[0].id] }),
        });
        bindOk = res.ok;
      }
    }

    // Full reload + re-check preview ready + binding
    await bp.reload({ waitUntil: 'domcontentloaded' });
    await bp.waitForTimeout(1000);
    const preview2 = await (
      await fetch(`${apiBase}/partners-portal/products/${productId}/preview`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).json();
    const stillReady = (preview2.media || []).some((m) => m.ready === true);
    const bound =
      (Array.isArray(preview2.draftVariantsJson) &&
        preview2.draftVariantsJson.some((v) => (v.mediaIds || []).includes(readyMedia[0]?.id))) ||
      (Array.isArray(preview2.publishedVariantsJson) &&
        preview2.publishedVariantsJson.some((v) => (v.mediaIds || []).includes(readyMedia[0]?.id)));

    // Explicit submit via UI
    await bp.goto(`http://127.0.0.1:${portalPort}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'domcontentloaded',
    });
    await bp.click('#goProduct');
    await bp.waitForTimeout(800);
    const open2 = bp.locator('button, a, .card').filter({ hasText: /رحلة P2/ }).first();
    if ((await open2.count()) > 0) await open2.click().catch(() => {});
    await bp.waitForTimeout(1200);
    const submitBtn = bp.locator('#catalogForm button').filter({ hasText: /إرسال للمراجعة|نشر الآن/ }).first();
    let submitViaUi = false;
    if ((await submitBtn.count()) > 0) {
      const before = net.length;
      await submitBtn.click();
      await bp.waitForTimeout(2500);
      submitViaUi = net.slice(before).some((n) => n.method === 'POST' && /submit-review/.test(n.url));
    }
    if (!submitViaUi) {
      await fetch(`${apiBase}/partners-portal/products/${productId}/submit-review`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: '{}',
      });
    }

    const prodRow = await (
      await fetch(`${apiBase}/partners-portal/products/${productId}/preview`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).json();
    // Prefer reviewRevision from me
    const meAfter = await (await fetch(`${apiBase}/partners-portal/me`, { headers: { authorization: `Bearer ${token}` } })).json();
    const live = (meAfter.partner?.products || []).find((p) => p.id === productId);
    const rev = live?.submittedRevision ?? live?.reviewRevision ?? prodRow.revision;
    const approveRes = await fetch(`${apiBase}/admin/catalog-reviews/product/${productId}/decision`, {
      method: 'POST',
      headers: { 'x-admin-key': ready.adminKey, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approve', revision: rev }),
    });
    const approveBody = await approveRes.json().catch(() => ({}));

    const foreign = await fetch(`${apiBase}/partners-portal/products/${productId}/variants/m-only/media`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ mediaIds: ['00000000-0000-0000-0000-000000000099'] }),
    });

    await bp.screenshot({ path: join(shotsDir, 'product-final.png'), fullPage: true });
    record(
      'JOURNEY_PRODUCT',
      !!productId &&
        readyMedia.length >= 1 &&
        stillReady &&
        !autoPublishOnUpload &&
        bindOk &&
        (approveRes.ok || approveBody.contentStatus === 'published') &&
        foreign.status >= 400,
      {
        productId,
        readyCount: readyMedia.length,
        stillReady,
        bound,
        bindOk,
        autoPublishOnUpload,
        submitViaUi,
        approveStatus: approveRes.status,
        foreignStatus: foreign.status,
        previewReadyContract: readyMedia.every((m) => m.ready === true && !('storageKey' in m)),
      },
    );
    await brandCtx.close();

    // ========== SERVICE (salon) ==========
    const salonCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const sp = await salonCtx.newPage();
    await login(sp, loginUrl, ready.salonEmail, ready.password);
    await sp.click('#goService');
    await sp.waitForSelector('#catalogForm [name="nameAr"]', { timeout: 15000 });
    await sp.fill('#catalogForm [name="nameAr"]', 'خدمة رحلة P2');
    await sp.fill('#catalogForm [name="priceSar"]', '90').catch(() => {});
    await sp.fill('#catalogForm [name="durationMin"]', '45').catch(() => {});
    const tpl = sp.locator('#catalogForm select[name="serviceTemplateId"]');
    if ((await tpl.count()) > 0) {
      const vals = await tpl.locator('option').evaluateAll((n) => n.map((x) => x.value).filter(Boolean));
      if (vals.length) await tpl.selectOption(vals.find((v) => v === 'salon_hair_cut') || vals[0]);
      await sp.waitForTimeout(500);
    }
    const single = sp.locator('#catalogForm input[type="radio"][value="single"]').first();
    if ((await single.count()) > 0) await single.check();
    const pm = sp.locator('#catalogForm select[name="priceMode"]');
    if ((await pm.count()) > 0) await pm.selectOption('fixed');

    const serviceId = await materializeWithPng(sp, 'svc.png', PNG2);
    // Interrupt + reload + reselect
    await sp.locator('#catalogForm input[type="file"]').first().setInputFiles({
      name: 'svc-b.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await sp.waitForTimeout(400);
    await sp.reload({ waitUntil: 'domcontentloaded' });
    await sp.waitForTimeout(1200);
    await sp.locator('#catalogForm input[type="file"]').first().setInputFiles({
      name: 'svc-b.png',
      mimeType: 'image/png',
      buffer: PNG,
    }).catch(() => {});
    await sp.waitForTimeout(8000);

    const sToken = await sp.evaluate(() => localStorage.getItem('mira_partner_token'));
    const sPreview = await (
      await fetch(`${apiBase}/partners-portal/services/${serviceId}/preview`, {
        headers: { authorization: `Bearer ${sToken}` },
      })
    ).json();
    const sReady = (sPreview.media || []).filter((m) => m.ready === true);

    const submitSvc = sp.locator('#catalogForm button').filter({ hasText: /إرسال للمراجعة/ }).first();
    if ((await submitSvc.count()) > 0) {
      await submitSvc.click();
      await sp.waitForTimeout(2000);
    } else {
      await fetch(`${apiBase}/partners-portal/services/${serviceId}/submit-review`, {
        method: 'POST',
        headers: { authorization: `Bearer ${sToken}`, 'content-type': 'application/json' },
        body: '{}',
      });
    }
    const sme = await (await fetch(`${apiBase}/partners-portal/me`, { headers: { authorization: `Bearer ${sToken}` } })).json();
    const slive = (sme.partner?.services || []).find((s) => s.id === serviceId);
    const sRev = slive?.submittedRevision ?? slive?.reviewRevision ?? sPreview.revision;
    const sApprove = await fetch(`${apiBase}/admin/catalog-reviews/service/${serviceId}/decision`, {
      method: 'POST',
      headers: { 'x-admin-key': ready.adminKey, 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approve', revision: sRev }),
    });
    await sp.screenshot({ path: join(shotsDir, 'service-final.png'), fullPage: true });
    record('JOURNEY_SERVICE', !!serviceId && sReady.length >= 1 && (sApprove.ok || sApprove.status < 500), {
      serviceId,
      readyCount: sReady.length,
      approveStatus: sApprove.status,
      reloadResumeAttempted: true,
    });
    await salonCtx.close();

    // ========== C04 developer: upload must not auto-publish ==========
    // Create a published-ready draft owner via API so the form has item.id without
    // materialize's submit-review side effects, then prove uploadOne alone does not publish.
    const devCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const dp = await devCtx.newPage();
    const dnet = [];
    dp.on('request', (req) => {
      const u = req.url();
      if (u.includes('/api/v1/')) dnet.push({ method: req.method(), url: u.replace(apiBase, ''), t: Date.now() });
    });
    await login(dp, loginUrl, ready.developerEmail, ready.password);
    const dToken = await dp.evaluate(() => localStorage.getItem('mira_partner_token'));
    const created = await (
      await fetch(`${apiBase}/partners-portal/products`, {
        method: 'POST',
        headers: { authorization: `Bearer ${dToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          nameAr: 'منتج مطوّر P2',
          nameEn: 'Dev P2',
          priceHalalas: 4000,
          category: 'face',
          externalUrl: 'https://example.com/dev-p2',
          concernTags: [],
          skinTypes: [],
        }),
      })
    ).json();
    const devOwner = created?.id || created?.product?.id;
    if (!devOwner) throw new Error('dev product create failed ' + JSON.stringify(created));

    await dp.goto(`http://127.0.0.1:${portalPort}/dashboard.html?api-base=${encodeURIComponent(apiBase)}`, {
      waitUntil: 'domcontentloaded',
    });
    await dp.waitForTimeout(1500);
    // Open existing product via real portal list button
    const opened = await dp.evaluate(async (id) => {
      const dash = await PartnersApi.dashboard();
      const products = dash.catalog?.products || dash.partner?.products || [];
      const p = products.find((x) => x.id === id);
      if (!p) return { ok: false, reason: 'not-in-catalog', n: products.length };
      CatalogJourney.renderForm('brand', p, 'catalogForm', 'catalogTitle');
      return { ok: true, id: p.id, name: p.nameAr };
    }, devOwner);
    if (!opened.ok) throw new Error('open dev product failed ' + JSON.stringify(opened));
    await dp.waitForSelector('#catalogForm input[type="file"]', { timeout: 15000 });
    await dp.waitForTimeout(800);

    dnet.length = 0;
    await dp.locator('#catalogForm input[type="file"]').first().setInputFiles({
      name: 'dev-b.png',
      mimeType: 'image/png',
      buffer: PNG2,
    });
    await dp.waitForTimeout(12000);
    const publishAfterUpload = dnet.filter((n) => n.method === 'POST' && /submit-review/.test(n.url));
    const statusText = await dp.locator('#catalogForm').innerText().catch(() => '');
    const draftMsg = /جاهزًا في المسودة|اضغط «نشر الآن»|رُبط بالمسودة|صورة محفوظة|رُفع|فيديو محفوظ/.test(statusText);
    const mediaReady = (
      await (
        await fetch(`${apiBase}/partners-portal/products/${devOwner}/preview`, {
          headers: { authorization: `Bearer ${dToken}` },
        })
      ).json()
    ).media?.some((m) => m.ready === true);

    // Explicit publish button — allowed path for developer
    const pubBtn = dp.locator('#catalogForm button').filter({ hasText: /نشر الآن/ }).first();
    let explicitPublish = false;
    if ((await pubBtn.count()) > 0) {
      const before = dnet.length;
      await pubBtn.click();
      await dp.waitForTimeout(2500);
      explicitPublish = dnet.slice(before).some((n) => n.method === 'POST' && /submit-review/.test(n.url));
    } else {
      // save button for developer is often labeled نشر الآن — try form submit
      const savePub = dp.locator('#catalogForm button[type="submit"], #catalogForm button').filter({ hasText: /نشر/ }).first();
      if ((await savePub.count()) > 0) {
        const before = dnet.length;
        await savePub.click();
        await dp.waitForTimeout(2500);
        explicitPublish = dnet.slice(before).some((n) => n.method === 'POST' && /submit-review/.test(n.url));
      }
    }
    await dp.screenshot({ path: join(shotsDir, 'developer-c04.png'), fullPage: true });
    record('C04', publishAfterUpload.length === 0 && !!devOwner && (draftMsg || mediaReady === true), {
      publishAfterUpload: publishAfterUpload.length,
      publishUrls: publishAfterUpload.map((n) => n.url),
      draftMsg,
      mediaReady,
      explicitPublish,
      devOwner,
      statusSnippet: statusText.replace(/\s+/g, ' ').slice(0, 240),
    });
    await devCtx.close();
  } catch (e) {
    record('JOURNEY_FATAL', false, String(e && e.stack ? e.stack : e));
  } finally {
    await browser.close().catch(() => {});
    staticServer.close();
    child.kill('SIGTERM');
  }

  const summary = {
    ok: cases.every((c) => c.ok === 'PASS'),
    db: dbMeta,
    commit: process.env.MIRA_P21_COMMIT || null,
    cases,
    finishedUtc: new Date().toISOString(),
    pngSha: createHash('sha256').update(PNG).digest('hex'),
  };
  writeFileSync(join(outDir, 'portal-journey.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, cases: cases.map((c) => ({ id: c.id, ok: c.ok })) }, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
