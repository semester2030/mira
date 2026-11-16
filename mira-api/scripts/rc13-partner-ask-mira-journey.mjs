#!/usr/bin/env node
/**
 * RC13 — fail-closed commercial-by-id partner → Ask Mira journey with commercial answer checks.
 * PASS only if catalog state AND recommendation content are correct.
 * SHA-256 is of the evidence file bytes on disk.
 *
 * Env: API_BASE, PARTNER_BEARER_TOKEN, CUSTOMER_BEARER_TOKEN, ADMIN_API_KEY (optional)
 * Optional: RUN_FLUTTER_LINK=1 to attempt Flutter link resolution (else link=BLOCKED).
 */
import { createHash, randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3000/api/v1').replace(/\/+$/, '');
const PARTNER = process.env.PARTNER_BEARER_TOKEN || '';
const ADMIN = process.env.ADMIN_API_KEY || '';
const CUSTOMER = process.env.CUSTOMER_BEARER_TOKEN || '';
const EVIDENCE = process.env.RC13_EVIDENCE_DIR || join(process.cwd(), '.rc13-evidence');
const RUN_FLUTTER_LINK = process.env.RUN_FLUTTER_LINK === '1';
mkdirSync(EVIDENCE, { recursive: true });

const log = [];
const createdIds = new Set();

function note(step, data = {}) {
  const row = { utc: new Date().toISOString(), step, ...data };
  log.push(row);
  console.log(JSON.stringify(row));
}

function fail(step, reason, detail = {}) {
  note('FAIL', { step, reason, ...detail });
  const body = {
    ok: false,
    round: 'RC13',
    failedStep: step,
    reason,
    ...detail,
    steps: log,
  };
  const path = join(EVIDENCE, 'RC13_PARTNER_ASK_MIRA_JOURNEY.json');
  writeFileSync(path, JSON.stringify(body, null, 2));
  const sha = createHash('sha256').update(readFileSync(path)).digest('hex');
  writeFileSync(join(EVIDENCE, 'RC13_PARTNER_ASK_MIRA_JOURNEY.sha256'), `${sha}\n`);
  console.error(`FAIL step=${step} reason=${reason} sha=${sha}`);
  process.exit(2);
}

async function req(path, { method = 'GET', token, admin, body } = {}) {
  const h = {};
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
    json = { raw: text.slice(0, 800) };
  }
  return { status: res.status, json };
}

function extractOffers(payload) {
  if (!payload) return [];
  return (
    payload.assistantMessage?.discoveryOffers ||
    payload.discoveryOffers ||
    payload.data?.assistantMessage?.discoveryOffers ||
    payload.data?.discoveryOffers ||
    []
  );
}

function extractText(payload) {
  return String(
    payload?.assistantMessage?.contentAr ||
      payload?.answerAr ||
      payload?.data?.assistantMessage?.contentAr ||
      payload?.data?.answerAr ||
      '',
  );
}

function isEngineDownText(text) {
  return /محرك الاستشارة غير متصل|غير مفعّل|discovery.*disabled|تعذّر الاتصال|service unavailable/i.test(
    text,
  );
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
    return { ok: false, status: res.status, error: await res.text(), payload: null, kind: 'http_error' };
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
      if (!raw || raw === '[DONE]') continue;
      try {
        const ev = JSON.parse(raw);
        if (ev?.assistantMessage || ev?.discoveryOffers || ev?.answerAr) finalPayload = ev;
        if (ev?.type === 'final' || ev?.done) finalPayload = ev.data ?? ev;
      } catch {
        /* ignore */
      }
    }
  }
  if (!finalPayload) {
    return { ok: false, status: 200, error: 'empty_sse_final_payload', payload: null, kind: 'empty' };
  }
  const text = extractText(finalPayload);
  if (isEngineDownText(text)) {
    return {
      ok: false,
      status: 200,
      error: 'engine_disconnected_generic',
      payload: finalPayload,
      kind: 'engine_down',
      text,
    };
  }
  return { ok: true, status: 200, payload: finalPayload, kind: 'ok', text };
}

function assertOwnedTarget(id, step) {
  if (!createdIds.has(id)) {
    fail(step, 'refuse mutate/withdraw of id not created by this run', {
      id,
      created: [...createdIds],
    });
  }
}

function stockIsExplicitlyOut(item) {
  if (typeof item?.stockAvailable === 'boolean') return item.stockAvailable === false;
  if (typeof item?.inStock === 'boolean') return item.inStock === false;
  if (item?.stockQty != null && Number.isFinite(Number(item.stockQty))) {
    return Number(item.stockQty) <= 0;
  }
  return null; // missing — not proof
}

