import { HttpException, HttpStatus } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Operational commerce rules (cart / COD order / service booking).
 * Pure helpers only — no database access — so they can be unit tested without Prisma.
 * All money is integer halalas. Server data is the source of truth.
 */

export type ActorType = 'customer' | 'partner' | 'admin' | 'system';

export const PURCHASE_MODE_EXTERNAL = 'external';
export const PURCHASE_MODE_INTERNAL_COD = 'internal_cod';

export const FULFILLMENT_STATUSES = [
  'new',
  'accepted',
  'preparing',
  'out_for_delivery',
  'delivered',
  'rejected',
  'cancelled',
  'failed_delivery',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const DELIVERY_STATUSES = ['pending', 'out_for_delivery', 'delivered', 'failed', 'none'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const PAYMENT_COLLECTION_STATUSES = ['uncollected', 'collected', 'waived'] as const;
export type PaymentCollectionStatus = (typeof PAYMENT_COLLECTION_STATUSES)[number];

export const BOOKING_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled', 'rejected'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type StockState = 'none' | 'reserved' | 'released' | 'consumed';

export const MAX_LINE_QUANTITY = 20;
export const MAX_CART_LINES = 30;
export const BOOKING_HORIZON_DAYS = 60;
export const BOOKING_LEAD_MINUTES = 30;
/** Saudi Arabia has no DST: local = UTC+3. */
export const LOCAL_UTC_OFFSET_MIN = 180;

// ---------------------------------------------------------------------------
// Errors — body is always { statusCode, message, messageAr, code, details? } (Arabic).
// ---------------------------------------------------------------------------

export function commerceError(
  status: HttpStatus,
  code: string,
  messageAr: string,
  extra: Record<string, unknown> = {},
): HttpException {
  const details = Object.keys(extra).length > 0 ? { details: extra } : {};
  return new HttpException({ message: messageAr, messageAr, code, ...details }, status);
}

export const badRequest = (code: string, messageAr: string, extra?: Record<string, unknown>) =>
  commerceError(HttpStatus.BAD_REQUEST, code, messageAr, extra);
export const notFound = (code: string, messageAr: string) => commerceError(HttpStatus.NOT_FOUND, code, messageAr);
export const conflict = (code: string, messageAr: string, extra?: Record<string, unknown>) =>
  commerceError(HttpStatus.CONFLICT, code, messageAr, extra);
export const unprocessable = (code: string, messageAr: string, extra?: Record<string, unknown>) =>
  commerceError(HttpStatus.UNPROCESSABLE_ENTITY, code, messageAr, extra);

// ---------------------------------------------------------------------------
// Order state machine
// ---------------------------------------------------------------------------

type ActorMap = Partial<Record<FulfillmentStatus, readonly ActorType[]>>;

/**
 * from -> to -> actors allowed to make the move.
 * Customers may only cancel while `new`.
 * `failed_delivery` keeps stock reserved until cancel (restock) or explicit retry delivery.
 * Terminal with no further move: delivered, rejected, cancelled.
 */
export const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, ActorMap> = {
  new: { accepted: ['partner', 'admin'], rejected: ['partner', 'admin'], cancelled: ['customer', 'admin'] },
  accepted: { preparing: ['partner', 'admin'], rejected: ['partner', 'admin'], cancelled: ['partner', 'admin'] },
  preparing: { out_for_delivery: ['partner', 'admin'], cancelled: ['partner', 'admin'] },
  out_for_delivery: { delivered: ['partner', 'admin'], failed_delivery: ['partner', 'admin'] },
  // Retry delivery or cancel+release — not an automatic return to sellable stock.
  failed_delivery: { out_for_delivery: ['partner', 'admin'], cancelled: ['partner', 'admin'] },
  delivered: {},
  rejected: {},
  cancelled: {},
};

export type TransitionCheck = { ok: true } | { ok: false; reason: 'unknown_status' | 'not_allowed' | 'actor_forbidden' };

export function checkFulfillmentTransition(from: string, to: string, actor: ActorType): TransitionCheck {
  if (!isFulfillmentStatus(from) || !isFulfillmentStatus(to)) return { ok: false, reason: 'unknown_status' };
  const actors = FULFILLMENT_TRANSITIONS[from][to];
  if (!actors) return { ok: false, reason: 'not_allowed' };
  if (!actors.includes(actor)) return { ok: false, reason: 'actor_forbidden' };
  return { ok: true };
}

export function isFulfillmentStatus(value: unknown): value is FulfillmentStatus {
  return typeof value === 'string' && (FULFILLMENT_STATUSES as readonly string[]).includes(value);
}
export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === 'string' && (DELIVERY_STATUSES as readonly string[]).includes(value);
}
export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === 'string' && (BOOKING_STATUSES as readonly string[]).includes(value);
}
export function isPaymentCollectionStatus(value: unknown): value is PaymentCollectionStatus {
  return typeof value === 'string' && (PAYMENT_COLLECTION_STATUSES as readonly string[]).includes(value);
}

