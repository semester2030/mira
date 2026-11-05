/**
 * P4 acceptance — API + optional browser against isolated local DB.
 * Independent expected values (never read-back-as-oracle).
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const outDir =
  process.env.MIRA_P4_OUT_DIR ||
  join(repoRoot, 'audit-out/p2-p31-p4/logs/p4-accept');
mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'shots'), { recursive: true });

const apiBase = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const commit = process.env.MIRA_P21_COMMIT || '';
const runId = process.env.MIRA_P21_RUN_ID || `p4-${Date.now()}`;
const portalRoot = join(repoRoot, 'partners-portal/web');

function requireLocal(url) {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`REFUSE ${host}`);
}

async function main() {
  const startedUtc = new Date().toISOString();
  const steps = [];
  const record = (id, ok, detail) => {
    steps.push({ id, ok, detail });
    console.log(JSON.stringify({ id, ok, detail }));
  };

  requireLocal(process.env.DATABASE_URL || '');
  const prisma = new PrismaClient();
  const run = randomUUID().slice(0, 8);
  const tokenA = `tok-p4a-${run}`;
  const tokenB = `tok-p4b-${run}`;
  const cleanups = [];

  try {
    const partnerA = await prisma.partner.create({
      data: { type: 'salon', status: 'active', nameAr: `صالون أ ${run}`, nameEn: `a-${run}`, city: 'الرياض', contactPhone: '0501111111' },
    });
    const partnerB = await prisma.partner.create({
      data: { type: 'salon', status: 'active', nameAr: `صالون ب ${run}`, nameEn: `b-${run}`, city: 'جدة' },
    });
    const puA = await prisma.partnerUser.create({
      data: { partnerId: partnerA.id, email: `p4a-${run}@t.local`, accessToken: tokenA },
    });
    const puB = await prisma.partnerUser.create({
      data: { partnerId: partnerB.id, email: `p4b-${run}@t.local`, accessToken: tokenB },
    });
    cleanups.push(async () => {
      await prisma.service.deleteMany({ where: { partnerId: { in: [partnerA.id, partnerB.id] } } });
      await prisma.partnerUser.deleteMany({ where: { id: { in: [puA.id, puB.id] } } });
      await prisma.partner.deleteMany({ where: { id: { in: [partnerA.id, partnerB.id] } } });
    });

    const authA = { Authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' };
    const authB = { Authorization: `Bearer ${tokenB}`, 'content-type': 'application/json' };

    // 1) Minimal draft — price 0 allowed for draft; omit duration (optional). Do not invent booking readiness.
    const createRes = await fetch(`${apiBase}/partners-portal/services`, {
      method: 'POST',
      headers: authA,
      body: JSON.stringify({
        nameAr: `خدمة مسودة ${run}`,
        priceHalalas: 0,
        category: 'hair',
        bookingEnabled: false,
      }),
    });
    const created = await createRes.json().catch(() => ({}));
    record('P4_CREATE_MIN_DRAFT', createRes.ok && !!created.id && created.priceHalalas === 0, {
      status: createRes.status,
      idSuffix: created.id?.slice(-8),
      priceHalalas: created.priceHalalas,
      durationMin: created.durationMin ?? null,
    });
    const serviceId = created.id;
    if (!serviceId) throw new Error('create failed');
    record(
      'P4_MIN_DRAFT_NOT_BOOKABLE_YET',
      created.bookingEnabled === false && (created.durationMin == null || created.durationMin === 0 || created.priceHalalas === 0),
      { bookingEnabled: created.bookingEnabled, durationMin: created.durationMin, priceHalalas: created.priceHalalas },
    );

    // Re-open via GET me catalog (no dedicated GET /services/:id in this portal).
    async function loadService(auth) {
      const me = await fetch(`${apiBase}/partners-portal/me`, { headers: auth }).then((r) => r.json());
      if (!me?.catalog) {
        throw new Error(`me missing catalog: ${JSON.stringify(me).slice(0, 180)}`);
      }
      return (me.catalog.services || []).find((s) => s.id === serviceId) || null;
    }
    const listed = await loadService(authA);
    record('P4_REOPEN_MIN', Boolean(listed) && String(listed.nameAr || listed.draftNameAr || '').includes('مسودة'), {
      nameAr: listed?.nameAr,
      draftNameAr: listed?.draftNameAr,
      availabilityJson: listed?.availabilityJson ?? null,
    });
    // Absence of availability must remain null/empty — not invented available
    record(
      'P4_UNCONFIGURED_NOT_AVAILABLE',
      listed?.availabilityJson == null ||
        (Array.isArray(listed.availabilityJson) && listed.availabilityJson.length === 0) ||
        (listed?.availabilityJson?.windows && listed.availabilityJson.windows.length === 0),
      { availabilityJson: listed?.availabilityJson ?? null },
    );

    // 2/3) Weekly + optional details
    const EXPECT_WINDOWS = [
      { weekday: 0, startMin: 540, endMin: 1020, capacity: 2, resourceId: 'غرفة-أ' },
      { weekday: 1, startMin: 540, endMin: 1020, capacity: 2, resourceId: 'غرفة-أ' },
    ];
    const EXPECT_CLOSED = ['2026-12-01'];
    const EXPECT_EX = [{ date: '2026-12-02', kind: 'special', startMin: 600, endMin: 720, capacity: 1, resourceId: '' }];
    const patch1 = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authA,
      body: JSON.stringify({
        descriptionAr: 'تفاصيل اختيارية',
        durationMin: 45,
        bookingEnabled: true,
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: EXPECT_WINDOWS,
          closedDates: EXPECT_CLOSED,
          exceptions: EXPECT_EX,
        },
      }),
    });
    const after1 = await patch1.json().catch(() => ({}));
    record('P4_SAVE_WEEKLY_AND_EXCEPTIONS', patch1.ok, { status: patch1.status, body: after1?.message || after1?.code });

    const s2 = await loadService(authA);
    const av = s2?.availabilityJson;
    const windowsOk =
      Array.isArray(av?.windows) &&
      av.windows.length === EXPECT_WINDOWS.length &&
      av.windows[0].capacity === 2 &&
      av.timezone === 'Asia/Riyadh';
    const closedOk = Array.isArray(av?.closedDates) && av.closedDates.includes('2026-12-01');
    const exOk = Array.isArray(av?.exceptions) && av.exceptions.some((e) => e.date === '2026-12-02' && e.kind === 'special');
    record('P4_RETRIEVE_WEEKLY', windowsOk, { windows: av?.windows });
    record('P4_RETRIEVE_CLOSED', closedOk, { closedDates: av?.closedDates });
    record('P4_RETRIEVE_EXCEPTION', exOk, { exceptions: av?.exceptions });
    record('P4_DURATION', s2?.durationMin === 45, { durationMin: s2?.durationMin });
    record('P4_OPTIONAL_DESC', s2?.descriptionAr === 'تفاصيل اختيارية' || s2?.draftDescriptionAr === 'تفاصيل اختيارية', {
      descriptionAr: s2?.descriptionAr,
      draftDescriptionAr: s2?.draftDescriptionAr,
    });

    // 4) Clear optional description + clear closed date
    const patchClear = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authA,
      body: JSON.stringify({
        descriptionAr: null,
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: EXPECT_WINDOWS,
          closedDates: [],
          exceptions: EXPECT_EX,
        },
      }),
    });
    record('P4_CLEAR_OPTIONAL_HTTP', patchClear.ok, { status: patchClear.status });
    const s3 = await loadService(authA);
    record(
      'P4_CLEAR_REACHES_SERVER',
      (s3?.descriptionAr == null || s3?.descriptionAr === '') &&
        (s3?.draftDescriptionAr == null || s3?.draftDescriptionAr === '') &&
        Array.isArray(s3?.availabilityJson?.closedDates) &&
        s3.availabilityJson.closedDates.length === 0,
      {
        descriptionAr: s3?.descriptionAr,
        draftDescriptionAr: s3?.draftDescriptionAr,
        closedDates: s3?.availabilityJson?.closedDates,
      },
    );

    // Multi-window same day + resources preserved across unrelated field save
    const DUAL = [
      { weekday: 0, startMin: 540, endMin: 660, capacity: 2, resourceId: 'غرفة-أ' },
      { weekday: 0, startMin: 720, endMin: 840, capacity: 1, resourceId: 'غرفة-ب' },
      { weekday: 1, startMin: 540, endMin: 1020, capacity: 2, resourceId: 'غرفة-أ' },
    ];
    const dualPatch = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authA,
      body: JSON.stringify({
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: DUAL,
          closedDates: ['2026-12-15'],
          exceptions: [{ date: '2026-12-16', kind: 'special', startMin: 600, endMin: 700, capacity: 1 }],
        },
      }),
    });
    record('P4_SAVE_DUAL_WINDOWS', dualPatch.ok, { status: dualPatch.status });
    const avBefore = (await loadService(authA))?.availabilityJson;
    const descOnly = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authA,
      body: JSON.stringify({ descriptionAr: 'وصف فقط دون لمس الجدول' }),
    });
    record('P4_DESC_ONLY_SAVE', descOnly.ok, { status: descOnly.status });
    const afterDescSvc = await loadService(authA);
    const avAfter = afterDescSvc?.availabilityJson;
    const dualPreserved =
      Array.isArray(avAfter?.windows) &&
      avAfter.windows.length === DUAL.length &&
      avAfter.windows.filter((w) => w.weekday === 0).length === 2 &&
      avAfter.windows.some((w) => w.resourceId === 'غرفة-أ' && w.capacity === 2) &&
      avAfter.windows.some((w) => w.resourceId === 'غرفة-ب' && w.capacity === 1) &&
      JSON.stringify(avAfter?.closedDates) === JSON.stringify(avBefore?.closedDates) &&
      JSON.stringify(avAfter?.exceptions) === JSON.stringify(avBefore?.exceptions);
    record('P4_MULTI_WINDOW_PRESERVE_ON_DESC', dualPreserved, {
      beforeLen: avBefore?.windows?.length,
      afterLen: avAfter?.windows?.length,
      after: avAfter?.windows,
    });

    // Strict validation: wrong types rejected (not coerced to empty wipe)
    const badWindowsType = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authA,
      body: JSON.stringify({
        availabilityJson: { v: 2, timezone: 'Asia/Riyadh', windows: 'nope', closedDates: [], exceptions: [] },
      }),
    });
    record('P4_REJECT_WINDOWS_TYPE', badWindowsType.status >= 400, { status: badWindowsType.status });
    const badClosedType = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authA,
      body: JSON.stringify({
        availabilityJson: { v: 2, timezone: 'Asia/Riyadh', windows: DUAL, closedDates: 'x', exceptions: [] },
      }),
    });
    record('P4_REJECT_CLOSED_TYPE', badClosedType.status >= 400, { status: badClosedType.status });
    const badExOverlap = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authA,
      body: JSON.stringify({
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: DUAL,
          closedDates: [],
          exceptions: [
            { date: '2026-12-20', kind: 'special', startMin: 600, endMin: 700, capacity: 1, resourceId: 'r1' },
            { date: '2026-12-20', kind: 'special', startMin: 650, endMin: 800, capacity: 1, resourceId: 'r1' },
          ],
        },
      }),
    });
    record('P4_REJECT_SPECIAL_OVERLAP', badExOverlap.status >= 400, { status: badExOverlap.status });
    // After rejects, dual windows still intact
    const avStill = (await loadService(authA))?.availabilityJson;
    record('P4_REJECT_KEEPS_PRIOR', Array.isArray(avStill?.windows) && avStill.windows.length === DUAL.length, {
      len: avStill?.windows?.length,
    });

    // 7) Invalid timezone / overlap rejected
    const badTz = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authA,
      body: JSON.stringify({
        availabilityJson: { v: 2, timezone: 'UTC', windows: EXPECT_WINDOWS, closedDates: [], exceptions: [] },
      }),
    });
    record('P4_REJECT_FOREIGN_TZ', badTz.status >= 400, { status: badTz.status });

    const badOverlap = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authA,
      body: JSON.stringify({
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: [
            { weekday: 0, startMin: 540, endMin: 700, capacity: 1, resourceId: 'x' },
            { weekday: 0, startMin: 600, endMin: 800, capacity: 1, resourceId: 'x' },
          ],
          closedDates: [],
          exceptions: [],
        },
      }),
    });
    record('P4_REJECT_OVERLAP', badOverlap.status >= 400, { status: badOverlap.status });

    // HTTP slots via partner commerce path (closed date)
    const slotService = await prisma.service.create({
      data: {
        partnerId: partnerA.id,
        nameAr: `مواعيد ${run}`,
        nameEn: `slots-${run}`,
        durationMin: 60,
        priceHalalas: 10000,
        concernTags: [],
        bookingEnabled: true,
        active: true,
        availabilityJson: {
          v: 2,
          timezone: 'Asia/Riyadh',
          windows: [{ weekday: 2, startMin: 540, endMin: 720, capacity: 1, resourceId: '' }],
          closedDates: ['2026-12-22'],
          exceptions: [],
        },
      },
    });
    cleanups.push(async () => {
      await prisma.service.deleteMany({ where: { id: slotService.id } });
    });
    const slotsClosed = await fetch(
      `${apiBase}/partners/me/commerce/services/${slotService.id}/availability?date=2026-12-22`,
      { headers: authA },
    );
    const slotsClosedBody = await slotsClosed.json().catch(() => ({}));
    record(
      'P4_HTTP_SLOTS_CLOSED_EMPTY',
      slotsClosed.ok && Array.isArray(slotsClosedBody.slots) && slotsClosedBody.slots.length === 0,
      { status: slotsClosed.status, slots: slotsClosedBody.slots?.length },
    );

    // 10) Partner B cannot read/write A
    const steal = await fetch(`${apiBase}/partners-portal/services/${serviceId}`, {
      method: 'PATCH',
      headers: authB,
      body: JSON.stringify({ nameAr: 'سرقة' }),
    });
    record('P4_OWNERSHIP_WRITE_DENIED', steal.status === 404 || steal.status === 403 || steal.status >= 400, {
      status: steal.status,
    });
    const meB = await fetch(`${apiBase}/partners-portal/me`, { headers: authB }).then((r) => r.json());
    const leak = (meB.catalog?.services || []).some((s) => s.id === serviceId);
    record('P4_OWNERSHIP_READ_ISOLATED', !leak, { serviceCount: meB.catalog?.serviceCount });

    // 11) Draft vs published — contentStatus stays draft/published per existing review cycle
    const sDraft = afterDescSvc || s3;
    record(
      'P4_CONTENT_STATUS_PRESERVED',
      ['draft', 'published', 'pending_review'].includes(String(sDraft?.contentStatus || '')),
      { contentStatus: sDraft?.contentStatus, reviewStatus: sDraft?.reviewStatus },
    );

    // Template coverage matrix (presence ≠ proven UI — recorded separately)
    const templatesPath = join(repoRoot, 'mira-api/src/partners-portal/registry/service-templates.catalog.json');
    const templates = JSON.parse(readFileSync(templatesPath, 'utf8'));
    const templateIds = [];
    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) node.forEach(walk);
      else if (typeof node === 'object') {
        if (typeof node.id === 'string' && node.id) templateIds.push(node.id);
        Object.values(node).forEach(walk);
      }
    };
    walk(templates);
    const uniqTemplates = [...new Set(templateIds)];
    record('P4_TEMPLATE_COVERAGE_MATRIX', uniqTemplates.length > 0, {
      count: uniqTemplates.length,
      sample: uniqTemplates.slice(0, 12),
      note: 'JSON presence only — UI journeys below prove editor paths',
    });

    // Browser journeys: multi-window preserve, calendar closed/exception, optional clear, ownership UI
    try {
      const apiOrigin = apiBase.replace(/\/api\/v1\/?$/, '');
      const readReqBody = (req) =>
        new Promise((resolve, reject) => {
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => resolve(Buffer.concat(chunks)));
          req.on('error', reject);
        });
      const mime = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
      };
      const server = createServer(async (req, res) => {
        const raw = req.url || '/';
        if (raw.startsWith('/api/')) {
          const method = req.method || 'GET';
          const body = ['GET', 'HEAD'].includes(method) ? undefined : await readReqBody(req);
          const headers = { accept: 'application/json' };
          if (req.headers.authorization) headers.authorization = req.headers.authorization;
          if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
          const up = await fetch(apiOrigin + raw, { method, headers, body });
          const buf = Buffer.from(await up.arrayBuffer());
          res.writeHead(up.status, { 'content-type': up.headers.get('content-type') || 'application/json' });
          res.end(buf);
          return;
        }
        let path = raw.split('?')[0];
        if (path === '/') path = '/dashboard.html';
        const file = join(portalRoot, path.replace(/^\//, ''));
        if (!existsSync(file)) {
          res.writeHead(404);
          res.end('x');
          return;
        }
        res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
        res.end(readFileSync(file));
      });
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      const port = server.address().port;
      const origin = `http://127.0.0.1:${port}`;
      const portalApi = `${origin}/api/v1`;
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      const netLog = [];
      page.on('request', (req) => {
        const u = req.url();
        if (/\/partners-portal\/services/.test(u)) {
          netLog.push({ method: req.method(), url: u.replace(origin, ''), t: Date.now() });
        }
      });
      await page.addInitScript(({ token }) => localStorage.setItem('mira_partner_token', token), { token: tokenA });
      await page.goto(`${origin}/dashboard.html?api-base=${encodeURIComponent(portalApi)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForSelector('#catalogList .list-item', { timeout: 30000 });
      // Open the dual-window service by name
      const openBtn = page.locator('#catalogList .list-item', { hasText: 'خدمة مسودة' }).locator('button', { hasText: 'فتح في النموذج' }).first();
      await openBtn.click();
      await page.waitForSelector('[data-testid="avail-calendar-preview"]', { timeout: 20000 });
      const rowCount0 = await page.locator('[data-testid="avail-window-row"]').count();
      record('P4_BROWSER_MULTI_ROWS_LOADED', rowCount0 >= 2, { rowCount0 });

      // Preview labels are work-hours, not fake capacity-full
      const previewText = await page.locator('[data-testid="avail-calendar-preview"]').innerText();
      const legendOk =
        !previewText.includes('مكتمل السعة') &&
        (await page.locator('body').innerText()).includes('ليست توافر حجز محسوبًا');
      record('P4_BROWSER_PREVIEW_WORK_HOURS_LABEL', legendOk, { previewSnippet: previewText.slice(0, 120) });

      // Edit description only via UI and save — multi windows must survive
      const desc = page.locator('textarea[name="descriptionAr"], input[name="descriptionAr"]').first();
      if (await desc.count()) {
        await desc.fill('رحلة واجهة: وصف فقط');
      }
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(outDir, 'shots', `ui-desc-save-${run}.png`), fullPage: true });

      // Re-open and count rows
      await page.goto(`${origin}/dashboard.html?api-base=${encodeURIComponent(portalApi)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForSelector('#catalogList .list-item', { timeout: 30000 });
      await page.locator('#catalogList .list-item', { hasText: 'خدمة مسودة' }).locator('button', { hasText: 'فتح في النموذج' }).first().click();
      await page.waitForSelector('[data-testid="avail-window-row"]', { timeout: 20000 });
      const rowCount1 = await page.locator('[data-testid="avail-window-row"]').count();
      record('P4_BROWSER_MULTI_PRESERVE_AFTER_DESC', rowCount1 >= 2 && rowCount1 === rowCount0, {
        rowCount0,
        rowCount1,
      });

      // Add closed date from calendar UI
      await page.locator('[data-testid="avail-closed-date-input"]').fill('2026-12-25');
      await page.locator('[data-testid="avail-closed-dates"] button', { hasText: 'إضافة يوم إغلاق' }).click();
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForTimeout(2000);
      const avUi = (await loadService(authA))?.availabilityJson;
      record('P4_BROWSER_CLOSED_PERSISTED', Array.isArray(avUi?.closedDates) && avUi.closedDates.includes('2026-12-25'), {
        closedDates: avUi?.closedDates,
      });
      record('P4_BROWSER_WINDOWS_STILL_DUAL', Array.isArray(avUi?.windows) && avUi.windows.length >= 2, {
        windows: avUi?.windows?.length,
      });

      // Remove one period via UI
      const beforeRm = avUi?.windows?.length || 0;
      await page.goto(`${origin}/dashboard.html?api-base=${encodeURIComponent(portalApi)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForSelector('#catalogList .list-item', { timeout: 30000 });
      await page.locator('#catalogList .list-item', { hasText: 'خدمة مسودة' }).locator('button', { hasText: 'فتح في النموذج' }).first().click();
      await page.waitForSelector('[data-testid="avail-window-remove"]', { timeout: 20000 });
      await page.locator('[data-testid="avail-window-remove"]').first().click();
      await page.locator('#catalogForm button[type="submit"]').first().click();
      await page.waitForTimeout(2000);
      const avRm = (await loadService(authA))?.availabilityJson;
      record('P4_BROWSER_REMOVE_ONE_PERIOD', Array.isArray(avRm?.windows) && avRm.windows.length === beforeRm - 1, {
        beforeRm,
        after: avRm?.windows?.length,
      });

      // Duration change
      const dur = page.locator('input[name="durationMin"]').first();
      if (await dur.count()) {
        await dur.fill('50');
        await page.locator('#catalogForm button[type="submit"]').first().click();
        await page.waitForTimeout(2000);
      }
      const sDur = await loadService(authA);
      record('P4_BROWSER_DURATION', sDur?.durationMin === 50, {
        durationMin: sDur?.durationMin,
        expect: 50,
      });

      // Dual-session service edit conflict: A saves description, B tries stale overwrite.
      const tokenA2 = tokenA;
      const pageA2 = await browser.newPage();
      const pageB2 = await browser.newPage();
      await pageA2.addInitScript(({ token }) => localStorage.setItem('mira_partner_token', token), { token: tokenA2 });
      await pageB2.addInitScript(({ token }) => localStorage.setItem('mira_partner_token', token), { token: tokenA2 });
      const openSvc = async (page) => {
        await page.goto(`${origin}/dashboard.html?api-base=${encodeURIComponent(portalApi)}`, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        await page.waitForSelector('#catalogList .list-item', { timeout: 30000 });
        await page.locator('#catalogList .list-item', { hasText: 'خدمة مسودة' }).locator('button', { hasText: 'فتح في النموذج' }).first().click();
        await page.waitForSelector('[data-testid="avail-calendar-preview"]', { timeout: 20000 });
      };
      await openSvc(pageA2);
      await openSvc(pageB2);
      const descA = pageA2.locator('textarea[name="descriptionAr"], input[name="descriptionAr"]').first();
      const descB = pageB2.locator('textarea[name="descriptionAr"], input[name="descriptionAr"]').first();
      if ((await descA.count()) && (await descB.count())) {
        await descA.fill(`جلسة-أ ${run}`);
        await pageA2.locator('#catalogForm button[type="submit"]').first().click();
        await pageA2.waitForTimeout(2000);
        await descB.fill(`جلسة-ب قديمة ${run}`);
        await pageB2.locator('#catalogForm button[type="submit"]').first().click();
        await pageB2.waitForTimeout(2000);
        const afterConflict = await loadService(authA);
        const keptA = String(afterConflict?.descriptionAr || afterConflict?.draftDescriptionAr || '').includes(`جلسة-أ ${run}`);
        const silentB = String(afterConflict?.descriptionAr || '').includes(`جلسة-ب قديمة`);
        // Accepted behaviors: keep A, or surface conflict without silent B overwrite of A.
        record('P4_BROWSER_DUAL_SESSION_NO_SILENT_B', keptA && !silentB, {
          descriptionAr: afterConflict?.descriptionAr,
          draftDescriptionAr: afterConflict?.draftDescriptionAr,
        });
      } else {
        record('P4_BROWSER_DUAL_SESSION_NO_SILENT_B', false, { reason: 'description field missing' });
      }
      await pageA2.close();
      await pageB2.close();

      // Session B cannot open A's service in list
      const pageB = await browser.newPage();
      await pageB.addInitScript(({ token }) => localStorage.setItem('mira_partner_token', token), { token: tokenB });
      await pageB.goto(`${origin}/dashboard.html?api-base=${encodeURIComponent(portalApi)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await pageB.waitForTimeout(2000);
      const leakUi = await pageB.locator('#catalogList .list-item', { hasText: 'خدمة مسودة' }).count();
      record('P4_BROWSER_OWNERSHIP_ISOLATED', leakUi === 0, { leakUi });
      await pageB.close();

      await page.screenshot({ path: join(outDir, 'shots', `ui-final-${run}.png`), fullPage: true });
      writeFileSync(join(outDir, 'browser-net.json'), JSON.stringify(netLog, null, 2));
      await browser.close();
      server.close();
    } catch (e) {
      record('P4_BROWSER_JOURNEY', false, { error: String(e?.message || e).slice(0, 300) });
    }
  } finally {
    for (const c of cleanups.reverse()) {
      try {
        await c();
      } catch {
        /* ignore */
      }
    }
    await prisma.$disconnect().catch(() => undefined);
  }

  const failed = steps.filter((s) => s.ok === false);
  const summary = {
    ok: failed.length === 0,
    id: 'P4_AVAILABILITY_ACCEPTANCE',
    commit,
    runId,
    startedUtc,
    finishedUtc: new Date().toISOString(),
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'p4-availability-acceptance.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, 'verdict.txt'), summary.ok ? 'PASS\n' : 'FAIL\n');
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), outDir }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  writeFileSync(join(outDir, 'verdict.txt'), 'FAIL\n');
  writeFileSync(join(outDir, 'p4-availability-acceptance.json'), JSON.stringify({ ok: false, error: String(e) }, null, 2));
  process.exit(2);
});
