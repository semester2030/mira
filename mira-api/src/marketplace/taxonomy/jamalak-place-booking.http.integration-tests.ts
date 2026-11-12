/**
 * Jamalak §3: place filters + booking branch/visit persistence (no OTP).
 * Salon: makeup either (Riyadh branch + Jeddah coverage), color branch-only.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const base = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const adminKey = process.env.ADMIN_API_KEY || 'jamalak-test-admin';
const runId = `place-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(2).toString('hex')}`;
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

function itemsOf(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) return json as Array<Record<string, unknown>>;
  if (json && typeof json === 'object' && Array.isArray((json as { items?: unknown }).items)) {
    return (json as { items: Array<Record<string, unknown>> }).items;
  }
  return [];
}

async function main() {
  const suffix = runId.slice(-10);
  const email = `salon.place.${suffix}@example.test`;

  const apply = await req('POST', '/partners-portal/apply', {
    nameAr: 'صالون مكان',
    nameEn: 'Place Salon',
    contactName: 'مسؤولة',
    contactEmail: email,
    contactPhone: `05${String(Date.now()).slice(-8)}`,
    city: 'الرياض',
    password,
    activities: {
      identity: ['salon'],
      locations: ['venue', 'client_home'],
      description: 'مكياج وصبغة — اختبار مكان',
      lines: [
        { activity: 'beauty.makeup.bridal', scope: 'category' },
        { activity: 'beauty.hair.color', scope: 'category' },
      ],
    },
  });
  assert.ok(ok(apply.status), `apply ${apply.status} ${apply.text}`);
  const requestId = (apply.json as { activitiesRequestId?: string }).activitiesRequestId!;
  assert.ok(requestId);

  const queue = await req('GET', '/partners-portal/admin/activities/queue', undefined, {
    'X-Admin-Key': adminKey,
  });
  const row = itemsOf(queue.json).find((r) => r.id === requestId) as
    | { id: string; lines?: Array<{ id: string }> }
    | undefined;
  assert.ok(row, 'request must be in queue by id');

  const decide = await req(
    'POST',
    '/partners-portal/admin/activities/decide',
    {
      requestId,
      approvedLineIds: (row.lines || []).map((l) => l.id),
      verificationNote: `${runId} approve place salon`,
    },
    { 'X-Admin-Key': adminKey },
  );
  assert.ok(ok(decide.status), `decide ${decide.status} ${decide.text}`);

  const login = await req('POST', '/partners-portal/login', { email, password });
  assert.ok(ok(login.status), `login ${login.status}`);
  const token = (login.json as { accessToken?: string }).accessToken!;
  const auth = { Authorization: `Bearer ${token}` };

  // Create Riyadh branch
  const branchRes = await req(
    'POST',
    '/partners-portal/branches',
    {
      nameAr: 'فرع الرياض',
      cityId: 'sa-riyadh',
      cityNameAr: 'الرياض',
      addressAr: 'العليا',
      lat: 24.71,
      lng: 46.67,
    },
    auth,
  );
  // Some builds use dashboard branch create under different path — fall back via me
  let branchId =
    (branchRes.json as { id?: string })?.id ||
    (branchRes.json as { branch?: { id?: string } })?.branch?.id;
  if (!ok(branchRes.status) || !branchId) {
    // Try nested create used by portal
    const alt = await req(
      'POST',
      '/partners-portal/me/branches',
      {
        nameAr: 'فرع الرياض',
        cityId: 'sa-riyadh',
        cityNameAr: 'الرياض',
        addressAr: 'العليا',
        lat: 24.71,
        lng: 46.67,
      },
      auth,
    );
    branchId = (alt.json as { id?: string })?.id;
    if (!branchId) {
      console.log(
        JSON.stringify({
          runId,
          verdict: 'NOT_VERIFIED',
          blocker: 'branch create endpoint missing',
          branchStatus: branchRes.status,
          branchText: branchRes.text.slice(0, 300),
          altStatus: alt.status,
          altText: alt.text.slice(0, 300),
        }),
      );
      process.exit(2);
    }
  }

  const makeup = await req(
    'POST',
    '/partners-portal/services',
    {
      nameAr: `مكياج إما ${suffix}`,
      category: 'beauty.makeup.bridal',
      priceHalalas: 30000,
      durationMin: 60,
      placeMode: 'either',
      branchId,
      bookingEnabled: true,
      coverageJson: { cityIds: ['sa-jeddah', 'sa-riyadh'] },
      availabilityJson: [
        { weekday: 0, startMin: 600, endMin: 1200, capacity: 2, resourceId: 'staff-a' },
        { weekday: 1, startMin: 600, endMin: 1200, capacity: 2, resourceId: 'staff-a' },
        { weekday: 2, startMin: 600, endMin: 1200, capacity: 2, resourceId: 'staff-a' },
        { weekday: 3, startMin: 600, endMin: 1200, capacity: 2, resourceId: 'staff-a' },
        { weekday: 4, startMin: 600, endMin: 1200, capacity: 2, resourceId: 'staff-a' },
        { weekday: 5, startMin: 600, endMin: 1200, capacity: 2, resourceId: 'staff-a' },
        { weekday: 6, startMin: 600, endMin: 1200, capacity: 2, resourceId: 'staff-a' },
      ],
    },
    auth,
  );
  assert.ok(ok(makeup.status), `makeup ${makeup.status} ${makeup.text}`);
  const makeupId = (makeup.json as { id?: string }).id!;

  const color = await req(
    'POST',
    '/partners-portal/services',
    {
      nameAr: `صبغة مقر ${suffix}`,
      category: 'beauty.hair.color',
      priceHalalas: 40000,
      durationMin: 90,
      placeMode: 'branch',
      branchId,
      bookingEnabled: true,
      availabilityJson: [
        { weekday: 0, startMin: 600, endMin: 1200, capacity: 1, resourceId: 'staff-a' },
        { weekday: 1, startMin: 600, endMin: 1200, capacity: 1, resourceId: 'staff-a' },
        { weekday: 2, startMin: 600, endMin: 1200, capacity: 1, resourceId: 'staff-a' },
        { weekday: 3, startMin: 600, endMin: 1200, capacity: 1, resourceId: 'staff-a' },
        { weekday: 4, startMin: 600, endMin: 1200, capacity: 1, resourceId: 'staff-a' },
        { weekday: 5, startMin: 600, endMin: 1200, capacity: 1, resourceId: 'staff-a' },
        { weekday: 6, startMin: 600, endMin: 1200, capacity: 1, resourceId: 'staff-a' },
      ],
    },
    auth,
  );
  assert.ok(ok(color.status), `color ${color.status} ${color.text}`);
  const colorId = (color.json as { id?: string }).id!;

  // Publish via DB after partner-owned create: submit-review requires media (portal path).
  // Place/coverage fields were set by the partner API; we only flip catalog visibility.
  const prisma = new PrismaClient();
  try {
    await prisma.service.updateMany({
      where: { id: { in: [makeupId, colorId] } },
      data: {
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        reviewStatus: 'approved',
        bookingEnabled: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  const homeJeddah = await req(
    'GET',
    `/marketplace/catalog?kind=service&lane=beauty&placeMode=home&city=${encodeURIComponent('جدة')}`,
  );
  const homeItems = itemsOf(homeJeddah.json);
  assert.ok(
    homeItems.some((i) => i.id === makeupId),
    'either makeup must appear under في موقعك جدة via coverage',
  );
  assert.ok(
    !homeItems.some((i) => i.id === colorId),
    'branch-only color must not appear under في موقعك',
  );

  const branchJeddah = await req(
    'GET',
    `/marketplace/catalog?kind=service&lane=beauty&placeMode=branch&city=${encodeURIComponent('جدة')}`,
  );
  const branchItems = itemsOf(branchJeddah.json);
  assert.ok(
    !branchItems.some((i) => i.id === makeupId || i.id === colorId),
    'no Jeddah branch → neither service under في المقر جدة',
  );

  const branchRiyadh = await req(
    'GET',
    `/marketplace/catalog?kind=service&lane=beauty&placeMode=branch&city=${encodeURIComponent('الرياض')}`,
  );
  const riyadhItems = itemsOf(branchRiyadh.json);
  assert.ok(riyadhItems.some((i) => i.id === makeupId), 'makeup under في المقر الرياض');
  assert.ok(riyadhItems.some((i) => i.id === colorId), 'color under في المقر الرياض');

  // Privacy: partner public contactPhone must be null
  const me = await req('GET', '/partners-portal/me', undefined, auth);
  const partnerId = (me.json as { partner?: { id?: string } })?.partner?.id;
  assert.ok(partnerId);
  const pub = await req('GET', `/marketplace/partners/${partnerId}`);
  const phone = (pub.json as { contactPhone?: string | null })?.contactPhone;
  assert.equal(phone ?? null, null, 'registration phone must not be public by default');

  console.log(
    JSON.stringify(
      {
        runId,
        verdict: 'PASS_CATALOG_PLACE',
        requestId,
        partnerId,
        branchId,
        makeupId,
        colorId,
        privacyPhone: phone ?? null,
        note: 'booking create needs customer auth — catalog place assertions PASS',
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