/** deliveryStatus implied by a fulfillment status. */
export function deliveryForFulfillment(status: FulfillmentStatus): DeliveryStatus {
  switch (status) {
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'delivered':
      return 'delivered';
    case 'failed_delivery':
      return 'failed';
    case 'rejected':
    case 'cancelled':
      return 'none';
    default:
      return 'pending';
  }
}

/** Fulfillment target a partner implies by moving only the delivery axis. `pending`/`none` are never settable. */
export function fulfillmentForDelivery(status: DeliveryStatus): FulfillmentStatus | null {
  switch (status) {
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'delivered':
      return 'delivered';
    case 'failed':
      return 'failed_delivery';
    default:
      return null;
  }
}

/** Reserved stock goes back to the shelf only when the order dies before leaving the partner. */
export function releasesStock(to: FulfillmentStatus): boolean {
  return to === 'rejected' || to === 'cancelled';
}
/** Reserved stock becomes a real decrement once the goods are delivered. */
export function consumesStock(to: FulfillmentStatus): boolean {
  return to === 'delivered';
}

/**
 * COD collection is recorded only after delivery succeeds.
 * Creating the order, accepting it, or marking out_for_delivery never implies collection.
 */
export function canCollectPayment(fulfillment: string, collection: string): boolean {
  return collection === 'uncollected' && fulfillment === 'delivered';
}

// ---------------------------------------------------------------------------
// Booking state machine
// ---------------------------------------------------------------------------

type BookingActorMap = Partial<Record<BookingStatus, readonly ActorType[]>>;

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingActorMap> = {
  requested: { confirmed: ['partner', 'admin'], rejected: ['partner', 'admin'], cancelled: ['customer', 'admin'] },
  confirmed: { completed: ['partner', 'admin'], cancelled: ['customer', 'partner', 'admin'] },
  completed: {},
  cancelled: {},
  rejected: {},
};

export function checkBookingTransition(from: string, to: string, actor: ActorType): TransitionCheck {
  if (!isBookingStatus(from) || !isBookingStatus(to)) return { ok: false, reason: 'unknown_status' };
  const actors = BOOKING_TRANSITIONS[from][to];
  if (!actors) return { ok: false, reason: 'not_allowed' };
  if (!actors.includes(actor)) return { ok: false, reason: 'actor_forbidden' };
  return { ok: true };
}

/** Bookings that still hold a place in the calendar. */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ['requested', 'confirmed'];

// ---------------------------------------------------------------------------
// Product options / variants (shape mirrors the app's CatalogOptionGroup / CatalogProductVariant)
// ---------------------------------------------------------------------------

export type OptionValue = { id: string; labelAr: string };
export type OptionGroup = { id: string; labelAr: string; values: OptionValue[] };
export type ProductVariant = { id: string; selections: Record<string, string>; priceHalalas: number | null; available: boolean };
export type SelectionSnapshot = { groupId: string; groupLabelAr: string; valueId: string; valueLabelAr: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseOptionGroups(json: unknown): OptionGroup[] {
  if (!Array.isArray(json)) return [];
  const groups: OptionGroup[] = [];
  for (const raw of json) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) continue;
    const values: OptionValue[] = [];
    if (Array.isArray(raw.values)) {
      for (const v of raw.values) {
        if (isRecord(v) && typeof v.id === 'string' && v.id) {
          values.push({ id: v.id, labelAr: typeof v.labelAr === 'string' ? v.labelAr : v.id });
        }
      }
    }
    if (values.length === 0) continue;
    groups.push({ id: raw.id, labelAr: typeof raw.labelAr === 'string' ? raw.labelAr : raw.id, values });
  }
  return groups;
}

