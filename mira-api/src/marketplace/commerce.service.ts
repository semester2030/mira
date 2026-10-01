import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACTIVE_BOOKING_STATUSES,
  ActorType,
  BookingStatus,
  DeliveryStatus,
  FulfillmentStatus,
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
  PURCHASE_MODE_INTERNAL_COD,
  SelectionSnapshot,
  badRequest,
  buildDaySlots,
  canCollectPayment,
  checkBookingTransition,
  checkFulfillmentTransition,
  checkSlot,
  commerceError,
  computeDeliveryFee,
  consumesStock,
  conflict,
  deliveryForFulfillment,
  fulfillmentForDelivery,
  isBookingStatus,
  isDeliveryStatus,
  isFulfillmentStatus,
  lineTotal,
  localInstant,
  makePublicNumber,
  normalizeIdempotencyKey,
  notFound,
  parseAvailability,
  parseContact,
  parseDelivery,
  parseOptionalNotes,
  parseQuantity,
  releasesStock,
  resolveSelection,
  unprocessable,
} from './commerce.types';

/** Who is acting. `scope` limits which rows they can see or change. */
export type CommerceActor =
  | { type: 'customer'; id: string; userId: string }
  | { type: 'partner'; id: string; partnerId: string }
  | { type: 'admin'; id: string };

export const ADMIN_ACTOR: CommerceActor = { type: 'admin', id: 'admin-key' };
export const partnerActor = (partnerUserId: string, partnerId: string): CommerceActor => ({
  type: 'partner',
  id: partnerUserId,
  partnerId,
});

type Tx = Prisma.TransactionClient;

type ProductWithPartner = Prisma.ProductGetPayload<{ include: { partner: true } }>;

type CartItemRow = { id: string; productId: string; variantKey: string; selectionsJson: Prisma.JsonValue | null; quantity: number };

type CartLineIssue = { code: string; messageAr: string };

type PricedLine = {
  id: string;
  productId: string;
  partnerId: string | null;
  nameAr: string | null;
  variantKey: string;
  selections: SelectionSnapshot[];
  quantity: number;
  unitPriceHalalas: number | null;
  lineTotalHalalas: number | null;
  /** Units still sellable for this product (null = unlimited). */
  availableQty: number | null;
  deliveryFeeHalalas: number | null;
  issues: CartLineIssue[];
};

type OrderRow = Prisma.CommerceOrderGetPayload<{ include: { items: true; partner: { select: { id: true; nameAr: true } } } }>;
type OrderDetailRow = Prisma.CommerceOrderGetPayload<{
  include: { items: true; events: true; partner: { select: { id: true; nameAr: true } } };
}>;
type BookingRow = Prisma.CommerceBookingGetPayload<{ include: { partner: { select: { id: true; nameAr: true } } } }>;

const ORDER_INCLUDE = { items: true, partner: { select: { id: true, nameAr: true } } } as const;
const ORDER_DETAIL_INCLUDE = {
  items: true,
  events: { orderBy: { createdAt: 'asc' as const } },
  partner: { select: { id: true, nameAr: true } },
} as const;
const BOOKING_INCLUDE = { partner: { select: { id: true, nameAr: true } } } as const;

const PURCHASABLE_PRODUCT = {
  active: true,
  contentStatus: 'published',
  catalogSource: 'catalog',
  partner: { status: 'active' },
} as const;

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function p2002Target(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return null;
  return JSON.stringify(error.meta?.target ?? '');
}

function pageArgs(limit: unknown, cursor: unknown): { take: number; cursor?: { id: string }; skip?: number } {
  const parsed = typeof limit === 'string' ? Number.parseInt(limit, 10) : typeof limit === 'number' ? limit : 30;
  const take = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 30;
  if (typeof cursor === 'string' && cursor) return { take: take + 1, cursor: { id: cursor }, skip: 1 };
  return { take: take + 1 };
}

function finishPage<T extends { id: string }>(rows: T[], limit: unknown): { rows: T[]; nextCursor: string | null } {
  const parsed = typeof limit === 'string' ? Number.parseInt(limit, 10) : typeof limit === 'number' ? limit : 30;
  const take = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 30;
  if (rows.length > take) {
    const page = rows.slice(0, take);
    return { rows: page, nextCursor: page[page.length - 1].id };
  }
  return { rows, nextCursor: null };
}

