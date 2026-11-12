/**
 * Admin-review registration (no SMS/email OTP).
 * Apply independent + facility → both pending in admin queue → approve one by requestId → other stays pending.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const base = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const adminKey = process.env.ADMIN_API_KEY || process.env.MIRA_ADMIN_KEY || '';
const runId = `admin-review-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(2).toString('hex')}`;

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

  const suffix = runId.slice(-10);
  const password = 'TestPass123!';

  const independent = await req('POST', '/partners-portal/apply', {
    nameAr: 'نورة اختبار',
    nameEn: 'Noura Test',
    contactName: 'نورة اختبار',
    contactEmail: `noura.${suffix}@example.test`,
    contactPhone: `05${String(Date.now()).slice(-8)}`,
    city: 'الرياض',
    password,
    activities: {
      identity: ['independent'],
      locations: ['client_home'],
      description: 'مكياج عروس — طلب مراجعة إدارة',
      lines: [{ activity: 'beauty.makeup.bridal', scope: 'category' }],
    },
    descriptionAr: 'مكياج عروس — طلب مراجعة إدارة',
  });
  assert.ok(ok(independent.status), `independent apply ${independent.status} ${independent.text}`);
  const indBody = independent.json as {
    status?: string;
    messageAr?: string;
    message?: string;
    activitiesRequestId?: string;
    applicationId?: string;
  };
  assert.equal(indBody.status, 'pending');
  assert.ok(
    String(indBody.messageAr || indBody.message || '').includes('قيد مراجعة الإدارة'),
    'success message must say pending admin review',
  );
  assert.ok(indBody.activitiesRequestId, 'activitiesRequestId required');
  assert.equal(
    (independent.json as { autoApproved?: boolean }).autoApproved,
    undefined,
    'autoApproved must never be returned',
  );
  const firstToken = (independent.json as { statusToken?: string }).statusToken;
  assert.ok(firstToken, 'statusToken required');

  // Same email again → new pending request with a different tracking token (never reuse).
  const duplicateEmail = await req('POST', '/partners-portal/apply', {
    nameAr: 'نورة مكررة',
    nameEn: 'Noura Dup',
    contactName: 'نورة مكررة',
    contactEmail: `noura.${suffix}@example.test`,
    contactPhone: `05${String(Date.now() + 3).slice(-8)}`,
    city: 'الرياض',
    password,
    activities: {
      identity: ['independent'],
      locations: ['client_home'],
      description: 'طلب ثانٍ بنفس البريد',
      lines: [{ activity: 'beauty.makeup.bridal', scope: 'category' }],
    },
    descriptionAr: 'طلب ثانٍ بنفس البريد',
  });
  assert.ok(ok(duplicateEmail.status), `duplicate email apply ${duplicateEmail.status} ${duplicateEmail.text}`);
  const dupBody = duplicateEmail.json as {
    status?: string;
    statusToken?: string;
    applicationId?: string;
    activitiesRequestId?: string;
    autoApproved?: boolean;
  };
  assert.equal(dupBody.status, 'pending');
  assert.ok(dupBody.statusToken && dupBody.statusToken !== firstToken, 'must not reuse prior statusToken');
  assert.ok(dupBody.applicationId && dupBody.applicationId !== indBody.applicationId);
  assert.equal(dupBody.autoApproved, undefined);

  const facility = await req('POST', '/partners-portal/apply', {
    nameAr: 'صالون لمسة اختبار',
    nameEn: 'Lamsa Test',
    contactName: 'مسؤولة',
    contactEmail: `lamsa.${suffix}@example.test`,
    contactPhone: `05${String(Date.now() + 1).slice(-8)}`,
    city: 'الرياض',
    password,
    activities: {
      identity: ['salon'],
      locations: ['venue', 'client_home'],
      description: 'صالون — طلب مراجعة إدارة',
      lines: [{ activity: 'beauty.makeup.bridal', scope: 'category' }],
    },
    descriptionAr: 'صالون — طلب مراجعة إدارة',
  });
  assert.ok(ok(facility.status), `facility apply ${facility.status} ${facility.text}`);
  const facBody = facility.json as {
    status?: string;
    activitiesRequestId?: string;
    applicationId?: string;
  };
  assert.equal(facBody.status, 'pending');
  assert.ok(facBody.activitiesRequestId);

  const queue = await req('GET', '/partners-portal/admin/activities/queue', undefined, {
    'X-Admin-Key': adminKey,
  });
  assert.ok(ok(queue.status), `queue ${queue.status}`);
  const list = (Array.isArray(queue.json) ? queue.json : []) as Array<{
    id: string;
    state?: string;
    lines?: Array<{ id: string }>;
  }>;
  const indReq = list.find((r) => r.id === indBody.activitiesRequestId);
  const facReq = list.find((r) => r.id === facBody.activitiesRequestId);
  assert.ok(indReq, 'independent request must appear in admin queue');
  assert.ok(facReq, 'facility request must appear in admin queue');
  assert.equal(indReq.state || 'pending', 'pending');
  assert.equal(facReq.state || 'pending', 'pending');

  // Approve independent only, by its requestId
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
  const facStill = list2.find((r) => r.id === facBody.activitiesRequestId);
  assert.ok(facStill, 'facility must remain in pending queue');
  assert.equal(facStill.state || 'pending', 'pending');

  // Unapproved facility cannot login as active partner (no partner yet) — login should fail
  const facLogin = await req('POST', '/partners-portal/login', {
    email: `lamsa.${suffix}@example.test`,
    password,
  });
  assert.ok(facLogin.status >= 400, 'pending facility must not get portal login');

  // Approved independent can login
  const indLogin = await req('POST', '/partners-portal/login', {
    email: `noura.${suffix}@example.test`,
    password,
  });
  assert.ok(ok(indLogin.status), `approved independent login ${indLogin.status} ${indLogin.text}`);

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
        noOtp: true,
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