export function parseVariants(json: unknown): ProductVariant[] {
  if (!Array.isArray(json)) return [];
  const out: ProductVariant[] = [];
  for (const raw of json) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id || !isRecord(raw.selections)) continue;
    const selections: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw.selections)) {
      if (typeof v === 'string') selections[k] = v;
    }
    const price = typeof raw.priceHalalas === 'number' && Number.isInteger(raw.priceHalalas) ? raw.priceHalalas : null;
    out.push({ id: raw.id, selections, priceHalalas: price, available: raw.available !== false });
  }
  return out;
}

export function sameSelections(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => a[k] === b[k]);
}

/**
 * Deterministic key from selections. Uses length-prefixed pairs so values may
 * contain `=`, `|`, or JSON punctuation without colliding with another map.
 * Prefer a stable variant `id` from the catalog when one exists (see resolveSelection).
 */
export function canonicalVariantKey(selections: Record<string, string>): string {
  return Object.keys(selections)
    .sort()
    .map((k) => {
      const v = selections[k] ?? '';
      return `${k.length}:${k}${v.length}:${v}`;
    })
    .join(';');
}

/** True when two selection maps are the same choice (order-independent). */
export function selectionIdentity(a: Record<string, string>, b: Record<string, string>): boolean {
  return canonicalVariantKey(a) === canonicalVariantKey(b);
}

export type ResolvedSelection = {
  variantKey: string;
  selections: Record<string, string>;
  snapshot: SelectionSnapshot[];
  unitPriceHalalas: number;
};

export type ResolveSelectionInput = {
  basePriceHalalas: number;
  optionsJson: unknown;
  variantsJson: unknown;
  selections?: unknown;
  variantKey?: unknown;
};

/**
 * Validate the customer's choice against server-owned options and variants and price it.
 * Throws a coded Arabic error; never trusts a client price.
 */
export function resolveSelection(input: ResolveSelectionInput): ResolvedSelection {
  const groups = parseOptionGroups(input.optionsJson);
  const variants = parseVariants(input.variantsJson);

  let selections: Record<string, string> = {};
  if (isRecord(input.selections)) {
    for (const [k, v] of Object.entries(input.selections)) {
      if (typeof v !== 'string' || !v) throw badRequest('SELECTION_INVALID', 'اختيار غير صالح للمنتج');
      selections[k] = v;
    }
  } else if (input.selections != null) {
    throw badRequest('SELECTION_INVALID', 'اختيار غير صالح للمنتج');
  }

  const requestedKey = typeof input.variantKey === 'string' ? input.variantKey : '';
  if (requestedKey && variants.length > 0) {
    const byKey = variants.find((v) => v.id === requestedKey);
    if (!byKey) throw unprocessable('VARIANT_NOT_FOUND', 'هذا الخيار غير متوفر لهذا المنتج');
    if (Object.keys(selections).length > 0 && !sameSelections(selections, byKey.selections)) {
      throw badRequest('SELECTION_MISMATCH', 'الخيارات المرسلة لا تطابق النسخة المحددة');
    }
    selections = { ...byKey.selections };
  } else if (requestedKey && variants.length === 0 && requestedKey !== canonicalVariantKey(selections)) {
    throw unprocessable('VARIANT_NOT_FOUND', 'هذا الخيار غير متوفر لهذا المنتج');
  }

  if (groups.length === 0) {
    if (Object.keys(selections).length > 0) {
      throw badRequest('SELECTION_INVALID', 'هذا المنتج لا يحتوي على خيارات');
    }
    return { variantKey: '', selections: {}, snapshot: [], unitPriceHalalas: assertPrice(input.basePriceHalalas) };
  }

  for (const key of Object.keys(selections)) {
    if (!groups.some((g) => g.id === key)) throw badRequest('SELECTION_INVALID', 'خيار غير معروف لهذا المنتج');
  }
  const snapshot: SelectionSnapshot[] = [];
  for (const group of groups) {
    const picked = selections[group.id];
    if (!picked) throw badRequest('SELECTION_REQUIRED', `يرجى اختيار ${group.labelAr}`, { groupId: group.id });
    const value = group.values.find((v) => v.id === picked);
    if (!value) throw badRequest('SELECTION_INVALID', `قيمة غير صالحة لـ ${group.labelAr}`, { groupId: group.id });
    snapshot.push({ groupId: group.id, groupLabelAr: group.labelAr, valueId: value.id, valueLabelAr: value.labelAr });
  }

  if (variants.length > 0) {
    const variant = variants.find((v) => sameSelections(v.selections, selections));
    if (!variant) throw unprocessable('VARIANT_NOT_FOUND', 'هذه التركيبة غير متوفرة لهذا المنتج');
    if (!variant.available) throw conflict('VARIANT_UNAVAILABLE', 'هذه التركيبة غير متوفرة حاليًا');
    return {
      variantKey: variant.id,
      selections,
      snapshot,
      unitPriceHalalas: assertPrice(variant.priceHalalas ?? input.basePriceHalalas),
    };
  }
  return {
    variantKey: canonicalVariantKey(selections),
    selections,
    snapshot,
    unitPriceHalalas: assertPrice(input.basePriceHalalas),
  };
}

