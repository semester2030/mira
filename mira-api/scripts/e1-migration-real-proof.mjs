#!/usr/bin/env node
/**
 * Real E1 migration proof using isolated tables in the local test DB
 * (role may lack CREATEDB / CREATE SCHEMA):
 * pre-E1 table → insert → snapshot → apply rewritten migration SQL → compare →
 * write/read new fields → preferred rollback SELECT of core columns.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const baseUrl = process.env.DATABASE_URL || '';
if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
  console.error('REFUSE: local DATABASE_URL required');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsRoot = join(__dirname, '../prisma/migrations');
const migSub = readFileSync(
  join(migrationsRoot, '20261107210000_elegance_e1_product_subcategory/migration.sql'),
  'utf8',
);
const migDraft = readFileSync(
  join(migrationsRoot, '20261107223000_elegance_e1_draft_taxonomy/migration.sql'),
  'utf8',
);

const suffix = randomUUID().slice(0, 8).replace(/-/g, '');
const partnersTable = `e1mig_partners_${suffix}`;
const productsTable = `e1mig_products_${suffix}`;
const mediaTable = `e1mig_media_${suffix}`;
const indexName = `e1mig_cat_sub_idx_${suffix}`;

function rewriteMigration(sql) {
  const withoutComments = sql
    .split('\n')
    .map((line) => (line.trimStart().startsWith('--') ? '' : line))
    .join('\n');
  return withoutComments
    .replaceAll('"products"', `"${productsTable}"`)
    .replaceAll('"products_category_subcategory_idx"', `"${indexName}"`);
}

async function main() {
  const started = new Date().toISOString();
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "${partnersTable}" (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        city TEXT NOT NULL
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "${productsTable}" (
        id TEXT PRIMARY KEY,
        partner_id TEXT NOT NULL REFERENCES "${partnersTable}"(id),
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        price_halalas INT NOT NULL,
        external_url TEXT NOT NULL,
        category TEXT,
        stock_qty INT,
        concern_tags TEXT[] NOT NULL DEFAULT '{}',
        skin_types TEXT[] NOT NULL DEFAULT '{}',
        content_status TEXT NOT NULL,
        review_status TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT false,
        options_json JSONB,
        variants_json JSONB
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "${mediaTable}" (
        id TEXT PRIMARY KEY,
        owner_kind TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        mime_type TEXT,
        url TEXT NOT NULL
      )
    `);

    const partnerId = randomUUID();
    const productId = randomUUID();
    const mediaId = randomUUID();
    const optionsJson = [{ id: 'color', nameAr: 'لون', values: [{ id: 'black', labelAr: 'أسود' }] }];
    const variantsJson = [{ id: 'v1', selections: { color: 'black' }, available: true, priceHalalas: 7777 }];

    await prisma.$executeRawUnsafe(
      `INSERT INTO "${partnersTable}" (id, type, status, name_ar, name_en, city)
       VALUES ($1, 'brand', 'active', $2, 'mig', 'الرياض')`,
      partnerId,
      `mig ${suffix}`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${productsTable}" (
         id, partner_id, name_ar, name_en, price_halalas, external_url, category,
         stock_qty, content_status, review_status, active, options_json, variants_json
       ) VALUES (
         $1, $2, $3, $4, 7777, 'https://example.test/mig', 'clothes',
         3, 'draft', 'draft', false, $5::jsonb, $6::jsonb
       )`,
      productId,
      partnerId,
      `قبل ${suffix}`,
      `before-${suffix}`,
      JSON.stringify(optionsJson),
      JSON.stringify(variantsJson),
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${mediaTable}" (id, owner_kind, owner_id, kind, mime_type, url)
       VALUES ($1, 'product', $2, 'image', 'image/png', 'memory://mig.png')`,
      mediaId,
      productId,
    );

    const preCols = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name=$1
         AND column_name IN (
           'subcategory','attributes_json','draft_subcategory','draft_taxonomy_set','draft_attributes_json'
         )`,
      productsTable,
    );
    assert.equal(preCols.length, 0, 'pre-E1 table must not have E1 columns');

    const beforeSnap = await prisma.$queryRawUnsafe(
      `SELECT id, partner_id, price_halalas, stock_qty, name_ar, category, options_json, variants_json
       FROM "${productsTable}" WHERE id=$1`,
      productId,
    );
    const ref = beforeSnap[0];
    assert.ok(ref);

    for (const stmt of rewriteMigration(migSub)
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt);
    }
    for (const stmt of rewriteMigration(migDraft)
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt);
    }

    const afterSnap = await prisma.$queryRawUnsafe(
      `SELECT id, partner_id, price_halalas, stock_qty, name_ar, category,
              subcategory, attributes_json, draft_taxonomy_set, draft_subcategory, draft_attributes_json,
              options_json, variants_json
       FROM "${productsTable}" WHERE id=$1`,
      productId,
    );
    const row = afterSnap[0];
    assert.equal(row.id, ref.id);
    assert.equal(row.partner_id, ref.partner_id);
    assert.equal(Number(row.price_halalas), Number(ref.price_halalas));
    assert.equal(Number(row.stock_qty), Number(ref.stock_qty));
    assert.equal(row.name_ar, ref.name_ar);
    assert.equal(row.category, ref.category);
    assert.deepEqual(row.options_json, ref.options_json);
    assert.deepEqual(row.variants_json, ref.variants_json);
    assert.equal(row.subcategory, null);
    assert.equal(row.attributes_json, null);
    assert.equal(row.draft_taxonomy_set, false);

    const mediaAfter = await prisma.$queryRawUnsafe(
      `SELECT id, owner_id FROM "${mediaTable}" WHERE id=$1`,
      mediaId,
    );
    assert.equal(mediaAfter[0].owner_id, productId);

    await prisma.$executeRawUnsafe(
      `UPDATE "${productsTable}" SET subcategory='clothes.abaya', attributes_json=$2::jsonb,
        draft_taxonomy_set=true, draft_subcategory='clothes.evening', draft_attributes_json=$3::jsonb
       WHERE id=$1`,
      productId,
      JSON.stringify({ material: ['silk'] }),
      JSON.stringify({ material: ['cotton'] }),
    );
    const written = await prisma.$queryRawUnsafe(
      `SELECT subcategory, attributes_json, draft_taxonomy_set, draft_subcategory, draft_attributes_json,
              price_halalas, stock_qty, partner_id
       FROM "${productsTable}" WHERE id=$1`,
      productId,
    );
    assert.equal(written[0].subcategory, 'clothes.abaya');
    assert.deepEqual(written[0].attributes_json, { material: ['silk'] });
    assert.equal(written[0].draft_taxonomy_set, true);
    assert.equal(written[0].draft_subcategory, 'clothes.evening');
    assert.deepEqual(written[0].draft_attributes_json, { material: ['cotton'] });
    assert.equal(Number(written[0].price_halalas), 7777);
    assert.equal(Number(written[0].stock_qty), 3);
    assert.equal(written[0].partner_id, partnerId);

    const priorApp = await prisma.$queryRawUnsafe(
      `SELECT id, partner_id, price_halalas, stock_qty, name_ar, category, options_json, variants_json
       FROM "${productsTable}" WHERE id=$1`,
      productId,
    );
    assert.equal(priorApp[0].id, productId);
    assert.equal(Number(priorApp[0].price_halalas), 7777);
    assert.deepEqual(priorApp[0].options_json, ref.options_json);

    console.log(
      JSON.stringify(
        {
          verdict: 'E1_MIGRATION_REAL_PROOF_PASS',
          started,
          ended: new Date().toISOString(),
          isolatedTables: { partnersTable, productsTable, mediaTable },
          productId,
          partnerId,
          mediaId,
          migrationsApplied: [
            '20261107210000_elegance_e1_product_subcategory',
            '20261107223000_elegance_e1_draft_taxonomy',
          ],
          note: 'Migration SQL applied verbatim with table/index names rewritten onto isolated pre-E1 tables so the ALTER runs between snapshots without touching live products.',
          rollbackPreferred:
            'Redeploy prior app build against DB that still has additive columns; core SELECT/UPDATE paths remain valid. Do not DROP COLUMN on production after dependent writes.',
        },
        null,
        2,
      ),
    );
  } finally {
    for (const t of [mediaTable, productsTable, partnersTable]) {
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}" CASCADE`);
      } catch {
        /* ignore */
      }
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
