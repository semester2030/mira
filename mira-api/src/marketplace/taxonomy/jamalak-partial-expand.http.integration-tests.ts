/** Jamalak §2: partial approve + expand + privacy (no OTP). */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const base = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const adminKey = process.env.ADMIN_API_KEY || 'jamalak-test-admin';
const runId = `partial-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
const password = 'TestPass123!';

async function req(method: string, path: string, body?: unknown, headers?: Record<string, string>) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(headers || {}) },
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

function ok(s: number) {
  return s === 200 || s === 201;
}

async function main() {
  const email = `partial.${runId}@example.test`;
  const apply = await req('POST', '/partners-portal/apply', {
    nameAr: 'نورة جزئي',
    nameEn: 'Partial Noura',
    contactName: 'نورة جزئي',
    contactEmail: email,
    contactPhone: `05${String(Date.now()).slice(-8)}`,
    city: 'الرياض',
    password,
    activities: {
      identity: ['independent'],
      locations: ['client_home'],
      description: 'مكياج وصبغة — موافقة جزئية',
      lines: [
        { activity: 'beauty.makeup.bridal', scope: 'category' },
        { activity: 'beauty.hair.color', scope: 'category' },
      ],
    },
  });
  assert.ok(ok(apply.status), apply.text);
  const requestId = (apply.json as { activitiesRequestId?: string }).activitiesRequestId!;
  const queue = await req('GET', '/partners-portal/admin/activities/queue', undefined, {
    'X-Admin-Key': adminKey,
  });
  const list = (Array.isArray(queue.json) ? queue.json : []) as Array<{
    id: string;
    lines?: Array<{ id: string; activity?: string }>;
  }>;
  const row = list.find((r) => r.id === requestId);
  assert.ok(row, 'must find by requestId not queue[0]');
  const bridalLine = (row.lines || []).find((l) => l.activity === 'beauty.makeup.bridal');
  assert.ok(bridalLine, 'bridal line');

  const decide = await req(
    'POST',
    '/partners-portal/admin/activities/decide',
    {
      requestId,
      approvedLineIds: [bridalLine!.id],
      reason: 'اعتماد المكياج فقط في هذه الجولة',
      verificationNote: `${runId} partial bridal only`,
    },
    { 'X-Admin-Key': adminKey },
  );
  assert.ok(ok(decide.status), `decide ${decide.status} ${decide.text}`);

  const login = await req('POST', '/partners-portal/login', { email, password });
  assert.ok(ok(login.status), login.text);
  const token = (login.json as { accessToken?: string }).accessToken!;
  const auth = { Authorization: `Bearer ${token}` };
  const me = await req('GET', '/partners-portal/me', undefined, auth);
  assert.ok((me.json as { partner?: { type?: string } })?.partner?.type !== 'developer');

  const bridalOk = await req(
    'POST',
    '/partners-portal/services',
    {
      nameAr: 'مكياج معتمد',
      category: 'beauty.makeup.bridal',
      priceHalalas: 20000,
      durationMin: 60,
      placeMode: 'home',
    },
    auth,
  );
  assert.ok(ok(bridalOk.status), `bridal ${bridalOk.status} ${bridalOk.text}`);
  const bridalId = (bridalOk.json as { id?: string }).id!;

  const colorDeny = await req(
    'POST',
    '/partners-portal/services',
    {
      nameAr: 'صبغة مرفوضة',
      category: 'beauty.hair.color',
      priceHalalas: 20000,
      durationMin: 60,
      placeMode: 'home',
    },
    auth,
  );
  assert.equal(colorDeny.status, 403, colorDeny.text);
  assert.ok(String((colorDeny.json as { code?: string }).code || '').includes('ACTIVITY_NOT_APPROVED'));

  const expand = await req(
    'POST',
    '/partners-portal/activities/expand',
    {
      identity: ['independent'],
      locations: ['client_home'],
      description: 'طلب استشوار لاحق',
      lines: [{ activity: 'beauty.hair.blowdry', scope: 'category' }],
    },
    auth,
  );
  assert.ok(ok(expand.status), `expand ${expand.status} ${expand.text}`);
  const expandId = (expand.json as { requestId?: string }).requestId;
  assert.ok(expandId);

  const bridalStill = await req(
    'POST',
    '/partners-portal/services',
    {
      nameAr: 'مكياج بعد التوسيع',
      category: 'beauty.makeup.bridal',
      priceHalalas: 22000,
      durationMin: 50,
      placeMode: 'home',
    },
    auth,
  );
  assert.ok(ok(bridalStill.status), `bridal after expand ${bridalStill.status} ${bridalStill.text}`);

  const blowDeny = await req(
    'POST',
    '/partners-portal/services',
    {
      nameAr: 'استشوار معلّق',
      category: 'beauty.hair.blowdry',
      priceHalalas: 10000,
      durationMin: 40,
      placeMode: 'home',
    },
    auth,
  );
  assert.equal(blowDeny.status, 403, blowDeny.text);

  const partnerId = (me.json as { partner?: { id?: string } }).partner?.id!;
  const prisma = new PrismaClient();
  try {
    await prisma.service.update({
      where: { id: bridalId },
      data: {
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: true,
        coverageJson: { cityIds: ['sa-riyadh'] },
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  const pubPartner = await req('GET', `/marketplace/partners/${partnerId}`);
  assert.equal((pubPartner.json as { contactPhone?: string | null }).contactPhone ?? null, null);
  const pubSvc = await req('GET', `/marketplace/catalog/service/${bridalId}`);
  assert.equal((pubSvc.json as { contactPhone?: string | null }).contactPhone ?? null, null);
  assert.ok(!('contactEmail' in ((pubSvc.json as object) || {})));

  const q2 = await req('GET', '/partners-portal/admin/activities/queue', undefined, {
    'X-Admin-Key': adminKey,
  });
  const still = (Array.isArray(q2.json) ? q2.json : []) as Array<{ id: string }>;
  assert.ok(still.some((r) => r.id === expandId), 'expand stays pending');

  console.log(
    JSON.stringify(
      {
        runId,
        verdict: 'PASS',
        requestId,
        approvedLine: 'beauty.makeup.bridal',
        rejectedLine: 'beauty.hair.color',
        expandRequestId: expandId,
        partnerId,
        privacyPhone: null,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