function assertPrice(halalas: number): number {
  if (!Number.isSafeInteger(halalas) || halalas <= 0) {
    throw unprocessable('PRICE_UNAVAILABLE', 'سعر المنتج غير متاح حاليًا');
  }
  return halalas;
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export type DeliveryFeeResult = { feeHalalas: number | null; known: boolean };

/**
 * Delivery fee for an order.
 * - null/missing on any line → unknown (never treated as free).
 * - all lines share the same non-negative integer → that fee.
 * - differing known fees → unknown (partner must set one coherent fee; no auto max/sum).
 * This helper is a technical consistency rule, not an owner commercial policy.
 */
export function computeDeliveryFee(fees: ReadonlyArray<number | null | undefined>): DeliveryFeeResult {
  if (fees.length === 0) return { feeHalalas: null, known: false };
  let first: number | null = null;
  for (const fee of fees) {
    if (fee == null || !Number.isSafeInteger(fee) || fee < 0) return { feeHalalas: null, known: false };
    if (first == null) first = fee;
    else if (fee !== first) return { feeHalalas: null, known: false };
  }
  return { feeHalalas: first!, known: true };
}

export function lineTotal(unitPriceHalalas: number, quantity: number): number {
  return unitPriceHalalas * quantity;
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

export function normalizeIdempotencyKey(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const key = candidate.trim();
      if (key.length > 128 || !/^[A-Za-z0-9._:\-]+$/.test(key)) {
        throw badRequest('IDEMPOTENCY_KEY_INVALID', 'مفتاح منع التكرار غير صالح');
      }
      return key;
    }
  }
  throw badRequest('IDEMPOTENCY_KEY_REQUIRED', 'مفتاح منع التكرار مطلوب');
}

/** Stable SHA-256 hex of a JSON-serializable value (sorted object keys). */
export function stableFingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export type QuoteLineFingerprint = {
  productId: string;
  variantKey: string;
  quantity: number;
  unitPriceHalalas: number;
};