async function publishProduct(nameAr, priceHalalas, stockQty) {
  const create = await req('/partners-portal/products', {
    method: 'POST',
    token: PARTNER,
    body: {
      nameAr,
      nameEn: `RC13 ${randomUUID().slice(0, 8)}`,
      descriptionAr: 'RC13 acceptance — owned by journey run',
      priceHalalas,
      externalUrl: 'https://example.invalid/rc13',
      concernTags: [],
      stockQty,
    },
  });
  if (create.status >= 400 || !create.json?.id) {
    fail('partner_create', 'POST products failed', { status: create.status, body: create.json });
  }
  const id = create.json.id;
  const partnerId = create.json.partnerId ?? create.json.partner_id;
  createdIds.add(id);
  const submit = await req(`/partners-portal/products/${id}/submit-review`, {
    method: 'POST',
    token: PARTNER,
  });
  if (submit.status >= 400) {
    fail('submit_review', 'submit-review failed', { id, status: submit.status, body: submit.json });
  }
  if (ADMIN) {
    const preview = await req(`/admin/catalog-reviews/product/${id}`, { admin: ADMIN });
    const rev = preview.json?.submittedRevision ?? preview.json?.reviewRevision ?? 1;
    const decision = await req(`/admin/catalog-reviews/product/${id}/decision`, {
      method: 'POST',
      admin: ADMIN,
      body: { decision: 'approve', revision: rev },
    });
    if (decision.status >= 400) {
      fail('admin_approve', 'approve failed', { id, status: decision.status, body: decision.json });
    }
  }
  const published = await req(`/marketplace/catalog/product/${id}`);
  if (published.status !== 200) {
    fail('catalog_get_after_publish', `expected 200 got ${published.status}`, { id });
  }
  if (Number(published.json?.priceHalalas) !== priceHalalas) {
    fail('catalog_price_after_publish', `expected ${priceHalalas}`, {
      got: published.json?.priceHalalas,
    });
  }
  return { id, partnerId, nameAr, published: published.json };
}

function assertCardIdentity(offer, expected, step) {
  if (!offer) fail(step, 'missing offer card');
  if (offer.id !== expected.id) {
    fail(step, 'card id mismatch', { expected: expected.id, got: offer.id });
  }
  if (expected.partnerId && offer.partnerId && offer.partnerId !== expected.partnerId) {
    fail(step, 'card partnerId mismatch', {
      expected: expected.partnerId,
      got: offer.partnerId,
    });
  }
}

/**
 * Commercial check by offer id + decision structure.
 * Explaining why #2 was excluded is NOT a recommendation.
 * «خذي الخيار رقم ٢» when #2 is excluded → FAIL.
 */
function assertDoesNotCommerciallyRecommend(text, offers, targetId, targetTitle, secondOrdinalId) {
  const hit = offers.find((o) => o.id === targetId);
  if (hit && (hit.action === 'buy' || hit.action === 'book' || hit.actionLabelAr === 'اطلبي')) {
    fail('which_fits_buy_cta', 'excluded id still has buy/book CTA', { hit, targetId });
  }
  // Structured pick: «الأنسب … هو الثاني «title»»
  const pickMatch = text.match(
    /الأنسب لكِ?\s+من العروض الظاهرة هو\s+(الأول|الثاني|الثالث)\s+«([^»]+)»/,
  );
  if (pickMatch) {
    const ord = pickMatch[1];
    const title = pickMatch[2];
    const idx = ord === 'الأول' ? 0 : ord === 'الثاني' ? 1 : 2;
    if (offers[idx]?.id === targetId || title === targetTitle) {
      fail('which_fits_pick_excluded', 'structured pick recommends excluded id', {
        targetId,
        title,
        ord,
      });
    }
  }
  if (
    /خذي الخيار رقم\s*[٢2]|الخيار رقم\s*[٢2].*الأفضل|رقم\s*[٢2]،?\s*هو الأفضل|أنصحك بالخيار الثاني|انصحك بالخيار الثاني|الخيار الثاني،?\s*اشتريه|اشتريه اليوم/.test(
      text,
    )
  ) {
    if (secondOrdinalId === targetId) {
      fail('which_fits_numeric_second', 'numeric/advise second maps to excluded id', {
        targetId,
        text: text.slice(0, 300),
      });
    }
  }
  // Exclusion explanation is allowed (without a buy CTA).
  if (
    /استبعد|لا أرشّح|لا يناسب|نافد|فوق الميزانية/.test(text) &&
    /الثاني|رقم\s*[٢2]/.test(text) &&
    !/اشتريه|اطلبيه|أنصحك بالخيار الثاني/.test(text)
  ) {
    note('which_fits_exclusion_explained', { targetId });
    return;
  }
  if (
    /أرشح لكِ?\s*الثاني|اطلبيه الآن|اطلبي الثاني|أنصحك بالخيار الثاني/.test(text) &&
    secondOrdinalId === targetId
  ) {
    fail('which_fits_commercial', 'phrase recommends excluded second', {
      targetId,
      text: text.slice(0, 400),
    });
  }
}

