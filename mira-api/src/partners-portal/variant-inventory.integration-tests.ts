/**
 * P3.1 — ProductVariantInventory adapter (isolated DB).
 * Distinguishes empty stock vs 0; refuses silent product→variant redistribution;
 * revision conflicts; partner isolation.
 *
 * Run: DATABASE_URL=… npx tsx src/partners-portal/variant-inventory.integration-tests.ts
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { VariantInventoryService } from './variant-inventory.service';

const outDir =
  process.env.MIRA_P31_OUT_DIR ||
  process.env.MIRA_P21_OUT_DIR ||
  join(process.cwd(), '..', 'audit-out', 'p2-closure-next', 'logs', 'p31-inv');
mkdirSync(outDir, { recursive: true });

type Step = { id: string; ok: boolean; detail?: unknown };
const steps: Step[] = [];
function record(id: string, ok: boolean, detail?: unknown) {
  steps.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail }));
}

function requireLocalDb() {
  const url = process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL required');
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`Refuse non-local DATABASE_URL host=${host}`);
  }
}

async function main() {
  requireLocalDb();
  const startedUtc = new Date().toISOString();
  const commit = process.env.MIRA_P21_COMMIT || 'unknown';
  const prisma = new PrismaClient();
  const svc = new VariantInventoryService(prisma as never);
  const run = randomUUID().slice(0, 8);
  let partnerA: string | null = null;
  let partnerB: string | null = null;
  let productId: string | null = null;

  try {
    const pa = await prisma.partner.create({
      data: {
        nameAr: `P31-A-${run}`,
        nameEn: `p31-a-${run}`,
        type: 'brand',
        status: 'active',
        city: 'الرياض',
        contactPhone: '0500000001',
      },
    });
    partnerA = pa.id;
    const pb = await prisma.partner.create({
      data: {
        nameAr: `P31-B-${run}`,
        nameEn: `p31-b-${run}`,
        type: 'brand',
        status: 'active',
        city: 'جدة',
        contactPhone: '0500000002',
      },
    });
    partnerB = pb.id;

    const product = await prisma.product.create({
      data: {
        partnerId: pa.id,
        nameAr: `منتج P31 ${run}`,
        nameEn: `p31-${run}`,
        priceHalalas: 5000,
        purchaseMode: 'internal_cod',
        stockQty: 10,
        inventoryMode: 'product',
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'draft',
        reviewStatus: 'draft',
        active: true,
        catalogSource: 'catalog',
      },
    });
    productId = product.id;

    // Refuse silent redistribute when product has stock and no rows.
    let refused = false;
    try {
      await svc.upsertMany(pa.id, product.id, { inventoryMode: 'variant' });
    } catch (e) {
      refused = /توزيع|تركيبات/.test(String((e as Error)?.message || e));
    }
    record('P31_REFUSE_SILENT_REDISTRIBUTE', refused);

    // Empty stock stays null (not 0); zero is explicit.
    const up = await svc.upsertMany(pa.id, product.id, {
      inventoryMode: 'variant',
      rows: [
        { variantId: 'v-empty', variantKey: 'v-empty', stockQty: null },
        { variantId: 'v-zero', variantKey: 'v-zero', stockQty: 0 },
        { variantId: 'v-five', variantKey: 'v-five', stockQty: 5 },
      ],
    });
    const empty = up.rows.find((r) => r.variantId === 'v-empty');
    const zero = up.rows.find((r) => r.variantId === 'v-zero');
    const five = up.rows.find((r) => r.variantId === 'v-five');
    record('P31_EMPTY_VS_ZERO', !!(empty && empty.stockQty === null && zero && zero.stockQty === 0 && five && five.stockQty === 5), {
      empty: empty?.stockQty,
      zero: zero?.stockQty,
      five: five?.stockQty,
      derived: up.derivedStockQty,
    });
    // derived is null when any tracked row is unspecified
    record('P31_DERIVED_NULL_WHEN_UNSPECIFIED', up.derivedStockQty === null, { derived: up.derivedStockQty });

    // Fill empty → derived becomes sum
    const filled = await svc.upsertMany(pa.id, product.id, {
      rows: [{ variantId: 'v-empty', stockQty: 2, expectedRevision: empty!.revision }],
    });
    record('P31_DERIVED_SUM', filled.derivedStockQty === 2 + 0 + 5, { derived: filled.derivedStockQty });

    // Revision conflict
    let conflictOk = false;
    try {
      await svc.upsertMany(pa.id, product.id, {
        rows: [{ variantId: 'v-five', stockQty: 4, expectedRevision: 0 }],
      });
    } catch (e) {
      const resp = typeof (e as { getResponse?: () => unknown }).getResponse === 'function'
        ? (e as { getResponse: () => unknown }).getResponse()
        : null;
      const blob = JSON.stringify(resp || (e as Error)?.message || e);
      conflictOk =
        /VARIANT_INVENTORY_REVISION_CONFLICT|تعارض|Conflict/i.test(blob) ||
        (e as { status?: number }).status === 409;
    }
    record('P31_REVISION_CONFLICT', conflictOk);

    // Partner isolation
    let isolated = false;
    try {
      await svc.upsertMany(pb.id, product.id, {
        rows: [{ variantId: 'v-five', stockQty: 99 }],
      });
    } catch {
      isolated = true;
    }
    const still = await svc.list(product.id);
    const fiveAfter = still.find((r) => r.variantId === 'v-five');
    record('P31_PARTNER_ISOLATION', isolated && fiveAfter?.stockQty === 5, { fiveAfter: fiveAfter?.stockQty });

    // availableForVariant
    const avail = await svc.availableForVariant(product.id, 'v-five');
    record('P31_AVAILABLE_FOR_VARIANT', avail === 5, { avail });

    // Identity preserved across label-like update (same variantId)
    const beforeIds = (await svc.list(product.id)).map((r) => r.variantId).sort();
    await svc.upsertMany(pa.id, product.id, {
      rows: [
        {
          variantId: 'v-five',
          variantKey: 'v-five',
          stockQty: 5,
          expectedRevision: fiveAfter!.revision,
        },
      ],
    });
    const afterIds = (await svc.list(product.id)).map((r) => r.variantId).sort();
    record('P31_ROW_IDENTITY', JSON.stringify(beforeIds) === JSON.stringify(afterIds), { beforeIds, afterIds });
  } catch (e) {
    record('P31_SUITE', false, String((e as Error)?.stack || e));
  } finally {
    if (productId) {
      await prisma.productVariantInventory.deleteMany({ where: { productId } }).catch(() => undefined);
      await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
    }
    if (partnerA) await prisma.partner.delete({ where: { id: partnerA } }).catch(() => undefined);
    if (partnerB) await prisma.partner.delete({ where: { id: partnerB } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    id: 'P3_1_VARIANT_INVENTORY',
    startedUtc,
    finishedUtc: new Date().toISOString(),
    commit,
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'variant-inventory.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), outDir }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
