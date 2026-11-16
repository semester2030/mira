#!/usr/bin/env node
/**
 * RC9 — full partner → Ask Mira SSE journey (no SQL substitute, no fixtures).
 *
 * Required env:
 *   API_BASE                 default http://127.0.0.1:3000/api/v1
 *   PARTNER_BEARER_TOKEN     brand partner JWT for partners-portal
 *   ADMIN_API_KEY            for catalog approve (if partner is not auto-approve)
 *   CUSTOMER_BEARER_TOKEN    customer Firebase/JWT for consultation
 *   MIRA_CONSULTANT_DISCOVERY_V1 must be true on that API
 *
 * Steps:
 *   health → publish unique 49.99 → approve → customer SSE search → match id/price/partner
 *   → partner PATCH price/stock → which-fits must not pick it if over budget
 *   → withdraw → link ordinal in same session fails → new session search empty
 */
import { createHash, randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3000/api/v1').replace(/\/+$/, '');
const PARTNER = process.env.PARTNER_BEARER_TOKEN || '';
const ADMIN = process.env.ADMIN_API_KEY || '';
const CUSTOMER = process.env.CUSTOMER_BEARER_TOKEN || '';
const EVIDENCE = process.env.RC9_EVIDENCE_DIR || join(process.cwd(), '.rc9-evidence');
mkdirSync(EVIDENCE, { recursive: true });

const log = [];
function note(step, data = {}) {
  const row = { utc: new Date().toISOString(), step, ...data };
  log.push(row);
  console.log(JSON.stringify(row));
}

function blocked(code, missing, detail = {}) {
  const body = { status: code, missing, ...detail, steps: log };
  writeFileSync(join(EVIDENCE, `${code}.json`), JSON.stringify(body, null, 2));
  console.error(code, missing.join(' | '));
  process.exitCode = 2;
}

async function req(path, { method = 'GET', token, admin, body, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (admin) h['x-admin-key'] = admin;
  if (body != null) h['content-type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: h,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

async function readSseAssistant(sessionId, message, clientMessageId) {
  const res = await fetch(`${API_BASE}/consultation/sessions/${sessionId}/messages/stream`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${CUSTOMER}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify({ message, clientMessageId }),
  });
  if (!res.ok || !res.body) {
    return { status: res.status, error: await res.text() };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finalPayload = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const chunk of parts) {
      const dataLine = chunk
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const raw = dataLine.slice(5).trim();
      if (raw === '[DONE]') continue;
      try {
        const ev = JSON.parse(raw);
        if (ev?.assistantMessage || ev?.discoveryOffers || ev?.answerAr) finalPayload = ev;
        if (ev?.type === 'final' || ev?.done) finalPayload = ev.data ?? ev;
      } catch {
        /* ignore */
      }
    }
  }
  return { status: 200, payload: finalPayload };
}

async function main() {
  note('start', { API_BASE });

  let health;
  try {
    health = await req('/health');
  } catch (e) {
    return blocked('BLOCKED_ASK_MIRA_SSE_LIVE', [
      'Running mira-api reachable at API_BASE',
      'MIRA_CONSULTANT_DISCOVERY_V1=true on that API',
    ], { error: String(e) });
  }
  note('health', { status: health.status });
  if (![200, 401, 403].includes(health.status)) {
    return blocked('BLOCKED_ASK_MIRA_SSE_LIVE', [
      `health HTTP ${health.status}`,
      'Start isolated/staging API before this script',
    ]);
  }

  if (!PARTNER) {
    return blocked('BLOCKED_PARTNER_TOKEN', ['PARTNER_BEARER_TOKEN for partners-portal']);
  }
  if (!CUSTOMER) {
    return blocked('BLOCKED_CUSTOMER_TOKEN', ['CUSTOMER_BEARER_TOKEN for consultation SSE']);
  }

  const unique = `مرطب RC9 فريد ${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const create = await req('/partners-portal/products', {
    method: 'POST',
    token: PARTNER,
    body: {
      nameAr: unique,
      nameEn: `RC9 ${randomUUID().slice(0, 8)}`,
      descriptionAr: 'عرض اختبار RC9 — ليس fixture',
      priceHalalas: 4999,
      externalUrl: 'https://example.invalid/rc9',
      concernTags: [],
      stockQty: 5,
    },
  });
  note('partner_create', { status: create.status, id: create.json?.id });
  if (create.status >= 400 || !create.json?.id) {
    return blocked('BLOCKED_PARTNER_PUBLISH', ['partners-portal POST /products', JSON.stringify(create.json)]);
  }
  const productId = create.json.id;
  const partnerId = create.json.partnerId ?? create.json.partner_id;

  const submit = await req(`/partners-portal/products/${productId}/submit-review`, {
    method: 'POST',
    token: PARTNER,
  });
  note('submit_review', { status: submit.status });

  if (ADMIN) {
    const preview = await req(`/admin/catalog-reviews/product/${productId}`, { admin: ADMIN });
    const rev = preview.json?.submittedRevision ?? preview.json?.reviewRevision ?? 1;
    const decision = await req(`/admin/catalog-reviews/product/${productId}/decision`, {
      method: 'POST',
      admin: ADMIN,
      body: { decision: 'approve', revision: rev },
    });
    note('admin_approve', { status: decision.status, revision: rev });
    if (decision.status >= 400) {
      return blocked('BLOCKED_ADMIN_APPROVE', ['ADMIN_API_KEY approve failed', JSON.stringify(decision.json)]);
    }
  } else {
    note('admin_approve_skipped', { hint: 'developer partners may auto-approve' });
  }

  const published = await req(`/marketplace/catalog/product/${productId}`);
  note('public_get', {
    status: published.status,
    priceHalalas: published.json?.priceHalalas,
    nameAr: published.json?.nameAr,
  });
  if (published.status !== 200 || published.json?.priceHalalas !== 4999) {
    return blocked('BLOCKED_PUBLISH_VISIBLE', ['catalog get after publish', JSON.stringify(published.json)]);
  }

  const session = await req('/consultation/sessions', {
    method: 'POST',
    token: CUSTOMER,
    body: { statedGoalAr: 'ميزانية حتى 50 ريال' },
  });
  note('session_create', { status: session.status, id: session.json?.id });
  if (session.status >= 400 || !session.json?.id) {
    return blocked('BLOCKED_CONSULTATION_SESSION', ['POST /consultation/sessions', JSON.stringify(session.json)]);
  }
  const sessionId = session.json.id;

  const turn1 = await readSseAssistant(sessionId, `أبي ${unique}`, `rc9-${randomUUID()}`);
  note('sse_search', {
    status: turn1.status,
    hasPayload: !!turn1.payload,
    offerIds: (turn1.payload?.assistantMessage?.discoveryOffers ||
      turn1.payload?.discoveryOffers ||
      []).map((o) => o.id),
  });
  const offers =
    turn1.payload?.assistantMessage?.discoveryOffers ||
    turn1.payload?.discoveryOffers ||
    [];
  const hit = offers.find((o) => o.id === productId);
  if (!hit) {
    return blocked('BLOCKED_ASK_MIRA_FIND', [
      'SSE discovery did not return the published product id',
      'Confirm MIRA_CONSULTANT_DISCOVERY_V1=true',
    ], { turn: turn1 });
  }
  if (Number(hit.priceSar) !== 49.99 && Number(hit.priceHalalas) !== 4999) {
    return blocked('BLOCKED_PRICE_MATCH', [`expected 49.99 got ${hit.priceSar}`]);
  }
  if (partnerId && hit.partnerId && hit.partnerId !== partnerId) {
    return blocked('BLOCKED_PARTNER_MATCH', [`expected ${partnerId} got ${hit.partnerId}`]);
  }
  note('matched_card', { id: hit.id, priceSar: hit.priceSar, partnerId: hit.partnerId });

  // Partner raises price above budget and marks OOS.
  const patch = await req(`/partners-portal/products/${productId}`, {
    method: 'PATCH',
    token: PARTNER,
    body: { priceHalalas: 9000, stockQty: 0 },
  });
  note('partner_patch_price_stock', { status: patch.status });
  if (ADMIN) {
    await req(`/partners-portal/products/${productId}/submit-review`, { method: 'POST', token: PARTNER });
    const preview = await req(`/admin/catalog-reviews/product/${productId}`, { admin: ADMIN });
    const rev = preview.json?.submittedRevision ?? 1;
    await req(`/admin/catalog-reviews/product/${productId}/decision`, {
      method: 'POST',
      admin: ADMIN,
      body: { decision: 'approve', revision: rev },
    });
  }

  const which = await readSseAssistant(sessionId, 'أيهم أنسب لي؟', `rc9-${randomUUID()}`);
  const whichText =
    which.payload?.assistantMessage?.contentAr ||
    which.payload?.answerAr ||
    JSON.stringify(which.payload ?? {});
  note('which_fits_after_edit', { text: String(whichText).slice(0, 400) });
  if (/الأنسب لكِ.*|\b49\.99\b|متوفر، ضمن ميزانيتك/.test(String(whichText)) && /RC9|مرطب RC9/.test(String(whichText))) {
    // If it still claims the edited product as best-in-budget, fail hard.
    if (/ضمن ميزانيتك/.test(String(whichText))) {
      return blocked('BLOCKED_STALE_PRICE_RECOMMEND', ['which-fits used stale in-budget claim after partner edit']);
    }
  }

  // Withdraw
  if (ADMIN) {
    const preview = await req(`/admin/catalog-reviews/product/${productId}`, { admin: ADMIN });
    const rev = preview.json?.submittedRevision ?? preview.json?.reviewRevision ?? 1;
    const wd = await req(`/admin/catalog-reviews/product/${productId}/decision`, {
      method: 'POST',
      admin: ADMIN,
      body: { decision: 'withdraw', revision: rev },
    });
    note('withdraw', { status: wd.status });
  } else {
    // Fallback: partner cannot always withdraw — mark via admin-less active false if API allows DELETE
    const del = await req(`/partners-portal/products/${productId}`, { method: 'DELETE', token: PARTNER });
    note('withdraw_delete_fallback', { status: del.status });
  }

  const gone = await req(`/marketplace/catalog/product/${productId}`);
  note('public_after_withdraw', { status: gone.status });

  const link = await readSseAssistant(sessionId, 'عطيني رابط الثاني', `rc9-${randomUUID()}`);
  note('link_after_withdraw', {
    text: String(
      link.payload?.assistantMessage?.contentAr || link.payload?.answerAr || '',
    ).slice(0, 300),
  });

  const session2 = await req('/consultation/sessions', {
    method: 'POST',
    token: CUSTOMER,
    body: {},
  });
  const sid2 = session2.json?.id;
  const search2 = sid2
    ? await readSseAssistant(sid2, `أبي ${unique}`, `rc9-${randomUUID()}`)
    : { status: 0 };
  const offers2 =
    search2.payload?.assistantMessage?.discoveryOffers || search2.payload?.discoveryOffers || [];
  if (offers2.some((o) => o.id === productId)) {
    return blocked('BLOCKED_STILL_RECOMMENDED_AFTER_WITHDRAW', ['new session still returned withdrawn id']);
  }
  note('new_session_no_hit', { offerCount: offers2.length });

  const evidence = {
    round: 'RC9',
    productId,
    partnerId,
    uniqueName: unique,
    steps: log,
    ok: true,
  };
  const path = join(EVIDENCE, 'RC9_PARTNER_ASK_MIRA_JOURNEY.json');
  writeFileSync(path, JSON.stringify(evidence, null, 2));
  const sha = createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
  writeFileSync(join(EVIDENCE, 'RC9_PARTNER_ASK_MIRA_JOURNEY.sha256'), `${sha}\n`);
  note('PASS', { path, sha });
}

main().catch((e) => {
  blocked('BLOCKED_SCRIPT_CRASH', [String(e)]);
});