/** Server-owned cart state the customer must re-confirm if it changes. */
export function cartConfirmationFingerprint(input: {
  partnerId: string;
  lines: QuoteLineFingerprint[];
  deliveryFeeHalalas: number;
  subtotalHalalas: number;
  totalHalalas: number;
}): string {
  const lines = [...input.lines]
    .map((l) => ({
      productId: l.productId,
      variantKey: l.variantKey,
      quantity: l.quantity,
      unitPriceHalalas: l.unitPriceHalalas,
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId) || a.variantKey.localeCompare(b.variantKey));
  return stableFingerprint({
    partnerId: input.partnerId,
    lines,
    deliveryFeeHalalas: input.deliveryFeeHalalas,
    subtotalHalalas: input.subtotalHalalas,
    totalHalalas: input.totalHalalas,
  });
}

export type ContactInput = { contactName: string; contactPhone: string };
export type DeliveryInput = ContactInput & { addressLine: string; city: string; notes: string | null };

export function orderRequestFingerprint(delivery: DeliveryInput, confirmationFingerprint: string): string {
  return stableFingerprint({
    confirmationFingerprint,
    contactName: delivery.contactName,
    contactPhone: delivery.contactPhone,
    addressLine: delivery.addressLine,
    city: delivery.city,
    notes: delivery.notes ?? '',
  });
}

export function bookingRequestFingerprint(input: {
  serviceId: string;
  startsAt: string;
  resourceId: string;
  contactName: string;
  contactPhone: string;
  notes: string | null;
}): string {
  return stableFingerprint({
    serviceId: input.serviceId,
    startsAt: input.startsAt,
    resourceId: input.resourceId || '',
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    notes: input.notes ?? '',
  });
}

/**
 * Stable resource key used in availability and booking.
 * Allows Arabic letters so portal labels like «غرفة-أ» round-trip; rejects spaces/control chars.
 */
export function normalizeResourceId(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') throw badRequest('RESOURCE_INVALID', 'معرّف المورد غير صالح');
  const id = value.trim().slice(0, 64);
  // Letters (any script), numbers, and a small set of separators — same rule for save and book.
  if (id && !/^[\p{L}\p{N}._:\-]+$/u.test(id)) {
    throw badRequest('RESOURCE_INVALID', 'معرّف المورد غير صالح. استخدمي حروفًا أو أرقامًا دون مسافات');
  }
  return id;
}

export type ResourceCapacityConflict = {
  resourceId: string;
  capacities: number[];
};

/**
 * Detect differing capacities for the same resourceId across window lists.
 * Does not pick MIN/MAX/SUM — conflicting resources are listed for explicit correction.
 */
export function findResourceCapacityConflicts(
  windowsLists: ReadonlyArray<ReadonlyArray<AvailabilityWindow>>,
): ResourceCapacityConflict[] {
  const seen = new Map<string, Set<number>>();
  for (const windows of windowsLists) {
    for (const w of windows) {
      if (!w.resourceId) continue;
      const set = seen.get(w.resourceId) ?? new Set<number>();
      set.add(w.capacity);
      seen.set(w.resourceId, set);
    }
  }
  const out: ResourceCapacityConflict[] = [];
  for (const [resourceId, caps] of seen) {
    if (caps.size > 1) out.push({ resourceId, capacities: [...caps].sort((a, b) => a - b) });
  }
  return out;
}

/** Consistent capacity per resourceId, or empty map when any conflict exists for that id. */
export function partnerResourceCapacities(windowsLists: ReadonlyArray<ReadonlyArray<AvailabilityWindow>>): Map<string, number> {
  const caps = new Map<string, number>();
  const conflicts = new Set(findResourceCapacityConflicts(windowsLists).map((c) => c.resourceId));
  for (const windows of windowsLists) {
    for (const w of windows) {
      if (!w.resourceId || conflicts.has(w.resourceId)) continue;
      caps.set(w.resourceId, w.capacity);
    }
  }
  return caps;
}

/**
 * Apply only agreed partner-wide capacities. Conflicting resources are left unchanged
 * here — callers must refuse booking/slots for those ids via findResourceCapacityConflicts.
 */
export function withPartnerResourceCaps(
  windows: AvailabilityWindow[],
  partnerCaps: ReadonlyMap<string, number>,
): AvailabilityWindow[] {
  return windows.map((w) => {
    if (!w.resourceId) return w;
    const cap = partnerCaps.get(w.resourceId);
    if (cap == null) return w;
    return cap === w.capacity ? w : { ...w, capacity: cap };
  });
}

/** Same resourceId must not declare differing capacities (within one payload or across services). */
export function assertResourceCapacitiesConsistent(
  windows: AvailabilityWindow[],
  otherWindows: ReadonlyArray<AvailabilityWindow> = [],
): void {
  const conflicts = findResourceCapacityConflicts([windows, otherWindows]);
  if (conflicts.length === 0) return;
  const first = conflicts[0]!;
  throw badRequest(
    'RESOURCE_CAPACITY_CONFLICT',
    `سعة المورد «${first.resourceId}» غير متسقة (${first.capacities.join(' مقابل ')}). وحّدي السعة لكل موارد الجهة قبل الحفظ`,
    { resourceId: first.resourceId, capacities: first.capacities, conflicts },
  );
}

/** Rewrite capacity for listed resourceIds on every window that uses them. */
export function unifyResourceCapacities(
  windows: AvailabilityWindow[],
  capacityByResource: ReadonlyMap<string, number>,
): AvailabilityWindow[] {
  return windows.map((w) => {
    if (!w.resourceId) return w;
    const next = capacityByResource.get(w.resourceId);
    return next == null || next === w.capacity ? w : { ...w, capacity: next };
  });
}

function text(value: unknown, field: string, min: number, max: number, code: string, messageAr: string): string {
  if (typeof value !== 'string') throw badRequest(code, messageAr, { field });
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw badRequest(code, messageAr, { field });
  return trimmed;
}

export function parseContact(body: Record<string, unknown>): ContactInput {
  const contactName = text(body.contactName, 'contactName', 2, 80, 'CONTACT_NAME_INVALID', 'الاسم مطلوب');
  const rawPhone = text(body.contactPhone, 'contactPhone', 7, 20, 'CONTACT_PHONE_INVALID', 'رقم الجوال غير صالح');
  const contactPhone = rawPhone.replace(/[\s-]/g, '');
  if (!/^\+?[0-9]{7,15}$/.test(contactPhone)) {
    throw badRequest('CONTACT_PHONE_INVALID', 'رقم الجوال غير صالح', { field: 'contactPhone' });
  }
  return { contactName, contactPhone };
}

export function parseOptionalNotes(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 500) {
    throw badRequest('NOTES_INVALID', 'الملاحظات طويلة جدًا', { field: 'notes' });
  }
  return value.trim() || null;
}