async function main() {
  note('start', { API_BASE, round: 'RC13' });

  let health;
  try {
    health = await req('/health');
  } catch (e) {
    fail('health', 'API unreachable', { error: String(e) });
  }
  note('health', { status: health.status });
  if (![200, 401, 403].includes(health.status)) {
    fail('health', `unexpected health status ${health.status}`);
  }
  if (!PARTNER) fail('env', 'PARTNER_BEARER_TOKEN missing');
  if (!CUSTOMER) fail('env', 'CUSTOMER_BEARER_TOKEN missing');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const nameA = `مرطب RC13 أولا ${stamp}`;
  const nameB = `مرطب RC13 ثاني ${stamp}`;

  const a = await publishProduct(nameA, 3999, 3);
  note('published_a', { id: a.id, partnerId: a.partnerId });
  const b = await publishProduct(nameB, 4999, 5);
  note('published_b', { id: b.id, partnerId: b.partnerId, priceHalalas: 4999 });

  const session = await req('/consultation/sessions', {
    method: 'POST',
    token: CUSTOMER,
    body: { statedGoalAr: 'ميزانية حتى 50 ريال' },
  });
  if (session.status >= 400 || !session.json?.id) {
    fail('session_create', 'customer session failed', { status: session.status, body: session.json });
  }
  const sessionId = session.json.id;
  note('session_create', { id: sessionId });

  const turnB = await readSseAssistant(sessionId, `أبي ${nameB}`, `rc13-${randomUUID()}`);
  if (!turnB.ok) {
    fail('sse_search_b', `SSE failed (${turnB.kind})`, {
      status: turnB.status,
      error: turnB.error,
      text: turnB.text,
    });
  }
  const offersB = extractOffers(turnB.payload);
  const hitB = offersB.find((o) => o.id === b.id);
  if (!hitB) fail('sse_find_b', 'named search did not return product B', { offers: offersB });
  assertCardIdentity(hitB, b, 'sse_card_b_identity');
  const priceOk =
    Number(hitB.priceSar) === 49.99 ||
    Number(hitB.priceHalalas) === 4999 ||
    Math.round(Number(hitB.priceSar) * 100) === 4999;
  if (!priceOk) fail('sse_price_b', 'card price is not 49.99', { hit: hitB });

  // Obtain a two-card turn that includes both owned ids
  let offers = [];
  const turnStamp = await readSseAssistant(sessionId, `أبي RC13 ${stamp}`, `rc13-${randomUUID()}`);
  if (!turnStamp.ok) {
    fail('sse_search_stamp', `SSE failed (${turnStamp.kind})`, { error: turnStamp.error });
  }
  offers = extractOffers(turnStamp.payload);
  if (offers.length < 2 || !offers.some((o) => o.id === a.id) || !offers.some((o) => o.id === b.id)) {
    // Force order A then B via sequential named asks — lastOffers is last browse only,
    // so require one browse with both. Fail closed.
    fail('sse_two_owned_offers', 'need both owned offers in one turn', {
      offerIds: offers.map((o) => o.id),
      owned: [a.id, b.id],
    });
  }
  for (const o of offers) {
    if (o.id === a.id) assertCardIdentity(o, a, 'card_a_in_list');
    if (o.id === b.id) assertCardIdentity(o, b, 'card_b_in_list');
  }

  const second = offers[1];
  if (!second?.id) fail('ordinal_second', 'no second card');
  assertOwnedTarget(second.id, 'second_not_owned');
  const targetId = second.id;
  const targetMeta = targetId === b.id ? b : a;
  note('second_card', {
    targetId,
    partnerId: second.partnerId ?? targetMeta.partnerId,
    titleAr: second.titleAr,
  });

  // PATCH → 90 SAR / stock 0
  assertOwnedTarget(targetId, 'patch_not_owned');
  const patch = await req(`/partners-portal/products/${targetId}`, {
    method: 'PATCH',
    token: PARTNER,
    body: { priceHalalas: 9000, stockQty: 0 },
  });
  note('partner_patch', { status: patch.status, targetId });
  if (patch.status >= 400) {
    fail('partner_patch', `PATCH failed status=${patch.status}`, { body: patch.json });
  }
  if (ADMIN) {
    await req(`/partners-portal/products/${targetId}/submit-review`, { method: 'POST', token: PARTNER });
    const preview = await req(`/admin/catalog-reviews/product/${targetId}`, { admin: ADMIN });
    const rev = preview.json?.submittedRevision ?? 1;
    const dec = await req(`/admin/catalog-reviews/product/${targetId}/decision`, {
      method: 'POST',
      admin: ADMIN,
      body: { decision: 'approve', revision: rev },
    });
    if (dec.status >= 400) {
      fail('partner_patch_approve', 'approve after patch failed', { status: dec.status });
    }
  }

  const afterPatch = await req(`/marketplace/catalog/product/${targetId}`);
  if (afterPatch.status !== 200) {
    fail('catalog_after_patch', `expected 200 got ${afterPatch.status}`);
  }
  if (Number(afterPatch.json?.priceHalalas) !== 9000) {
    fail('catalog_price_after_patch', 'price not 9000 halalas', {
      got: afterPatch.json?.priceHalalas,
    });
  }
  const stockOut = stockIsExplicitlyOut(afterPatch.json);
  if (stockOut !== true) {
    fail('catalog_stock_after_patch', 'need explicit out-of-stock proof (missing field ≠ proof)', {
      stockOut,
      body: afterPatch.json,
    });
  }
  note('catalog_after_patch_ok', {
    priceHalalas: afterPatch.json?.priceHalalas,
    stockAvailable: afterPatch.json?.stockAvailable,
    inStock: afterPatch.json?.inStock,
    stockQty: afterPatch.json?.stockQty,
  });

  const which = await readSseAssistant(sessionId, 'أيهم أنسب لي؟', `rc13-${randomUUID()}`);
  if (!which.ok) {
    fail('which_fits_sse', `SSE failed (${which.kind}) — not commercial success`, {
      error: which.error,
      text: which.text,
    });
  }
  const whichText = which.text || extractText(which.payload);
  const whichOffers = extractOffers(which.payload);
  note('which_fits', {
    text: whichText.slice(0, 400),
    offerActions: whichOffers.map((o) => ({ id: o.id, action: o.action, inStock: o.inStock })),
  });
  assertDoesNotCommerciallyRecommend(
    whichText,
    whichOffers,
    targetId,
    targetMeta.nameAr,
    second.id,
  );
  // Target must not be recommended as fit; if present as liveness card, action must be view.
  const targetCard = whichOffers.find((o) => o.id === targetId);
  if (targetCard && (targetCard.action === 'buy' || targetCard.action === 'book')) {
    fail('which_fits_action', 'excluded id still action=buy/book', { targetCard });
  }

  // Withdraw
  assertOwnedTarget(targetId, 'withdraw_not_owned');
  if (ADMIN) {
    const preview = await req(`/admin/catalog-reviews/product/${targetId}`, { admin: ADMIN });
    const rev = preview.json?.submittedRevision ?? preview.json?.reviewRevision ?? 1;
    const wd = await req(`/admin/catalog-reviews/product/${targetId}/decision`, {
      method: 'POST',
      admin: ADMIN,
      body: { decision: 'withdraw', revision: rev },
    });
    note('withdraw', { status: wd.status });
    if (wd.status >= 400) fail('withdraw', `withdraw failed ${wd.status}`, { body: wd.json });
  } else {
    const del = await req(`/partners-portal/products/${targetId}`, { method: 'DELETE', token: PARTNER });
    note('withdraw_delete', { status: del.status });
    if (del.status >= 400) fail('withdraw', `DELETE failed ${del.status}`, { body: del.json });
  }

  const gone = await req(`/marketplace/catalog/product/${targetId}`);
  note('catalog_after_withdraw', { status: gone.status });
  if (gone.status === 200) {
    fail('catalog_still_published', 'product still returns 200 after withdraw', { body: gone.json });
  }
  if (![404, 410].includes(gone.status)) {
    fail('catalog_after_withdraw_status', `unexpected status ${gone.status}`);
  }

  // Flutter link resolution — independent BLOCKED if not run
  let linkResult = { status: 'BLOCKED', reason: 'RUN_FLUTTER_LINK not set; Flutter link not executed' };
  if (RUN_FLUTTER_LINK) {
    const flutterRoot = process.env.FLUTTER_ROOT || join(process.cwd(), '..');
    const r = spawnSync(
      'flutter',
      ['test', 'test/advisor/mira_offer_link_resolver_test.dart'],
      { cwd: flutterRoot, encoding: 'utf8', timeout: 120000 },
    );
    linkResult = {
      status: r.status === 0 ? 'PASS' : 'FAIL',
      exit: r.status,
      tail: (r.stdout || r.stderr || '').slice(-800),
    };
    if (r.status !== 0) {
      fail('flutter_link', 'Flutter link tests failed', linkResult);
    }
  } else {
    note('link_flutter_blocked', linkResult);
  }

  const session2 = await req('/consultation/sessions', {
    method: 'POST',
    token: CUSTOMER,
    body: {},
  });
  if (session2.status >= 400 || !session2.json?.id) {
    fail('session2_create', 'second session failed', { status: session2.status, body: session2.json });
  }
  const search2 = await readSseAssistant(
    session2.json.id,
    `أبي ${targetMeta.nameAr}`,
    `rc13-${randomUUID()}`,
  );
  if (!search2.ok) {
    // Distinguish engine down / empty from honest no-match
    if (search2.kind === 'engine_down' || search2.kind === 'empty' || search2.kind === 'http_error') {
      fail('session2_search_unavailable', 'search unavailable — not counted as no-match success', {
        kind: search2.kind,
        error: search2.error,
        text: search2.text,
      });
    }
    fail('session2_sse', 'second session SSE failed', { error: search2.error });
  }
  const text2 = search2.text || extractText(search2.payload);
  const offers2 = extractOffers(search2.payload);
  const searchFailed =
    search2.payload?.searchFailed === true ||
    search2.payload?.assistantMessage?.searchFailed === true ||
    search2.payload?.data?.searchFailed === true;
  if (searchFailed || isEngineDownText(text2)) {
    fail('session2_search_unavailable', 'searchFailed/engine down ≠ no match', { text: text2 });
  }
  if (/أهلًا بك|كيف أساعدك/.test(text2) && offers2.length === 0) {
    fail('session2_greeting_not_search', 'generic greeting is not successful no-match', {
      text: text2.slice(0, 200),
    });
  }
  if (offers2.some((o) => o.id === targetId)) {
    fail('session2_still_recommends', 'new session still returned withdrawn id');
  }
  note('session2_no_match_ok', { offerCount: offers2.length, text: text2.slice(0, 240) });

  const commercialApiPassed = true;
  const flutterLinkPassed = linkResult.status === 'PASS';
  const flutterLinkBlocked = linkResult.status === 'BLOCKED';
  const journeyComplete = commercialApiPassed && flutterLinkPassed;

  const evidence = {
    ok: commercialApiPassed,
    round: 'RC13',
    commercialApiPassed,
    flutterLinkPassed,
    flutterLinkBlocked,
    journeyComplete,
    productA: { id: a.id, partnerId: a.partnerId, nameAr: nameA },
    productB: { id: b.id, partnerId: b.partnerId, nameAr: nameB },
    secondCard: {
      id: targetId,
      partnerId: second.partnerId ?? targetMeta.partnerId,
      titleAr: second.titleAr,
    },
    linkFlutter: linkResult,
    steps: log,
  };
  if (!journeyComplete) {
    evidence.blocked = [
      ...(flutterLinkBlocked ? ['flutter_link'] : []),
      ...(linkResult.status === 'FAIL' ? ['flutter_link_fail'] : []),
    ];
    evidence.note =
      'commercialApiPassed and flutterLinkPassed are separate; journeyComplete requires both.';
  }
  const path = join(EVIDENCE, 'RC13_PARTNER_ASK_MIRA_JOURNEY.json');
  writeFileSync(path, JSON.stringify(evidence, null, 2));
  const sha = createHash('sha256').update(readFileSync(path)).digest('hex');
  writeFileSync(join(EVIDENCE, 'RC13_PARTNER_ASK_MIRA_JOURNEY.sha256'), `${sha}\n`);
  note(journeyComplete ? 'PASS' : 'PASS_COMMERCIAL_ONLY', {
    path,
    sha,
    commercialApiPassed,
    flutterLinkPassed,
    journeyComplete,
  });
  console.log(
    journeyComplete ? 'PASS' : 'PASS_COMMERCIAL_ONLY',
    sha,
    'journeyComplete=',
    journeyComplete,
  );
}

main().catch((e) => {
  fail('script_crash', String(e));
});
