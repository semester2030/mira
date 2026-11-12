/**
 * Dual registration without SMS/email OTP — admin review gates activation.
 * Independent + facility apply → both in admin queue → approve one by requestId → other stays pending.
 * Unapproved activity cannot be written (ACTIVITY_NOT_APPROVED).
 *
 * Requires: running test API + ADMIN_API_KEY. Phone OTP is deferred — not required.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const adminKey = process.env.ADMIN_API_KEY || process.env.MIRA_ADMIN_KEY || '';
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

function ok(status: number) {
  return status === 200 || status === 201;
}

async function main() {
  const health = await req('GET', '/marketplace/cities').catch(() => null);
  if (!health || health.status >= 500) {
    console.log(JSON.stringify({ runId, verdict: 'NOT_VERIFIED', blocker: 'test API not reachable', base }));
    process.exit(2);
  }
  if (!adminKey) {
    console.log(JSON.stringify({ runId, verdict: 'NOT_VERIFIED', blocker: 'ADMIN_API_KEY required' }));
    process.exit(2);
  }

  const suffix = runId.slice(-12);
  const password = 'TestPass123!';

  const independent = await req('POST', '/partners-portal/apply', {
    nameAr: 'نورة رحلة',
    nameEn: 'Noura Journey',
    contactName: 'نورة رحلة',
    contactEmail: `noura.j.${suffix}@example.test`,
    contactPhone: `05${String(Date.now()).slice(-8)}`,
    city: 'الرياض',
    password,
    activities: {
      identity: ['independent'],
      locations: ['client_home'],
      description: 'مكياج عروس — مراجعة إدارة',
      lines: [{ activity: 'beauty.makeup.bridal', scope: 'category' }],
    },
    descriptionAr: 'مكياج عروس — مراجعة إدارة',
  });
  assert.ok(ok(independent.status), `independent apply ${independent.status} ${independent.text}`);
  const indBody = independent.json as {
    status?: string;
    messageAr?: string;
    message?: string;
    activitiesRequestId?: string;
  };
  assert.equal(indBody.status, 'pending');
  assert.ok(String(indBody.messageAr || indBody.message || '').includes('قيد مراجعة الإدارة'));
  assert.ok(indBody.activitiesRequestId);

  const facility = await req('POST', '/partners-portal/apply', {
    nameAr: 'صالون رحلة',
    nameEn: 'Salon Journey',
    contactName: 'مسؤولة',
    contactEmail: `salon.j.${suffix}@example.test`,
    contactPhone: `05${String(Date.now() + 7).slice(-8)}`,
    city: 'الرياض',
    password,
    activities: {
      identity: ['salon'],
      locations: ['venue', 'client_home'],
      description: 'صالون — مراجعة إدارة',
      lines: [{ activity: 'beauty.makeup.bridal', scope: 'category' }],
    },
    descriptionAr: 'صالون — مراجعة إدارة',
  });
  assert.ok(ok(facility.status), `facility apply ${facility.status} ${facility.text}`);
  const facBody = facility.json as { status?: string; activitiesRequestId?: string };
  assert.equal(facBody.status, 'pending');
  assert.ok(facBody.activitiesRequestId);

  const queue = await req('GET', '/partners-portal/admin/activities/queue', undefined, {
    'X-Admin-Key': adminKey,
  });
  assert.ok(ok(queue.status), `queue ${queue.status} ${queue.text}`);
  const list = (Array.isArray(queue.json) ? queue.json : []) as Array<{
    id: string;
    state?: string;
    lines?: Array<{ id: string }>;
  }>;
  const indReq = list.find((r) => r.id === indBody.activitiesRequestId);
  const facReq = list.find((r) => r.id === facBody.activitiesRequestId);
  assert.ok(indReq, 'independent must appear in admin queue');
  assert.ok(facReq, 'facility must appear in admin queue');

  const decide = await req(
    'POST',
    '/partners-portal/admin/activities/decide',
    {
      requestId: indBody.activitiesRequestId,
      approvedLineIds: (indReq.lines || []).map((l) => l.id),
      verificationNote: `${runId} approve independent only`,
    },
    { 'X-Admin-Key': adminKey },
  );
  assert.ok(ok(decide.status), `decide ${decide.status} ${decide.text}`);

  const queue2 = await req('GET', '/partners-portal/admin/activities/queue', undefined, {
    'X-Admin-Key': adminKey,
  });
  const list2 = (Array.isArray(queue2.json) ? queue2.json : []) as Array<{ id: string; state?: string }>;
  assert.ok(
    list2.some((r) => r.id === facBody.activitiesRequestId),
    'facility request must stay pending',
  );
  assert.ok(
    !list2.some((r) => r.id === indBody.activitiesRequestId),
    'approved independent must leave pending queue',
  );

  const facLogin = await req('POST', '/partners-portal/login', {
    email: `salon.j.${suffix}@example.test`,
    password,
  });
  assert.ok(facLogin.status >= 400, 'pending facility must not login');

  const indLogin = await req('POST', '/partners-portal/login', {
    email: `noura.j.${suffix}@example.test`,
    password,
  });
  assert.ok(ok(indLogin.status), `approved login ${indLogin.status} ${indLogin.text}`);
  const token = (indLogin.json as { accessToken?: string }).accessToken;
  assert.ok(token);

  // Unapproved activity (hair) must not be creatable with bridal-only grant
  const denied = await req(
    'POST',
    '/partners-portal/services',
    {
      nameAr: 'صبغة غير معتمدة',
      category: 'beauty.hair.color',
      priceHalalas: 10000,
      durationMin: 60,
      placeMode: 'home',
    },
    { Authorization: `Bearer ${token}` },
  );
  const deniedCode =
    (denied.json as { code?: string; message?: string })?.code ||
    (denied.json as { message?: string })?.message ||
    '';
  assert.ok(
    denied.status === 403 || String(deniedCode).includes('ACTIVITY_NOT_APPROVED'),
    `unapproved activity must be blocked, got ${denied.status} ${denied.text}`,
  );

  // Pending facility has no public bookable services
  const publicCatalog = await req(
    'GET',
    `/marketplace/catalog?q=${encodeURIComponent('صالون رحلة')}&lane=beauty`,
  );
  const items = Array.isArray((publicCatalog.json as { items?: unknown[] })?.items)
    ? ((publicCatalog.json as { items: Array<{ partnerNameAr?: string }> }).items)
    : Array.isArray(publicCatalog.json)
      ? (publicCatalog.json as Array<{ partnerNameAr?: string }>)
      : [];
  assert.ok(
    !items.some((i) => String(i.partnerNameAr || '').includes('صالون رحلة')),
    'pending facility must not appear in bookable catalog',
  );

  console.log(
    JSON.stringify(
      {
        runId,
        verdict: 'PASS',
        independentRequestId: indBody.activitiesRequestId,
        facilityRequestId: facBody.activitiesRequestId,
        approved: indBody.activitiesRequestId,
        stillPending: facBody.activitiesRequestId,
        message: indBody.messageAr || indBody.message,
        unapprovedWriteBlocked: true,
        noOtp: true,
        otpDeferred: true,
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
