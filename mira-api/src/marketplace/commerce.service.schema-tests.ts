import 'reflect-metadata';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceActor, CommerceService, ADMIN_ACTOR, partnerActor } from './commerce.service';
import { localInstant, localParts } from './commerce.types';

/**
 * Real-database tests for the operational commerce service (concurrency cannot be faked).
 * Refuses to run unless DATABASE_URL points at a local database, and only touches rows it creates.
 */

type Customer = CommerceActor & { type: 'customer' };
const run = `cmt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PHONE = '0501234567';
const delivery = (key: string, extra: Record<string, unknown> = {}) => ({
  idempotencyKey: key,
  contactName: 'سارة العتيبي',
  contactPhone: PHONE,
  addressLine: 'حي الياسمين، شارع الأمير',
  city: 'الرياض',
  ...extra,
});

async function failure(promise: Promise<unknown>, status: number, code: string): Promise<Record<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof HttpException, `expected HttpException, got ${String(error)}`);
    const body = error.getResponse() as Record<string, unknown>;
    assert.equal(error.getStatus(), status, `status for ${code}: ${JSON.stringify(body)}`);
    assert.equal(body.code, code, JSON.stringify(body));
    assert.equal(typeof body.messageAr, 'string');
    assert.ok(/[\u0600-\u06FF]/.test(body.messageAr as string), 'messageAr is Arabic');
    return body;
  }
  assert.fail(`expected ${code} (${status}) but call succeeded`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const commerce = new CommerceService(prisma as unknown as PrismaService);
  const created = { userIds: [] as string[], partnerIds: [] as string[] };

  const mkUser = async (name: string): Promise<Customer> => {
    const actor = await commerce.customerActor({ firebaseUid: `${run}-${name}`, email: `${name}@test.local`, name });
    created.userIds.push(actor.userId);
    return actor;
  };
  const mkPartner = async (name: string, type = 'brand') => {
    const partner = await prisma.partner.create({ data: { type, nameAr: `متجر ${name}`, nameEn: `${run}-${name}`, city: 'الرياض' } });
    created.partnerIds.push(partner.id);
    return partner;
  };
  const mkProduct = (partnerId: string, name: string, extra: Record<string, unknown> = {}) =>
    prisma.product.create({
      data: {
        partnerId,
        nameAr: name,
        nameEn: `${run}-${name}`,
        priceHalalas: 5000,
        externalUrl: 'https://example.test/p',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        deliveryFeeHalalas: 1500,
        ...extra,
      },
    });
  const product = (id: string) => prisma.product.findUniqueOrThrow({ where: { id } });
  const fill = async (user: Customer, productId: string, quantity = 1, extra: Record<string, unknown> = {}) =>
    commerce.addCartItem(user, { productId, quantity, ...extra });
  const place = (user: Customer, key: string, extra: Record<string, unknown> = {}) =>
    commerce.createOrder(user, delivery(key, extra));

  try {
    const alice = await mkUser('alice');
    const bob = await mkUser('bob');
    const carol = await mkUser('carol');
    const pA = await mkPartner('A');
    const pB = await mkPartner('B');
    const actorA = partnerActor('pu-a', pA.id);
    const actorB = partnerActor('pu-b', pB.id);

    // =====================================================================
    // 1. External products never enter the cart
    // =====================================================================
    const external = await mkProduct(pA.id, 'خارجي', { purchaseMode: 'external' });
    const ext = await failure(fill(alice, external.id), 422, 'EXTERNAL_PRODUCT_NOT_PURCHASABLE');
    assert.equal((ext.details as Record<string, unknown>).externalUrl, 'https://example.test/p');
    assert.equal((await commerce.getCart(alice)).items.length, 0);
    await failure(fill(alice, 'does-not-exist'), 404, 'PRODUCT_NOT_FOUND');
    const hidden = await mkProduct(pA.id, 'مسودة', { contentStatus: 'draft' });
    await failure(fill(alice, hidden.id), 404, 'PRODUCT_NOT_FOUND');

    // =====================================================================
    // 2. Cart: merge lines, single partner, server price
    // =====================================================================
    const tracked = await mkProduct(pA.id, 'مخزون محدود', { stockQty: 5 });
    const untracked = await mkProduct(pA.id, 'بدون تتبع', { stockQty: null, deliveryFeeHalalas: null });
    const otherPartner = await mkProduct(pB.id, 'من متجر آخر', { deliveryFeeHalalas: 1000 });
    await fill(alice, tracked.id, 2);
    const merged = await fill(alice, tracked.id, 1);
    assert.equal(merged.items.length, 1);
    assert.equal(merged.items[0].quantity, 3);
    assert.equal(merged.items[0].unitPriceHalalas, 5000);
    assert.equal(merged.subtotalHalalas, 15000);
    assert.equal(merged.partnerId, pA.id);

    const clash = await failure(fill(alice, otherPartner.id), 409, 'CART_PARTNER_CONFLICT');
    const clashDetails = clash.details as Record<string, unknown>;
    assert.equal(clashDetails.currentPartnerId, pA.id);
    assert.equal(clashDetails.requestedPartnerId, pB.id);
    assert.equal((await commerce.getCart(alice)).items.length, 1, 'cart is not silently replaced');

    await failure(fill(alice, tracked.id, 0), 400, 'QUANTITY_INVALID');
    await failure(fill(alice, tracked.id, 3), 409, 'OUT_OF_STOCK'); // 3 + 3 > 5 available
    const line = merged.items[0];
    const updated = await commerce.updateCartItem(alice, line.id, { quantity: 4 });
    assert.equal(updated.items[0].quantity, 4);
    await failure(commerce.updateCartItem(alice, line.id, { quantity: 6 }), 409, 'OUT_OF_STOCK');
    await failure(commerce.updateCartItem(bob, line.id, { quantity: 1 }), 404, 'CART_ITEM_NOT_FOUND');
    await failure(commerce.removeCartItem(bob, line.id), 404, 'CART_ITEM_NOT_FOUND');
    const emptied = await commerce.removeCartItem(alice, line.id);
    assert.equal(emptied.items.length, 0);
    assert.equal(emptied.partnerId, null, 'empty cart forgets its partner');
    await fill(alice, otherPartner.id, 1); // now allowed
    await commerce.clearCart(alice);

    // =====================================================================
    // 3. Quote + unknown delivery fee is not free
    // =====================================================================
    await failure(commerce.quote(alice), 409, 'CART_EMPTY');
    await fill(alice, untracked.id, 2);
    const quote = await commerce.quote(alice);
    assert.equal(quote.deliveryFeeHalalas, null);
    assert.equal(quote.deliveryFeeKnown, false);
    assert.equal(quote.canConfirmOrder, false);
    assert.notEqual(quote.requiresDeliveryFeeAcknowledgement, true, 'ack path is not offered');
    assert.equal(quote.totalHalalas, 10000);
    await failure(place(alice, `${run}-unknown-fee`), 422, 'DELIVERY_FEE_UNKNOWN');
    await failure(
      place(alice, `${run}-unknown-fee-ack`, { acknowledgeUnknownDeliveryFee: true, totalHalalas: 1 }),
      422,
      'DELIVERY_FEE_UNKNOWN',
    );
    assert.equal((await commerce.getCart(alice)).items.length, 1, 'failed checkout keeps the cart');

    // Partner sets a known fee; body price/total fields from a client are ignored
    await prisma.product.update({ where: { id: untracked.id }, data: { deliveryFeeHalalas: 1500 } });
    const forged = await place(alice, `${run}-known-fee`, {
      totalHalalas: 1,
      priceHalalas: 1,
      items: [{ productId: untracked.id, unitPriceHalalas: 1 }],
    });
    assert.equal(forged.order.subtotalHalalas, 10000);
    assert.equal(forged.order.deliveryFeeHalalas, 1500);
    assert.equal(forged.order.deliveryFeeKnown, true);
    assert.equal(forged.order.totalHalalas, 11500);
    assert.equal(forged.order.items[0].unitPriceHalalas, 5000);
    assert.equal(forged.order.paymentMethod, 'cod');
    assert.equal(forged.order.fulfillmentStatus, 'new');
    assert.equal(forged.order.deliveryStatus, 'pending');
    assert.equal(forged.order.paymentCollectionStatus, 'uncollected');
    assert.equal((await product(untracked.id)).reservedQty, 0, 'untracked stock is not reserved');
    assert.equal((await commerce.getCart(alice)).items.length, 0, 'cart cleared by order');

    // price snapshot survives later catalog edits
    await prisma.product.update({ where: { id: untracked.id }, data: { priceHalalas: 9999, nameAr: 'اسم جديد' } });
    const snap = await commerce.getCustomerOrder(alice, forged.order.id);
    assert.equal(snap.items[0].unitPriceHalalas, 5000);
    assert.equal(snap.items[0].productNameAr, 'بدون تتبع');
    await prisma.product.update({ where: { id: untracked.id }, data: { priceHalalas: 5000, nameAr: 'بدون تتبع' } });

    // =====================================================================
    // 4. Dual click: same idempotency key -> exactly one order, one reservation
    // =====================================================================
    const hot = await mkProduct(pA.id, 'مخزون للنقر المزدوج', { stockQty: 10 });
    await fill(alice, hot.id, 2);
    const key = `${run}-dual-click`;
    const clicks = await Promise.allSettled([place(alice, key), place(alice, key), place(alice, key)]);
    assert.ok(clicks.every((c) => c.status === 'fulfilled'), JSON.stringify(clicks.map((c) => (c as PromiseRejectedResult).reason?.response)));
    const orders = clicks.map((c) => (c as PromiseFulfilledResult<Awaited<ReturnType<typeof place>>>).value);
    assert.equal(new Set(orders.map((o) => o.order.id)).size, 1, 'all clicks return the same order');
    assert.equal(orders.filter((o) => !o.idempotentReplay).length, 1, 'exactly one real creation');
    assert.equal(await prisma.commerceOrder.count({ where: { userId: alice.userId, idempotencyKey: key } }), 1);
    assert.equal((await product(hot.id)).reservedQty, 2, 'stock reserved once');
    assert.equal(orders[0].order.deliveryFeeHalalas, 1500);
    assert.equal(orders[0].order.totalHalalas, 11500);
    // later retry (cart now empty) still replays, even with a different body
    const retry = await place(alice, key, { city: 'جدة' });
    assert.equal(retry.idempotentReplay, true);
    assert.equal(retry.order.id, orders[0].order.id);
    assert.equal(retry.order.city, 'الرياض');
    await failure(commerce.createOrder(alice, { ...delivery('x'), idempotencyKey: undefined }), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    assert.equal((await commerce.createOrder(alice, { ...delivery('ignored-body') , idempotencyKey: 'body-key' }, key).catch((e) => e)).idempotentReplay, true, 'header key wins');
    await failure(place(alice, `${run}-empty`), 409, 'CART_EMPTY');
    // same key from another user is a different order space
    await fill(bob, hot.id, 1);
    const bobOrder = await place(bob, key);
    assert.notEqual(bobOrder.order.id, orders[0].order.id);
    assert.equal((await product(hot.id)).reservedQty, 3);
    await commerce.cancelCustomerOrder(bob, bobOrder.order.id, {});
    assert.equal((await product(hot.id)).reservedQty, 2);

    // =====================================================================
    // 5. Stock race: only one buyer gets the last unit
    // =====================================================================
    const last = await mkProduct(pA.id, 'القطعة الأخيرة', { stockQty: 1 });
    await fill(alice, last.id, 1);
    await fill(bob, last.id, 1);
    const race = await Promise.allSettled([place(alice, `${run}-race-a`), place(bob, `${run}-race-b`)]);
    const won = race.filter((r) => r.status === 'fulfilled');
    const lost = race.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    assert.equal(won.length, 1, 'exactly one order wins the last unit');
    assert.equal(lost.length, 1);
    assert.equal(((lost[0].reason as HttpException).getResponse() as { code: string }).code, 'OUT_OF_STOCK');
    assert.equal((lost[0].reason as HttpException).getStatus(), 409);
    const afterRace = await product(last.id);
    assert.equal(afterRace.reservedQty, 1);
    assert.equal(afterRace.stockQty, 1);
    // the loser's cart is preserved so they can adjust
    const loserUser = (race[0].status === 'rejected' ? alice : bob);
    assert.equal((await commerce.getCart(loserUser)).items.length, 1);
    assert.equal((await prisma.commerceOrder.count({ where: { userId: loserUser.userId, items: { some: { productId: last.id } } } })), 0);
    await commerce.clearCart(alice);
    await commerce.clearCart(bob);

    // many buyers, limited stock: never oversell
    const scarce = await mkProduct(pA.id, 'نادر', { stockQty: 3 });
    const crowd = await Promise.all(['d1', 'd2', 'd3', 'd4', 'd5'].map((n) => mkUser(n)));
    await Promise.all(crowd.map((u) => fill(u, scarce.id, 1)));
    const crowdResults = await Promise.allSettled(crowd.map((u, i) => place(u, `${run}-crowd-${i}`)));
    assert.equal(crowdResults.filter((r) => r.status === 'fulfilled').length, 3);
    assert.equal((await product(scarce.id)).reservedQty, 3);

    // =====================================================================
    // 6. Stock release happens once
    // =====================================================================
    const shelf = await mkProduct(pA.id, 'رف', { stockQty: 4 });
    await fill(alice, shelf.id, 1);
    const o1 = (await place(alice, `${run}-shelf-1`)).order;
    await fill(bob, shelf.id, 1);
    const o2 = (await place(bob, `${run}-shelf-2`)).order;
    assert.equal((await product(shelf.id)).reservedQty, 2);

    const doubleCancel = await Promise.allSettled([
      commerce.transitionOrderFor(actorA, o1.id, { fulfillmentStatus: 'rejected', note: 'نفدت الكمية' }),
      commerce.transitionOrderFor(actorA, o1.id, { fulfillmentStatus: 'rejected', note: 'نفدت الكمية' }),
      commerce.transitionOrderFor(ADMIN_ACTOR, o1.id, { fulfillmentStatus: 'cancelled', note: 'إلغاء إداري' }),
    ]);
    assert.ok(doubleCancel.some((r) => r.status === 'fulfilled'));
    assert.equal((await product(shelf.id)).reservedQty, 1, 'o2 still holds its unit; o1 released exactly once');
    const item1 = await prisma.commerceOrderItem.findFirstOrThrow({ where: { orderId: o1.id } });
    assert.equal(item1.stockState, 'released');
    // repeat after the fact: terminal -> no-op or conflict, never a second release
    await commerce.transitionOrderFor(actorA, o1.id, { fulfillmentStatus: 'rejected' });
    await failure(commerce.transitionOrderFor(actorA, o1.id, { fulfillmentStatus: 'cancelled' }), 409, 'TRANSITION_NOT_ALLOWED');
    assert.equal((await product(shelf.id)).reservedQty, 1);
    const o1Detail = await commerce.getOrder(actorA, o1.id);
    assert.equal(o1Detail.deliveryStatus, 'none');

    // delivery consumes stock: stock 4 -> 3, reserved 1 -> 0
    for (const status of ['accepted', 'preparing', 'out_for_delivery', 'delivered']) {
      await commerce.transitionOrderFor(actorA, o2.id, { fulfillmentStatus: status });
    }
    const afterDelivery = await product(shelf.id);
    assert.equal(afterDelivery.reservedQty, 0);
    assert.equal(afterDelivery.stockQty, 3);
    const delivered = await commerce.getOrder(actorA, o2.id);
    assert.equal(delivered.fulfillmentStatus, 'delivered');
    assert.equal(delivered.deliveryStatus, 'delivered');
    assert.equal(delivered.paymentCollectionStatus, 'uncollected', 'delivery does not imply cash collected');
    // cancelling after delivery is impossible, so no stock can come back
    await failure(commerce.transitionOrderFor(ADMIN_ACTOR, o2.id, { fulfillmentStatus: 'cancelled', note: 'سبب' }), 409, 'TRANSITION_NOT_ALLOWED');

    // =====================================================================
    // 7. Transition rules + separate axes
    // =====================================================================
    await fill(alice, untracked.id, 1);
    const flow = (await place(alice, `${run}-flow`)).order;
    await failure(commerce.transitionOrderFor(actorA, flow.id, { fulfillmentStatus: 'delivered' }), 409, 'TRANSITION_NOT_ALLOWED');
    await failure(commerce.transitionOrderFor(actorA, flow.id, { fulfillmentStatus: 'nonsense' }), 400, 'STATUS_INVALID');
    await failure(commerce.transitionOrderFor(actorA, flow.id, {}), 400, 'TRANSITION_EMPTY');
    await failure(
      commerce.transitionOrderFor({ type: 'customer', id: alice.id, userId: alice.userId }, flow.id, { fulfillmentStatus: 'accepted' }),
      403,
      'TRANSITION_FORBIDDEN',
    );
    await failure(commerce.transitionOrderFor(ADMIN_ACTOR, flow.id, { fulfillmentStatus: 'accepted' }), 400, 'REASON_REQUIRED');
    await failure(commerce.transitionOrderFor(actorA, flow.id, { deliveryStatus: 'pending' }), 422, 'DELIVERY_STATUS_NOT_SETTABLE');
    await failure(
      commerce.transitionOrderFor(actorA, flow.id, { fulfillmentStatus: 'accepted', deliveryStatus: 'delivered' }),
      422,
      'STATUS_MISMATCH',
    );

    await failure(commerce.collectPayment(actorA, flow.id, {}), 409, 'PAYMENT_NOT_COLLECTABLE');
    await commerce.transitionOrderFor(actorA, flow.id, { fulfillmentStatus: 'accepted' });
    await failure(commerce.cancelCustomerOrder(alice, flow.id, {}), 403, 'TRANSITION_FORBIDDEN'); // customer can no longer cancel
    await commerce.transitionOrderFor(actorA, flow.id, { fulfillmentStatus: 'preparing', note: 'جاري التجهيز' });
    const moving = await commerce.transitionOrderFor(actorA, flow.id, { deliveryStatus: 'out_for_delivery' });
    assert.equal(moving.fulfillmentStatus, 'out_for_delivery');
    assert.equal(moving.deliveryStatus, 'out_for_delivery');
    await failure(commerce.collectPayment(actorA, flow.id, { note: 'مبكر' }), 409, 'PAYMENT_NOT_COLLECTABLE');
    const failed = await commerce.transitionOrderFor(actorA, flow.id, { fulfillmentStatus: 'failed_delivery', deliveryStatus: 'failed' });
    assert.equal(failed.deliveryStatus, 'failed');
    assert.equal((await product(untracked.id)).reservedQty, 0);
    const retryOut = await commerce.transitionOrderFor(actorA, flow.id, { fulfillmentStatus: 'out_for_delivery' });
    assert.equal(retryOut.deliveryStatus, 'out_for_delivery');
    const same = await commerce.transitionOrderFor(actorA, flow.id, { fulfillmentStatus: 'out_for_delivery' });
    assert.equal((same as { unchanged?: boolean }).unchanged, true);
    await commerce.transitionOrderFor(actorA, flow.id, { fulfillmentStatus: 'delivered' });
    assert.equal((await commerce.getOrder(actorA, flow.id)).paymentCollectionStatus, 'uncollected', 'delivery does not collect');

    // payment collection only after delivered; dual click is idempotent
    const dualCollect = await Promise.all([
      commerce.collectPayment(actorA, flow.id, { note: 'نقدًا' }),
      commerce.collectPayment(actorA, flow.id, { note: 'نقدًا' }),
    ]);
    assert.ok(dualCollect.every((o) => o.paymentCollectionStatus === 'collected'));
    const collected = await commerce.getOrder(actorA, flow.id);
    assert.equal(collected.fulfillmentStatus, 'delivered', 'collecting does not change fulfillment');
    assert.equal(collected.collectionActor, 'partner:pu-a');
    assert.ok(collected.collectedAt);
    assert.equal(collected.events.filter((e) => e.field === 'payment' && e.toStatus === 'collected').length, 1, 'one collect event');
    const again = await commerce.collectPayment(actorA, flow.id, {});
    assert.equal((again as { alreadyCollected?: boolean }).alreadyCollected, true);
    await failure(commerce.waivePayment(ADMIN_ACTOR, flow.id, { note: 'سبب' }), 409, 'PAYMENT_NOT_COLLECTABLE');
    await failure(commerce.collectPayment({ type: 'customer', id: alice.id, userId: alice.userId }, flow.id, {}), 403, 'PAYMENT_FORBIDDEN');
    assert.equal(collected.events.some((e) => e.field === 'fulfillment' && e.toStatus === 'preparing' && e.note === 'جاري التجهيز'), true);
    const customerView = await commerce.getCustomerOrder(alice, flow.id);
    assert.ok(customerView.events.every((e) => e.actorId === undefined), 'customer timeline hides actor ids');
    assert.ok(!customerView.events.some((e) => e.note === 'جاري التجهيز'), 'customer does not see partner notes');

    // customer cancel before acceptance releases stock
    const cancelable = await mkProduct(pA.id, 'قابل للإلغاء', { stockQty: 2 });
    await fill(carol, cancelable.id, 2);
    const cc = (await place(carol, `${run}-carol`)).order;
    assert.equal((await product(cancelable.id)).reservedQty, 2);
    const cancelled = await commerce.cancelCustomerOrder(carol, cc.id, { note: 'غيرت رأيي' });
    assert.equal(cancelled.fulfillmentStatus, 'cancelled');
    assert.equal((await product(cancelable.id)).reservedQty, 0);
    const cancelAgain = await commerce.cancelCustomerOrder(carol, cc.id, {});
    assert.equal((cancelAgain as { unchanged?: boolean }).unchanged, true);
    assert.equal((await product(cancelable.id)).reservedQty, 0);
    await failure(commerce.cancelCustomerOrder(bob, cc.id, {}), 404, 'ORDER_NOT_FOUND');

    // =====================================================================
    // 8. Partner isolation, admin sees all
    // =====================================================================
    await fill(bob, otherPartner.id, 1);
    const bOrder = (await place(bob, `${run}-b-order`)).order;
    await failure(commerce.getOrder(actorB, flow.id), 404, 'ORDER_NOT_FOUND');
    await failure(commerce.transitionOrderFor(actorB, flow.id, { fulfillmentStatus: 'delivered' }), 404, 'ORDER_NOT_FOUND');
    await failure(commerce.collectPayment(actorB, flow.id, {}), 404, 'ORDER_NOT_FOUND');
    await failure(commerce.getOrder(actorA, bOrder.id), 404, 'ORDER_NOT_FOUND');
    await failure(commerce.transitionOrderFor(actorA, bOrder.id, { fulfillmentStatus: 'accepted' }), 404, 'ORDER_NOT_FOUND');
    await failure(commerce.getCustomerOrder(alice, bOrder.id), 404, 'ORDER_NOT_FOUND');
    assert.equal((await prisma.commerceOrder.findUniqueOrThrow({ where: { id: flow.id } })).fulfillmentStatus, 'delivered');
    const listB = await commerce.listOrders(actorB, {});
    assert.deepEqual(listB.items.map((o) => o.id), [bOrder.id]);
    // a partner cannot widen scope through query params
    const sneaky = await commerce.listOrders(actorB, { partnerId: pA.id });
    assert.deepEqual(sneaky.items.map((o) => o.id), [bOrder.id]);
    const listA = await commerce.listOrders(actorA, { limit: 100 });
    assert.ok(listA.items.every((o) => o.partner.id === pA.id));
    assert.ok(!listA.items.some((o) => o.id === bOrder.id));
    assert.ok((listA.items[0] as { userId?: string }).userId === undefined, 'partner view hides user id');
    const adminAll = await commerce.listOrders(ADMIN_ACTOR, { limit: 100 });
    assert.ok(adminAll.items.some((o) => o.id === bOrder.id) && adminAll.items.some((o) => o.id === flow.id));
    const adminOnlyB = await commerce.listOrders(ADMIN_ACTOR, { partnerId: pB.id, limit: 100 });
    assert.ok(adminOnlyB.items.every((o) => o.partner.id === pB.id));
    const byNumber = await commerce.listOrders(ADMIN_ACTOR, { q: bOrder.publicNumber.toLowerCase() });
    assert.deepEqual(byNumber.items.map((o) => o.id), [bOrder.id]);
    const byStatus = await commerce.listOrders(actorB, { status: 'new' });
    assert.equal(byStatus.items.length, 1);
    await failure(commerce.listOrders(actorB, { status: 'bogus' }), 400, 'STATUS_INVALID');
    // customer lists only their own
    const aliceOrders = await commerce.listCustomerOrders(alice, { limit: 100 });
    assert.ok(aliceOrders.items.length >= 3);
    assert.ok(!aliceOrders.items.some((o) => o.id === bOrder.id));
    const page1 = await commerce.listCustomerOrders(alice, { limit: 2 });
    assert.equal(page1.items.length, 2);
    assert.ok(page1.nextCursor);
    const page2 = await commerce.listCustomerOrders(alice, { limit: 2, cursor: page1.nextCursor });
    assert.ok(page2.items.every((o) => !page1.items.some((p) => p.id === o.id)), 'pages do not overlap');
    // admin acts with reason
    const adminMove = await commerce.transitionOrderFor(ADMIN_ACTOR, bOrder.id, { fulfillmentStatus: 'rejected', note: 'مخالفة السياسة' });
    assert.equal(adminMove.fulfillmentStatus, 'rejected');
    const adminEvent = adminMove.events.filter((e) => e.field === 'fulfillment').at(-1);
    assert.equal(adminEvent?.actorType, 'admin');
    assert.equal(adminEvent?.note, 'مخالفة السياسة');

    // =====================================================================
    // 9. Variants: priced by server, unavailable blocked
    // =====================================================================
    const shirt = await mkProduct(pA.id, 'قميص', {
      stockQty: 10,
      optionsJson: [{ id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 's', labelAr: 'S' }, { id: 'm', labelAr: 'M' }] }],
      variantsJson: [
        { id: 'v-s', selections: { size: 's' }, priceHalalas: 6500 },
        { id: 'v-m', selections: { size: 'm' }, available: false },
      ],
    });
    await failure(fill(carol, shirt.id, 1), 400, 'SELECTION_REQUIRED');
    await failure(fill(carol, shirt.id, 1, { selections: { size: 'm' } }), 409, 'VARIANT_UNAVAILABLE');
    const shirtCart = await fill(carol, shirt.id, 1, { selections: { size: 's' } });
    assert.equal(shirtCart.items[0].unitPriceHalalas, 6500);
    assert.equal(shirtCart.items[0].variantKey, 'v-s');
    assert.equal(shirtCart.items[0].selections[0].valueLabelAr, 'S');
    // variant becomes unavailable after being carted: checkout is blocked, nothing reserved
    await prisma.product.update({
      where: { id: shirt.id },
      data: { variantsJson: [{ id: 'v-s', selections: { size: 's' }, priceHalalas: 6500, available: false }] },
    });
    const blocked = await commerce.getCart(carol);
    assert.equal(blocked.canCheckout, false);
    assert.equal(blocked.issues[0].code, 'VARIANT_UNAVAILABLE');
    await failure(place(carol, `${run}-variant-blocked`), 422, 'VARIANT_UNAVAILABLE');
    assert.equal((await product(shirt.id)).reservedQty, 0);
    // a price change after carting is picked up at order time
    await prisma.product.update({
      where: { id: shirt.id },
      data: { variantsJson: [{ id: 'v-s', selections: { size: 's' }, priceHalalas: 7000 }] },
    });
    const repriced = (await place(carol, `${run}-variant-price`)).order;
    assert.equal(repriced.items[0].unitPriceHalalas, 7000);
    assert.equal(repriced.subtotalHalalas, 7000);
    assert.equal(repriced.items[0].selections && (repriced.items[0].selections as Array<{ valueLabelAr: string }>)[0].valueLabelAr, 'S');
    // product pulled from the catalog after carting
    await fill(bob, tracked.id, 1);
    await prisma.product.update({ where: { id: tracked.id }, data: { purchaseMode: 'external' } });
    await failure(place(bob, `${run}-went-external`), 422, 'EXTERNAL_PRODUCT_NOT_PURCHASABLE');
    await prisma.product.update({ where: { id: tracked.id }, data: { purchaseMode: 'internal_cod' } });
    await commerce.clearCart(bob);

    // =====================================================================
    // 10. Bookings: availability, conflicts, idempotency, isolation
    // =====================================================================
    const salon = await mkPartner('Salon', 'salon');
    const actorSalon = partnerActor('pu-salon', salon.id);
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 600, endMin: 840, capacity: 1 }));
    const service = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: 'جلسة عناية',
        nameEn: `${run}-svc`,
        durationMin: 60,
        priceHalalas: 25000,
        concernTags: [],
        bookingEnabled: true,
        availabilityJson: allWeek,
      },
    });
    const noAvailability = await prisma.service.create({
      data: { partnerId: salon.id, nameAr: 'بدون مواعيد', nameEn: `${run}-svc2`, durationMin: 30, priceHalalas: 10000, concernTags: [], bookingEnabled: true },
    });
    const disabled = await prisma.service.create({
      data: { partnerId: salon.id, nameAr: 'غير مفعلة', nameEn: `${run}-svc3`, durationMin: 30, priceHalalas: 10000, concernTags: [], bookingEnabled: false, availabilityJson: allWeek },
    });

    const day = localParts(new Date(Date.now() + 5 * 86_400_000)).dateKey;
    const slotAt = (minute: number) => localInstant(day, minute)!.toISOString();
    const book = (user: Customer, minute: number, key: string, extra: Record<string, unknown> = {}) =>
      commerce.createBooking(user, {
        serviceId: service.id,
        startsAt: slotAt(minute),
        contactName: 'سارة',
        contactPhone: PHONE,
        idempotencyKey: key,
        ...extra,
      });

    const before = await commerce.serviceAvailability(service.id, day);
    assert.equal(before.slots.length, 4);
    assert.ok(before.slots.every((s) => s.available && s.remaining === 1));
    assert.equal(before.payMode, 'pay_at_venue');

    const b1 = await book(alice, 600, `${run}-bk-1`, { notes: 'أول مرة' });
    assert.equal(b1.booking.status, 'requested');
    assert.equal(b1.booking.priceHalalas, 25000);
    assert.equal(b1.booking.payMode, 'pay_at_venue');
    assert.equal(b1.booking.durationMin, 60);
    assert.equal(b1.booking.endsAt, slotAt(660));
    assert.equal(b1.booking.serviceNameAr, 'جلسة عناية');
    // dual click
    const bookClicks = await Promise.allSettled([book(alice, 600, `${run}-bk-1`), book(alice, 600, `${run}-bk-1`)]);
    assert.ok(bookClicks.every((c) => c.status === 'fulfilled'));
    assert.ok(bookClicks.every((c) => (c as PromiseFulfilledResult<{ booking: { id: string }; idempotentReplay: boolean }>).value.booking.id === b1.booking.id));
    assert.equal(await prisma.commerceBooking.count({ where: { userId: alice.userId, serviceId: service.id } }), 1);

    // capacity 1: same slot is taken, neighbours are free
    await failure(book(bob, 600, `${run}-bk-2`), 409, 'BOOKING_SLOT_FULL');
    await failure(book(alice, 600, `${run}-bk-1b`), 409, 'BOOKING_USER_OVERLAP');
    const after = await commerce.serviceAvailability(service.id, day);
    assert.equal(after.slots[0].remaining, 0);
    assert.equal(after.slots[0].available, false);
    assert.equal(after.slots[1].available, true);

    // race for a free slot: one winner
    const raceBooking = await Promise.allSettled([book(bob, 660, `${run}-bk-r1`), book(carol, 660, `${run}-bk-r2`)]);
    assert.equal(raceBooking.filter((r) => r.status === 'fulfilled').length, 1);
    const loserBooking = raceBooking.find((r): r is PromiseRejectedResult => r.status === 'rejected')!;
    assert.equal(((loserBooking.reason as HttpException).getResponse() as { code: string }).code, 'BOOKING_SLOT_FULL');
    assert.equal(await prisma.commerceBooking.count({ where: { serviceId: service.id, startsAt: new Date(slotAt(660)) } }), 1);

    // validation
    await failure(book(bob, 605, `${run}-bk-bad1`), 422, 'SLOT_MISALIGNED');
    await failure(book(bob, 840, `${run}-bk-bad2`), 422, 'SLOT_OUTSIDE_AVAILABILITY');
    await failure(book(bob, 630, `${run}-bk-bad3`), 422, 'SLOT_MISALIGNED');
    await failure(
      commerce.createBooking(bob, { serviceId: service.id, startsAt: new Date(Date.now() - 3_600_000).toISOString(), contactName: 'بوب', contactPhone: PHONE, idempotencyKey: `${run}-bk-past` }),
      422,
      'SLOT_IN_PAST',
    );
    await failure(commerce.createBooking(bob, { serviceId: service.id, startsAt: 'not-a-date', contactName: 'بوب', contactPhone: PHONE, idempotencyKey: `${run}-bk-nd` }), 400, 'STARTS_AT_INVALID');
    await failure(commerce.createBooking(bob, { serviceId: noAvailability.id, startsAt: slotAt(600), contactName: 'بوب', contactPhone: PHONE, idempotencyKey: `${run}-bk-na` }), 422, 'AVAILABILITY_NOT_CONFIGURED');
    await failure(commerce.createBooking(bob, { serviceId: disabled.id, startsAt: slotAt(600), contactName: 'بوب', contactPhone: PHONE, idempotencyKey: `${run}-bk-dis` }), 422, 'BOOKING_NOT_ENABLED');
    await failure(commerce.createBooking(bob, { serviceId: 'nope', startsAt: slotAt(600), contactName: 'بوب', contactPhone: PHONE, idempotencyKey: `${run}-bk-ns` }), 404, 'SERVICE_NOT_FOUND');
    await failure(commerce.createBooking(bob, { serviceId: service.id, startsAt: slotAt(600), contactName: 'بوب', contactPhone: PHONE }), 400, 'IDEMPOTENCY_KEY_REQUIRED');
    await failure(commerce.serviceAvailability(service.id, '2026-13-40'), 400, 'DATE_INVALID');

    // state machine + isolation
    await failure(commerce.transitionBookingFor(actorSalon, b1.booking.id, { status: 'completed' }), 409, 'TRANSITION_NOT_ALLOWED');
    await failure(commerce.transitionBookingFor(actorSalon, b1.booking.id, { status: 'bogus' }), 400, 'STATUS_INVALID');
    await failure(commerce.transitionBookingFor(actorA, b1.booking.id, { status: 'confirmed' }), 404, 'BOOKING_NOT_FOUND');
    await failure(commerce.getBooking(actorB, b1.booking.id), 404, 'BOOKING_NOT_FOUND');
    await failure(commerce.getCustomerBooking(bob, b1.booking.id), 404, 'BOOKING_NOT_FOUND');
    await failure(commerce.transitionBookingFor(ADMIN_ACTOR, b1.booking.id, { status: 'confirmed' }), 400, 'REASON_REQUIRED');
    await failure(
      commerce.transitionBookingFor({ type: 'customer', id: alice.id, userId: alice.userId }, b1.booking.id, { status: 'confirmed' }),
      403,
      'TRANSITION_FORBIDDEN',
    );
    const confirmed = await commerce.transitionBookingFor(actorSalon, b1.booking.id, { status: 'confirmed', note: 'مؤكد' });
    assert.equal(confirmed.status, 'confirmed');
    assert.equal(confirmed.events.length, 2);
    await failure(commerce.transitionBookingFor(actorSalon, b1.booking.id, { status: 'completed' }), 409, 'BOOKING_NOT_STARTED');
    // cancel frees the slot for someone else
    const cancelledBooking = await commerce.cancelCustomerBooking(alice, b1.booking.id, {});
    assert.equal(cancelledBooking.status, 'cancelled');
    const takeover = await book(bob, 600, `${run}-bk-takeover`);
    assert.equal(takeover.booking.status, 'requested');
    await failure(commerce.transitionBookingFor(actorSalon, b1.booking.id, { status: 'confirmed' }), 409, 'TRANSITION_NOT_ALLOWED');
    // partner rejects
    const rejectedBooking = await commerce.transitionBookingFor(actorSalon, takeover.booking.id, { status: 'rejected', note: 'مغلق' });
    assert.equal(rejectedBooking.status, 'rejected');
    // completion of a past, confirmed visit
    const past = await prisma.commerceBooking.create({
      data: {
        publicNumber: `MB-${run}`.slice(0, 20), userId: alice.userId, partnerId: salon.id, serviceId: service.id, serviceNameAr: 'جلسة عناية',
        startsAt: new Date(Date.now() - 7_200_000), endsAt: new Date(Date.now() - 3_600_000), durationMin: 60, priceHalalas: 25000,
        status: 'confirmed', contactName: 'سارة', contactPhone: PHONE,
      },
    });
    const done = await commerce.transitionBookingFor(actorSalon, past.id, { status: 'completed' });
    assert.equal(done.status, 'completed');
    // lists
    const salonList = await commerce.listBookings(actorSalon, { limit: 100 });
    assert.ok(salonList.items.length >= 3 && salonList.items.every((b) => b.partner.id === salon.id));
    assert.equal((await commerce.listBookings(actorA, {})).items.length, 0);
    assert.equal((await commerce.listBookings(actorA, { partnerId: salon.id })).items.length, 0, 'query cannot widen partner scope');
    const adminBookings = await commerce.listBookings(ADMIN_ACTOR, { partnerId: salon.id, status: 'completed' });
    assert.deepEqual(adminBookings.items.map((b) => b.id), [past.id]);
    assert.equal((adminBookings.items[0] as { userId?: string }).userId, alice.userId);
    const mine = await commerce.listCustomerBookings(bob, {});
    assert.ok(mine.items.every((b) => (b as { userId?: string }).userId === undefined));
    assert.ok(mine.items.length >= 1);
    // partner availability only for own service
    assert.equal((await commerce.serviceAvailability(service.id, day, salon.id)).slots.length, 4);
    await failure(commerce.serviceAvailability(service.id, day, pA.id), 404, 'SERVICE_NOT_FOUND');
    // service pay mode other than pay_at_venue is rejected
    await prisma.service.update({ where: { id: service.id }, data: { payMode: 'online' } });
    await failure(book(carol, 780, `${run}-bk-pm`), 422, 'PAY_MODE_UNSUPPORTED');

    console.log('commerce.service schema tests passed');
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    await prisma.partner.deleteMany({ where: { id: { in: created.partnerIds } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
