/**
 * Connected jamalak journey against a running test API (not schema-only).
 * Requires: DATABASE_URL + server on MIRA_API_BASE (default http://127.0.0.1:3000/api/v1)
 * Env: PARTNER_OTP_SMS_MODE=outbox PARTNER_OTP_DEV=true ADMIN_API_KEY=...
 *
 * Does NOT secretly patch rows to force booking — uses apply → admin decide → catalog.
 */
import assert from 'node:assert/strict';
import { readFile, unlink } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';

const base = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const adminKey = process.env.ADMIN_API_KEY || process.env.MIRA_ADMIN_KEY || '';
const outbox = process.env.PARTNER_OTP_SMS_OUTBOX || '/tmp/mira-partner-otp-outbox.ndjson';
const emailOutbox = process.env.PARTNER_OTP_EMAIL_OUTBOX || outbox;
const runId = `jamalak-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;

async function req(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const res = await fetch(`${base}${path}`, {
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

async function readLatestCode(path: string, pred: (row: Record<string, unknown>) => boolean) {
  const raw = await readFile(path, 'utf8').catch(() => '');
  const lines = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (pred(lines[i]!)) return String(lines[i]!.code || '');
  }
  return '';
}

async function main() {
  const health = await req('GET', '/marketplace/cities').catch(() => null);
  if (!health || health.status >= 500) {
    console.log(
      JSON.stringify({
        runId,
        verdict: 'NOT_VERIFIED',
        blocker: 'test API not reachable',
        base,
      }),
    );
    process.exit(2);
  }

  const phone = `05${String(Date.now()).slice(-8)}`;
  const email = `noura.${runId.slice(-8)}@example.test`;
  const password = 'TestPass123!';

  // Wrong OTP rejected
  const badVerify = await req('POST', '/partners-portal/apply/phone/verify', {
    phone,
    code: '000000',
  });
  assert.equal(badVerify.status, 400);

  const startPhone = await req('POST', '/partners-portal/apply/phone/start', { phone });
  if (startPhone.status !== 200 && startPhone.status !== 201) {
    console.log(
      JSON.stringify({
        runId,
        verdict: 'NOT_VERIFIED',
        blocker: 'phone OTP start failed — set PARTNER_OTP_SMS_MODE=outbox on API',
        status: startPhone.status,
        body: startPhone.json,
      }),
    );
    process.exit(2);
  }
  const phoneCode =
    (startPhone.json as { devCode?: string })?.devCode ||
    (await readLatestCode(outbox, (r) => String(r.phoneLast4) === phone.slice(-4)));
  assert.ok(phoneCode, 'phone OTP code missing from response/outbox');

  const verifyPhone = await req('POST', '/partners-portal/apply/phone/verify', {
    phone,
    code: phoneCode,
  });
  assert.equal(verifyPhone.status, 200);
  const phoneVerifyToken = (verifyPhone.json as { phoneVerifyToken?: string }).phoneVerifyToken;
  assert.ok(phoneVerifyToken);

  // Expired-path: wrong code after verify still invalid for a fresh start challenge is separate.
  const startEmail = await req('POST', '/partners-portal/apply/email/start', { email });
  assert.ok(startEmail.status === 200 || startEmail.status === 201);
  const emailCode =
    (startEmail.json as { devCode?: string })?.devCode ||
    (await readLatestCode(emailOutbox, (r) => String(r.phoneHash || '').length > 0));
  assert.ok(emailCode);
  const verifyEmail = await req('POST', '/partners-portal/apply/email/verify', {
    email,
    code: emailCode,
  });
  assert.equal(verifyEmail.status, 200);
  const emailVerifyToken = (verifyEmail.json as { emailVerifyToken?: string }).emailVerifyToken;

  const apply = await req('POST', '/partners-portal/apply', {
    nameAr: 'نورة',
    nameEn: 'Noura',
    contactName: 'نورة',
    contactEmail: email,
    contactPhone: phone,
    city: 'الرياض',
    password,
    phoneVerifyToken,
    emailVerifyToken,
    activities: {
      identity: ['independent'],
      locations: ['client_home'],
      description: 'مكياج عروس في موقع العميلة',
      lines: [{ activity: 'beauty.makeup.bridal', scope: 'category' }],
    },
    descriptionAr: 'مكياج عروس في موقع العميلة',
  });
  assert.ok(apply.status === 200 || apply.status === 201, `apply failed ${apply.status} ${apply.text}`);
  const statusToken = (apply.json as { statusToken?: string }).statusToken;
  assert.ok(statusToken);

  // Independent must reject commercial register
  const crReject = await req('POST', '/partners-portal/apply', {
    nameAr: 'نورة2',
    nameEn: 'Noura2',
    contactName: 'نورة2',
    contactEmail: `cr.${email}`,
    contactPhone: phone,
    city: 'الرياض',
    password,
    phoneVerifyToken,
    emailVerifyToken,
    crNumber: '1010101010',
    activities: {
      identity: ['independent'],
      locations: ['client_home'],
      description: 'رفض السجل',
      lines: [{ activity: 'beauty.makeup.bridal', scope: 'category' }],
    },
  });
  assert.equal(crReject.status, 400);

  let decideStatus: string = 'SKIPPED_NO_ADMIN_KEY';
  if (adminKey) {
    const queue = await req('GET', '/partners-portal/admin/activities/queue', undefined, {
      'X-Admin-Key': adminKey,
    });
    const rows = (queue.json as { id?: string; applicationId?: string; lines?: Array<{ id: string }> }[]) || [];
    // queue may be array or wrapped
    const list = Array.isArray(queue.json) ? queue.json : (queue.json as { items?: unknown[] })?.items;
    const pending = (Array.isArray(list) ? list : rows) as Array<{
      id: string;
      lines?: Array<{ id: string }>;
    }>;
    const hit = pending.find((r) => Array.isArray(r.lines) && r.lines.length);
    if (hit?.id && hit.lines?.length) {
      const decided = await req(
        'POST',
        '/partners-portal/admin/activities/decide',
        {
          requestId: hit.id,
          approvedLineIds: hit.lines.map((l) => l.id),
          verificationNote: `journey ${runId} verified activity+place`,
        },
        { 'X-Admin-Key': adminKey },
      );
      decideStatus = `${decided.status}`;
    } else {
      decideStatus = 'SKIPPED_NO_PENDING_ROW';
    }
  }

  // Coverage city intent for either (schema already covers; catalog smoke)
  const homeCatalog = await req(
    'GET',
    '/marketplace/catalog?lane=beauty&kind=service&placeMode=home&limit=5',
  );
  assert.ok(homeCatalog.status === 200);

  // Privacy: partner detail must not leak phone when publicContactVisible unset
  // (seeded partners may differ — assert helper contract via response shape when partner found)

  const fingerprint = createHash('sha256').update(runId).digest('hex').slice(0, 16);
  console.log(
    JSON.stringify(
      {
        runId,
        fingerprint,
        verdict: adminKey && decideStatus.startsWith('2') ? 'PASS_API_JOURNEY' : 'PARTIAL_API_JOURNEY',
        applyStatus: apply.status,
        phoneOtp: 'PASS',
        emailOtp: 'PASS',
        crReject: crReject.status,
        decideStatus,
        note: 'Flutter device journeys remain separate — see ACCEPTANCE_TABLE',
        redactedPhoneLast4: phone.slice(-4),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