export function parseDelivery(body: Record<string, unknown>): DeliveryInput {
  return {
    ...parseContact(body),
    addressLine: text(body.addressLine, 'addressLine', 5, 240, 'ADDRESS_INVALID', 'العنوان مطلوب'),
    city: text(body.city, 'city', 2, 60, 'CITY_INVALID', 'المدينة مطلوبة'),
    notes: parseOptionalNotes(body.notes),
  };
}

export function parseQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_LINE_QUANTITY) {
    throw badRequest('QUANTITY_INVALID', `الكمية يجب أن تكون بين 1 و ${MAX_LINE_QUANTITY}`);
  }
  return value;
}

const PUBLIC_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Human readable, e.g. `MO-261001-K7Q2ZP`. Uniqueness is enforced by the database. */
export function makePublicNumber(prefix: 'MO' | 'MB', now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const bytes = randomBytes(6);
  let suffix = '';
  for (const b of bytes) suffix += PUBLIC_NUMBER_ALPHABET[b % PUBLIC_NUMBER_ALPHABET.length];
  return `${prefix}-${yy}${mm}${dd}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Service availability / slots
// ---------------------------------------------------------------------------

/**
 * One operating window. Optional `resourceId` separates rooms/staff.
 * Overlapping windows for the **same** resource are rejected at save time.
 * Legacy overlaps are never capacity-summed: covering capacity uses MIN.
 */
export type AvailabilityWindow = {
  weekday: number;
  startMin: number;
  endMin: number;
  capacity: number;
  resourceId: string;
};

export function parseAvailability(json: unknown): AvailabilityWindow[] {
  if (!Array.isArray(json)) return [];
  const windows: AvailabilityWindow[] = [];
  for (const raw of json) {
    if (!isRecord(raw)) continue;
    const { weekday, startMin, endMin, capacity } = raw;
    let resourceId = '';
    try {
      resourceId = normalizeResourceId(raw.resourceId);
    } catch {
      continue; // invalid id skipped at parse; writers must validate via normalizeResourceId first
    }
    if (
      typeof weekday === 'number' && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 &&
      typeof startMin === 'number' && Number.isInteger(startMin) && startMin >= 0 && startMin < 1440 &&
      typeof endMin === 'number' && Number.isInteger(endMin) && endMin > startMin && endMin <= 1440 &&
      typeof capacity === 'number' && Number.isInteger(capacity) && capacity >= 1 && capacity <= 100
    ) {
      windows.push({ weekday, startMin, endMin, capacity, resourceId });
    }
  }
  return windows;
}

/** Reject overlapping windows for the same resource (adjacent end===start is allowed). */
export function assertAvailabilityConsistent(windows: AvailabilityWindow[]): void {
  const groups = new Map<string, AvailabilityWindow[]>();
  for (const w of windows) {
    const key = `${w.resourceId}|${w.weekday}`;
    const list = groups.get(key) ?? [];
    list.push(w);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        if (a.startMin < b.endMin && b.startMin < a.endMin) {
          throw badRequest(
            'AVAILABILITY_OVERLAP',
            'فترات التوفر متداخلة لنفس المورد. صحّحي الجدول أو عيّني معرّف مورد مختلفًا لكل فترة',
            { weekday: a.weekday, resourceId: a.resourceId, a: [a.startMin, a.endMin], b: [b.startMin, b.endMin] },
          );
        }
      }
    }
  }
}

/**
 * Capacity covering a candidate slot. Never sums overlapping legacy windows:
 * uses the minimum capacity among covering windows of the same resource.
 */
export function capacityCovering(
  weekday: number,
  slotStartMin: number,
  slotEndMin: number,
  windows: AvailabilityWindow[],
  resourceId = '',
): number | null {
  if (!Number.isInteger(slotStartMin) || !Number.isInteger(slotEndMin) || slotEndMin <= slotStartMin) return null;
  const covering = windows.filter(
    (w) =>
      w.resourceId === resourceId &&
      w.weekday === weekday &&
      w.startMin <= slotStartMin &&
      w.endMin >= slotEndMin,
  );
  if (covering.length === 0) return null;
  return Math.min(...covering.map((w) => w.capacity));
}

/** Local (Asia/Riyadh) weekday (0 = Sunday) and minute-of-day for an instant. */
export function localParts(instant: Date): { weekday: number; minuteOfDay: number; dateKey: string } {
  const local = new Date(instant.getTime() + LOCAL_UTC_OFFSET_MIN * 60_000);
  return {
    weekday: local.getUTCDay(),
    minuteOfDay: local.getUTCHours() * 60 + local.getUTCMinutes(),
    dateKey: local.toISOString().slice(0, 10),
  };
}

/** UTC instant for a local YYYY-MM-DD at the given minute-of-day. Returns null for invalid dates. */
export function localInstant(dateKey: string, minuteOfDay: number): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const base = Date.parse(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(base)) return null;
  if (new Date(base).toISOString().slice(0, 10) !== dateKey) return null;
  return new Date(base + (minuteOfDay - LOCAL_UTC_OFFSET_MIN) * 60_000);
}

export type SlotCheck =
  | { ok: true; capacity: number; endsAt: Date; resourceId: string }
  | { ok: false; code: 'SLOT_IN_PAST' | 'SLOT_TOO_FAR' | 'SLOT_MISALIGNED' | 'SLOT_OUTSIDE_AVAILABILITY' | 'AVAILABILITY_NOT_CONFIGURED' | 'DURATION_INVALID' };

/** Shared bookability check used by listing and create booking. */
export function checkSlot(
  startsAt: Date,
  durationMin: number,
  windows: AvailabilityWindow[],
  now: Date = new Date(),
  resourceId = '',
): SlotCheck {
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 12 * 60) {
    return { ok: false, code: 'DURATION_INVALID' };
  }
  if (windows.length === 0) return { ok: false, code: 'AVAILABILITY_NOT_CONFIGURED' };
  if (startsAt.getTime() < now.getTime() + BOOKING_LEAD_MINUTES * 60_000) return { ok: false, code: 'SLOT_IN_PAST' };
  if (startsAt.getTime() > now.getTime() + BOOKING_HORIZON_DAYS * 86_400_000) return { ok: false, code: 'SLOT_TOO_FAR' };
  const { weekday, minuteOfDay } = localParts(startsAt);
  if (startsAt.getUTCSeconds() !== 0 || startsAt.getUTCMilliseconds() !== 0) return { ok: false, code: 'SLOT_MISALIGNED' };
  const slotEnd = minuteOfDay + durationMin;
  const capacity = capacityCovering(weekday, minuteOfDay, slotEnd, windows, resourceId);
  if (capacity == null) return { ok: false, code: 'SLOT_OUTSIDE_AVAILABILITY' };
  // Align to a grid from any covering window start for this resource.
  const covering = windows.filter(
    (w) =>
      w.resourceId === resourceId &&
      w.weekday === weekday &&
      w.startMin <= minuteOfDay &&
      w.endMin >= slotEnd,
  );
  const aligned = covering.some((w) => (minuteOfDay - w.startMin) % durationMin === 0);
  if (!aligned) return { ok: false, code: 'SLOT_MISALIGNED' };
  return { ok: true, capacity, endsAt: new Date(startsAt.getTime() + durationMin * 60_000), resourceId };
}

export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export type SlotView = {
  startsAt: string;
  endsAt: string;
  capacity: number;
  remaining: number;
  available: boolean;
  resourceId: string;
};

/**
 * One local day of slots. Each start time appears once per resource.
 * Capacity/remaining use the same covering rule as checkSlot (never double-list).
 */
export function buildDaySlots(
  dateKey: string,
  durationMin: number,
  windows: AvailabilityWindow[],
  held: ReadonlyArray<{ startsAt: Date; endsAt: Date; resourceId?: string }>,
  now: Date = new Date(),
): SlotView[] {
  if (!Number.isInteger(durationMin) || durationMin < 5) return [];
  const dayStart = localInstant(dateKey, 0);
  if (!dayStart) return [];
  const weekday = localParts(new Date(dayStart.getTime() + 12 * 3_600_000)).weekday;
  const resourceIds = [...new Set(windows.filter((w) => w.weekday === weekday).map((w) => w.resourceId))];
  if (resourceIds.length === 0) return [];

  const slots: SlotView[] = [];
  for (const resourceId of resourceIds) {
    const dayWindows = windows.filter((w) => w.weekday === weekday && w.resourceId === resourceId);
    const starts = new Set<number>();
    for (const w of dayWindows) {
      for (let m = w.startMin; m + durationMin <= w.endMin; m += durationMin) {
        if ((m - w.startMin) % durationMin === 0) starts.add(m);
      }
    }
    for (const m of [...starts].sort((a, b) => a - b)) {
      const startsAt = localInstant(dateKey, m)!;
      const check = checkSlot(startsAt, durationMin, windows, now, resourceId);
      if (!check.ok) {
        // Still show past/outside as unavailable rows only when capacity exists for the window.
        const cap = capacityCovering(weekday, m, m + durationMin, windows, resourceId);
        if (cap == null) continue;
        const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
        const taken = held.filter(
          (h) => (h.resourceId ?? '') === resourceId && intervalsOverlap(startsAt, endsAt, h.startsAt, h.endsAt),
        ).length;
        slots.push({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          capacity: cap,
          remaining: Math.max(cap - taken, 0),
          available: false,
          resourceId,
        });
        continue;
      }
      const taken = held.filter(
        (h) => (h.resourceId ?? '') === resourceId && intervalsOverlap(startsAt, check.endsAt, h.startsAt, h.endsAt),
      ).length;
      const remaining = Math.max(check.capacity - taken, 0);
      slots.push({
        startsAt: startsAt.toISOString(),
        endsAt: check.endsAt.toISOString(),
        capacity: check.capacity,
        remaining,
        available: remaining > 0,
        resourceId,
      });
    }
  }
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.resourceId.localeCompare(b.resourceId));
}