@Injectable()
export class CommerceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // =========================================================================
  // Users
  // =========================================================================

  async customerActor(authUser: RequestUser): Promise<CommerceActor & { type: 'customer' }> {
    const existing = await this.prisma.user.findUnique({ where: { firebaseUid: authUser.firebaseUid } });
    let user = existing;
    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: {
            firebaseUid: authUser.firebaseUid,
            email: authUser.email,
            displayName: authUser.name,
            subscription: { create: { plan: 'free', status: 'active' } },
            preference: { create: { locale: 'ar' } },
          },
        });
      } catch (error) {
        if (p2002Target(error) === null) throw error;
        user = await this.prisma.user.findUnique({ where: { firebaseUid: authUser.firebaseUid } });
      }
    }
    if (!user) throw commerceError(HttpStatus.UNAUTHORIZED, 'USER_REQUIRED', 'يلزم حساب ميرا');
    return { type: 'customer', id: user.id, userId: user.id };
  }

  // =========================================================================
  // Cart
  // =========================================================================

  async getCart(actor: CommerceActor & { type: 'customer' }) {
    const cart = await this.prisma.commerceCart.findUnique({
      where: { userId: actor.userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    return this.cartView(cart);
  }

  async clearCart(actor: CommerceActor & { type: 'customer' }) {
    const cart = await this.prisma.commerceCart.findUnique({ where: { userId: actor.userId } });
    if (cart) {
      await this.prisma.$transaction(async (tx) => {
        await this.lockCart(tx, cart.id);
        await tx.commerceCartItem.deleteMany({ where: { cartId: cart.id } });
        await tx.commerceCart.update({ where: { id: cart.id }, data: { partnerId: null } });
      }, TX_OPTIONS);
    }
    return this.getCart(actor);
  }

  async addCartItem(actor: CommerceActor & { type: 'customer' }, body: unknown) {
    const data = record(body);
    if (typeof data.productId !== 'string' || !data.productId) {
      throw badRequest('PRODUCT_REQUIRED', 'المنتج مطلوب');
    }
    const quantity = parseQuantity(data.quantity ?? 1);
    const product = await this.loadProduct(data.productId);
    this.assertInAppProduct(product);
    const resolved = this.resolveForProduct(product, data.selections, data.variantKey);

    // Native upsert (ON CONFLICT) so two first-adds never fail on the unique user key.
    await this.prisma.commerceCart.upsert({ where: { userId: actor.userId }, create: { userId: actor.userId }, update: {} });
    await this.prisma.$transaction(async (tx) => {
      const cart = await this.ensureLockedCart(tx, actor.userId);
      const items = await tx.commerceCartItem.findMany({ where: { cartId: cart.id } });

      if (items.length > 0 && cart.partnerId && cart.partnerId !== product.partnerId) {
        throw conflict(
          'CART_PARTNER_CONFLICT',
          'سلتك تحتوي على منتجات من متجر آخر. يرجى إكمال الطلب الحالي أو إفراغ السلة أولًا',
          { currentPartnerId: cart.partnerId, requestedPartnerId: product.partnerId },
        );
      }

      const existing = items.find((i) => i.productId === product.id && i.variantKey === resolved.variantKey);
      if (!existing && items.length >= MAX_CART_LINES) {
        throw conflict('CART_FULL', 'السلة وصلت للحد الأقصى من العناصر');
      }
      const lineQty = Math.min((existing?.quantity ?? 0) + quantity, MAX_LINE_QUANTITY);
      const otherQty = items
        .filter((i) => i.productId === product.id && i.id !== existing?.id)
        .reduce((sum, i) => sum + i.quantity, 0);
      this.assertStock(product, otherQty + lineQty);

      if (existing) {
        await tx.commerceCartItem.update({ where: { id: existing.id }, data: { quantity: lineQty } });
      } else {
        await tx.commerceCartItem.create({
          data: {
            cartId: cart.id,
            productId: product.id,
            variantKey: resolved.variantKey,
            selectionsJson: resolved.selections as Prisma.InputJsonValue,
            quantity: lineQty,
          },
        });
      }
      await tx.commerceCart.update({ where: { id: cart.id }, data: { partnerId: product.partnerId } });
    }, TX_OPTIONS);
    return this.getCart(actor);
  }

  async updateCartItem(actor: CommerceActor & { type: 'customer' }, itemId: string, body: unknown) {
    const quantity = parseQuantity(record(body).quantity);
    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.commerceCart.findUnique({ where: { userId: actor.userId } });
      if (!cart) throw notFound('CART_ITEM_NOT_FOUND', 'عنصر السلة غير موجود');
      await this.lockCart(tx, cart.id);
      const item = await tx.commerceCartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
      if (!item) throw notFound('CART_ITEM_NOT_FOUND', 'عنصر السلة غير موجود');
      const product = await this.loadProduct(item.productId, tx);
      this.assertInAppProduct(product);
      const siblings = await tx.commerceCartItem.findMany({ where: { cartId: cart.id, productId: item.productId } });
      const otherQty = siblings.filter((s) => s.id !== item.id).reduce((sum, s) => sum + s.quantity, 0);
      this.assertStock(product, otherQty + quantity);
      await tx.commerceCartItem.update({ where: { id: item.id }, data: { quantity } });
    }, TX_OPTIONS);
    return this.getCart(actor);
  }

  async removeCartItem(actor: CommerceActor & { type: 'customer' }, itemId: string) {
    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.commerceCart.findUnique({ where: { userId: actor.userId } });
      if (!cart) throw notFound('CART_ITEM_NOT_FOUND', 'عنصر السلة غير موجود');
      await this.lockCart(tx, cart.id);
      const removed = await tx.commerceCartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
      if (removed.count === 0) throw notFound('CART_ITEM_NOT_FOUND', 'عنصر السلة غير موجود');
      const left = await tx.commerceCartItem.count({ where: { cartId: cart.id } });
      if (left === 0) await tx.commerceCart.update({ where: { id: cart.id }, data: { partnerId: null } });
    }, TX_OPTIONS);
    return this.getCart(actor);
  }

  private async lockCart(tx: Tx, cartId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM commerce_carts WHERE id = ${cartId} FOR UPDATE`;
  }

  private async ensureLockedCart(tx: Tx, userId: string) {
    const cart = await tx.commerceCart.findUnique({ where: { userId } });
    if (!cart) throw conflict('CART_BUSY', 'تعذر تحديث السلة الآن، حاول مرة أخرى');
    await this.lockCart(tx, cart.id);
    return (await tx.commerceCart.findUnique({ where: { id: cart.id } }))!;
  }

  // =========================================================================
  // Pricing (shared by cart view, quote and order create)
  // =========================================================================

  private async loadProduct(productId: string, db: Tx | PrismaService = this.prisma): Promise<ProductWithPartner> {
    const product = await db.product.findFirst({
      where: { id: productId, ...PURCHASABLE_PRODUCT },
      include: { partner: true },
    });
    if (!product) throw notFound('PRODUCT_NOT_FOUND', 'المنتج غير متاح');
    return product;
  }

  private assertInAppProduct(product: ProductWithPartner): void {
    if (product.purchaseMode !== PURCHASE_MODE_INTERNAL_COD) {
      throw unprocessable(
        'EXTERNAL_PRODUCT_NOT_PURCHASABLE',
        'هذا المنتج يُشترى من موقع المتجر ولا يمكن إضافته إلى سلة ميرا',
        { externalUrl: product.externalUrl },
      );
    }
  }

  private resolveForProduct(product: ProductWithPartner, selections: unknown, variantKey: unknown) {
    return resolveSelection({
      basePriceHalalas: product.priceHalalas,
      optionsJson: product.optionsJson,
      variantsJson: product.variantsJson,
      selections,
      variantKey,
    });
  }

  private availableQty(product: Pick<ProductWithPartner, 'stockQty' | 'reservedQty'>): number | null {
    if (product.stockQty == null) return null;
    return Math.max(product.stockQty - product.reservedQty, 0);
  }

  private assertStock(product: ProductWithPartner, wantedQty: number): void {
    const available = this.availableQty(product);
    if (available !== null && available < wantedQty) {
      throw conflict('OUT_OF_STOCK', 'الكمية المطلوبة غير متوفرة حاليًا', { availableQty: available });
    }
  }

  private priceLines(
    items: CartItemRow[],
    products: Map<string, ProductWithPartner>,
    expectedPartnerId: string | null,
  ): PricedLine[] {
    const lines: PricedLine[] = items.map((item) => {
      const product = products.get(item.productId);
      const base: PricedLine = {
        id: item.id,
        productId: item.productId,
        partnerId: product?.partnerId ?? null,
        nameAr: product?.nameAr ?? null,
        variantKey: item.variantKey,
        selections: [],
        quantity: item.quantity,
        unitPriceHalalas: null,
        lineTotalHalalas: null,
        availableQty: product ? this.availableQty(product) : null,
        deliveryFeeHalalas: product?.deliveryFeeHalalas ?? null,
        issues: [],
      };
      if (!product) {
        base.issues.push({ code: 'PRODUCT_UNAVAILABLE', messageAr: 'المنتج لم يعد متاحًا' });
        return base;
      }
      if (product.purchaseMode !== PURCHASE_MODE_INTERNAL_COD) {
        base.issues.push({ code: 'EXTERNAL_PRODUCT_NOT_PURCHASABLE', messageAr: 'هذا المنتج يُشترى من موقع المتجر' });
        return base;
      }
      if (expectedPartnerId && product.partnerId !== expectedPartnerId) {
        base.issues.push({ code: 'CART_PARTNER_CONFLICT', messageAr: 'السلة تحتوي على منتجات من أكثر من متجر' });
        return base;
      }
      try {
        const stored = record(item.selectionsJson);
        const resolved = this.resolveForProduct(product, stored, item.variantKey || undefined);
        base.selections = resolved.snapshot;
        base.variantKey = resolved.variantKey;
        base.unitPriceHalalas = resolved.unitPriceHalalas;
        base.lineTotalHalalas = lineTotal(resolved.unitPriceHalalas, item.quantity);
      } catch (error) {
        const body = (error as { getResponse?: () => unknown }).getResponse?.() as Record<string, unknown> | undefined;
        base.issues.push({
          code: typeof body?.code === 'string' ? body.code : 'SELECTION_INVALID',
          messageAr: typeof body?.messageAr === 'string' ? body.messageAr : 'خيار المنتج لم يعد متاحًا',
        });
      }
      return base;
    });

    // Stock is per product: all lines of one product share the same pool.
    const qtyByProduct = new Map<string, number>();
    for (const line of lines) qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.quantity);
    for (const line of lines) {
      const total = qtyByProduct.get(line.productId) ?? 0;
      if (line.availableQty !== null && line.availableQty < total && !line.issues.some((i) => i.code === 'PRODUCT_UNAVAILABLE')) {
        line.issues.push({ code: 'OUT_OF_STOCK', messageAr: 'الكمية المطلوبة غير متوفرة حاليًا' });
      }
    }
    return lines;
  }

  private async pricedCart(cart: { partnerId: string | null; items: CartItemRow[] } | null, db: Tx | PrismaService = this.prisma) {
    const items = cart?.items ?? [];
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = new Map<string, ProductWithPartner>();
    if (ids.length > 0) {
      const rows = await db.product.findMany({
        where: { id: { in: ids }, ...PURCHASABLE_PRODUCT },
        include: { partner: true },
      });
      for (const row of rows) products.set(row.id, row);
    }
    const partnerId = cart?.partnerId ?? [...products.values()][0]?.partnerId ?? null;
    const lines = this.priceLines(items, products, partnerId);
    const subtotal = lines.reduce((sum, l) => sum + (l.lineTotalHalalas ?? 0), 0);
    const fee = computeDeliveryFee(lines.map((l) => l.deliveryFeeHalalas));
    const partner = partnerId ? [...products.values()].find((p) => p.partnerId === partnerId)?.partner : undefined;
    const issues = lines.flatMap((l) => l.issues);
    return { lines, products, partnerId, partnerNameAr: partner?.nameAr ?? null, subtotal, fee, issues };
  }

  private async cartView(cart: { id: string; partnerId: string | null; items: CartItemRow[] } | null) {
    const priced = await this.pricedCart(cart);
    return {
      id: cart?.id ?? null,
      partnerId: priced.partnerId,
      partnerNameAr: priced.partnerNameAr,
      paymentMethod: 'cod' as const,
      currency: 'SAR' as const,
      items: priced.lines,
      subtotalHalalas: priced.subtotal,
      deliveryFeeHalalas: priced.fee.feeHalalas,
      deliveryFeeKnown: priced.fee.known,
      totalHalalas: priced.subtotal + (priced.fee.feeHalalas ?? 0),
      issues: priced.issues,
      canCheckout: priced.lines.length > 0 && priced.issues.length === 0,
    };
  }

  async quote(actor: CommerceActor & { type: 'customer' }) {
    const cart = await this.prisma.commerceCart.findUnique({
      where: { userId: actor.userId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!cart || cart.items.length === 0) throw conflict('CART_EMPTY', 'السلة فارغة');
    const view = await this.cartView(cart);
    return {
      ...view,
      requiresDeliveryFeeAcknowledgement: !view.deliveryFeeKnown,
      deliveryFeeNoteAr: view.deliveryFeeKnown ? null : 'رسوم التوصيل غير محددة وسيؤكدها المتجر عند التواصل',
      paymentNoteAr: 'الدفع نقدًا عند الاستلام',
    };
  }

  // =========================================================================
  // Orders — customer
  // =========================================================================

  async createOrder(actor: CommerceActor & { type: 'customer' }, body: unknown, headerKey?: string) {
    const data = record(body);
    const idempotencyKey = normalizeIdempotencyKey(headerKey, data.idempotencyKey);
    const delivery = parseDelivery(data);
    const acknowledgeUnknownFee = data.acknowledgeUnknownDeliveryFee === true;
    const clientRequestId = typeof data.clientRequestId === 'string' ? data.clientRequestId.slice(0, 128) : null;

    const replay = await this.findOrderByKey(actor.userId, idempotencyKey);
    if (replay) return { order: this.orderDto(replay, 'customer'), idempotentReplay: true };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const cart = await tx.commerceCart.findUnique({ where: { userId: actor.userId } });
          if (!cart) throw conflict('CART_EMPTY', 'السلة فارغة');
          // Serialises dual clicks from the same account.
          await this.lockCart(tx, cart.id);

          const again = await tx.commerceOrder.findUnique({
            where: { userId_idempotencyKey: { userId: actor.userId, idempotencyKey } },
            include: ORDER_INCLUDE,
          });
          if (again) return { row: again, replay: true };

          const items = await tx.commerceCartItem.findMany({ where: { cartId: cart.id }, orderBy: { createdAt: 'asc' } });
          if (items.length === 0) throw conflict('CART_EMPTY', 'السلة فارغة');

          // Re-read price/stock inside the transaction. Cart prices are never trusted.
          const priced = await this.pricedCart({ partnerId: cart.partnerId, items }, tx);
          const firstIssue = priced.issues[0];
          if (firstIssue) {
            throw commerceError(
              firstIssue.code === 'OUT_OF_STOCK' || firstIssue.code === 'CART_PARTNER_CONFLICT' ? HttpStatus.CONFLICT : HttpStatus.UNPROCESSABLE_ENTITY,
              firstIssue.code,
              firstIssue.messageAr,
              { issues: priced.issues },
            );
          }
          if (!priced.partnerId) throw conflict('CART_EMPTY', 'السلة فارغة');
          if (!priced.fee.known && !acknowledgeUnknownFee) {
            throw unprocessable('DELIVERY_FEE_UNKNOWN', 'رسوم التوصيل غير محددة. يرجى تأكيد المتابعة بدون رسوم محددة', {
              requiresDeliveryFeeAcknowledgement: true,
            });
          }

          // Reserve stock: one conditional UPDATE per product, ordered by id to avoid deadlocks.
          const qtyByProduct = new Map<string, number>();
          for (const line of priced.lines) qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.quantity);
          const tracked = new Set<string>();
          for (const productId of [...qtyByProduct.keys()].sort()) {
            const product = priced.products.get(productId)!;
            if (product.stockQty == null) continue;
            const qty = qtyByProduct.get(productId)!;
            const affected = await tx.$executeRaw`
              UPDATE products SET reserved_qty = reserved_qty + ${qty}
              WHERE id = ${productId} AND stock_qty IS NOT NULL AND stock_qty - reserved_qty >= ${qty}`;
            if (affected !== 1) {
              throw conflict('OUT_OF_STOCK', `الكمية المطلوبة من "${product.nameAr}" غير متوفرة حاليًا`, { productId });
            }
            tracked.add(productId);
          }

          const subtotal = priced.subtotal;
          const fee = priced.fee.feeHalalas;
          const row = await tx.commerceOrder.create({
            data: {
              publicNumber: makePublicNumber('MO'),
              userId: actor.userId,
              partnerId: priced.partnerId,
              fulfillmentStatus: 'new',
              deliveryStatus: 'pending',
              paymentMethod: 'cod',
              paymentCollectionStatus: 'uncollected',
              subtotalHalalas: subtotal,
              deliveryFeeHalalas: fee,
              totalHalalas: subtotal + (fee ?? 0),
              currency: 'SAR',
              contactName: delivery.contactName,
              contactPhone: delivery.contactPhone,
              addressLine: delivery.addressLine,
              city: delivery.city,
              notes: delivery.notes,
              idempotencyKey,
              clientRequestId,
              items: {
                create: priced.lines.map((line) => ({
                  productId: line.productId,
                  productNameAr: line.nameAr ?? '',
                  variantKey: line.variantKey,
                  selectionsJson: line.selections as unknown as Prisma.InputJsonValue,
                  unitPriceHalalas: line.unitPriceHalalas!,
                  quantity: line.quantity,
                  lineTotalHalalas: line.lineTotalHalalas!,
                  reservedQty: tracked.has(line.productId) ? line.quantity : 0,
                  stockState: tracked.has(line.productId) ? 'reserved' : 'none',
                })),
              },
              events: {
                create: [
                  { actorType: 'customer', actorId: actor.id, toStatus: 'new', field: 'fulfillment' },
                  { actorType: 'system', toStatus: 'pending', field: 'delivery' },
                  { actorType: 'system', toStatus: 'uncollected', field: 'payment' },
                ],
              },
            },
            include: ORDER_INCLUDE,
          });

          await tx.commerceCartItem.deleteMany({ where: { cartId: cart.id } });
          await tx.commerceCart.update({ where: { id: cart.id }, data: { partnerId: null } });
          return { row, replay: false };
        }, TX_OPTIONS);
        return { order: this.orderDto(created.row, 'customer'), idempotentReplay: created.replay };
      } catch (error) {
        const target = p2002Target(error);
        if (target?.includes('idempotency_key')) {
          const existing = await this.findOrderByKey(actor.userId, idempotencyKey);
          if (existing) return { order: this.orderDto(existing, 'customer'), idempotentReplay: true };
        }
        if (target?.includes('public_number')) continue;
        throw error;
      }
    }
    throw conflict('ORDER_BUSY', 'تعذر إنشاء الطلب الآن، حاول مرة أخرى');
  }

  private findOrderByKey(userId: string, idempotencyKey: string) {
    return this.prisma.commerceOrder.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: ORDER_INCLUDE,
    });
  }

  async listCustomerOrders(actor: CommerceActor & { type: 'customer' }, query: Record<string, unknown> = {}) {
    const rows = await this.prisma.commerceOrder.findMany({
      where: { userId: actor.userId },
      include: ORDER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.limit, query.cursor),
    });
    const page = finishPage(rows, query.limit);
    return { items: page.rows.map((r) => this.orderDto(r, 'customer')), nextCursor: page.nextCursor };
  }

  async getCustomerOrder(actor: CommerceActor & { type: 'customer' }, orderId: string) {
    return this.getOrderDetail(orderId, { userId: actor.userId }, 'customer');
  }

  async cancelCustomerOrder(actor: CommerceActor & { type: 'customer' }, orderId: string, body: unknown) {
    return this.transitionOrder({ userId: actor.userId }, orderId, actor, {
      fulfillmentStatus: 'cancelled',
      note: parseOptionalNotes(record(body).note),
    });
  }

  // =========================================================================
  // Orders — partner / admin
  // =========================================================================

  async listOrders(actor: CommerceActor, query: Record<string, unknown> = {}) {
    const where = this.orderListWhere(actor, query);
    const rows = await this.prisma.commerceOrder.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.limit, query.cursor),
    });
    const page = finishPage(rows, query.limit);
    return { items: page.rows.map((r) => this.orderDto(r, actor.type)), nextCursor: page.nextCursor };
  }

  private orderListWhere(actor: CommerceActor, query: Record<string, unknown>): Prisma.CommerceOrderWhereInput {
    const where: Prisma.CommerceOrderWhereInput = {};
    if (actor.type === 'partner') where.partnerId = actor.partnerId;
    else if (actor.type === 'admin' && typeof query.partnerId === 'string' && query.partnerId) where.partnerId = query.partnerId;
    const status = query.status ?? query.fulfillmentStatus;
    if (typeof status === 'string' && status) {
      if (!isFulfillmentStatus(status)) throw badRequest('STATUS_INVALID', 'حالة الطلب غير صالحة');
      where.fulfillmentStatus = status;
    }
    if (typeof query.paymentCollectionStatus === 'string' && query.paymentCollectionStatus) {
      where.paymentCollectionStatus = query.paymentCollectionStatus;
    }
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (q) {
      where.OR = [
        { publicNumber: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { contactPhone: { contains: q } },
      ];
    }
    return where;
  }

  getOrder(actor: CommerceActor, orderId: string) {
    return this.getOrderDetail(orderId, this.orderScope(actor), actor.type);
  }

  async transitionOrderFor(actor: CommerceActor, orderId: string, body: unknown) {
    const data = record(body);
    const note = parseOptionalNotes(data.note);
    const fulfillmentStatus = data.fulfillmentStatus;
    const deliveryStatus = data.deliveryStatus;
    if (fulfillmentStatus != null && !isFulfillmentStatus(fulfillmentStatus)) {
      throw badRequest('STATUS_INVALID', 'حالة الطلب غير صالحة');
    }
    if (deliveryStatus != null && !isDeliveryStatus(deliveryStatus)) {
      throw badRequest('STATUS_INVALID', 'حالة التوصيل غير صالحة');
    }
    return this.transitionOrder(this.orderScope(actor), orderId, actor, {
      fulfillmentStatus: fulfillmentStatus as FulfillmentStatus | undefined,
      deliveryStatus: deliveryStatus as DeliveryStatus | undefined,
      note,
    });
  }

  private orderScope(actor: CommerceActor): Prisma.CommerceOrderWhereInput {
    if (actor.type === 'customer') return { userId: actor.userId };
    if (actor.type === 'partner') return { partnerId: actor.partnerId };
    return {};
  }

  private async getOrderDetail(orderId: string, scope: Prisma.CommerceOrderWhereInput, view: ActorType) {
    const row = await this.prisma.commerceOrder.findFirst({
      where: { id: orderId, ...scope },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!row) throw notFound('ORDER_NOT_FOUND', 'الطلب غير موجود');
    const dto = this.orderDto(row, view);
    return { ...dto, events: dto.events ?? [] };
  }

  private async transitionOrder(
    scope: Prisma.CommerceOrderWhereInput,
    orderId: string,
    actor: CommerceActor,
    input: { fulfillmentStatus?: FulfillmentStatus; deliveryStatus?: DeliveryStatus; note: string | null },
  ) {
    this.requireReason(actor, input.note);
    const order = await this.prisma.commerceOrder.findFirst({ where: { id: orderId, ...scope }, select: { id: true, fulfillmentStatus: true, deliveryStatus: true } });
    if (!order) throw notFound('ORDER_NOT_FOUND', 'الطلب غير موجود');

    const impliedFromDelivery = input.deliveryStatus ? fulfillmentForDelivery(input.deliveryStatus) : null;
    if (input.deliveryStatus && !impliedFromDelivery) {
      throw unprocessable('DELIVERY_STATUS_NOT_SETTABLE', 'لا يمكن تعيين حالة التوصيل هذه مباشرة');
    }
    if (input.fulfillmentStatus && impliedFromDelivery && input.fulfillmentStatus !== impliedFromDelivery) {
      throw unprocessable('STATUS_MISMATCH', 'حالة الطلب وحالة التوصيل غير متطابقتين');
    }
    const target = input.fulfillmentStatus ?? impliedFromDelivery ?? null;

    if (!target) {
      // Note-only update.
      if (!input.note) throw badRequest('TRANSITION_EMPTY', 'لا يوجد تغيير مطلوب');
      if (actor.type === 'customer') throw commerceError(HttpStatus.FORBIDDEN, 'TRANSITION_FORBIDDEN', 'غير مسموح بهذا الإجراء');
      await this.prisma.commerceOrderEvent.create({
        data: { orderId: order.id, actorType: actor.type, actorId: actor.id, field: 'note', note: input.note },
      });
      return this.getOrderDetail(order.id, scope, actor.type);
    }

    if (target === order.fulfillmentStatus) {
      return { ...(await this.getOrderDetail(order.id, scope, actor.type)), unchanged: true };
    }

    const check = checkFulfillmentTransition(order.fulfillmentStatus, target, actor.type);
    if (!check.ok) {
      if (check.reason === 'actor_forbidden') {
        throw commerceError(HttpStatus.FORBIDDEN, 'TRANSITION_FORBIDDEN', 'غير مسموح لك بهذا الإجراء على الطلب');
      }
      throw conflict('TRANSITION_NOT_ALLOWED', 'لا يمكن نقل الطلب إلى هذه الحالة', {
        from: order.fulfillmentStatus,
        to: target,
      });
    }

    const nextDelivery = deliveryForFulfillment(target);
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.commerceOrder.updateMany({
        where: { id: order.id, fulfillmentStatus: order.fulfillmentStatus },
        data: { fulfillmentStatus: target, deliveryStatus: nextDelivery },
      });
      if (moved.count !== 1) throw conflict('ORDER_STATE_CHANGED', 'تغيرت حالة الطلب، حدّث الصفحة وحاول مرة أخرى');

      if (releasesStock(target)) await this.releaseOrderStock(tx, order.id);
      else if (consumesStock(target)) await this.consumeOrderStock(tx, order.id);

      await tx.commerceOrderEvent.create({
        data: {
          orderId: order.id,
          actorType: actor.type,
          actorId: actor.id,
          fromStatus: order.fulfillmentStatus,
          toStatus: target,
          field: 'fulfillment',
          note: input.note,
        },
      });
      if (nextDelivery !== order.deliveryStatus) {
        await tx.commerceOrderEvent.create({
          data: {
            orderId: order.id,
            actorType: actor.type,
            actorId: actor.id,
            fromStatus: order.deliveryStatus,
            toStatus: nextDelivery,
            field: 'delivery',
          },
        });
      }
    }, TX_OPTIONS);
    return this.getOrderDetail(order.id, scope, actor.type);
  }

  /** Each item flips reserved -> released exactly once; only the winner touches the product counter. */
  private async releaseOrderStock(tx: Tx, orderId: string): Promise<void> {
    const items = await tx.commerceOrderItem.findMany({ where: { orderId, stockState: 'reserved' }, orderBy: { productId: 'asc' } });
    for (const item of items) {
      const flipped = await tx.commerceOrderItem.updateMany({
        where: { id: item.id, stockState: 'reserved' },
        data: { stockState: 'released' },
      });
      if (flipped.count !== 1) continue;
      await tx.$executeRaw`
        UPDATE products SET reserved_qty = GREATEST(reserved_qty - ${item.reservedQty}, 0)
        WHERE id = ${item.productId}`;
    }
  }

  private async consumeOrderStock(tx: Tx, orderId: string): Promise<void> {
    const items = await tx.commerceOrderItem.findMany({ where: { orderId, stockState: 'reserved' }, orderBy: { productId: 'asc' } });
    for (const item of items) {
      const flipped = await tx.commerceOrderItem.updateMany({
        where: { id: item.id, stockState: 'reserved' },
        data: { stockState: 'consumed' },
      });
      if (flipped.count !== 1) continue;
      await tx.$executeRaw`
        UPDATE products
        SET reserved_qty = GREATEST(reserved_qty - ${item.reservedQty}, 0),
            stock_qty = CASE WHEN stock_qty IS NULL THEN NULL ELSE GREATEST(stock_qty - ${item.reservedQty}, 0) END
        WHERE id = ${item.productId}`;
    }
  }

  async collectPayment(actor: CommerceActor, orderId: string, body: unknown) {
    if (actor.type === 'customer') throw commerceError(HttpStatus.FORBIDDEN, 'PAYMENT_FORBIDDEN', 'غير مسموح بتسجيل التحصيل');
    const note = parseOptionalNotes(record(body).note);
    this.requireReason(actor, note);
    const scope = this.orderScope(actor);
    const order = await this.prisma.commerceOrder.findFirst({ where: { id: orderId, ...scope } });
    if (!order) throw notFound('ORDER_NOT_FOUND', 'الطلب غير موجود');
    if (order.paymentCollectionStatus === 'collected') {
      return { ...(await this.getOrderDetail(order.id, scope, actor.type)), alreadyCollected: true };
    }
    if (!canCollectPayment(order.fulfillmentStatus, order.paymentCollectionStatus)) {
      throw conflict('PAYMENT_NOT_COLLECTABLE', 'لا يمكن تسجيل التحصيل في حالة الطلب الحالية', {
        fulfillmentStatus: order.fulfillmentStatus,
        paymentCollectionStatus: order.paymentCollectionStatus,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.commerceOrder.updateMany({
        where: { id: order.id, paymentCollectionStatus: 'uncollected', fulfillmentStatus: { in: ['out_for_delivery', 'delivered'] } },
        data: { paymentCollectionStatus: 'collected', collectionActor: `${actor.type}:${actor.id}`, collectedAt: new Date() },
      });
      if (marked.count !== 1) throw conflict('ORDER_STATE_CHANGED', 'تغيرت حالة الطلب، حدّث الصفحة وحاول مرة أخرى');
      await tx.commerceOrderEvent.create({
        data: {
          orderId: order.id,
          actorType: actor.type,
          actorId: actor.id,
          fromStatus: 'uncollected',
          toStatus: 'collected',
          field: 'payment',
          note,
        },
      });
    }, TX_OPTIONS).catch(async (error) => {
      // A concurrent identical click already collected: treat as the same success.
      const fresh = await this.prisma.commerceOrder.findFirst({ where: { id: order.id }, select: { paymentCollectionStatus: true } });
      if (fresh?.paymentCollectionStatus === 'collected') return;
      throw error;
    });
    return this.getOrderDetail(order.id, scope, actor.type);
  }

  /** Admin-only: forgive an uncollected payment (e.g. goodwill). Requires a reason. */
  async waivePayment(actor: CommerceActor, orderId: string, body: unknown) {
    if (actor.type !== 'admin') throw commerceError(HttpStatus.FORBIDDEN, 'PAYMENT_FORBIDDEN', 'هذا الإجراء للإدارة فقط');
    const note = parseOptionalNotes(record(body).note);
    this.requireReason(actor, note);
    const order = await this.prisma.commerceOrder.findUnique({ where: { id: orderId } });
    if (!order) throw notFound('ORDER_NOT_FOUND', 'الطلب غير موجود');
    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.commerceOrder.updateMany({
        where: { id: order.id, paymentCollectionStatus: 'uncollected' },
        data: { paymentCollectionStatus: 'waived', collectionActor: `admin:${actor.id}`, collectedAt: new Date() },
      });
      if (marked.count !== 1) throw conflict('PAYMENT_NOT_COLLECTABLE', 'لا يمكن إعفاء الدفع في حالته الحالية');
      await tx.commerceOrderEvent.create({
        data: { orderId: order.id, actorType: 'admin', actorId: actor.id, fromStatus: 'uncollected', toStatus: 'waived', field: 'payment', note },
      });
    }, TX_OPTIONS);
    return this.getOrderDetail(order.id, {}, 'admin');
  }

  private requireReason(actor: CommerceActor, note: string | null): void {
    if (actor.type === 'admin' && !note) {
      throw badRequest('REASON_REQUIRED', 'سبب الإجراء مطلوب للإدارة', { field: 'note' });
    }
  }

  // =========================================================================
  // Order output
  // =========================================================================

  private orderDto(row: OrderRow | OrderDetailRow, view: ActorType) {
    const events = 'events' in row ? row.events : undefined;
    return {
      id: row.id,
      publicNumber: row.publicNumber,
      partner: { id: row.partner.id, nameAr: row.partner.nameAr },
      ...(view === 'admin' ? { userId: row.userId } : {}),
      fulfillmentStatus: row.fulfillmentStatus,
      deliveryStatus: row.deliveryStatus,
      paymentMethod: row.paymentMethod,
      paymentCollectionStatus: row.paymentCollectionStatus,
      collectionActor: row.collectionActor,
      collectedAt: row.collectedAt?.toISOString() ?? null,
      subtotalHalalas: row.subtotalHalalas,
      deliveryFeeHalalas: row.deliveryFeeHalalas,
      deliveryFeeKnown: row.deliveryFeeHalalas != null,
      totalHalalas: row.totalHalalas,
      currency: row.currency,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      addressLine: row.addressLine,
      city: row.city,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      items: row.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productNameAr: item.productNameAr,
        variantKey: item.variantKey,
        selections: item.selectionsJson,
        unitPriceHalalas: item.unitPriceHalalas,
        quantity: item.quantity,
        lineTotalHalalas: item.lineTotalHalalas,
      })),
      ...(events
        ? {
            events: events
              .filter((e) => view !== 'customer' || e.field !== 'note')
              .map((e) => ({
                id: e.id,
                actorType: e.actorType,
                actorId: view === 'customer' ? undefined : e.actorId,
                field: e.field,
                fromStatus: e.fromStatus,
                toStatus: e.toStatus,
                note: view === 'customer' && e.actorType !== 'customer' ? undefined : e.note,
                createdAt: e.createdAt.toISOString(),
              })),
          }
        : {}),
    };
  }

  // =========================================================================
  // Bookings
  // =========================================================================

  async createBooking(actor: CommerceActor & { type: 'customer' }, body: unknown, headerKey?: string) {
    const data = record(body);
    const idempotencyKey = normalizeIdempotencyKey(headerKey, data.idempotencyKey);
    if (typeof data.serviceId !== 'string' || !data.serviceId) throw badRequest('SERVICE_REQUIRED', 'الخدمة مطلوبة');
    if (typeof data.startsAt !== 'string' || !data.startsAt) throw badRequest('STARTS_AT_REQUIRED', 'وقت الحجز مطلوب');
    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw badRequest('STARTS_AT_INVALID', 'وقت الحجز غير صالح');
    const contact = parseContact(data);
    const notes = parseOptionalNotes(data.notes);

    const replay = await this.findBookingByKey(actor.userId, idempotencyKey);
    if (replay) return { booking: this.bookingDto(replay), idempotentReplay: true };

    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId, active: true, contentStatus: 'published', catalogSource: 'catalog', partner: { status: 'active' } },
      include: { partner: true },
    });
    if (!service) throw notFound('SERVICE_NOT_FOUND', 'الخدمة غير متاحة');
    if (!service.bookingEnabled) throw unprocessable('BOOKING_NOT_ENABLED', 'الحجز غير متاح لهذه الخدمة');
    if (service.payMode !== 'pay_at_venue') throw unprocessable('PAY_MODE_UNSUPPORTED', 'طريقة الدفع غير مدعومة لهذه الخدمة');
    if (!Number.isSafeInteger(service.priceHalalas) || service.priceHalalas <= 0 || service.durationMin <= 0) {
      throw unprocessable('SERVICE_NOT_BOOKABLE', 'بيانات الخدمة غير مكتملة للحجز');
    }

    const slot = checkSlot(startsAt, service.durationMin, parseAvailability(service.availabilityJson));
    if (!slot.ok) throw this.slotError(slot.code);
    const endsAt = slot.endsAt;
    const capacity = slot.window.capacity;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // One calendar per service: serialise bookings with a transaction-scoped advisory lock.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`commerce-booking:${service.id}`}))`;

        const again = await tx.commerceBooking.findUnique({
          where: { userId_idempotencyKey: { userId: actor.userId, idempotencyKey } },
          include: BOOKING_INCLUDE,
        });
        if (again) return { row: again, replay: true };

        const overlapping = await tx.commerceBooking.findMany({
          where: {
            serviceId: service.id,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { userId: true },
        });
        if (overlapping.some((b) => b.userId === actor.userId)) {
          throw conflict('BOOKING_USER_OVERLAP', 'لديك حجز آخر لنفس الخدمة في هذا الوقت');
        }
        if (overlapping.length >= capacity) {
          throw conflict('BOOKING_SLOT_FULL', 'هذا الموعد غير متاح، اختر وقتًا آخر');
        }

        const row = await tx.commerceBooking.create({
          data: {
            publicNumber: makePublicNumber('MB'),
            userId: actor.userId,
            partnerId: service.partnerId,
            serviceId: service.id,
            serviceNameAr: service.nameAr,
            branchLabel: `${service.partner.nameAr} - ${service.partner.city}`,
            startsAt,
            endsAt,
            durationMin: service.durationMin,
            priceHalalas: service.priceHalalas,
            payMode: service.payMode,
            status: 'requested',
            contactName: contact.contactName,
            contactPhone: contact.contactPhone,
            notes,
            idempotencyKey,
            events: { create: [{ actorType: 'customer', actorId: actor.id, toStatus: 'requested' }] },
          },
          include: BOOKING_INCLUDE,
        });
        return { row, replay: false };
      }, TX_OPTIONS);
      return { booking: this.bookingDto(created.row), idempotentReplay: created.replay };
    } catch (error) {
      if (p2002Target(error)?.includes('idempotency_key')) {
        const existing = await this.findBookingByKey(actor.userId, idempotencyKey);
        if (existing) return { booking: this.bookingDto(existing), idempotentReplay: true };
      }
      throw error;
    }
  }

  private slotError(code: string) {
    const messages: Record<string, string> = {
      SLOT_IN_PAST: 'لا يمكن حجز موعد في الماضي أو قريب جدًا',
      SLOT_TOO_FAR: 'الموعد بعيد جدًا، اختر موعدًا أقرب',
      SLOT_MISALIGNED: 'وقت الحجز لا يطابق المواعيد المتاحة',
      SLOT_OUTSIDE_AVAILABILITY: 'هذا الوقت خارج أوقات عمل الخدمة',
      AVAILABILITY_NOT_CONFIGURED: 'مواعيد هذه الخدمة غير محددة بعد',
    };
    return unprocessable(code, messages[code] ?? 'الموعد غير متاح');
  }

  private findBookingByKey(userId: string, idempotencyKey: string) {
    return this.prisma.commerceBooking.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: BOOKING_INCLUDE,
    });
  }

  /** Slots for one local (Asia/Riyadh) day. Partner callers may only read their own services. */
  async serviceAvailability(serviceId: string, date: unknown, partnerId?: string) {
    if (typeof date !== 'string' || !localInstant(date, 0)) throw badRequest('DATE_INVALID', 'التاريخ غير صالح (YYYY-MM-DD)');
    const service = await this.prisma.service.findFirst({
      where: partnerId
        ? { id: serviceId, partnerId }
        : { id: serviceId, active: true, contentStatus: 'published', catalogSource: 'catalog', bookingEnabled: true, partner: { status: 'active' } },
    });
    if (!service) throw notFound('SERVICE_NOT_FOUND', 'الخدمة غير متاحة');
    const windows = parseAvailability(service.availabilityJson);
    const dayStart = localInstant(date, 0)!;
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const held = await this.prisma.commerceBooking.findMany({
      where: { serviceId: service.id, status: { in: [...ACTIVE_BOOKING_STATUSES] }, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      select: { startsAt: true, endsAt: true },
    });
    return {
      serviceId: service.id,
      date,
      timezone: 'Asia/Riyadh',
      durationMin: service.durationMin,
      payMode: service.payMode,
      priceHalalas: service.priceHalalas,
      slots: buildDaySlots(date, service.durationMin, windows, held),
    };
  }

  async listCustomerBookings(actor: CommerceActor & { type: 'customer' }, query: Record<string, unknown> = {}) {
    const rows = await this.prisma.commerceBooking.findMany({
      where: { userId: actor.userId },
      include: BOOKING_INCLUDE,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.limit, query.cursor),
    });
    const page = finishPage(rows, query.limit);
    return { items: page.rows.map((r) => this.bookingDto(r)), nextCursor: page.nextCursor };
  }

  async getCustomerBooking(actor: CommerceActor & { type: 'customer' }, bookingId: string) {
    return this.getBookingDetail(bookingId, { userId: actor.userId }, 'customer');
  }

  async cancelCustomerBooking(actor: CommerceActor & { type: 'customer' }, bookingId: string, body: unknown) {
    return this.transitionBooking({ userId: actor.userId }, bookingId, actor, 'cancelled', parseOptionalNotes(record(body).note));
  }

  async listBookings(actor: CommerceActor, query: Record<string, unknown> = {}) {
    const where: Prisma.CommerceBookingWhereInput = {};
    if (actor.type === 'partner') where.partnerId = actor.partnerId;
    else if (actor.type === 'admin' && typeof query.partnerId === 'string' && query.partnerId) where.partnerId = query.partnerId;
    if (typeof query.status === 'string' && query.status) {
      if (!isBookingStatus(query.status)) throw badRequest('STATUS_INVALID', 'حالة الحجز غير صالحة');
      where.status = query.status;
    }
    if (typeof query.serviceId === 'string' && query.serviceId) where.serviceId = query.serviceId;
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    if (q) {
      where.OR = [
        { publicNumber: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { contactPhone: { contains: q } },
      ];
    }
    const rows = await this.prisma.commerceBooking.findMany({
      where,
      include: BOOKING_INCLUDE,
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      ...pageArgs(query.limit, query.cursor),
    });
    const page = finishPage(rows, query.limit);
    return { items: page.rows.map((r) => this.bookingDto(r, actor.type === 'admin')), nextCursor: page.nextCursor };
  }

  getBooking(actor: CommerceActor, bookingId: string) {
    return this.getBookingDetail(bookingId, this.bookingScope(actor), actor.type);
  }

  async transitionBookingFor(actor: CommerceActor, bookingId: string, body: unknown) {
    const data = record(body);
    if (!isBookingStatus(data.status)) throw badRequest('STATUS_INVALID', 'حالة الحجز غير صالحة');
    return this.transitionBooking(this.bookingScope(actor), bookingId, actor, data.status, parseOptionalNotes(data.note));
  }

  private bookingScope(actor: CommerceActor): Prisma.CommerceBookingWhereInput {
    if (actor.type === 'customer') return { userId: actor.userId };
    if (actor.type === 'partner') return { partnerId: actor.partnerId };
    return {};
  }

  private async getBookingDetail(bookingId: string, scope: Prisma.CommerceBookingWhereInput, view: ActorType) {
    const row = await this.prisma.commerceBooking.findFirst({
      where: { id: bookingId, ...scope },
      include: { ...BOOKING_INCLUDE, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw notFound('BOOKING_NOT_FOUND', 'الحجز غير موجود');
    return {
      ...this.bookingDto(row, view === 'admin'),
      events: row.events.map((e) => ({
        id: e.id,
        actorType: e.actorType,
        actorId: view === 'customer' ? undefined : e.actorId,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        note: view === 'customer' && e.actorType !== 'customer' ? undefined : e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  private async transitionBooking(
    scope: Prisma.CommerceBookingWhereInput,
    bookingId: string,
    actor: CommerceActor,
    target: BookingStatus,
    note: string | null,
  ) {
    this.requireReason(actor, note);
    const booking = await this.prisma.commerceBooking.findFirst({ where: { id: bookingId, ...scope } });
    if (!booking) throw notFound('BOOKING_NOT_FOUND', 'الحجز غير موجود');
    if (booking.status === target) {
      return { ...(await this.getBookingDetail(booking.id, scope, actor.type)), unchanged: true };
    }
    const check = checkBookingTransition(booking.status, target, actor.type);
    if (!check.ok) {
      if (check.reason === 'actor_forbidden') {
        throw commerceError(HttpStatus.FORBIDDEN, 'TRANSITION_FORBIDDEN', 'غير مسموح لك بهذا الإجراء على الحجز');
      }
      throw conflict('TRANSITION_NOT_ALLOWED', 'لا يمكن نقل الحجز إلى هذه الحالة', { from: booking.status, to: target });
    }
    if (target === 'completed' && actor.type !== 'admin' && booking.startsAt.getTime() > Date.now()) {
      throw conflict('BOOKING_NOT_STARTED', 'لا يمكن إكمال حجز لم يحن موعده بعد');
    }
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.commerceBooking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { status: target },
      });
      if (moved.count !== 1) throw conflict('BOOKING_STATE_CHANGED', 'تغيرت حالة الحجز، حدّث الصفحة وحاول مرة أخرى');
      await tx.commerceBookingEvent.create({
        data: { bookingId: booking.id, actorType: actor.type, actorId: actor.id, fromStatus: booking.status, toStatus: target, note },
      });
    }, TX_OPTIONS);
    return this.getBookingDetail(booking.id, scope, actor.type);
  }

  private bookingDto(row: BookingRow, includeUser = false) {
    return {
      id: row.id,
      publicNumber: row.publicNumber,
      partner: { id: row.partner.id, nameAr: row.partner.nameAr },
      ...(includeUser ? { userId: row.userId } : {}),
      serviceId: row.serviceId,
      serviceNameAr: row.serviceNameAr,
      branchLabel: row.branchLabel,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      durationMin: row.durationMin,
      priceHalalas: row.priceHalalas,
      currency: 'SAR',
      payMode: row.payMode,
      status: row.status,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
