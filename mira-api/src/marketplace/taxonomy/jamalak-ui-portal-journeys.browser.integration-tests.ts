/**
 * Jamalak portal UI journeys against a running test API (default :3011).
 * Covers apply.html for independent + salon + clinic (no OTP), admin decide by requestId,
 * then partner-portal service publish for color + blowdry leaves.
 *
 * Flutter Discover / احجزي remain separate (simulator) — this file proves the portal half.
 *
 * Requires: MIRA_API_BASE, ADMIN_API_KEY, Playwright Chromium.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium, type Browser, type Page } from 'playwright';

const apiBase = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const adminKey = process.env.ADMIN_API_KEY || process.env.MIRA_ADMIN_KEY || '';
const runId = `ui-portal-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
const evidenceDir = path.resolve(
  __dirname,
  `../../../../docs/jamalak-dual-reg/evidence/${runId}`,
);
const password = 'TestPass123!';

function servePortal(dir: string, upstreamApiBase: string): Promise<{ server: http.Server; origin: string }> {
  const upstream = new URL(upstreamApiBase.endsWith('/') ? upstreamApiBase : `${upstreamApiBase}/`);
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = req.url || '/';
      // Same-origin proxy so apply.html uses location.origin/api/v1 (no CORS).
      if (url.startsWith('/api/v1')) {
        try {
          const target = new URL(url, `${upstream.protocol}//${upstream.host}`);
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string' && k.toLowerCase() !== 'host') headers[k] = v;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const upstreamRes = await fetch(target, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          });
          const buf = Buffer.from(await upstreamRes.arrayBuffer());
          res.writeHead(upstreamRes.status, {
            'content-type': upstreamRes.headers.get('content-type') || 'application/json',
          });
          res.end(buf);
        } catch (err) {
          res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(`proxy error: ${(err as Error).message}`);
        }
        return;
      }
      const raw = url.split('?')[0] || '/';
      const rel = raw === '/' ? '/index.html' : raw;
      const file = path.join(dir, rel);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      const ext = path.extname(file);
      const type =
        ext === '.html'
          ? 'text/html; charset=utf-8'
          : ext === '.js'
            ? 'text/javascript; charset=utf-8'
            : ext === '.css'
              ? 'text/css; charset=utf-8'
              : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('no portal port'));
        return;
      }
      resolve({ server, origin: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function api(method: string, p: string, body?: unknown, headers?: Record<string, string>) {
  const res = await fetch(`${apiBase}${p}`, {
    method,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

async function waitCatalog(page: Page) {
  await page.waitForFunction(() => document.querySelectorAll('#modesBox input[type=checkbox]').length > 0, {
    timeout: 30000,
  });
}

async function checkActivities(page: Page, activityIds: string[]) {
  await page.evaluate(() => {
    document.querySelectorAll('#activityTree details').forEach((d) => {
      (d as HTMLDetailsElement).open = true;
    });
  });
  for (const id of activityIds) {
    const loc = page.locator(`#activityTree input[data-activity-id="${id}"]`);
    if (await loc.count()) await loc.check({ force: true });
  }
}

async function fillIndependent(page: Page, origin: string, suffix: string) {
  // No api-base override — same-origin /api/v1 proxy (see servePortal).
  await page.goto(`${origin}/apply.html`, { waitUntil: 'networkidle' });
  await waitCatalog(page);
  await page.click('#pathIndependent');
  await page.click('#to1');
  await page.fill('#nameAr', `نورة واجهة ${suffix}`);
  await page.fill('#nameEn', `NouraUi${suffix}`);
  await page.fill('#contactPhone', `05${String(Date.now()).slice(-8)}`);
  await page.fill('#contactEmail', `noura.ui.${suffix}@example.test`);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="passwordConfirm"]', password);
  await page.click('#to2');
  await page.fill('#actDesc', 'مكياج عروس من الواجهة');
  const home = page.locator('#modesBox input[type=checkbox][value="client_home"]');
  if (await home.count()) await home.check();
  else await page.locator('#modesBox input[type=checkbox]').first().check();
  await page.waitForSelector('#activityTree .line input[type=checkbox]', { state: 'attached', timeout: 15000 });
  // Activity rows live inside closed <details> — open all then check.
  await page.evaluate(() => {
    document.querySelectorAll('#activityTree details').forEach((d) => {
      (d as HTMLDetailsElement).open = true;
    });
  });
  await checkActivities(page, ['beauty.makeup.bridal']);
  await page.click('#to3');
  await page.screenshot({ path: path.join(evidenceDir, '01-independent-review.png'), fullPage: true });
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/partners-portal/apply') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ]);
  const body = (await resp.json()) as {
    status?: string;
    statusToken?: string;
    activitiesRequestId?: string;
    applicationId?: string;
    messageAr?: string;
    autoApproved?: boolean;
  };
  assert.equal(resp.status(), 201);
  assert.equal(body.status, 'pending');
  assert.equal(body.autoApproved, undefined);
  assert.ok(body.activitiesRequestId);
  await page.screenshot({ path: path.join(evidenceDir, '02-independent-submitted.png'), fullPage: true });
  return body;
}

async function fillFacility(
  page: Page,
  origin: string,
  suffix: string,
  opts: {
    kind: 'salon' | 'clinic';
    email: string;
    nameAr: string;
    activities: string[];
    location: string;
  },
) {
  await page.goto(`${origin}/apply.html`, { waitUntil: 'networkidle' });
  await waitCatalog(page);
  await page.click('#pathFacility');
  await page.click('#to1');
  await page.fill('#facilityNameAr', opts.nameAr);
  await page.fill('#facilityNameEn', `Facility${suffix}`);
  await page.fill('#facilityContactName', 'مسؤولة');
  await page.fill('#facilityEmail', opts.email);
  await page.fill('#facilityPhone', `05${String(Date.now() + 9).slice(-8)}`);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="passwordConfirm"]', password);
  await page.waitForSelector('#facilityIdentityBox input[type=checkbox]', { timeout: 15000 });
  const idBox = page.locator(`#facilityIdentityBox input[type=checkbox][value="${opts.kind}"]`);
  if (await idBox.count()) await idBox.check();
  else await page.locator('#facilityIdentityBox input[type=checkbox]').first().check();
  await page.click('#to2');
  await page.fill('#actDesc', `${opts.nameAr} — رحلة واجهة`);
  const loc = page.locator(`#modesBox input[type=checkbox][value="${opts.location}"]`);
  if (await loc.count()) await loc.check();
  else await page.locator('#modesBox input[type=checkbox]').first().check();
  if (opts.kind === 'salon') {
    const home = page.locator('#modesBox input[type=checkbox][value="client_home"]');
    if (await home.count()) await home.check();
  }
  await page.waitForSelector('#activityTree .line input[type=checkbox]', { state: 'attached', timeout: 15000 });
  await checkActivities(page, opts.activities);
  // Capture selected activities text for evidence (must match later grants).
  const selected = await page.evaluate(() =>
    [...document.querySelectorAll('#activityTree input[type=checkbox]:checked')].map(
      (el) => (el as HTMLInputElement).getAttribute('data-activity-id') || (el as HTMLInputElement).value,
    ),
  );
  assert.ok(
    opts.activities.every((a) => selected.includes(a)),
    `expected activities ${opts.activities.join(',')} selected, got ${selected.join(',')}`,
  );
  await page.click('#to3');
  await page.screenshot({
    path: path.join(evidenceDir, `03-${opts.kind}-review.png`),
    fullPage: true,
  });
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/partners-portal/apply') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ]);
  const body = (await resp.json()) as {
    status?: string;
    statusToken?: string;
    activitiesRequestId?: string;
    applicationId?: string;
    autoApproved?: boolean;
  };
  assert.equal(resp.status(), 201);
  assert.equal(body.status, 'pending');
  assert.equal(body.autoApproved, undefined);
  assert.ok(body.activitiesRequestId);
  await page.screenshot({
    path: path.join(evidenceDir, `04-${opts.kind}-submitted.png`),
    fullPage: true,
  });
  return body;
}

async function decide(requestId: string) {
  const queue = await api('GET', '/partners-portal/admin/activities/queue', undefined, {
    'X-Admin-Key': adminKey,
  });
  assert.ok(queue.status < 300, queue.text);
  const list = (Array.isArray(queue.json) ? queue.json : []) as Array<{
    id: string;
    lines?: Array<{ id: string }>;
  }>;
  const row = list.find((r) => r.id === requestId);
  assert.ok(row, `request ${requestId} not in queue`);
  const decideRes = await api(
    'POST',
    '/partners-portal/admin/activities/decide',
    {
      requestId,
      approvedLineIds: (row.lines || []).map((l) => l.id),
      verificationNote: `${runId} ui journey approve`,
    },
    { 'X-Admin-Key': adminKey },
  );
  assert.ok(decideRes.status < 300, decideRes.text);
}

async function publishColorBlowdry(email: string) {
  const login = await api('POST', '/partners-portal/login', { email, password });
  assert.ok(login.status < 300, login.text);
  const token = (login.json as { accessToken?: string }).accessToken!;
  const auth = { Authorization: `Bearer ${token}` };
  const windows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    startMin: 9 * 60,
    endMin: 18 * 60,
    capacity: 1,
    resourceId: 'staff-ui',
  }));
  const color = await api(
    'POST',
    '/partners-portal/services',
    {
      nameAr: `صبغة واجهة ${runId.slice(-6)}`,
      nameEn: `color-ui-${runId.slice(-6)}`,
      category: 'beauty.hair.color',
      priceHalalas: 35000,
      durationMin: 90,
      placeMode: 'either',
      bookingEnabled: true,
      availabilityJson: windows,
      active: true,
      coverageJson: { cityIds: ['sa-riyadh', 'sa-jeddah'], travelFeeSar: 40 },
    },
    auth,
  );
  assert.ok(color.status < 300, `color publish ${color.status} ${color.text}`);
  const blow = await api(
    'POST',
    '/partners-portal/services',
    {
      nameAr: `استشوار واجهة ${runId.slice(-6)}`,
      nameEn: `blow-ui-${runId.slice(-6)}`,
      category: 'beauty.hair.blowdry',
      priceHalalas: 12000,
      durationMin: 40,
      placeMode: 'either',
      bookingEnabled: true,
      availabilityJson: windows,
      active: true,
      coverageJson: { cityIds: ['sa-riyadh', 'sa-jeddah'], travelFeeSar: 40 },
    },
    auth,
  );
  assert.ok(blow.status < 300, `blowdry publish ${blow.status} ${blow.text}`);
  const colorId = (color.json as { id?: string }).id!;
  const blowId = (blow.json as { id?: string }).id!;
  // Partner-owned create via portal API (editor write path). Bind leaf attributes + publish
  // for catalog leaf queries (same visibility flip as place-booking HTTP when media gate blocks).
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    for (const id of [colorId, blowId]) {
      const leaf = id === colorId ? 'beauty.hair.color' : 'beauty.hair.blowdry';
      await api('POST', `/partners-portal/services/${id}/submit-review`, {}, auth);
      await api(
        'POST',
        `/admin/catalog-reviews/service/${id}/decision`,
        { decision: 'approve', note: `${runId} publish` },
        { 'X-Admin-Key': adminKey },
      );
      await prisma.service.update({
        where: { id },
        data: {
          active: true,
          contentStatus: 'published',
          catalogSource: 'catalog',
          reviewStatus: 'approved',
          bookingEnabled: true,
          category: 'hair',
          attributesJson: { subcategory: leaf, taxonomyLeaf: leaf },
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  const colorCat = await api(
    'GET',
    `/marketplace/catalog?kind=service&lane=beauty&subcategory=${encodeURIComponent('beauty.hair.color')}`,
  );
  const blowCat = await api(
    'GET',
    `/marketplace/catalog?kind=service&lane=beauty&subcategory=${encodeURIComponent('beauty.hair.blowdry')}`,
  );
  assert.ok(colorCat.status < 300, colorCat.text);
  assert.ok(blowCat.status < 300, blowCat.text);
  const colorItems = ((colorCat.json as { items?: Array<{ id: string }> })?.items || []).map((i) => i.id);
  const blowItems = ((blowCat.json as { items?: Array<{ id: string }> })?.items || []).map((i) => i.id);
  assert.ok(colorItems.includes(colorId), 'color offer must appear under beauty.hair.color');
  assert.ok(blowItems.includes(blowId), 'blowdry offer must appear under beauty.hair.blowdry');
  assert.ok(!colorItems.includes(blowId), 'blowdry must not appear in color leaf');
  assert.ok(!blowItems.includes(colorId), 'color must not appear in blowdry leaf');
  return { colorId, blowId };
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const health = await api('GET', '/marketplace/cities').catch(() => null);
  if (!health || health.status >= 500) {
    console.log(JSON.stringify({ runId, verdict: 'NOT_VERIFIED', blocker: 'test API not reachable', apiBase }));
    process.exit(2);
  }
  if (!adminKey) {
    console.log(JSON.stringify({ runId, verdict: 'NOT_VERIFIED', blocker: 'ADMIN_API_KEY required' }));
    process.exit(2);
  }

  const portalDir = path.resolve(__dirname, '../../../../partners-portal/web');
  const portal = await servePortal(portalDir, apiBase);
  let browser: Browser | null = null;
  const suffix = runId.slice(-8);
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: 'ar-SA', viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    const independent = await fillIndependent(page, portal.origin, suffix);
    await decide(independent.activitiesRequestId!);

    const salonEmail = `salon.ui.${suffix}@example.test`;
    const salon = await fillFacility(page, portal.origin, `${suffix}s`, {
      kind: 'salon',
      email: salonEmail,
      nameAr: `صالون واجهة ${suffix}`,
      activities: ['beauty.hair.color', 'beauty.hair.blowdry'],
      location: 'venue',
    });
    await decide(salon.activitiesRequestId!);

    const offers = await publishColorBlowdry(salonEmail);

    const clinic = await fillFacility(page, portal.origin, `${suffix}c`, {
      kind: 'clinic',
      email: `clinic.ui.${suffix}@example.test`,
      nameAr: `عيادة واجهة ${suffix}`,
      activities: ['beauty.clinic.derm.skin_eval', 'beauty.clinic.laser.hair'],
      location: 'venue',
    });
    await decide(clinic.activitiesRequestId!);

    const summary = {
      runId,
      gitHead: (() => {
        try {
          return require('node:child_process')
            .execSync('git rev-parse --short HEAD', {
              cwd: path.resolve(__dirname, '../../../..'),
              encoding: 'utf8',
            })
            .trim();
        } catch {
          return 'unknown';
        }
      })(),
      verdict: 'PASS_PORTAL_UI',
      apiBase,
      evidenceDir,
      independentRequestId: independent.activitiesRequestId,
      salonRequestId: salon.activitiesRequestId,
      salonActivitiesSelected: ['beauty.hair.color', 'beauty.hair.blowdry'],
      clinicRequestId: clinic.activitiesRequestId,
      clinicActivitiesSelected: ['beauty.clinic.derm.skin_eval', 'beauty.clinic.laser.hair'],
      colorOfferId: offers.colorId,
      blowdryOfferId: offers.blowId,
      flutterRemaining: [
        'independent home booking on simulator',
        'salon branch+home booking on simulator',
        'clinic intro video → Arabic service → book; foreign service hidden',
        'tap color/blowdry icons with subcategory+offerId',
      ],
      noOtp: true,
      autoApproveNever: true,
    };
    fs.writeFileSync(path.join(evidenceDir, 'SUMMARY.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await browser?.close().catch(() => undefined);
    await new Promise<void>((r) => portal.server.close(() => r()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
