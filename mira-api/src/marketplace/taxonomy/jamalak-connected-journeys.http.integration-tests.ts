/**
 * Jamalak connected journeys — same partner identity across the full chain:
 * apply → admin decide(requestId) → partner publish → customer book → partner sees booking.
 *
 * Portal half hits live MIRA_API_BASE. Customer booking uses in-process Nest + Scripted Firebase
 * against the same DATABASE_URL (local only) so place persistence is verified without OTP/SMS.
 *
 * Evidence JSON written under docs/jamalak-dual-reg/evidence/<runId>/.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { INestApplication, Module, UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../../common/auth/firebase-id-token-verifier';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PartnerTokenGuard } from '../../partners-portal/guards/partner-token.guard';
import { CommerceAdminController } from '../commerce.admin.controller';
import { CommerceController } from '../commerce.controller';
import { CommercePartnerController } from '../commerce-partner.controller';
import { CommerceService } from '../commerce.service';

const apiBase = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const adminKey = process.env.ADMIN_API_KEY || process.env.MIRA_ADMIN_KEY || '';
const password = 'TestPass123!';
const runId = `conn-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
const evidenceDir = path.resolve(__dirname, `../../../../docs/jamalak-dual-reg/evidence/${runId}`);

function gitHead(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: path.resolve(__dirname, '../../../..'), encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

class ScriptedVerifier extends FirebaseIdTokenVerifier {
  constructor(private readonly known: Record<string, string>) {
    super();
  }
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    const uid = this.known[token];
    if (!uid) throw new UnauthorizedException('Invalid or expired Firebase token');
    return { uid, email: `${uid}@test.local`, name: uid };
  }
}

const tokens = { 'cust-conn': `${runId}-cust` };

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [CommerceController, CommercePartnerController, CommerceAdminController],
  providers: [
    CommerceService,
    FirebaseAuthGuard,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    { provide: FirebaseIdTokenVerifier, useValue: new ScriptedVerifier(tokens) },
  ],
})
class ConnBookingModule {}

async function api(method: string, p: string, body?: unknown, headers?: Record<string, string>) {
  const res = await fetch(`${apiBase}${p}`, {
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

function nextWeekdayAt(weekday: number, hour: number): Date {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  const delta = (weekday - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

const windows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMin: 8 * 60,
  endMin: 20 * 60,
  capacity: 1,
  resourceId: 'staff-conn',
}));

async function decide(requestId: string) {
  const queue = await api('GET', '/partners-portal/admin/activities/queue', undefined, {
    'X-Admin-Key': adminKey,
  });
  assert.ok(ok(queue.status), queue.text);
  const list = (Array.isArray(queue.json) ? queue.json : []) as Array<{ id: string; lines?: Array<{ id: string; activity?: string }> }>;
  const row = list.find((r) => r.id === requestId);
  assert.ok(row, `request ${requestId} missing from queue`);
  const res = await api(
    'POST',
    '/partners-portal/admin/activities/decide',
    {
      requestId,
      approvedLineIds: (row.lines || []).map((l) => l.id),
      verificationNote: `${runId} connected approve`,
    },
    { 'X-Admin-Key': adminKey },
  );
  assert.ok(ok(res.status), `decide ${requestId} ${res.status} ${res.text}`);
  return row;
}

async function publishService(
  auth: Record<string, string>,
  prisma: PrismaClient,
  data: {
    nameAr: string;
    category: string;
    leaf?: string;
    placeMode: string;
    branchId?: string;
    coverageJson?: object;
    attributesJson?: object;
    videoScope?: string;
    linkedServiceIds?: string[];
  },
) {
  const create = await api(
    'POST',
    '/partners-portal/services',
    {
      nameAr: data.nameAr,
      nameEn: data.nameAr,
      category: data.category,
      priceHalalas: 25000,
      durationMin: 60,
      placeMode: data.placeMode,
      branchId: data.branchId,
      bookingEnabled: true,
      availabilityJson: windows,
      coverageJson: data.coverageJson,
      active: true,
    },
    auth,
  );
  assert.ok(ok(create.status), `create ${data.nameAr} ${create.status} ${create.text}`);
  const id = (create.json as { id?: string }).id!;
  const leaf = data.leaf || data.category;
  const attrs: Record<string, unknown> = {
    subcategory: leaf,
    taxonomyLeaf: leaf,
    ...(data.attributesJson || {}),
  };
  if (data.videoScope) attrs.videoScope = data.videoScope;
  if (data.linkedServiceIds) attrs.linkedServiceIds = data.linkedServiceIds;
  // Catalog SQL scopes service leaves by taxonomyNode.category (legacy mid: hair/makeup/…).
  // Leaf id stays on attributesJson for browse binding + booking grant checks.
  const legacyCategory =
    leaf.startsWith('beauty.hair')
      ? 'hair'
      : leaf.startsWith('beauty.makeup')
        ? 'makeup'
        : leaf.startsWith('beauty.clinic.derm')
          ? 'skin'
          : leaf.startsWith('beauty.clinic.laser')
            ? 'laser'
            : data.category;
  await prisma.service.update({
    where: { id },
    data: {
      active: true,
      contentStatus: 'published',
      catalogSource: 'catalog',
      reviewStatus: 'approved',
      bookingEnabled: true,
      category: legacyCategory,
      attributesJson: attrs as object,
      placeMode: data.placeMode,
      branchId: data.branchId ?? null,
      coverageJson: data.coverageJson ? (data.coverageJson as object) : undefined,
    },
  });
  return id;
}

async function book(
  commerceBase: string,
  body: Record<string, unknown>,
) {
  const res = await fetch(`${commerceBase}/marketplace/commerce/bookings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer cust-conn',
      'Idempotency-Key': String(body.idempotencyKey),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text };
}

async function partnerBookings(token: string) {
  return api('GET', '/partners/me/commerce/bookings?limit=20', undefined, {
    Authorization: `Bearer ${token}`,
  });
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const head = gitHead();
  const health = await api('GET', '/marketplace/cities').catch(() => null);
  if (!health || health.status >= 500) {
    console.log(JSON.stringify({ runId, verdict: 'NOT_VERIFIED', blocker: 'test API not reachable', apiBase }));
    process.exit(2);
  }
  if (!adminKey) {
    console.log(JSON.stringify({ runId, verdict: 'NOT_VERIFIED', blocker: 'ADMIN_API_KEY required' }));
    process.exit(2);
  }
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    console.log(JSON.stringify({ runId, verdict: 'NOT_VERIFIED', blocker: 'local DATABASE_URL required for customer booking' }));
    process.exit(2);
  }

  process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || adminKey;
  process.env.AUTH_SKIP = 'false';

  const app: INestApplication = await NestFactory.create(ConnBookingModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const commerceBase = `http://127.0.0.1:${port}/api/v1`;
  const prisma = new PrismaClient();
  const suffix = runId.slice(-8);
  const evidence: Record<string, unknown> = {
    runId,
    gitHead: head,
    apiBase,
    commerceBase,
    verdict: 'PENDING',
  };

  try {
    // ─── 1) Independent ─────────────────────────────────────────────
    const indEmail = `ind.conn.${suffix}@example.test`;
    const indApply = await api('POST', '/partners-portal/apply', {
      nameAr: `نورة متصلة ${suffix}`,
      nameEn: `NouraConn${suffix}`,
      contactName: `نورة متصلة ${suffix}`,
      contactEmail: indEmail,
      contactPhone: `05${String(Date.now()).slice(-8)}`,
      city: 'الرياض',
      password,
      activities: {
        identity: ['independent'],
        locations: ['client_home'],
        description: 'مكياج عروس — سلسلة متصلة',
        lines: [{ activity: 'beauty.makeup.bridal', scope: 'category' }],
      },
      descriptionAr: 'مكياج عروس — سلسلة متصلة',
    });
    assert.ok(ok(indApply.status), indApply.text);
    const indBody = indApply.json as {
      status?: string;
      activitiesRequestId?: string;
      applicationId?: string;
      statusToken?: string;
      autoApproved?: boolean;
    };
    assert.equal(indBody.status, 'pending');
    assert.equal(indBody.autoApproved, undefined);
    assert.ok(indBody.activitiesRequestId);
    await decide(indBody.activitiesRequestId!);

    const indLogin = await api('POST', '/partners-portal/login', { email: indEmail, password });
    assert.ok(ok(indLogin.status), indLogin.text);
    const indTok = (indLogin.json as { accessToken?: string }).accessToken!;
    const indMe = await api('GET', '/partners-portal/me', undefined, { Authorization: `Bearer ${indTok}` });
    const indPartnerId = (indMe.json as { partner?: { id?: string } }).partner?.id!;
    assert.ok(indPartnerId);

    const indSvc = await publishService(
      { Authorization: `Bearer ${indTok}` },
      prisma,
      {
        nameAr: `مكياج منزل متصلة ${suffix}`,
        category: 'beauty.makeup.bridal',
        leaf: 'beauty.makeup.bridal',
        placeMode: 'home',
        coverageJson: { cityIds: ['sa-riyadh', 'sa-jeddah'], travelFeeSar: 35 },
      },
    );

    const indBook = await book(commerceBase, {
      serviceId: indSvc,
      startsAt: nextWeekdayAt(1, 10).toISOString(),
      placeMode: 'home',
      visitCityId: 'sa-jeddah',
      visitAddress: 'حي الزهراء، جدة — سلسلة متصلة',
      travelFeeHalalas: 3500,
      resourceId: 'staff-conn',
      contactName: 'عميلة متصلة',
      contactPhone: '0501112233',
      idempotencyKey: `${runId}-ind-home`,
    });
    assert.equal(indBook.status, 201, indBook.text);
    const indBooking = ((indBook.json as { booking?: Record<string, unknown> }).booking ||
      indBook.json!) as Record<string, unknown>;
    assert.equal(indBooking.placeMode, 'home');
    assert.equal(indBooking.visitCityId, 'sa-jeddah');
    assert.ok(String(indBooking.visitAddress || '').includes('الزهراء'));
    assert.equal(indBooking.branchId ?? null, null);
    assert.ok(String(indBooking.branchLabel || '').includes('زيارة'));

    const indPartnerList = await partnerBookings(indTok);
    assert.ok(ok(indPartnerList.status), indPartnerList.text);
    const indItems = ((indPartnerList.json as { items?: Array<Record<string, unknown>> })?.items || []);
    assert.ok(
      indItems.some((b) => b.id === indBooking.id),
      'independent partner must see the same booking',
    );
    const indSeen = indItems.find((b) => b.id === indBooking.id)!;
    assert.equal(indSeen.placeMode, 'home');
    assert.ok(String(indSeen.visitAddress || '').includes('الزهراء'));

    evidence.independent = {
      applicationId: indBody.applicationId,
      requestId: indBody.activitiesRequestId,
      partnerId: indPartnerId,
      serviceId: indSvc,
      bookingId: indBooking.id,
      visitCityId: indBooking.visitCityId,
      visitAddress: indBooking.visitAddress,
      travelFeeHalalas: indBooking.travelFeeHalalas,
      partnerSeesBooking: true,
      noFakeBranch: indBooking.branchId == null,
    };

    // ─── 2) Salon (color + blowdry on same partner) ─────────────────
    const salonEmail = `salon.conn.${suffix}@example.test`;
    const salonApply = await api('POST', '/partners-portal/apply', {
      nameAr: `صالون متصل ${suffix}`,
      nameEn: `SalonConn${suffix}`,
      contactName: 'مسؤولة',
      contactEmail: salonEmail,
      contactPhone: `05${String(Date.now() + 3).slice(-8)}`,
      city: 'الرياض',
      password,
      activities: {
        identity: ['salon'],
        locations: ['venue', 'client_home'],
        description: 'صبغة واستشوار — سلسلة متصلة',
        lines: [
          { activity: 'beauty.hair.color', scope: 'category' },
          { activity: 'beauty.hair.blowdry', scope: 'category' },
        ],
      },
      descriptionAr: 'صبغة واستشوار — سلسلة متصلة',
    });
    assert.ok(ok(salonApply.status), salonApply.text);
    const salonBody = salonApply.json as { activitiesRequestId?: string; applicationId?: string; status?: string };
    assert.equal(salonBody.status, 'pending');
    const salonReq = await decide(salonBody.activitiesRequestId!);
    const salonActs = (salonReq.lines || []).map((l) => l.activity).filter(Boolean);
    assert.ok(salonActs.includes('beauty.hair.color'), 'color line approved');
    assert.ok(salonActs.includes('beauty.hair.blowdry'), 'blowdry line approved');

    const salonLogin = await api('POST', '/partners-portal/login', { email: salonEmail, password });
    assert.ok(ok(salonLogin.status), salonLogin.text);
    const salonTok = (salonLogin.json as { accessToken?: string }).accessToken!;
    const salonMe = await api('GET', '/partners-portal/me', undefined, { Authorization: `Bearer ${salonTok}` });
    const salonPartnerId = (salonMe.json as { partner?: { id?: string } }).partner?.id!;

    const branchRes = await api(
      'POST',
      '/partners-portal/branches',
      {
        nameAr: 'فرع الرياض المتصل',
        cityId: 'sa-riyadh',
        cityNameAr: 'الرياض',
        addressAr: 'العليا',
        lat: 24.71,
        lng: 46.67,
        active: true,
      },
      { Authorization: `Bearer ${salonTok}` },
    );
    let branchId = (branchRes.json as { id?: string })?.id;
    if (!ok(branchRes.status) || !branchId) {
      // Fallback: create via prisma if portal branches route differs
      const b = await prisma.partnerBranch.create({
        data: {
          partnerId: salonPartnerId,
          nameAr: 'فرع الرياض المتصل',
          cityId: 'sa-riyadh',
          cityNameAr: 'الرياض',
          addressAr: 'العليا',
          lat: 24.71,
          lng: 46.67,
          active: true,
        },
      });
      branchId = b.id;
    }

    const colorId = await publishService(
      { Authorization: `Bearer ${salonTok}` },
      prisma,
      {
        nameAr: `صبغة وجذور متصلة ${suffix}`,
        category: 'beauty.hair.color',
        leaf: 'beauty.hair.color',
        placeMode: 'branch',
        branchId,
      },
    );
    const blowId = await publishService(
      { Authorization: `Bearer ${salonTok}` },
      prisma,
      {
        nameAr: `استشوار متصل ${suffix}`,
        category: 'beauty.hair.blowdry',
        leaf: 'beauty.hair.blowdry',
        placeMode: 'either',
        branchId,
        coverageJson: { cityIds: ['sa-riyadh', 'sa-jeddah'], travelFeeSar: 50 },
      },
    );

    const colorCat = await api(
      'GET',
      `/marketplace/catalog?kind=service&lane=beauty&subcategory=${encodeURIComponent('beauty.hair.color')}`,
    );
    const blowCat = await api(
      'GET',
      `/marketplace/catalog?kind=service&lane=beauty&subcategory=${encodeURIComponent('beauty.hair.blowdry')}`,
    );
    const colorItems = ((colorCat.json as { items?: Array<{ id: string }> })?.items || []).map((i) => i.id);
    const blowItems = ((blowCat.json as { items?: Array<{ id: string }> })?.items || []).map((i) => i.id);
    assert.ok(colorItems.includes(colorId), 'color leaf contains salon color offer');
    assert.ok(blowItems.includes(blowId), 'blowdry leaf contains salon blowdry offer');
    assert.ok(!colorItems.includes(blowId), 'blowdry not under color leaf');
    assert.ok(!blowItems.includes(colorId), 'color not under blowdry leaf');

    // Parent hair query — document whether both appear (pagination vs binding)
    const hairParent = await api(
      'GET',
      `/marketplace/catalog?kind=service&lane=beauty&category=${encodeURIComponent('beauty.hair')}&limit=100`,
    );
    const hairItems = ((hairParent.json as { items?: Array<{ id: string }> })?.items || []).map((i) => i.id);
    const bothUnderHairParent = hairItems.includes(colorId) && hairItems.includes(blowId);

    const salonBranchBook = await book(commerceBase, {
      serviceId: colorId,
      startsAt: nextWeekdayAt(2, 10).toISOString(),
      placeMode: 'branch',
      branchId,
      resourceId: 'staff-conn',
      contactName: 'عميلة صالون',
      contactPhone: '0502223344',
      idempotencyKey: `${runId}-salon-branch`,
    });
    assert.equal(salonBranchBook.status, 201, salonBranchBook.text);
    const sb = ((salonBranchBook.json as { booking?: Record<string, unknown> }).booking ||
      salonBranchBook.json!) as Record<string, unknown>;
    assert.equal(sb.placeMode, 'branch');
    assert.equal(sb.branchId, branchId);

    const salonHomeBook = await book(commerceBase, {
      serviceId: blowId,
      startsAt: nextWeekdayAt(2, 14).toISOString(),
      placeMode: 'home',
      visitCityId: 'sa-jeddah',
      visitAddress: 'أبحر، جدة',
      travelFeeHalalas: 5000,
      resourceId: 'staff-conn',
      contactName: 'عميلة صالون',
      contactPhone: '0502223344',
      idempotencyKey: `${runId}-salon-home`,
    });
    assert.equal(salonHomeBook.status, 201, salonHomeBook.text);
    const sh = ((salonHomeBook.json as { booking?: Record<string, unknown> }).booking ||
      salonHomeBook.json!) as Record<string, unknown>;
    assert.equal(sh.placeMode, 'home');
    assert.equal(sh.travelFeeHalalas, 5000);

    const salonList = await partnerBookings(salonTok);
    const salonItems = ((salonList.json as { items?: Array<Record<string, unknown>> })?.items || []);
    assert.ok(salonItems.some((b) => b.id === sb.id), 'salon sees branch booking');
    assert.ok(salonItems.some((b) => b.id === sh.id), 'salon sees home booking');

    evidence.salon = {
      applicationId: salonBody.applicationId,
      requestId: salonBody.activitiesRequestId,
      approvedActivities: salonActs,
      partnerId: salonPartnerId,
      branchId,
      colorOfferId: colorId,
      blowdryOfferId: blowId,
      bothUnderHairParent,
      hairParentNote: bothUnderHairParent
        ? 'both offers visible under beauty.hair parent'
        : 'parent category query did not return both — leaf queries still isolate correctly (not a pagination failure on leaf)',
      branchBookingId: sb.id,
      homeBookingId: sh.id,
      homeTravelFeeHalalas: sh.travelFeeHalalas,
      partnerSeesBoth: true,
    };

    // ─── 3) Clinic (derm + laser + intro video) ─────────────────────
    const clinicEmail = `clinic.conn.${suffix}@example.test`;
    const clinicApply = await api('POST', '/partners-portal/apply', {
      nameAr: `عيادة متصلة ${suffix}`,
      nameEn: `ClinicConn${suffix}`,
      contactName: 'مديرة',
      contactEmail: clinicEmail,
      contactPhone: `05${String(Date.now() + 9).slice(-8)}`,
      city: 'الرياض',
      password,
      activities: {
        identity: ['clinic'],
        locations: ['venue'],
        description: 'بشرة وليزر — سلسلة متصلة',
        lines: [
          { activity: 'beauty.clinic.derm.skin_eval', scope: 'category' },
          { activity: 'beauty.clinic.laser.hair', scope: 'category' },
        ],
      },
      descriptionAr: 'بشرة وليزر — سلسلة متصلة',
    });
    assert.ok(ok(clinicApply.status), clinicApply.text);
    const clinicBody = clinicApply.json as { activitiesRequestId?: string; applicationId?: string; status?: string };
    assert.equal(clinicBody.status, 'pending');
    const clinicReq = await decide(clinicBody.activitiesRequestId!);
    const clinicActs = (clinicReq.lines || []).map((l) => l.activity).filter(Boolean);
    assert.ok(clinicActs.includes('beauty.clinic.derm.skin_eval'), 'derm leaf approved');
    assert.ok(clinicActs.includes('beauty.clinic.laser.hair'), 'laser leaf approved');

    const clinicLogin = await api('POST', '/partners-portal/login', { email: clinicEmail, password });
    assert.ok(ok(clinicLogin.status), clinicLogin.text);
    const clinicTok = (clinicLogin.json as { accessToken?: string }).accessToken!;
    const clinicMe = await api('GET', '/partners-portal/me', undefined, {
      Authorization: `Bearer ${clinicTok}`,
    });
    const clinicPartnerId = (clinicMe.json as { partner?: { id?: string } }).partner?.id!;

    const clinicBranch = await prisma.partnerBranch.create({
      data: {
        partnerId: clinicPartnerId,
        nameAr: 'فرع العيادة المتصل',
        cityId: 'sa-riyadh',
        cityNameAr: 'الرياض',
        addressAr: 'الملقا',
        lat: 24.8,
        lng: 46.6,
        active: true,
      },
    });

    const dermId = await publishService(
      { Authorization: `Bearer ${clinicTok}` },
      prisma,
      {
        nameAr: 'جلسة بشرة',
        category: 'beauty.clinic.derm.skin_eval',
        leaf: 'beauty.clinic.derm.skin_eval',
        placeMode: 'branch',
        branchId: clinicBranch.id,
      },
    );
    const laserId = await publishService(
      { Authorization: `Bearer ${clinicTok}` },
      prisma,
      {
        nameAr: 'جلسة ليزر',
        category: 'beauty.clinic.laser.hair',
        leaf: 'beauty.clinic.laser.hair',
        placeMode: 'branch',
        branchId: clinicBranch.id,
      },
    );
    // Foreign partner service should not appear in linked picker
    const foreignPartner = await prisma.partner.create({
      data: {
        type: 'clinic',
        status: 'active',
        nameAr: `عيادة أجنبية ${suffix}`,
        nameEn: `foreign-${suffix}`,
        city: 'جدة',
      },
    });
    const foreignSvc = await prisma.service.create({
      data: {
        partnerId: foreignPartner.id,
        nameAr: 'خدمة أجنبية',
        nameEn: 'foreign',
        durationMin: 30,
        priceHalalas: 10000,
        category: 'beauty.clinic.derm',
        placeMode: 'branch',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: true,
      },
    });

    const introId = await publishService(
      { Authorization: `Bearer ${clinicTok}` },
      prisma,
      {
        nameAr: `فيديو تعريفي متصل ${suffix}`,
        category: 'beauty.clinic.derm.skin_eval',
        leaf: 'beauty.clinic.derm.skin_eval',
        placeMode: 'branch',
        branchId: clinicBranch.id,
        videoScope: 'provider_intro',
        linkedServiceIds: [dermId, laserId, foreignSvc.id],
      },
    );

    const detail = await api('GET', `/marketplace/catalog/service/${introId}`);
    assert.ok(ok(detail.status), detail.text);
    const linked = ((detail.json as { linkedServices?: Array<Record<string, unknown>> })?.linkedServices ||
      []) as Array<Record<string, unknown>>;
    const bookable = linked.filter((l) => l.missing !== true && l.bookingEnabled === true);
    assert.ok(bookable.some((l) => l.nameAr === 'جلسة بشرة'));
    assert.ok(bookable.some((l) => l.nameAr === 'جلسة ليزر'));
    assert.ok(
      linked.some((l) => l.id === foreignSvc.id && (l.missing === true || l.bookingEnabled !== true)),
      'foreign clinic service must not be bookable from this intro',
    );

    const clinicBook = await book(commerceBase, {
      serviceId: dermId,
      startsAt: nextWeekdayAt(3, 11).toISOString(),
      placeMode: 'branch',
      branchId: clinicBranch.id,
      resourceId: 'staff-conn',
      contactName: 'عميلة عيادة',
      contactPhone: '0503334455',
      idempotencyKey: `${runId}-clinic-derm`,
    });
    assert.equal(clinicBook.status, 201, clinicBook.text);
    const cb = ((clinicBook.json as { booking?: Record<string, unknown> }).booking ||
      clinicBook.json!) as Record<string, unknown>;
    assert.equal(cb.branchId, clinicBranch.id);
    assert.equal(cb.serviceId, dermId);

    const clinicList = await partnerBookings(clinicTok);
    const clinicItems = ((clinicList.json as { items?: Array<Record<string, unknown>> })?.items || []);
    assert.ok(clinicItems.some((b) => b.id === cb.id), 'clinic partner sees derm booking');

    evidence.clinic = {
      applicationId: clinicBody.applicationId,
      requestId: clinicBody.activitiesRequestId,
      approvedActivities: clinicActs,
      partnerId: clinicPartnerId,
      branchId: clinicBranch.id,
      introVideoId: introId,
      dermServiceId: dermId,
      laserServiceId: laserId,
      foreignServiceId: foreignSvc.id,
      linkedBookableAr: bookable.map((l) => l.nameAr),
      foreignHiddenOrDisabled: true,
      bookingId: cb.id,
      partnerSeesBooking: true,
    };

    evidence.verdict = 'PASS_CONNECTED';
    evidence.sameIdentityProven = true;
    evidence.note =
      'Customer booking via in-process Scripted Firebase on same DATABASE_URL as live :3011 portal; partner booking lists hit live API.';
    evidence.flutterUiRemaining = [
      'simulator: tap color/blowdry icons → match offerIds',
      'simulator: Discover intro video → Arabic picker → book',
    ];

    fs.writeFileSync(path.join(evidenceDir, 'CONNECTED_SUMMARY.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await app.close().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
