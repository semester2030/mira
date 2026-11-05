/**
 * D1–D4 + T1 path tests — real CommerceService / VariantInventoryService on isolated DB.
 * No || true. Release/consume via transitionOrderFor. Checkout via createOrder.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceService, partnerActor } from '../marketplace/commerce.service';
import { CatalogContentService } from '../marketplace/catalog-content.service';
import { MemoryCatalogMediaStorage } from '../marketplace/catalog-media.storage';
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
  const mediaStore = new MemoryCatalogMediaStorage();
  const catalog = new CatalogContentService(prisma as unknown as PrismaService, mediaStore);
  const run = randomUUID().slice(0, 8);
  const cleanup: Array<() => Promise<void>> = [];

  async function seedCover(productId: string) {
    await prisma.catalogMedia.create({
      data: {
        ownerKind: 'product',
        ownerId: productId,
        kind: 'image',
        url: `/api/v1/marketplace/media/pending-${run}`,
        mimeType: 'image/png',
        byteSize: 68,
        storageKey: `test-p31/${run}/${productId}.png`,
        isPrimary: true,
        publication: 'published',
        active: true,
        sortOrder: 0,
      },
    });
    await mediaStore.put(
      `test-p31/${run}/${productId}.png`,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
  }

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
      await prisma.catalogMedia.deleteMany({ where: { ownerKind: 'product', ownerId: { in: (await prisma.product.findMany({ where: { partnerId: partner.id }, select: { id: true } })).map((p) => p.id) } } }).catch(() => undefined);
      await prisma.catalogReviewLog.deleteMany({ where: { ownerKind: 'product', ownerId: { in: (await prisma.product.findMany({ where: { partnerId: partner.id }, select: { id: true } })).map((p) => p.id) } } }).catch(() => undefined);
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
    const baseRev = c0.rows[0].revision;
    // Deterministic barrier: both requests observe the same revision before either writes.
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    let arrived = 0;
    async function racedWrite(qty: number, withMode: boolean) {
      const seen = (await inv.list(cProd.id))[0]?.revision;
      arrived += 1;
      if (arrived === 2) releaseBarrier();
      await barrier;
      return inv.upsertMany(partner.id, cProd.id, {
        ...(withMode ? { inventoryMode: 'variant' as const } : {}),
        rows: [{ variantId: 'c1', stockQty: qty, expectedRevision: seen }],
      });
    }
    const race = await Promise.allSettled([racedWrite(12, false), racedWrite(7, false)]);
    const wins = race.filter((r) => r.status === 'fulfilled').length;
    const losses = race.filter((r) => r.status === 'rejected').length;
    const afterRace = await inv.list(cProd.id);
    const raceQty = afterRace[0]?.stockQty;
    const raceRev = afterRace[0]?.revision;
    record(
      'D3_ATOMIC_RACE_ONE_WINS',
      wins === 1 &&
        losses === 1 &&
        (raceQty === 12 || raceQty === 7) &&
        raceRev === baseRev + 1,
      { wins, losses, raceQty, raceRev, baseRev },
    );

    // Repeat barrier race with inventoryMode in body
    const midRev = (await inv.list(cProd.id))[0]!.revision;
    arrived = 0;
    const barrier2 = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    async function racedWriteMode(qty: number) {
      const seen = (await inv.list(cProd.id))[0]?.revision;
      arrived += 1;
      if (arrived === 2) releaseBarrier();
      await barrier2;
      return inv.upsertMany(partner.id, cProd.id, {
        inventoryMode: 'variant',
        rows: [{ variantId: 'c1', stockQty: qty, expectedRevision: seen }],
      });
    }
    const raceMode = await Promise.allSettled([racedWriteMode(20), racedWriteMode(3)]);
    const modeWins = raceMode.filter((r) => r.status === 'fulfilled').length;
    const afterMode = await inv.list(cProd.id);
    record(
      'D3_ATOMIC_RACE_WITH_INVENTORY_MODE',
      modeWins === 1 &&
        raceMode.filter((r) => r.status === 'rejected').length === 1 &&
        (afterMode[0]?.stockQty === 20 || afterMode[0]?.stockQty === 3) &&
        afterMode[0]?.revision === midRev + 1,
      { modeWins, qty: afterMode[0]?.stockQty, rev: afterMode[0]?.revision, midRev },
    );

    // Multi-row atomicity: conflict on second row must not leave first row updated.
    const multiProd = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'متعدد',
        nameEn: `multi-${run}`,
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
              { id: 'm1v', labelAr: 'M1' },
              { id: 'm2v', labelAr: 'M2' },
            ],
          },
        ],
        variantsJson: [
          { id: 'm1', selections: { size: 'm1v' }, available: true },
          { id: 'm2', selections: { size: 'm2v' }, available: true },
        ],
      },
    });
    await inv.upsertMany(partner.id, multiProd.id, {
      rows: [
        { variantId: 'm1', stockQty: 4 },
        { variantId: 'm2', stockQty: 4 },
      ],
    });
    const mRows = await inv.list(multiProd.id);
    const m1Rev = mRows.find((r) => r.variantId === 'm1')!.revision;
    const m2Rev = mRows.find((r) => r.variantId === 'm2')!.revision;
    let multiConflict = false;
    try {
      await inv.upsertMany(partner.id, multiProd.id, {
        rows: [
          { variantId: 'm1', stockQty: 9, expectedRevision: m1Rev },
          { variantId: 'm2', stockQty: 9, expectedRevision: m2Rev - 1 }, // stale → conflict
        ],
      });
    } catch (e) {
      multiConflict = /VARIANT_INVENTORY_REVISION_CONFLICT|تعارض/.test(errBlob(e));
    }
    const afterMulti = await inv.list(multiProd.id);
    record(
      'D3_MULTI_ROW_NO_PARTIAL_UPDATE',
      multiConflict &&
        afterMulti.find((r) => r.variantId === 'm1')?.stockQty === 4 &&
        afterMulti.find((r) => r.variantId === 'm2')?.stockQty === 4,
      afterMulti,
    );

    const qtyAfterRaces = (await inv.list(cProd.id))[0]?.stockQty;
    const tipRev = (await inv.list(cProd.id))[0]?.revision ?? 0;
    let conflictOk = false;
    try {
      await inv.upsertMany(partner.id, cProd.id, {
        rows: [{ variantId: 'c1', stockQty: 99, expectedRevision: baseRev }],
      });
    } catch (e) {
      conflictOk = /VARIANT_INVENTORY_REVISION_CONFLICT|تعارض/.test(errBlob(e));
    }
    const still = await inv.list(cProd.id);
    record(
      'D3_STALE_REVISION_REJECTED_SERVER_KEEPS_QTY',
      conflictOk && still[0]?.stockQty === qtyAfterRaces,
      still[0],
    );

    let missingRev = false;
    try {
      await inv.upsertMany(partner.id, cProd.id, {
        rows: [{ variantId: 'c1', stockQty: 7 }],
      });
    } catch (e) {
      missingRev = /VARIANT_INVENTORY_REVISION_REQUIRED|مراجعة/.test(errBlob(e));
    }
    const still2 = await inv.list(cProd.id);
    record('D3_MISSING_REVISION_REJECTED', missingRev && still2[0]?.stockQty === qtyAfterRaces, still2[0]);

    // Also with inventoryMode present in body against stale tip
    let modeBodyConflict = false;
    try {
      await inv.upsertMany(partner.id, cProd.id, {
        inventoryMode: 'variant',
        rows: [{ variantId: 'c1', stockQty: 1, expectedRevision: tipRev - 1 }],
      });
    } catch (e) {
      modeBodyConflict = /VARIANT_INVENTORY_REVISION_CONFLICT|تعارض/.test(errBlob(e));
    }
    record(
      'D3_CONFLICT_WITH_INVENTORY_MODE_BODY',
      modeBodyConflict && (await inv.list(cProd.id))[0]?.stockQty === qtyAfterRaces,
    );

    // ========== D4 cycle: draft ↔ published ↔ inventory ==========
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
        reviewRevision: 1,
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
              { id: 'd3v', labelAr: 'D3' },
            ],
          },
        ],
        variantsJson: [
          { id: 'd1', selections: { size: 'd1v' }, available: true },
          { id: 'd2', selections: { size: 'd2v' }, available: true },
        ],
      },
    });
    await seedCover(dProd.id);
    await inv.upsertMany(partner.id, dProd.id, {
      rows: [
        { variantId: 'd1', stockQty: 10 },
        { variantId: 'd2', stockQty: 10 },
      ],
    });

    // D4-A: draft removes published d2 — stays available before approve
    await prisma.product.update({
      where: { id: dProd.id },
      data: {
        draftVariantsSet: true,
        draftVariantsJson: [{ id: 'd1', selections: { size: 'd1v' }, available: true }],
        reviewRevision: 2,
      },
    });
    const d1BeforeDraftSave = (await inv.list(dProd.id)).find((r) => r.variantId === 'd1')!;
    await inv.upsertMany(partner.id, dProd.id, {
      rows: [{ variantId: 'd1', stockQty: 10, expectedRevision: d1BeforeDraftSave.revision }],
    });
    const derivedAfterDraft = await inv.derivedProductStock(dProd.id);
    const d2AfterDraft = (await inv.list(dProd.id)).find((r) => r.variantId === 'd2');
    const availD2 = await inv.availableForVariant(dProd.id, 'd2');
    record(
      'D4_A_DRAFT_DELETE_KEEPS_PUBLISHED_AVAILABLE',
      derivedAfterDraft.derivedStockQty === 20 && !d2AfterDraft?.archivedAt && availD2 === 10,
      { derivedAfterDraft, d2AfterDraft, availD2 },
    );

    // D4-B: reject via CatalogContentService.decide — published availability unchanged
    const submittedReject = await catalog.submit(partner.id, 'product', dProd.id);
    const rejectRev =
      (submittedReject as { revision?: number }).revision ??
      (await prisma.product.findUniqueOrThrow({ where: { id: dProd.id } })).submittedRevision!;
    await catalog.decide('ops-reviewer', 'product', dProd.id, 'reject', 'اختبار رفض', rejectRev);
    const afterReject = await inv.derivedProductStock(dProd.id);
    const d2Reject = (await inv.list(dProd.id)).find((r) => r.variantId === 'd2');
    record(
      'D4_B_REJECT_KEEPS_PUBLISHED',
      afterReject.derivedStockQty === 20 && !d2Reject?.archivedAt && (await inv.availableForVariant(dProd.id, 'd2')) === 10,
      { afterReject, d2Reject },
    );

    // Clear rejection and restore draft for new-variant path (D4-C)
    await prisma.product.update({
      where: { id: dProd.id },
      data: {
        reviewStatus: 'none',
        reviewNote: null,
        submittedRevision: null,
        draftVariantsSet: true,
        draftVariantsJson: [
          { id: 'd1', selections: { size: 'd1v' }, available: true },
          { id: 'd2', selections: { size: 'd2v' }, available: true },
          { id: 'd3', selections: { size: 'd3v' }, available: true },
        ],
        reviewRevision: 3,
      },
    });

    // D4-C: new draft variant qty 5 — not public until approve; then available=5
    const createdNew = await inv.upsertMany(partner.id, dProd.id, {
      rows: [{ variantId: 'd3', stockQty: 5 }],
    });
    const d3row = (await inv.list(dProd.id)).find((r) => r.variantId === 'd3');
    const respRev = createdNew.updated.find((r) => r.variantId === 'd3')?.revision;
    const availBefore = await inv.availableForVariant(dProd.id, 'd3');
    const derivedBefore = await inv.derivedProductStock(dProd.id);
    record(
      'D4_C_NEW_DRAFT_NOT_PUBLIC_AND_NOT_ARCHIVED',
      !d3row?.archivedAt &&
        d3row?.stockQty === 5 &&
        respRev === d3row?.revision &&
        availBefore === 0 &&
        derivedBefore.derivedStockQty === 20,
      { d3row, respRev, availBefore, derivedBefore },
    );

    // D4-D: second save using revision returned from first save succeeds (no phantom conflict)
    const secondSave = await inv.upsertMany(partner.id, dProd.id, {
      rows: [{ variantId: 'd3', stockQty: 5, expectedRevision: respRev }],
    });
    record(
      'D4_D_SECOND_SAVE_WITH_RETURNED_REVISION',
      secondSave.ok === true &&
        secondSave.updated.find((r) => r.variantId === 'd3')?.revision === (respRev || 0) + 1 &&
        !(await inv.list(dProd.id)).find((r) => r.variantId === 'd3')?.archivedAt,
      secondSave.updated.find((r) => r.variantId === 'd3'),
    );

    const submittedApprove = await catalog.submit(partner.id, 'product', dProd.id);
    const approveRev =
      (submittedApprove as { revision?: number }).revision ??
      (await prisma.product.findUniqueOrThrow({ where: { id: dProd.id } })).submittedRevision!;
    await catalog.decide('ops-reviewer', 'product', dProd.id, 'approve', 'اعتماد تركيبة جديدة', approveRev);
    const availAfterApprove = await inv.availableForVariant(dProd.id, 'd3');
    const derivedAfterApprove = await inv.derivedProductStock(dProd.id);
    const d3AfterApprove = (await inv.list(dProd.id)).find((r) => r.variantId === 'd3');
    record(
      'D4_C_AFTER_APPROVE_AVAILABLE_FIVE',
      availAfterApprove === 5 &&
        !d3AfterApprove?.archivedAt &&
        derivedAfterApprove.derivedStockQty === 25,
      { availAfterApprove, d3AfterApprove, derivedAfterApprove },
    );

    // D4-E: approve deletion of d2 — public availability stops
    await prisma.product.update({
      where: { id: dProd.id },
      data: {
        draftVariantsSet: true,
        draftVariantsJson: [
          { id: 'd1', selections: { size: 'd1v' }, available: true },
          { id: 'd3', selections: { size: 'd3v' }, available: true },
        ],
        reviewRevision: 4,
        reviewStatus: 'none',
        submittedRevision: null,
      },
    });
    const submittedDel = await catalog.submit(partner.id, 'product', dProd.id);
    const delRev =
      (submittedDel as { revision?: number }).revision ??
      (await prisma.product.findUniqueOrThrow({ where: { id: dProd.id } })).submittedRevision!;
    await catalog.decide('ops-reviewer', 'product', dProd.id, 'approve', 'اعتماد حذف d2', delRev);
    const d2AfterApproveDelete = (await inv.list(dProd.id)).find((r) => r.variantId === 'd2');
    const availD2Gone = await inv.availableForVariant(dProd.id, 'd2');
    const derivedAfterDel = await inv.derivedProductStock(dProd.id);
    record(
      'D4_E_APPROVE_DELETE_STOPS_PUBLIC',
      !!d2AfterApproveDelete?.archivedAt && availD2Gone === 0 && derivedAfterDel.derivedStockQty === 15,
      { d2AfterApproveDelete, availD2Gone, derivedAfterDel },
    );

    // D4-F: held reservation survives remove-from-catalog; release/consume via commerce paths
    const holdProd = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: 'حجز',
        nameEn: `hold-${run}`,
        priceHalalas: 1000,
        purchaseMode: 'internal_cod',
        stockQty: null,
        inventoryMode: 'variant',
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'published',
        reviewStatus: 'none',
        reviewRevision: 1,
        active: true,
        catalogSource: 'catalog',
        deliveryFeeHalalas: 0,
        optionsJson: [
          {
            id: 'size',
            labelAr: 'المقاس',
            values: [
              { id: 'h1v', labelAr: 'H1' },
              { id: 'h2v', labelAr: 'H2' },
            ],
          },
        ],
        variantsJson: [
          { id: 'h1', selections: { size: 'h1v' }, available: true },
          { id: 'h2', selections: { size: 'h2v' }, available: true },
        ],
      },
    });
    await seedCover(holdProd.id);
    await inv.upsertMany(partner.id, holdProd.id, {
      rows: [
        { variantId: 'h1', stockQty: 5 },
        { variantId: 'h2', stockQty: 5 },
      ],
    });
    await commerce.clearCart(user);
    await commerce.addCartItem(user, {
      productId: holdProd.id,
      quantity: 2,
      variantKey: 'h2',
      selections: { size: 'h2v' },
    });
    const holdQuote = await commerce.quote(user);
    const heldWrap = await commerce.createOrder(
      user,
      delivery(`hold-${run}`, { confirmationFingerprint: holdQuote.confirmationFingerprint }),
    );
    const orderId = (heldWrap as { order: { id: string } }).order.id;
    const h2Held = (await inv.list(holdProd.id)).find((r) => r.variantId === 'h2');
    const heldItem = await prisma.commerceOrderItem.findFirst({ where: { orderId } });
    record(
      'D4_F_HOLD_CREATED',
      !!orderId && (h2Held?.reservedQty || 0) >= 2 && heldItem?.stockSource === 'variant',
      { orderId, h2Held, stockSource: heldItem?.stockSource },
    );

    await prisma.product.update({
      where: { id: holdProd.id },
      data: {
        draftVariantsSet: true,
        draftVariantsJson: [{ id: 'h1', selections: { size: 'h1v' }, available: true }],
        reviewRevision: 2,
      },
    });
    const submittedHold = await catalog.submit(partner.id, 'product', holdProd.id);
    const holdRev =
      (submittedHold as { revision?: number }).revision ??
      (await prisma.product.findUniqueOrThrow({ where: { id: holdProd.id } })).submittedRevision!;
    await catalog.decide('ops-reviewer', 'product', holdProd.id, 'approve', 'حذف مع حجز', holdRev);
    const h2After = (await inv.list(holdProd.id)).find((r) => r.variantId === 'h2');
    record(
      'D4_F_HELD_ORPHAN_KEPT',
      !h2After?.archivedAt && (h2After?.reservedQty || 0) >= 2,
      h2After,
    );

    await commerce.transitionOrderFor(actor, orderId, {
      fulfillmentStatus: 'rejected',
      note: 'تحرير حجز تركيبة محذوفة من العرض',
    });
    const afterRelease = (await inv.list(holdProd.id)).find((r) => r.variantId === 'h2');
    const releasedItem = await prisma.commerceOrderItem.findFirst({ where: { orderId } });
    record(
      'D4_F_RELEASE_VIA_ORDER',
      (afterRelease?.reservedQty || 0) === 0 && releasedItem?.stockState === 'released',
      { afterRelease, releasedItem },
    );

    // Consume path: restore h2 to published catalog, new checkout, deliver
    await prisma.product.update({
      where: { id: holdProd.id },
      data: {
        variantsJson: [
          { id: 'h1', selections: { size: 'h1v' }, available: true },
          { id: 'h2', selections: { size: 'h2v' }, available: true },
        ],
        draftVariantsSet: false,
        draftVariantsJson: Prisma.DbNull,
        reviewStatus: 'none',
        reviewRevision: 3,
        submittedRevision: null,
      },
    });
    await inv.archiveOrphansAfterPublish(holdProd.id);
    const h2Live = (await inv.list(holdProd.id)).find((r) => r.variantId === 'h2');
    record('D4_F_REPUBLISH_REACTIVATES', !h2Live?.archivedAt && (await inv.availableForVariant(holdProd.id, 'h2')) != null, h2Live);

    await commerce.clearCart(user);
    await commerce.addCartItem(user, {
      productId: holdProd.id,
      quantity: 1,
      variantKey: 'h2',
      selections: { size: 'h2v' },
    });
    const consumeQuote = await commerce.quote(user);
    const consumeWrap = await commerce.createOrder(
      user,
      delivery(`consume-${run}`, { confirmationFingerprint: consumeQuote.confirmationFingerprint }),
    );
    const consumeId = (consumeWrap as { order: { id: string } }).order.id;
    await commerce.transitionOrderFor(actor, consumeId, { fulfillmentStatus: 'accepted', note: 'قبول' });
    await commerce.transitionOrderFor(actor, consumeId, { fulfillmentStatus: 'preparing', note: 'تجهيز' });
    await commerce.transitionOrderFor(actor, consumeId, { fulfillmentStatus: 'out_for_delivery', note: 'شحن' });
    await commerce.transitionOrderFor(actor, consumeId, { fulfillmentStatus: 'delivered', note: 'تسليم' });
    const afterConsume = (await inv.list(holdProd.id)).find((r) => r.variantId === 'h2');
    const d4ConsumedItem = await prisma.commerceOrderItem.findFirst({ where: { orderId: consumeId } });
    record(
      'D4_F_CONSUME_VIA_ORDER',
      (afterConsume?.reservedQty || 0) === 0 &&
        d4ConsumedItem?.stockState === 'consumed' &&
        (afterConsume?.stockQty || 0) === (h2Live?.stockQty || 5) - 1,
      { afterConsume, d4ConsumedItem },
    );
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
