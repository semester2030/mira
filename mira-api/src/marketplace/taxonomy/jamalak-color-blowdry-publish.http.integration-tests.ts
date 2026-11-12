/**
 * Jamalak §5: publish color + blowdry under hair leaves; catalog leaf queries must isolate offerIds.
 * Seeds via partner-shaped rows (local DB) then hits running API catalog (or in-process if BASE unset).
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const base = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const runId = `cb-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(2).toString('hex')}`;

async function req(path: string) {
  const res = await fetch(`${base}${path}`, { headers: { accept: 'application/json' } });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function itemsOf(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) return json as Array<Record<string, unknown>>;
  if (json && typeof json === 'object' && Array.isArray((json as { items?: unknown }).items)) {
    return (json as { items: Array<Record<string, unknown>> }).items;
  }
  return [];
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const suffix = runId.slice(-8);

  const salon = await prisma.partner.create({
    data: {
      type: 'salon',
      status: 'active',
      nameAr: `صالون صبغة استشوار ${suffix}`,
      nameEn: `color-blow-${suffix}`,
      city: 'الرياض',
      activitiesMeta: { providerKind: 'facility', bookingActivated: true },
    },
  });

  const color = await prisma.service.create({
    data: {
      partnerId: salon.id,
      nameAr: `صبغة وجذور ${suffix}`,
      nameEn: `color-${suffix}`,
      durationMin: 90,
      priceHalalas: 25000,
      category: 'hair',
      contentStatus: 'published',
      catalogSource: 'catalog',
      active: true,
      bookingEnabled: true,
      placeMode: 'branch',
      profileId: 'service.salon_hair_color',
      attributesJson: {
        subcategory: 'beauty.hair.color',
        taxonomyLeaf: 'beauty.hair.color',
      },
    },
  });

  const blowdry = await prisma.service.create({
    data: {
      partnerId: salon.id,
      nameAr: `استشوار ${suffix}`,
      nameEn: `blowdry-${suffix}`,
      durationMin: 45,
      priceHalalas: 12000,
      category: 'hair',
      contentStatus: 'published',
      catalogSource: 'catalog',
      active: true,
      bookingEnabled: true,
      placeMode: 'branch',
      profileId: 'service.salon_hair_blowdry',
      attributesJson: {
        subcategory: 'beauty.hair.blowdry',
        taxonomyLeaf: 'beauty.hair.blowdry',
      },
    },
  });

  try {
    const colorQ = await req(
      `/marketplace/catalog?kind=service&lane=beauty&subcategory=${encodeURIComponent('beauty.hair.color')}`,
    );
    assert.equal(colorQ.status, 200, 'color catalog');
    const colorItems = itemsOf(colorQ.json);
    assert.ok(
      colorItems.some((i) => i.id === color.id),
      `color offer ${color.id} missing under beauty.hair.color`,
    );
    assert.ok(
      !colorItems.some((i) => i.id === blowdry.id),
      'blowdry must not appear under color leaf',
    );

    const blowQ = await req(
      `/marketplace/catalog?kind=service&lane=beauty&subcategory=${encodeURIComponent('beauty.hair.blowdry')}`,
    );
    assert.equal(blowQ.status, 200, 'blowdry catalog');
    const blowItems = itemsOf(blowQ.json);
    assert.ok(
      blowItems.some((i) => i.id === blowdry.id),
      `blowdry offer ${blowdry.id} missing under beauty.hair.blowdry`,
    );
    assert.ok(
      !blowItems.some((i) => i.id === color.id),
      'color must not appear under blowdry leaf',
    );

    // Parent «الشعر» alone is NOT proof — ensure leaf queries differ
    const hairParent = await req(
      `/marketplace/catalog?kind=service&lane=beauty&category=${encodeURIComponent('beauty.hair')}`,
    );
    const hairItems = itemsOf(hairParent.json);
    const bothUnderParent =
      hairItems.some((i) => i.id === color.id) && hairItems.some((i) => i.id === blowdry.id);

    console.log(
      JSON.stringify(
        {
          runId,
          verdict: 'PASS',
          partnerId: salon.id,
          colorOfferId: color.id,
          blowdryOfferId: blowdry.id,
          colorQuery: 'subcategory=beauty.hair.color',
          blowdryQuery: 'subcategory=beauty.hair.blowdry',
          bothUnderHairParent: bothUnderParent,
          note: 'Flutter icons must send these subcategory ids — not Arabic name filters',
        },
        null,
        2,
      ),
    );
  } finally {
    // Keep offers for Flutter device proof; cleanup only if CLEANUP=1
    if (process.env.CLEANUP === '1') {
      await prisma.service.deleteMany({ where: { partnerId: salon.id } });
      await prisma.partner.delete({ where: { id: salon.id } });
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
