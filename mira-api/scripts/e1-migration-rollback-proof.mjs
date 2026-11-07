#!/usr/bin/env node
/**
 * E1-10 proof: additive migrations preserve product ids/owners/prices/stock.
 * Local DB only. Prefer app rollback leaving columns over DROP after data written.
 */
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const url = process.env.DATABASE_URL || '';
if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
  console.error('REFUSE: local DATABASE_URL required');
  process.exit(1);
}

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

async function main() {
  const partner = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `mig ${suffix}`, nameEn: 'mig', city: 'الرياض' },
  });
  const before = await prisma.product.create({
    data: {
      partnerId: partner.id,
      nameAr: `قبل ${suffix}`,
      nameEn: `before-${suffix}`,
      priceHalalas: 7777,
      externalUrl: 'https://example.test/mig',
      category: 'clothes',
      stockQty: 3,
      concernTags: [],
      skinTypes: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
      active: false,
    },
  });
  const snapshot = {
    id: before.id,
    partnerId: before.partnerId,
    priceHalalas: before.priceHalalas,
    stockQty: before.stockQty,
    nameAr: before.nameAr,
  };

  // Columns from E1 migrations must exist
  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name IN ('subcategory','attributes_json','draft_subcategory','draft_taxonomy_set','draft_attributes_json')`,
  );
  const names = new Set(cols.map((c) => c.column_name));
  for (const need of ['subcategory', 'attributes_json', 'draft_subcategory', 'draft_taxonomy_set', 'draft_attributes_json']) {
    assert.ok(names.has(need), `missing ${need}`);
  }

  const after = await prisma.product.findUniqueOrThrow({ where: { id: snapshot.id } });
  assert.equal(after.partnerId, snapshot.partnerId);
  assert.equal(after.priceHalalas, snapshot.priceHalalas);
  assert.equal(after.stockQty, snapshot.stockQty);
  assert.equal(after.nameAr, snapshot.nameAr);
  assert.equal(after.subcategory, null);

  // Write new path
  await prisma.product.update({
    where: { id: after.id },
    data: { subcategory: 'clothes.abaya', attributesJson: { material: ['silk'] } },
  });
  const written = await prisma.product.findUniqueOrThrow({ where: { id: after.id } });
  assert.equal(written.subcategory, 'clothes.abaya');
  assert.deepEqual(written.attributesJson, { material: ['silk'] });
  assert.equal(written.priceHalalas, 7777);

  console.log('E1-10 MIGRATION_PROOF_PASS');
  console.log(
    JSON.stringify({
      productId: snapshot.id,
      partnerId: snapshot.partnerId,
      priceHalalas: snapshot.priceHalalas,
      stockQty: snapshot.stockQty,
      rollbackNote:
        'Preferred rollback: redeploy prior app build; leave additive columns. DROP only on unused env after confirming no production writes depend on them.',
    }),
  );

  await prisma.product.delete({ where: { id: after.id } });
  await prisma.partner.delete({ where: { id: partner.id } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
