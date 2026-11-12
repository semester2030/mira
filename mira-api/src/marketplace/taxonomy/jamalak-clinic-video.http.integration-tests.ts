/**
 * Jamalak §4: clinic intro video linked to two published services; detail returns Arabic linkedServices.
 * Foreign/unpublished/disabled links marked missing or bookingEnabled=false.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const base = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const runId = `clinic-vid-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const partnerIds: string[] = [];

  try {
    const clinic = await prisma.partner.create({
      data: {
        type: 'clinic',
        status: 'active',
        nameAr: `عيادة فيديو ${runId}`,
        nameEn: `clinic-${runId}`,
        city: 'الرياض',
        activitiesMeta: { providerKind: 'facility', bookingActivated: true, publicContactVisible: false },
      },
    });
    partnerIds.push(clinic.id);
    const other = await prisma.partner.create({
      data: {
        type: 'clinic',
        status: 'active',
        nameAr: `عيادة أخرى ${runId}`,
        nameEn: `other-${runId}`,
        city: 'الرياض',
        activitiesMeta: { providerKind: 'facility', bookingActivated: true },
      },
    });
    partnerIds.push(other.id);

    const derm = await prisma.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'جلسة بشرة',
        nameEn: 'derm',
        durationMin: 45,
        priceHalalas: 20000,
        category: 'beauty.clinic.derm',
        placeMode: 'branch',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: true,
      },
    });
    const laser = await prisma.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'جلسة ليزر',
        nameEn: 'laser',
        durationMin: 30,
        priceHalalas: 35000,
        category: 'beauty.clinic.laser',
        placeMode: 'branch',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: true,
      },
    });
    const draft = await prisma.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'مسودة غير منشورة',
        nameEn: 'draft',
        durationMin: 20,
        priceHalalas: 10000,
        category: 'beauty.clinic.derm',
        active: false,
        contentStatus: 'draft',
        catalogSource: 'catalog',
        bookingEnabled: true,
      },
    });
    const foreign = await prisma.service.create({
      data: {
        partnerId: other.id,
        nameAr: 'خدمة عيادة أخرى',
        nameEn: 'foreign',
        durationMin: 20,
        priceHalalas: 10000,
        category: 'beauty.clinic.derm',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: true,
      },
    });

    const intro = await prisma.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: 'فيديو تعريفي للعيادة',
        nameEn: 'intro',
        durationMin: 1,
        priceHalalas: 0,
        category: 'beauty.clinics',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: false,
        attributesJson: {
          videoScope: 'provider_intro',
          linkedServiceIds: [derm.id, laser.id, draft.id, foreign.id],
        },
      },
    });

    // priceHalalas 0 may fail bookability elsewhere — intro is video shell
    await prisma.service.update({
      where: { id: intro.id },
      data: { priceHalalas: 1, durationMin: 1 },
    });

    const res = await fetch(`${base}/marketplace/catalog/service/${intro.id}`, {
      headers: { accept: 'application/json' },
    });
    const raw = await res.text();
    assert.equal(res.status, 200, raw);
    const body = JSON.parse(raw) as {
      videoScope?: string;
      linkedServices?: Array<{
        id: string;
        nameAr?: string | null;
        missing?: boolean;
        bookingEnabled?: boolean;
      }>;
      contactPhone?: string | null;
    };
    assert.equal(body.videoScope, 'provider_intro');
    assert.equal(body.contactPhone ?? null, null);
    const linked = body.linkedServices || [];
    const dermL = linked.find((l) => l.id === derm.id);
    const laserL = linked.find((l) => l.id === laser.id);
    const draftL = linked.find((l) => l.id === draft.id);
    const foreignL = linked.find((l) => l.id === foreign.id);
    assert.equal(dermL?.nameAr, 'جلسة بشرة');
    assert.equal(laserL?.nameAr, 'جلسة ليزر');
    assert.equal(dermL?.bookingEnabled, true);
    assert.equal(laserL?.bookingEnabled, true);
    assert.equal(draftL?.missing, true);
    assert.equal(foreignL?.missing, true);

    const bookable = linked.filter((l) => !l.missing && l.bookingEnabled && l.nameAr);
    assert.equal(bookable.length, 2);

    console.log(
      JSON.stringify(
        {
          runId,
          verdict: 'PASS',
          introId: intro.id,
          linkedBookable: bookable.map((b) => ({ id: b.id, nameAr: b.nameAr })),
          flutterPath: 'openServiceBookingFlow → Arabic sheet → CatalogRecordScope',
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.service.deleteMany({ where: { partnerId: { in: partnerIds } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
