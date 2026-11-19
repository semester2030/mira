#!/usr/bin/env node
/**
 * Portal-API journey using the same partners-portal routes the center UI calls.
 * Serves candidate partners-portal static files with mira-api-base → local test API.
 * Does not print bearer tokens.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const API_ROOT = join(ROOT, 'mira-api');
const PORTAL_ROOT = join(ROOT, 'partners-portal/web');
const EV = join(ROOT, 'evidence/unified-prod-release-20261119/raw');
mkdirSync(EV, { recursive: true });

const API_PORT = Number(process.env.API_PORT || 3031);
const WEB_PORT = Number(process.env.WEB_PORT || 8031);
const API_BASE = `http://127.0.0.1:${API_PORT}/api/v1`;
const PARTNER = (process.env.PARTNER_BEARER_TOKEN || '').trim();
const ADMIN = (process.env.ADMIN_API_KEY || 'p1-rc7-admin').trim();

if (!PARTNER) {
  console.error('PARTNER_BEARER_TOKEN required');
  process.exit(2);
}

const steps = [];
function note(step, data = {}) {
  const row = { utc: new Date().toISOString(), step, ...data };
  steps.push(row);
  console.log(JSON.stringify({ step, ...data }));
}

async function req(path, { method = 'GET', token, admin, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (admin) headers['x-admin-key'] = admin;
  if (body != null) headers['content-type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, json };
}

function mime(p) {
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    }[extname(p)] || 'application/octet-stream'
  );
}

function startPortal() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const file = join(PORTAL_ROOT, urlPath.replace(/^\//, ''));
      if (!file.startsWith(PORTAL_ROOT) || !existsSync(file)) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      let buf = readFileSync(file);
      if (extname(file) === '.html') {
        let html = buf.toString('utf8');
        html = html.replace(
          /content="https:\/\/mira-api-n4p3\.onrender\.com\/api\/v1"/g,
          `content="${API_BASE}"`,
        );
        html = html.replace(
          /https:\/\/mira-api-n4p3\.onrender\.com\/api\/v1/g,
          API_BASE,
        );
        buf = Buffer.from(html, 'utf8');
      }
      res.writeHead(200, { 'content-type': mime(file) });
      res.end(buf);
    });
    server.listen(WEB_PORT, '127.0.0.1', () => resolve(server));
  });
}

function startApi() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['dist/main.js'],
      {
        cwd: API_ROOT,
        env: {
          ...process.env,
          PORT: String(API_PORT),
          DATABASE_URL:
            process.env.DATABASE_URL ||
            'postgresql://mira:mira_secret@localhost:5432/mira_p1_rc7_test',
          MIRA_PARTNER_EDITOR_V2: 'true',
          ADMIN_API_KEY: ADMIN,
          AUTH_SKIP: 'false',
          NODE_ENV: 'development',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let ready = false;
    const onData = (buf) => {
      const s = buf.toString();
      if (!ready && /Nest application successfully started|listening/i.test(s)) {
        ready = true;
        resolve(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      if (!ready) reject(new Error(`api exited ${code}`));
    });
    setTimeout(() => {
      if (!ready) resolve(child); // health poll will decide
    }, 25000);
  });
}

async function waitHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${API_BASE}/health`);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const api = await startApi();
  const portal = await startPortal();
  const okHealth = await waitHealth();
  note('health', { ok: okHealth, api: API_BASE, portal: `http://127.0.0.1:${WEB_PORT}/dashboard.html` });
  if (!okHealth) {
    writeFileSync(join(EV, 'portal_journey.json'), JSON.stringify({ ok: false, steps }, null, 2));
    portal.close();
    api.kill('SIGTERM');
    process.exit(1);
  }

  const me = await req('/partners-portal/me', { token: PARTNER });
  note('portal_me', { status: me.status, partnerId: me.json?.partner?.id || me.json?.id || null });

  const created = [];
  for (const name of ['تنظيف اختبار إصدار', 'ترطيب اختبار إصدار']) {
    const create = await req('/partners-portal/services', {
      method: 'POST',
      token: PARTNER,
      body: {
        nameAr: name,
        nameEn: `unified-${Date.now()}`,
        durationMin: 45,
        priceHalalas: name.startsWith('تنظيف') ? 15000 : 12000,
        bookingEnabled: true,
        category: 'hair',
        profileId: 'service.salon_hair_cut',
        placeMode: 'branch',
        availabilityJson: [
          { weekday: 0, startMin: 540, endMin: 1020, capacity: 2, resourceId: 'غرفة-1' },
          { weekday: 1, startMin: 540, endMin: 1020, capacity: 2, resourceId: 'غرفة-1' },
          { weekday: 2, startMin: 540, endMin: 1020, capacity: 2, resourceId: 'غرفة-1' },
          { weekday: 3, startMin: 540, endMin: 1020, capacity: 2, resourceId: 'غرفة-1' },
          { weekday: 4, startMin: 540, endMin: 1020, capacity: 2, resourceId: 'غرفة-1' },
        ],
      },
    });
    const id = create.json?.id || create.json?.service?.id;
    note('create_service', { status: create.status, nameAr: name, id: id || null, err: create.json?.message || create.json?.code || null });
    if (!id) continue;
    created.push({ id, nameAr: name });
    const submit = await req(`/partners-portal/services/${id}/submit-review`, {
      method: 'POST',
      token: PARTNER,
      body: {},
    });
    note('submit_review', { id, status: submit.status, contentStatus: submit.json?.contentStatus || submit.json?.service?.contentStatus, err: submit.json?.message || null });
    const patch = await req(`/partners-portal/services/${id}`, {
      method: 'PATCH',
      token: PARTNER,
      body: { bookingEnabled: true },
    });
    note('patch_bookable', { id, status: patch.status, contentStatus: patch.json?.contentStatus, bookingEnabled: patch.json?.bookingEnabled, err: patch.json?.message || null });
  }

  if (created.length >= 1) {
    const target = created[0];
    const close = await req(`/partners-portal/services/${target.id}`, {
      method: 'PATCH',
      token: PARTNER,
      body: { bookingEnabled: false, expectedRevision: 1 },
    });
    note('close_booking', {
      id: target.id,
      status: close.status,
      bookingEnabled: close.json?.bookingEnabled ?? close.json?.service?.bookingEnabled,
      contentStatus: close.json?.contentStatus ?? close.json?.service?.contentStatus,
    });

    const withdraw = await req(`/partners-portal/services/${target.id}`, {
      method: 'DELETE',
      token: PARTNER,
    });
    note('withdraw', {
      id: target.id,
      status: withdraw.status,
      contentStatus: withdraw.json?.contentStatus ?? withdraw.json?.service?.contentStatus,
      ok: withdraw.json?.ok,
    });
  }

  // Prove candidate portal HTML was rewritten to test API
  const dash = await fetch(`http://127.0.0.1:${WEB_PORT}/dashboard.html`).then((r) => r.text());
  note('portal_html_api_base', {
    pointsToTestApi: dash.includes(API_BASE),
    hasProdApi: dash.includes('mira-api-n4p3.onrender.com'),
  });

  const out = {
    ok: steps.some((s) => s.step === 'create_service' && s.id) && steps.some((s) => s.step === 'withdraw'),
    apiBase: API_BASE,
    portalUrl: `http://127.0.0.1:${WEB_PORT}/dashboard.html`,
    steps,
  };
  writeFileSync(join(EV, 'portal_journey.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ done: true, ok: out.ok }));
  portal.close();
  api.kill('SIGTERM');
  process.exit(out.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
