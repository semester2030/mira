/**
 * P3.1 defect closure — ghost variants, mode-switch+reserve source, product-pool, untracked semantics.
 * Isolated DB only.
 *
 * Run: DATABASE_URL=… npx tsx src/partners-portal/p31-inventory-defects.integration-tests.ts
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { VariantInventoryService } from './variant-inventory.service';
import { CommerceService, partnerActor } from '../marketplace/commerce.service';

const outDir =
  process.env.MIRA_P31_OUT_DIR ||
  join(process.cwd(), '..', 'audit-out', 'p2-p31-final', 'logs', 'p31-defects');
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
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`Refuse host ${host}`);
}

function errCode(e: unknown): string {
  const resp =
    typeof (e as { getResponse?: () => unknown }).getResponse === 'function'
      ? (e as { getResponse: () => unknown }).getResponse()
      : (e as { response?: unknown })?.response || (e as Error)?.message;
  return JSON.stringify(resp || e);
}

async function main() {
  requireLocalDb();
  const startedUtc = new Date().toISOString();
  const commit = process.env.MIRA_P21_COMMIT || process.env.MIRA_TEST_COMMIT || 'unknown';
  const prisma = new PrismaClient();
  const inv = new VariantInventoryService(prisma as never);
  const commerce = new CommerceService(prisma as never);
  const run = randomUUID().slice(0, 8);
  const cleanup: Array<() => Promise<void>> = [];

  try {
    const partner = await prisma.partner.create({
      data: { type: 'brand', status: 'active', nameAr: `P31D ${run}`, nameEn: `p31d-${run}`, city: 'الرياض' },
    });
    cleanup.push(async () => {
      await prisma.partner.delete({ where: { id: partner.id } }).catch(() => undefined);
    });
    const partnerUser = await prisma.partnerUser.create({
      data: { partnerId: partner.id, email: `p31d-${run}@test.local`, accessToken: `tok-${run}` },
    });
    const user = await prisma.user.create({
      data: { firebaseUid: `fb-${run}`, email: `cust-${run}@test.local` },
    });
    cleanup.push(async () => {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      await prisma.partnerUser.delete({ where: { id: partnerUser.id } }).catch(() => undefined);
    });
    const customer = { type: 'customer' as const, id: user.id, userId: user.id };
    const partnerAct = partnerActor(partnerUser.id, partner.id);

    // —— Ghost / foreign / mixed upsert ——
    const product = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'منتج تركيبات',
        nameEn: `var-${run}`,
        priceHalalas: 5000,
        purchaseMode: 'internal_cod',
        stockQty: 10,
        inventoryMode: 'product',
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'published',
        reviewStatus: 'none',
        active: true,
        catalogSource: 'catalog',
        deliveryFeeHalalas: 0,
        optionsJson: [{ id: 'size', labelAr: 'المقاس', values: [{ id: 'm', labelAr: 'M' }, { id: 'l', labelAr: 'L' }] }],
        variantsJson: [
          { id: 'v-m', selections: { size: 'm' }, available: true, mediaIds: [] },
          { id: 'v-l', selections: { size: 'l' }, available: true, mediaIds: [] },
        ],
      },
    });
    cleanup.push(async () => {
      await prisma.productVariantInventory.deleteMany({ where: { productId: product.id } }).catch(() => undefined);
      await prisma.product.delete({ where: { id: product.id } }).catch(() => undefined);
    });

    let ghostRejected = false;
    try {
      await inv.upsertMany(partner.id, product.id, {
        inventoryMode: 'variant',
        rows: [{ variantId: 'ghost-99', stockQty: 99 }],
      });
    } catch (e) {
      ghostRejected = /VARIANT_NOT_ON_PRODUCT|غير موجودة/.test(errCode(e));
    }
    record('P31_GHOST_VARIANT_REJECT', ghostRejected);

    const other = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'منتج آخر',
        nameEn: `other-${run}`,
        priceHalalas: 1000,
        purchaseMode: 'internal_cod',
        stockQty: null,
        inventoryMode: 'product',
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'published',
        reviewStatus: 'none',
        active: true,
        catalogSource: 'catalog',
        deliveryFeeHalalas: 0,
        variantsJson: [{ id: 'foreign-v', selections: {}, available: true }],
      },
    });
    cleanup.push(async () => {
      await prisma.product.delete({ where: { id: other.id } }).catch(() => undefined);
    });

    let foreignRejected = false;
    try {
      await inv.upsertMany(partner.id, product.id, {
        inventoryMode: 'variant',
        rows: [{ variantId: 'foreign-v', stockQty: 5 }],
      });
    } catch (e) {
      foreignRejected = /VARIANT_NOT_ON_PRODUCT|غير موجودة/.test(errCode(e));
    }
    record('P31_FOREIGN_VARIANT_REJECT', foreignRejected);

    let mixedNoPartial = false;
    try {
      await inv.upsertMany(partner.id, product.id, {
        inventoryMode: 'variant',
        rows: [
          { variantId: 'v-m', stockQty: 10 },
          { variantId: 'ghost-x', stockQty: 3 },
        ],
      });
    } catch (e) {
      mixedNoPartial = /VARIANT_NOT_ON_PRODUCT|غير موجودة/.test(errCode(e));
    }
    const rowsAfterMixed = await prisma.productVariantInventory.count({ where: { productId: product.id } });
    const modeAfterMixed = (await prisma.product.findUnique({ where: { id: product.id } }))?.inventoryMode;
    record('P31_MIXED_NO_PARTIAL', mixedNoPartial && rowsAfterMixed === 0 && modeAfterMixed === 'product', {
      rowsAfterMixed,
      modeAfterMixed,
    });

    const okUpsert = await inv.upsertMany(partner.id, product.id, {
      inventoryMode: 'variant',
      rows: [
        { variantId: 'v-m', stockQty: 10 },
        { variantId: 'v-l', stockQty: 5 },
      ],
    });
    record('P31_VALID_UPSERT_IDENTITY', okUpsert.derivedStockQty === 15 && okUpsert.rows.length === 2, {
      derived: okUpsert.derivedStockQty,
    });

    // —— Untracked vs tracked null vs zero ——
    await inv.upsertMany(partner.id, product.id, {
      rows: [
        { variantId: 'v-m', stockMode: 'untracked', stockQty: null, expectedRevision: okUpsert.rows.find((r) => r.variantId === 'v-m')!.revision },
        { variantId: 'v-l', stockMode: 'tracked', stockQty: null, expectedRevision: okUpsert.rows.find((r) => r.variantId === 'v-l')!.revision },
      ],
    });
    await commerce.addCartItem(customer, { productId: product.id, quantity: 1, variantKey: 'v-m', selections: { size: 'm' } });
    const cartUntracked = await commerce.getCart(customer);
    const untrackedLineIssues =
      cartUntracked.lines?.some?.((l: { issues?: unknown[] }) => (l.issues || []).length > 0) === true;
    const untrackedOk = !untrackedLineIssues;
    // clear and test tracked null rejects
    await commerce.clearCart(customer);
    let unspecifiedRejected = false;
    try {
      await commerce.addCartItem(customer, { productId: product.id, quantity: 1, variantKey: 'v-l', selections: { size: 'l' } });
    } catch (e) {
      unspecifiedRejected = /STOCK_UNSPECIFIED|غير محددة/.test(errCode(e));
    }
    record('P31_UNTRACKED_CART_OK', untrackedOk, {
      untrackedLineIssues,
      lines: cartUntracked.lines?.map?.((l: { issues?: unknown[] }) => l.issues) ?? null,
    });
    record('P31_TRACKED_NULL_REJECT', unspecifiedRejected);

    // reset stocks for remaining tests
    const cur = await inv.list(product.id);
    await inv.upsertMany(partner.id, product.id, {
      rows: [
        { variantId: 'v-m', stockMode: 'tracked', stockQty: 4, expectedRevision: cur.find((r) => r.variantId === 'v-m')!.revision },
        { variantId: 'v-l', stockMode: 'tracked', stockQty: 4, expectedRevision: cur.find((r) => r.variantId === 'v-l')!.revision },
      ],
    });

    // —— Product-mode shared pool regression ——
    const poolProduct = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'مخزون إجمالي',
        nameEn: `pool-${run}`,
        priceHalalas: 2000,
        purchaseMode: 'internal_cod',
        stockQty: 5,
        reservedQty: 0,
        inventoryMode: 'product',
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'published',
        reviewStatus: 'none',
        active: true,
        catalogSource: 'catalog',
        deliveryFeeHalalas: 0,
        optionsJson: [{ id: 'size', labelAr: 'المقاس', values: [{ id: 'm', labelAr: 'M' }, { id: 'l', labelAr: 'L' }] }],
        variantsJson: [
          { id: 'p-m', selections: { size: 'm' }, available: true },
          { id: 'p-l', selections: { size: 'l' }, available: true },
        ],
      },
    });
    cleanup.push(async () => {
      await prisma.commerceCartItem.deleteMany({ where: { productId: poolProduct.id } }).catch(() => undefined);
      await prisma.product.delete({ where: { id: poolProduct.id } }).catch(() => undefined);
    });
    await commerce.clearCart(customer);
    await commerce.addCartItem(customer, { productId: poolProduct.id, quantity: 3, variantKey: 'p-m', selections: { size: 'm' } });
    let secondRejected = false;
    try {
      await commerce.addCartItem(customer, { productId: poolProduct.id, quantity: 3, variantKey: 'p-l', selections: { size: 'l' } });
    } catch (e) {
      secondRejected = /OUT_OF_STOCK|غير متوفرة/.test(errCode(e));
    }
    const cartAfter = await prisma.commerceCartItem.findMany({
      where: { productId: poolProduct.id },
    });
    const totalInCart = cartAfter.reduce((s, i) => s + i.quantity, 0);
    record('P31_PRODUCT_POOL_REJECT_SECOND', secondRejected && totalInCart === 3, { totalInCart, lines: cartAfter.length });

    // —— Reserve source survives mode switch attempt ——
    await commerce.clearCart(customer);
    // Use product-mode product with stock 5, order 2, then try switch to variant while reserved
    await prisma.product.update({ where: { id: poolProduct.id }, data: { stockQty: 5, reservedQty: 0, inventoryMode: 'product' } });
    await commerce.addCartItem(customer, { productId: poolProduct.id, quantity: 2, variantKey: 'p-m', selections: { size: 'm' } });
    // Confirm order via raw reserve path exercise: place order through commerce if possible
    // Minimal: manually reserve like checkout then attempt mode switch
    await prisma.$executeRaw`
      UPDATE products SET reserved_qty = reserved_qty + 2
      WHERE id = ${poolProduct.id} AND stock_qty - reserved_qty >= 2`;
    const order = await prisma.commerceOrder.create({
      data: {
        publicNumber: `MO-P31-${run}`,
        userId: user.id,
        partnerId: partner.id,
        fulfillmentStatus: 'new',
        deliveryStatus: 'pending',
        paymentMethod: 'cod',
        paymentCollectionStatus: 'uncollected',
        subtotalHalalas: 4000,
        deliveryFeeHalalas: 0,
        totalHalalas: 4000,
        currency: 'SAR',
        contactName: 'اختبار',
        contactPhone: '0500000000',
        addressLine: 'شارع',
        city: 'الرياض',
        items: {
          create: [
            {
              productId: poolProduct.id,
              productNameAr: 'مخزون إجمالي',
              variantKey: 'p-m',
              unitPriceHalalas: 2000,
              quantity: 2,
              lineTotalHalalas: 4000,
              reservedQty: 2,
              stockState: 'reserved',
              stockSource: 'product',
            },
          ],
        },
      },
      include: { items: true },
    });
    cleanup.push(async () => {
      await prisma.commerceOrderItem.deleteMany({ where: { orderId: order.id } }).catch(() => undefined);
      await prisma.commerceOrder.delete({ where: { id: order.id } }).catch(() => undefined);
    });

    let switchBlocked = false;
    try {
      await inv.upsertMany(partner.id, poolProduct.id, { inventoryMode: 'variant', rows: [{ variantId: 'p-m', stockQty: 5 }] });
    } catch (e) {
      switchBlocked = /INVENTORY_MODE_SWITCH_BLOCKED|حجوزات/.test(errCode(e));
    }
    const modeStillProduct = (await prisma.product.findUnique({ where: { id: poolProduct.id } }))?.inventoryMode === 'product';
    record('P31_MODE_SWITCH_BLOCKED_WHILE_RESERVED', switchBlocked && modeStillProduct);

    // Release via real commerce cancel path (transitionOrderFor → releaseOrderStock).
    const beforeRel = await prisma.product.findUnique({ where: { id: poolProduct.id } });
    await commerce.transitionOrderFor(partnerAct, order.id, {
      fulfillmentStatus: 'rejected',
      note: 'رفض اختبار تحرير المخزون',
    });
    const afterRel = await prisma.product.findUnique({ where: { id: poolProduct.id } });
    const releasedItem = await prisma.commerceOrderItem.findFirst({ where: { orderId: order.id } });
    // Second reject must be idempotent — reserved_qty must not go negative / double-free.
    await commerce.transitionOrderFor(partnerAct, order.id, {
      fulfillmentStatus: 'rejected',
      note: 'تكرار رفض',
    });
    const afterTwice = await prisma.product.findUnique({ where: { id: poolProduct.id } });
    const variantRows = await prisma.productVariantInventory.count({ where: { productId: poolProduct.id } });
    record(
      'P31_RELEASE_USES_PRODUCT_SOURCE',
      (beforeRel?.reservedQty || 0) >= 2 &&
        afterRel?.reservedQty === (beforeRel!.reservedQty - 2) &&
        afterTwice?.reservedQty === afterRel?.reservedQty &&
        releasedItem?.stockState === 'released' &&
        releasedItem?.stockSource === 'product' &&
        variantRows === 0,
      {
        before: beforeRel?.reservedQty,
        after: afterRel?.reservedQty,
        afterTwice: afterTwice?.reservedQty,
        item: releasedItem,
        variantRows,
      },
    );

    // After release, mode switch allowed
    let switchOk = false;
    try {
      await inv.upsertMany(partner.id, poolProduct.id, {
        inventoryMode: 'variant',
        rows: [
          { variantId: 'p-m', stockQty: 3 },
          { variantId: 'p-l', stockQty: 2 },
        ],
      });
      switchOk = true;
    } catch (e) {
      switchOk = false;
      record('P31_MODE_SWITCH_AFTER_RELEASE', false, errCode(e));
    }
    if (switchOk) {
      const derived = await inv.derivedProductStock(poolProduct.id);
      record('P31_MODE_SWITCH_AFTER_RELEASE', derived.inventoryMode === 'variant' && derived.derivedStockQty === 5, derived);
    }

    // Independent variant pools
    await commerce.clearCart(customer);
    await commerce.addCartItem(customer, { productId: poolProduct.id, quantity: 3, variantKey: 'p-m', selections: { size: 'm' } });
    let otherVariantOk = false;
    try {
      await commerce.addCartItem(customer, { productId: poolProduct.id, quantity: 2, variantKey: 'p-l', selections: { size: 'l' } });
      otherVariantOk = true;
    } catch {
      otherVariantOk = false;
    }
    record('P31_VARIANT_POOLS_INDEPENDENT', otherVariantOk);

    // Zero tracked rejects
    const zeroProd = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'صفر',
        nameEn: `zero-${run}`,
        priceHalalas: 1000,
        purchaseMode: 'internal_cod',
        stockQty: null,
        inventoryMode: 'variant',
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'published',
        reviewStatus: 'none',
        active: true,
        catalogSource: 'catalog',
        deliveryFeeHalalas: 0,
        variantsJson: [{ id: 'z1', selections: {}, available: true }],
      },
    });
    cleanup.push(async () => {
      await prisma.productVariantInventory.deleteMany({ where: { productId: zeroProd.id } }).catch(() => undefined);
      await prisma.product.delete({ where: { id: zeroProd.id } }).catch(() => undefined);
    });
    await inv.upsertMany(partner.id, zeroProd.id, {
      inventoryMode: 'variant',
      rows: [{ variantId: 'z1', stockQty: 0 }],
    });
    await commerce.clearCart(customer);
    let zeroRejected = false;
    try {
      await commerce.addCartItem(customer, { productId: zeroProd.id, quantity: 1, variantKey: 'z1', selections: {} });
    } catch (e) {
      zeroRejected = /OUT_OF_STOCK|غير متوفرة/.test(errCode(e));
    }
    record('P31_TRACKED_ZERO_REJECT', zeroRejected);

    void partnerAct;
  } catch (e) {
    record('P31_DEFECTS_SUITE', false, String((e as Error)?.stack || e));
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await prisma.$disconnect();
  }

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    id: 'P3_1_DEFECT_CLOSURE',
    startedUtc,
    finishedUtc: new Date().toISOString(),
    commit,
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'p31-inventory-defects.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), outDir, commit }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
