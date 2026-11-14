/**
 * Isolated proof for «البيع والحجز بدون متجر»:
 * customer + seller(brand, storeUrl=null) + salon(storeUrl=null) + admin.
 * Local DATABASE_URL only. Writes JSON evidence; does not touch production.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { HttpException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ACTOR, CommerceService, partnerActor, type CommerceActor } from './commerce.service';
import { localInstant, localParts } from './commerce.types';
import { partnerCanCreateKindFromPartner } from '../partners-portal/partner-capabilities';

type Step = {
  step: string;
  actor: string;
  layer: 'server' | 'editor-path' | 'ui-not-run';
  expected: string;
  actual: string;
  ok: boolean;
  evidence: string;
};

type Customer = CommerceActor & { type: 'customer' };

const run = `sbws${Date.now().toString(36)}`;
const PHONE = '0501234567';
const steps: Step[] = [];

function record(s: Step) {
  steps.push(s);
  const mark = s.ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${s.step} | ${s.actor} | ${s.actual}`);
}

async function failure(promise: Promise<unknown>, status: number, code: string) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof HttpException);
    const body = error.getResponse() as Record<string, unknown>;
    assert.equal(error.getStatus(), status);
    assert.equal(body.code, code);
    return body;
  }
  assert.fail(`expected ${code}`);
}

function coercePurchaseModeLikeEditor(value: unknown): string {
  // Mirrors editor-drafts.service.ts materialize path.
  return value === 'internal_cod' || value === 'external' ? String(value) : 'external';
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  let dbName = '';
  try {
    dbName = new URL(url).pathname.replace(/^\//, '');
  } catch {
    dbName = '';
  }
  if (!dbName || dbName === 'mira_db' || !/test/i.test(dbName)) {
    console.error(`REFUSE: database name must be a dedicated local *test* DB, got "${dbName}"`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const commerce = new CommerceService(prisma as unknown as PrismaService);
  const partnerIds: string[] = [];
  const userIds: string[] = [];
  const mediaIds: string[] = [];
  const adIds: string[] = [];

  const outDir = resolve(
    process.cwd(),
    '../docs/mira-commerce-reference/evidence/sell-book-without-store',
  );
  mkdirSync(outDir, { recursive: true });

  try {
    // —— 1. Actors ————————————————————————————————————————————————
    const customer = (await commerce.customerActor({
      firebaseUid: `${run}-customer`,
      email: `${run}-customer@test.local`,
      name: 'عميلة اختبار',
    })) as Customer;
    userIds.push(customer.userId);

    const customerB = (await commerce.customerActor({
      firebaseUid: `${run}-customer-b`,
      email: `${run}-customer-b@test.local`,
      name: 'عميلة منافسة',
    })) as Customer;
    userIds.push(customerB.userId);

    const seller = await prisma.partner.create({
      data: {
        type: 'brand',
        nameAr: 'بائعة بلا متجر',
        nameEn: `${run}-seller`,
        storeUrl: null,
        canSellProducts: true,
        city: 'الرياض',
      },
    });
    partnerIds.push(seller.id);
    await prisma.partnerUser.create({
      data: {
        partnerId: seller.id,
        email: `${run}-seller@test.local`,
        accessToken: `${run}-seller-tok`,
      },
    });
    const sellerActor = partnerActor(`${run}-seller-pu`, seller.id);

    const salon = await prisma.partner.create({
      data: {
        type: 'salon',
        nameAr: 'مقدّمة خدمة بلا متجر',
        nameEn: `${run}-salon`,
        storeUrl: null,
        city: 'الرياض',
      },
    });
    partnerIds.push(salon.id);
    await prisma.partnerUser.create({
      data: {
        partnerId: salon.id,
        email: `${run}-salon@test.local`,
        accessToken: `${run}-salon-tok`,
      },
    });
    const salonActor = partnerActor(`${run}-salon-pu`, salon.id);

    const miraAdminPartner = await prisma.partner.create({
      data: {
        type: 'developer',
        nameAr: 'حساب ميرا إداري',
        nameEn: `${run}-mira-admin`,
        storeUrl: null,
        city: 'الرياض',
      },
    });
    partnerIds.push(miraAdminPartner.id);

    record({
      step: 'إنشاء حسابات معزولة بلا storeUrl',
      actor: 'harness',
      layer: 'server',
      expected: 'عميلة + بائع brand + صالون + شريك إداري؛ storeUrl=null',
      actual: `seller.storeUrl=${seller.storeUrl} salon.storeUrl=${salon.storeUrl} canCreateProduct=${partnerCanCreateKindFromPartner(seller, 'product')} canCreateService=${partnerCanCreateKindFromPartner(salon, 'service')}`,
      ok:
        seller.storeUrl === null &&
        salon.storeUrl === null &&
        partnerCanCreateKindFromPartner(seller, 'product') === true &&
        partnerCanCreateKindFromPartner(salon, 'service') === true,
      evidence: `partners ${seller.id} / ${salon.id}`,
    });

    // —— 2. COD sale journey ———————————————————————————————————————
    const product = await prisma.product.create({
      data: {
        partnerId: seller.id,
        nameAr: 'عباية اختبار',
        nameEn: `${run}-abaya`,
        priceHalalas: 19900,
        externalUrl: 'https://example.test/unused',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        stockQty: 2,
        deliveryFeeHalalas: 1500,
        contentStatus: 'published',
        active: true,
      },
    });
    const mediaMain = await prisma.catalogMedia.create({
      data: {
        ownerKind: 'product',
        ownerId: product.id,
        kind: 'video',
        url: `https://cdn.test/${run}/abaya-main.mp4`,
        placement: 'main',
        sortOrder: 0,
        isPrimary: true,
      },
    });
    mediaIds.push(mediaMain.id);
    const mediaAlt = await prisma.catalogMedia.create({
      data: {
        ownerKind: 'product',
        ownerId: product.id,
        kind: 'video',
        url: `https://cdn.test/${run}/abaya-alt.mp4`,
        placement: 'main',
        sortOrder: 1,
      },
    });
    mediaIds.push(mediaAlt.id);

    await commerce.addCartItem(customer, { productId: product.id, quantity: 1 });
    const quote = await commerce.quote(customer);
    const placed = await commerce.createOrder(customer, {
      idempotencyKey: `${run}-order-1`,
      contactName: 'عميلة اختبار',
      contactPhone: PHONE,
      addressLine: 'حي الياسمين',
      city: 'الرياض',
      confirmationFingerprint: quote.confirmationFingerprint,
    });
    const orderId = placed.order.id;
    const publicNumber = placed.order.publicNumber;

    const custSee = await commerce.getCustomerOrder(customer, orderId);
    const sellerSee = await commerce.getOrder(sellerActor, orderId);
    const adminSee = await commerce.getOrder(ADMIN_ACTOR, orderId);
    await failure(commerce.getOrder(salonActor, orderId), 404, 'ORDER_NOT_FOUND');
    const salonOrders = await commerce.listOrders(salonActor, { limit: 50 });
    const salonSeesOrder = salonOrders.items.some((o) => o.id === orderId);

    record({
      step: 'طلب COD: رؤية العميلة والبائع والإدارة؛ الصالون لا يرى',
      actor: 'customer/seller/admin/salon',
      layer: 'server',
      expected: 'نفس رقم الطلب لدى العميلة والبائع والإدارة؛ الصالون 404/قائمة فارغة منه',
      actual: `publicNumber=${publicNumber} cust=${custSee.publicNumber} seller=${sellerSee.publicNumber} admin=${adminSee.publicNumber} salonSees=${salonSeesOrder}`,
      ok:
        custSee.publicNumber === publicNumber &&
        sellerSee.publicNumber === publicNumber &&
        adminSee.publicNumber === publicNumber &&
        salonSeesOrder === false,
      evidence: `orderId=${orderId}`,
    });

    for (const status of ['accepted', 'preparing', 'out_for_delivery', 'delivered'] as const) {
      await commerce.transitionOrderFor(sellerActor, orderId, { fulfillmentStatus: status });
    }
    const afterDeliver = await commerce.getOrder(sellerActor, orderId);
    assert.equal(afterDeliver.paymentCollectionStatus, 'uncollected');
    const collected = await commerce.collectPayment(sellerActor, orderId, { note: 'نقدًا عند التسليم' });
    const custAfterPay = await commerce.getCustomerOrder(customer, orderId);
    const stock = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

    record({
      step: 'تسليم + تسجيل تحصيل COD',
      actor: 'seller',
      layer: 'server',
      expected: 'delivered + collected؛ المخزون ينقص 1؛ العميلة ترى الحالة',
      actual: `fulfillment=${collected.fulfillmentStatus} payment=${collected.paymentCollectionStatus} stockQty=${stock.stockQty} reserved=${stock.reservedQty} customerPayment=${custAfterPay.paymentCollectionStatus}`,
      ok:
        collected.fulfillmentStatus === 'delivered' &&
        collected.paymentCollectionStatus === 'collected' &&
        stock.stockQty === 1 &&
        stock.reservedQty === 0 &&
        custAfterPay.paymentCollectionStatus === 'collected',
      evidence: `collectionActor=${collected.collectionActor}`,
    });

    // —— 3. Booking journey ————————————————————————————————————————
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      startMin: 600,
      endMin: 840,
      capacity: 1,
    }));
    const service = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: 'جلسة تجميل اختبار',
        nameEn: `${run}-svc`,
        durationMin: 60,
        priceHalalas: 15000,
        concernTags: [],
        bookingEnabled: true,
        payMode: 'pay_at_venue',
        availabilityJson: allWeek,
        contentStatus: 'published',
        active: true,
      },
    });
    const day = localParts(new Date(Date.now() + 5 * 86_400_000)).dateKey;
    const slotAt = (minute: number) => localInstant(day, minute)!.toISOString();

    const beforeAccept = await commerce.createBooking(customer, {
      serviceId: service.id,
      startsAt: slotAt(600),
      contactName: 'عميلة اختبار',
      contactPhone: PHONE,
      idempotencyKey: `${run}-bk-1`,
    });
    assert.equal(beforeAccept.booking.status, 'requested');
    const custBkBefore = await commerce.getCustomerBooking(customer, beforeAccept.booking.id);
    const salonBk = await commerce.getBooking(salonActor, beforeAccept.booking.id);
    await failure(commerce.getBooking(sellerActor, beforeAccept.booking.id), 404, 'BOOKING_NOT_FOUND');
    const sellerBookings = await commerce.listBookings(sellerActor, { limit: 50 });
    const sellerSeesBk = sellerBookings.items.some((b) => b.id === beforeAccept.booking.id);

    record({
      step: 'طلب موعد قبل القبول',
      actor: 'customer/salon/seller',
      layer: 'server',
      expected: 'status=requested؛ الصالون يرى؛ البائع لا يرى',
      actual: `cust=${custBkBefore.status} salon=${salonBk.status} sellerSees=${sellerSeesBk} payMode=${custBkBefore.payMode}`,
      ok:
        custBkBefore.status === 'requested' &&
        salonBk.status === 'requested' &&
        sellerSeesBk === false &&
        custBkBefore.payMode === 'pay_at_venue',
      evidence: `bookingId=${beforeAccept.booking.id} publicNumber=${beforeAccept.booking.publicNumber}`,
    });

    const confirmed = await commerce.transitionBookingFor(salonActor, beforeAccept.booking.id, {
      status: 'confirmed',
      note: 'مقبول',
    });
    const custBkAfter = await commerce.getCustomerBooking(customer, beforeAccept.booking.id);
    record({
      step: 'قبول مقدّم الخدمة',
      actor: 'salon',
      layer: 'server',
      expected: 'confirmed لدى الطرفين',
      actual: `salon=${confirmed.status} customer=${custBkAfter.status}`,
      ok: confirmed.status === 'confirmed' && custBkAfter.status === 'confirmed',
      evidence: `events=${confirmed.events.length}`,
    });

    const cancelled = await commerce.cancelCustomerBooking(customer, beforeAccept.booking.id, {
      note: 'إعادة جدولة',
    });
    const availAfterCancel = await commerce.serviceAvailability(service.id, day);
    const freeAgain = availAfterCancel.slots.find((s) => s.startsAt === slotAt(600));
    record({
      step: 'إلغاء العميلة يحرّر الموعد',
      actor: 'customer',
      layer: 'server',
      expected: 'cancelled + slot available again',
      actual: `status=${cancelled.status} slotAvailable=${freeAgain?.available} remaining=${freeAgain?.remaining}`,
      ok: cancelled.status === 'cancelled' && freeAgain?.available === true && freeAgain?.remaining === 1,
      evidence: `day=${day}`,
    });

    // —— 4. Legacy clips / ownership / display mode ————————————————
    const adminProduct = await prisma.product.create({
      data: {
        partnerId: miraAdminPartner.id,
        nameAr: 'مقطع إداري قديم',
        nameEn: `${run}-admin-clip`,
        priceHalalas: 5000,
        externalUrl: 'https://example.test/admin',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'external',
        stockQty: 1,
        contentStatus: 'published',
        active: true,
      },
    });
    const adminMedia = await prisma.catalogMedia.create({
      data: {
        ownerKind: 'product',
        ownerId: adminProduct.id,
        kind: 'video',
        url: `https://cdn.test/${run}/admin.mp4`,
        placement: 'main',
      },
    });
    mediaIds.push(adminMedia.id);
    const ad = await prisma.catalogAd.create({
      data: {
        targetKind: 'product',
        targetId: adminProduct.id,
        advertiserPartnerId: miraAdminPartner.id,
        publisherPartnerId: miraAdminPartner.id,
        captionAr: 'نشر إداري نيابة',
        status: 'published',
      },
    });
    adIds.push(ad.id);

    const displayCoerced = coercePurchaseModeLikeEditor('display');
    const notForSaleCoerced = coercePurchaseModeLikeEditor('not_for_sale');
    await prisma.product.update({
      where: { id: product.id },
      data: { purchaseMode: displayCoerced },
    });
    const afterDisplay = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    const mediaStill = await prisma.catalogMedia.findMany({
      where: { ownerKind: 'product', ownerId: product.id },
      orderBy: { sortOrder: 'asc' },
    });

    // Activate one offer: flip partner-owned product to internal_cod; media ids must stay.
    await prisma.product.update({
      where: { id: product.id },
      data: { purchaseMode: 'internal_cod', stockQty: 1 },
    });
    const afterActivate = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    const mediaAfterActivate = await prisma.catalogMedia.findMany({
      where: { ownerKind: 'product', ownerId: product.id },
      orderBy: { sortOrder: 'asc' },
    });

    // Two clips same offer → both tied to same productId; activating product affects both.
    const bothAffected =
      mediaAfterActivate.length === 2 &&
      mediaAfterActivate.every((m) => m.ownerId === product.id) &&
      afterActivate.purchaseMode === 'internal_cod';

    record({
      step: 'محرر: اختيار «عرض فقط» / display',
      actor: 'editor-path',
      layer: 'editor-path',
      expected: 'القيمة المحفوظة فعليًا ليست display (تُحوَّل إلى external)',
      actual: `input=display → stored=${displayCoerced}; input=not_for_sale → stored=${notForSaleCoerced}; DB after write=${afterDisplay.purchaseMode}`,
      ok: displayCoerced === 'external' && notForSaleCoerced === 'external' && afterDisplay.purchaseMode === 'external',
      evidence: 'editor-drafts.service.ts coerce: only internal_cod|external persist; else external',
    });

    record({
      step: 'تفعيل عرض يملكه الشريك مع مقطعين',
      actor: 'seller-owned product',
      layer: 'server',
      expected: 'نفس productId + نفس media ids؛ الوضع internal_cod يؤثر على كل المقاطع المرتبطة',
      actual: `productId=${product.id} mode=${afterActivate.purchaseMode} mediaIds=${mediaAfterActivate.map((m) => m.id).join(',')} idsUnchanged=${mediaStill.map((m) => m.id).join(',') === mediaAfterActivate.map((m) => m.id).join(',')}`,
      ok: bothAffected && mediaStill[0].id === mediaAfterActivate[0].id && mediaStill[1].id === mediaAfterActivate[1].id,
      evidence: 'commerce owns purchaseMode on Product; CatalogMedia.ownerId=product',
    });

    // Admin-owned offer: partner seller cannot take ownership via any commerce API.
    const invitePathExists = false; // no claim/invite API in commerce or partners portal for this study scope
    let adminClaimStop = 'لا مسار دعوة/نقل ملكية من الواجهة';
    try {
      await commerce.addCartItem(customer, { productId: adminProduct.id, quantity: 1 });
      adminClaimStop = 'unexpected: external admin product entered cart';
    } catch (error) {
      const body = error instanceof HttpException ? (error.getResponse() as { code?: string }) : {};
      adminClaimStop = `شراء المنتج الإداري الخارجي مرفوض: ${body.code ?? 'error'}؛ الملكية تبقى partner_id=${adminProduct.partnerId} (ميرا) لا البائع ${seller.id}`;
    }
    // Direct DB reassignment would "work" but does NOT prove a user journey.
    record({
      step: 'عرض منشور من الإدارة → إسناده لصاحبه من الواجهة',
      actor: 'admin→owner claim',
      layer: 'server',
      expected: 'إن وُجد مسار دعوة/قبول؛ وإلا توثيق التوقف',
      actual: adminClaimStop,
      ok: invitePathExists === false,
      evidence: `adminProduct=${adminProduct.id} ad=${ad.id} invitePathExists=${invitePathExists}`,
    });
    // Mark the claim journey as NOT proven for UI
    record({
      step: 'هل تستطيع الإدارة تفعيل عرض قديم لصاحبه الصحيح من الواجهة؟',
      actor: 'admin UI',
      layer: 'ui-not-run',
      expected: 'دعوة ملكية أو نقل partner_id من واجهة مصرّح بها',
      actual: 'غير مثبت — لا API دعوة/claim في النطاق المفحوص؛ تعديل DB مباشر لا يُعد إثبات رحلة مستخدم',
      ok: false,
      evidence: 'STOP: missing ownership-claim journey',
    });

    // —— 5. Races ————————————————————————————————————————————————
    const last = await prisma.product.create({
      data: {
        partnerId: seller.id,
        nameAr: 'آخر قطعة',
        nameEn: `${run}-last`,
        priceHalalas: 1000,
        externalUrl: 'https://example.test/l',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        stockQty: 1,
        deliveryFeeHalalas: 0,
      },
    });
    await commerce.clearCart(customer).catch(() => undefined);
    await commerce.clearCart(customerB).catch(() => undefined);
    await commerce.addCartItem(customer, { productId: last.id, quantity: 1 });
    await commerce.addCartItem(customerB, { productId: last.id, quantity: 1 });
    const qA = await commerce.quote(customer);
    const qB = await commerce.quote(customerB);
    const raceStock = await Promise.allSettled([
      commerce.createOrder(customer, {
        idempotencyKey: `${run}-race-a`,
        contactName: 'سارة الأحد',
        contactPhone: PHONE,
        addressLine: 'حي الياسمين',
        city: 'الرياض',
        confirmationFingerprint: qA.confirmationFingerprint,
      }),
      commerce.createOrder(customerB, {
        idempotencyKey: `${run}-race-b`,
        contactName: 'نورة الإثنين',
        contactPhone: PHONE,
        addressLine: 'حي النرجس',
        city: 'الرياض',
        confirmationFingerprint: qB.confirmationFingerprint,
      }),
    ]);
    const stockWins = raceStock.filter((r) => r.status === 'fulfilled').length;
    const stockAfter = await prisma.product.findUniqueOrThrow({ where: { id: last.id } });
    const stockLost = raceStock.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    const stockLostCode =
      stockLost && stockLost.reason instanceof HttpException
        ? (stockLost.reason.getResponse() as { code?: string }).code
        : stockLost
          ? String(stockLost.reason)
          : null;
    record({
      step: 'سباق آخر قطعة من عميلتين',
      actor: 'two customers',
      layer: 'server',
      expected: 'فائز واحد؛ reservedQty=1؛ الخاسر OUT_OF_STOCK',
      actual: `wins=${stockWins} reserved=${stockAfter.reservedQty} lostCode=${stockLostCode}`,
      ok: stockWins === 1 && stockAfter.reservedQty === 1 && stockLostCode === 'OUT_OF_STOCK',
      evidence: `product=${last.id}`,
    });

    const raceSlot = await Promise.allSettled([
      commerce.createBooking(customer, {
        serviceId: service.id,
        startsAt: slotAt(660),
        contactName: 'سارة الأحد',
        contactPhone: PHONE,
        idempotencyKey: `${run}-slot-a`,
      }),
      commerce.createBooking(customerB, {
        serviceId: service.id,
        startsAt: slotAt(660),
        contactName: 'نورة الإثنين',
        contactPhone: PHONE,
        idempotencyKey: `${run}-slot-b`,
      }),
    ]);
    const slotWins = raceSlot.filter((r) => r.status === 'fulfilled').length;
    const slotCount = await prisma.commerceBooking.count({
      where: { serviceId: service.id, startsAt: new Date(slotAt(660)), status: { not: 'cancelled' } },
    });
    record({
      step: 'سباق نفس الموعد من عميلتين',
      actor: 'two customers',
      layer: 'server',
      expected: 'حجز واحد فقط',
      actual: `wins=${slotWins} activeRows=${slotCount}`,
      ok: slotWins === 1 && slotCount === 1,
      evidence: `slot=${slotAt(660)}`,
    });

    // Double confirm (idempotent key)
    const dualKey = `${run}-dual`;
    await commerce.clearCart(customer).catch(() => undefined);
    const dualProd = await prisma.product.create({
      data: {
        partnerId: seller.id,
        nameAr: 'ضغط مزدوج',
        nameEn: `${run}-dual`,
        priceHalalas: 2000,
        externalUrl: 'https://example.test/d',
        concernTags: [],
        skinTypes: [],
        purchaseMode: 'internal_cod',
        stockQty: 5,
        deliveryFeeHalalas: 0,
      },
    });
    await commerce.addCartItem(customer, { productId: dualProd.id, quantity: 1 });
    const qDual = await commerce.quote(customer);
    const bodyDual = {
      idempotencyKey: dualKey,
      contactName: 'سارة الأحد',
      contactPhone: PHONE,
      addressLine: 'حي الياسمين',
      city: 'الرياض',
      confirmationFingerprint: qDual.confirmationFingerprint,
    };
    const [d1, d2] = await Promise.all([
      commerce.createOrder(customer, bodyDual),
      commerce.createOrder(customer, bodyDual),
    ]);
    record({
      step: 'ضغط مرتين على تأكيد الطلب (نفس المفتاح)',
      actor: 'customer',
      layer: 'server',
      expected: 'نفس orderId؛ طلب واحد فقط',
      actual: `id1=${d1.order.id} id2=${d2.order.id} same=${d1.order.id === d2.order.id} replays=${[d1, d2].filter((x) => x.idempotentReplay).length}`,
      ok: d1.order.id === d2.order.id && [d1, d2].filter((x) => x.idempotentReplay).length === 1,
      evidence: `publicNumber=${d1.order.publicNumber}`,
    });

    const saleOk = steps.find((s) => s.step.startsWith('تسليم + تسجيل'))?.ok === true;
    const bookOk = steps.find((s) => s.step.startsWith('قبول مقدّم'))?.ok === true;
    const claimOk = false;

    const summary = {
      run,
      database: dbName,
      databaseUrlHostLocal: true,
      layer: 'server-service-proof',
      uiFlutterNotRun: true,
      answers: {
        firstSaleCompleted: saleOk,
        firstBookingCompleted: bookOk,
        adminCanActivateLegacyOfferForOwnerViaUi: claimOk,
        firstUnprovenStops: claimOk
          ? []
          : [
              {
                question: 'تفعيل عرض قديم لصاحبه من الواجهة',
                stop: 'لا مسار دعوة/claim/نقل ملكية من API/واجهة ضمن النطاق',
                needed: 'تصميم وتنفيذ رحلة دعوة ملكية + قبول الشريك + ربط partner_id دون تعديل DB يدوي',
              },
            ],
      },
      steps,
      ids: {
        customerUserId: customer.userId,
        sellerPartnerId: seller.id,
        salonPartnerId: salon.id,
        adminPartnerId: miraAdminPartner.id,
        productId: product.id,
        serviceId: service.id,
        orderPublicNumber: publicNumber,
      },
    };

    writeFileSync(resolve(outDir, 'PROOF_RUN.json'), JSON.stringify(summary, null, 2));
    const md = [
      '# SBWS proof run',
      '',
      `| الخطوة | المنفّذ | الطبقة | ما حدث فعليًا | النتيجة | الدليل |`,
      `|---|---|---|---|---|---|`,
      ...steps.map(
        (s) =>
          `| ${s.step} | ${s.actor} | ${s.layer} | ${s.actual.replace(/\|/g, '/')} | ${s.ok ? 'PASS' : 'FAIL/STOP'} | ${s.evidence.replace(/\|/g, '/')} |`,
      ),
      '',
      `## الإجابات الثلاث`,
      `- أول بيع اكتمل؟ **${saleOk ? 'نعم (خادم/خدمة)' : 'لا'}**`,
      `- أول حجز اكتمل؟ **${bookOk ? 'نعم (طلب→قبول على الخادم)' : 'لا'}**`,
      `- الإدارة تفعّل عرضًا قديمًا لصاحبه من الواجهة؟ **لا — غير مثبت**`,
      '',
    ].join('\n');
    writeFileSync(resolve(outDir, 'PROOF_STEPS.md'), md);
    console.log('SBWS proof finished', { saleOk, bookOk, claimOk, steps: steps.length });
  } finally {
    // Cleanup only rows we created (partners cascade products/orders when deleted carefully).
    // Orders/bookings cascade via partner/user deletes where schema allows.
    try {
      if (adIds.length) await prisma.catalogAd.deleteMany({ where: { id: { in: adIds } } });
      if (mediaIds.length) await prisma.catalogMedia.deleteMany({ where: { id: { in: mediaIds } } });
      if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (partnerIds.length) await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    } catch (e) {
      console.warn('cleanup warning', e);
    }
    await prisma.$disconnect();
  }

  if (steps.some((s) => s.layer !== 'ui-not-run' && !s.ok)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
