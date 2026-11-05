/**
 * D1–D4 + T1 path tests — real CommerceService / VariantInventoryService on isolated DB.
 * No || true. Release/consume via transitionOrderFor. Checkout via createOrder.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceService, partnerActor } from '../marketplace/commerce.service';
import { VariantInventoryService } from './variant-inventory.service';

const outDir =
  process.env.MIRA_P31_OUT_DIR ||
  join(process.cwd(), '..', 'audit-out', 'p2-p31-final2', 'logs', 'd1-d4');
mkdirSync(outDir, { recursive: true });

type Step = { id: string; ok: boolean; detail?: unknown };
const steps: Step[] = [];
function record(id: string, ok: boolean, detail?: unknown) {
  steps.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail }));
}

function errBlob(e: unknown): string {
  const resp =
    typeof (e as { getResponse?: () => unknown }).getResponse === 'function'
      ? (e as { getResponse: () => unknown }).getResponse()
      : (e as Error)?.message;
  return JSON.stringify(resp || e);
}

function requireLocal() {
  const url = process.env.DATABASE_URL || '';
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error(`Refuse ${host}`);
}

async function main() {
  requireLocal();
  const startedUtc = new Date().toISOString();
  const commit = process.env.MIRA_P21_COMMIT || process.env.MIRA_TEST_COMMIT || 'unknown';
  const prisma = new PrismaClient();
  const commerce = new CommerceService(prisma as unknown as PrismaService);
  const inv = new VariantInventoryService(prisma as never);
  const run = randomUUID().slice(0, 8);
  const cleanup: Array<() => Promise<void>> = [];

  const delivery = (key: string, extra: Record<string, unknown> = {}) => ({
    idempotencyKey: key,
    contactName: 'سارة',
    contactPhone: '0501234567',
    addressLine: 'حي النرجس ١٢',
    city: 'الرياض',
    ...extra,
  });

  try {
    const partner = await prisma.partner.create({
      data: { type: 'brand', status: 'active', nameAr: `D14 ${run}`, nameEn: `d14-${run}`, city: 'الرياض' },
    });
    const pu = await prisma.partnerUser.create({
      data: { partnerId: partner.id, email: `d14-${run}@t.local`, accessToken: `tok-d14-${run}` },
    });
    const actor = partnerActor(pu.id, partner.id);
    const user = await commerce.customerActor({
      firebaseUid: `fb-d14-${run}`,
      email: `c-d14-${run}@t.local`,
      name: 'عميل',
    });
    cleanup.push(async () => {
      await prisma.commerceOrderItem.deleteMany({ where: { order: { partnerId: partner.id } } }).catch(() => undefined);
      await prisma.commerceOrderEvent.deleteMany({ where: { order: { partnerId: partner.id } } }).catch(() => undefined);
      await prisma.commerceOrder.deleteMany({ where: { partnerId: partner.id } }).catch(() => undefined);
      await prisma.commerceCartItem.deleteMany({ where: { cart: { userId: user.userId } } }).catch(() => undefined);
      await prisma.commerceCart.deleteMany({ where: { userId: user.userId } }).catch(() => undefined);
      await prisma.productVariantInventory.deleteMany({ where: { product: { partnerId: partner.id } } }).catch(() => undefined);
      await prisma.product.deleteMany({ where: { partnerId: partner.id } }).catch(() => undefined);
      await prisma.partnerUser.delete({ where: { id: pu.id } }).catch(() => undefined);
      await prisma.partner.delete({ where: { id: partner.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: user.userId } }).catch(() => undefined);
    });

    // ========== D1: legacy stock_source=none with reserved hold ==========
    const legacyProd = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'قديم',
        nameEn: `leg-${run}`,
        priceHalalas: 2000,
        purchaseMode: 'internal_cod',
        stockQty: 10,
        reservedQty: 2,
        inventoryMode: 'product',
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'published',
        reviewStatus: 'none',
        active: true,
        catalogSource: 'catalog',
        deliveryFeeHalalas: 0,
      },
    });
    const legacyOrder = await prisma.commerceOrder.create({
      data: {
        publicNumber: `MO-LEG-${run}`,
        userId: user.userId,
        partnerId: partner.id,
        fulfillmentStatus: 'new',
        deliveryStatus: 'pending',
        paymentMethod: 'cod',
        paymentCollectionStatus: 'uncollected',
        subtotalHalalas: 4000,
        deliveryFeeHalalas: 0,
        totalHalalas: 4000,
        currency: 'SAR',
        contactName: 'س',
        contactPhone: '0501234567',
        addressLine: 'ش',
        city: 'الرياض',
        items: {
          create: [
            {
              productId: legacyProd.id,
              productNameAr: 'قديم',
              variantKey: '',
              unitPriceHalalas: 2000,
              quantity: 2,
              lineTotalHalalas: 4000,
              reservedQty: 2,
              stockState: 'reserved',
              stockSource: 'none', // simulates post-migration default
            },
          ],
        },
      },
    });
    // No PVI → backfill heuristic / runtime resolves to product
    const beforeCancel = await prisma.product.findUnique({ where: { id: legacyProd.id } });
    // Partner releases from `new` via rejected (cancelled from new is customer/admin only).
    await commerce.transitionOrderFor(actor, legacyOrder.id, {
      fulfillmentStatus: 'rejected',
      note: 'رفض اختبار D1 — تحرير حجز قديم',
    });
    const afterCancel = await prisma.product.findUnique({ where: { id: legacyProd.id } });
    const itemAfter = await prisma.commerceOrderItem.findFirst({ where: { orderId: legacyOrder.id } });
    record(
      'D1_LEGACY_CANCEL_RELEASES_PRODUCT',
      beforeCancel!.reservedQty === 2 &&
        afterCancel!.reservedQty === 0 &&
        itemAfter?.stockState === 'released' &&
        itemAfter?.stockSource === 'product',
      { before: beforeCancel?.reservedQty, after: afterCancel?.reservedQty, item: itemAfter },
    );
    // Idempotent second reject path
    const again = await commerce.transitionOrderFor(actor, legacyOrder.id, {
      fulfillmentStatus: 'rejected',
      note: 'تكرار',
    });
    const afterTwice = await prisma.product.findUnique({ where: { id: legacyProd.id } });
    record('D1_CANCEL_IDEMPOTENT', afterTwice!.reservedQty === 0, {
      reserved: afterTwice?.reservedQty,
      secondTransition: again,
    });

    // Legacy consume
    await prisma.product.update({ where: { id: legacyProd.id }, data: { stockQty: 8, reservedQty: 2 } });
    const legacyConsumeOrder = await prisma.commerceOrder.create({
      data: {
        publicNumber: `MO-LEG-C-${run}`,
        userId: user.userId,
        partnerId: partner.id,
        fulfillmentStatus: 'new',
        deliveryStatus: 'pending',
        paymentMethod: 'cod',
        paymentCollectionStatus: 'uncollected',
        subtotalHalalas: 4000,
        deliveryFeeHalalas: 0,
        totalHalalas: 4000,
        currency: 'SAR',
        contactName: 'س',
        contactPhone: '0501234567',
        addressLine: 'ش',
        city: 'الرياض',
        items: {
          create: [
            {
              productId: legacyProd.id,
              productNameAr: 'قديم',
              variantKey: '',
              unitPriceHalalas: 2000,
              quantity: 2,
              lineTotalHalalas: 4000,
              reservedQty: 2,
              stockState: 'reserved',
              stockSource: 'none',
            },
          ],
        },
      },
    });
    await commerce.transitionOrderFor(actor, legacyConsumeOrder.id, { fulfillmentStatus: 'accepted', note: 'قبول' });
    await commerce.transitionOrderFor(actor, legacyConsumeOrder.id, { fulfillmentStatus: 'preparing', note: 'تجهيز' });
    await commerce.transitionOrderFor(actor, legacyConsumeOrder.id, { fulfillmentStatus: 'out_for_delivery', note: 'شحن' });
    await commerce.transitionOrderFor(actor, legacyConsumeOrder.id, { fulfillmentStatus: 'delivered', note: 'تسليم' });
    const afterDeliver = await prisma.product.findUnique({ where: { id: legacyProd.id } });
    const consumedItem = await prisma.commerceOrderItem.findFirst({ where: { orderId: legacyConsumeOrder.id } });
    record(
      'D1_LEGACY_DELIVER_CONSUMES_PRODUCT',
      afterDeliver!.reservedQty === 0 && afterDeliver!.stockQty === 6 && consumedItem?.stockState === 'consumed',
      { product: afterDeliver, item: consumedItem },
    );

    // New product-source order via real checkout
    await prisma.product.update({
      where: { id: legacyProd.id },
      data: { stockQty: 5, reservedQty: 0, inventoryMode: 'product' },
    });
    await commerce.clearCart(user);
    await commerce.addCartItem(user, { productId: legacyProd.id, quantity: 2 });
    const quote = await commerce.quote(user);
    const placeBody = delivery(`new-prod-${run}`, {
      confirmationFingerprint: quote.confirmationFingerprint,
    });
    if (typeof placeBody.addressLine !== 'string' || placeBody.addressLine.trim().length < 5) {
      throw new Error(`bad placeBody.addressLine=${JSON.stringify(placeBody)}`);
    }
    const placedWrap = await commerce.createOrder(user, placeBody);
    const placedOrder = (placedWrap as { order: { id: string } }).order;
    const afterPlace = await prisma.product.findUnique({ where: { id: legacyProd.id } });
    const placedItem = await prisma.commerceOrderItem.findFirst({ where: { orderId: placedOrder.id } });
    record(
      'D1_NEW_PRODUCT_CHECKOUT_STAMPS_SOURCE',
      afterPlace!.reservedQty === 2 && placedItem?.stockSource === 'product' && placedItem?.stockState === 'reserved',
      {
        reserved: afterPlace?.reservedQty,
        source: placedItem?.stockSource,
        stockState: placedItem?.stockState,
        orderId: placedOrder.id,
      },
    );
    await commerce.transitionOrderFor(actor, placedOrder.id, { fulfillmentStatus: 'rejected', note: 'رفض طلب جديد' });
    const afterNewCancel = await prisma.product.findUnique({ where: { id: legacyProd.id } });
    record('D1_NEW_PRODUCT_CANCEL', afterNewCancel!.reservedQty === 0, { reserved: afterNewCancel?.reservedQty });

    // ========== D2: untracked preserved ==========
    const uProd = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'غير متتبع',
        nameEn: `unt-${run}`,
        priceHalalas: 1500,
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
        optionsJson: [{ id: 'size', labelAr: 'المقاس', values: [{ id: 'u', labelAr: 'U' }] }],
        variantsJson: [{ id: 'u1', selections: { size: 'u' }, available: true }],
      },
    });
    const created = await inv.upsertMany(partner.id, uProd.id, {
      inventoryMode: 'variant',
      rows: [{ variantId: 'u1', stockMode: 'untracked', stockQty: null }],
    });
    // Persist without sending stockMode (simulates editor clean save)
    const rev = created.rows[0].revision;
    await inv.upsertMany(partner.id, uProd.id, {
      inventoryMode: 'variant',
      rows: [{ variantId: 'u1', stockQty: null, expectedRevision: rev }],
    });
    const afterSave = await inv.list(uProd.id);
    record('D2_UNTRACKED_SURVIVES_SAVE_WITHOUT_MODE', afterSave[0]?.stockMode === 'untracked', afterSave[0]);

    await commerce.clearCart(user);
    await commerce.addCartItem(user, {
      productId: uProd.id,
      quantity: 2,
      variantKey: 'u1',
      selections: { size: 'u' },
    });
    const uQuote = await commerce.quote(user);
    const uWrap = await commerce.createOrder(
      user,
      delivery(`unt-${run}`, { confirmationFingerprint: uQuote.confirmationFingerprint }),
    );
    const uOrder = (uWrap as { order: { id: string } }).order;
    const uItem = await prisma.commerceOrderItem.findFirst({ where: { orderId: uOrder.id } });
    record(
      'D2_UNTRACKED_CHECKOUT_NO_NUMERIC_RESERVE',
      uItem?.stockSource === 'none' && uItem?.stockState === 'none' && uItem?.reservedQty === 0,
      uItem,
    );

    // ========== D3: revision required ==========
    const cProd = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'تعارض',
        nameEn: `cf-${run}`,
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
        optionsJson: [{ id: 'size', labelAr: 'المقاس', values: [{ id: 'c', labelAr: 'C' }] }],
        variantsJson: [{ id: 'c1', selections: { size: 'c' }, available: true }],
      },
    });
    const c0 = await inv.upsertMany(partner.id, cProd.id, {
      rows: [{ variantId: 'c1', stockMode: 'tracked', stockQty: 10 }],
    });
    // Concurrent bump
    await inv.upsertMany(partner.id, cProd.id, {
      rows: [{ variantId: 'c1', stockQty: 12, expectedRevision: c0.rows[0].revision }],
    });
    let conflictOk = false;
    try {
      await inv.upsertMany(partner.id, cProd.id, {
        rows: [{ variantId: 'c1', stockQty: 7, expectedRevision: c0.rows[0].revision }],
      });
    } catch (e) {
      conflictOk = /VARIANT_INVENTORY_REVISION_CONFLICT|تعارض/.test(errBlob(e));
    }
    const still = await inv.list(cProd.id);
    record('D3_STALE_REVISION_REJECTED_SERVER_KEEPS_12', conflictOk && still[0]?.stockQty === 12, still[0]);

    let missingRev = false;
    try {
      await inv.upsertMany(partner.id, cProd.id, {
        rows: [{ variantId: 'c1', stockQty: 7 }],
      });
    } catch (e) {
      missingRev = /VARIANT_INVENTORY_REVISION_REQUIRED|مراجعة/.test(errBlob(e));
    }
    const still2 = await inv.list(cProd.id);
    record('D3_MISSING_REVISION_REJECTED', missingRev && still2[0]?.stockQty === 12, still2[0]);

    // ========== D4: deleted variant excluded from derived ==========
    const dProd = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'حذف',
        nameEn: `del-${run}`,
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
        optionsJson: [
          {
            id: 'size',
            labelAr: 'المقاس',
            values: [
              { id: 'd1v', labelAr: 'D1' },
              { id: 'd2v', labelAr: 'D2' },
            ],
          },
        ],
        variantsJson: [
          { id: 'd1', selections: { size: 'd1v' }, available: true },
          { id: 'd2', selections: { size: 'd2v' }, available: true },
        ],
      },
    });
    await inv.upsertMany(partner.id, dProd.id, {
      rows: [
        { variantId: 'd1', stockQty: 4 },
        { variantId: 'd2', stockQty: 6 },
      ],
    });
    // Remove d2 from catalog
    await prisma.product.update({
      where: { id: dProd.id },
      data: { variantsJson: [{ id: 'd1', selections: { size: 'd1v' }, available: true }] },
    });
    // Inventory put for remaining variants archives orphan
    const d1row = (await inv.list(dProd.id)).find((r) => r.variantId === 'd1')!;
    await inv.upsertMany(partner.id, dProd.id, {
      rows: [{ variantId: 'd1', stockQty: 4, expectedRevision: d1row.revision }],
    });
    const derived = await inv.derivedProductStock(dProd.id);
    const d2 = (await inv.list(dProd.id)).find((r) => r.variantId === 'd2');
    record(
      'D4_DELETED_VARIANT_EXCLUDED_FROM_DERIVED',
      derived.derivedStockQty === 4 && !!d2?.archivedAt,
      { derived, d2 },
    );

    // Remove all variants
    await prisma.product.update({ where: { id: dProd.id }, data: { variantsJson: [] } });
    await inv.upsertMany(partner.id, dProd.id, { rows: [] });
    const derivedEmpty = await inv.derivedProductStock(dProd.id);
    record('D4_ALL_VARIANTS_REMOVED_DERIVED_ZERO', derivedEmpty.derivedStockQty === 0, derivedEmpty);
  } catch (e) {
    record('D1_D4_SUITE', false, String((e as Error)?.stack || e));
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await prisma.$disconnect();
  }

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    id: 'P31_D1_D4',
    startedUtc,
    finishedUtc: new Date().toISOString(),
    commit,
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'p31-d1-d4.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), commit, outDir }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
