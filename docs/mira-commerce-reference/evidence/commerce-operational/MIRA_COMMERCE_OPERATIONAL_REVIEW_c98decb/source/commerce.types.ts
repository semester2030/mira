import { HttpException, HttpStatus } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

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
 * Customers may only cancel before the partner accepts. Terminal: delivered, rejected, cancelled.
 */
export const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, ActorMap> = {
  new: { accepted: ['partner', 'admin'], rejected: ['partner', 'admin'], cancelled: ['customer', 'admin'] },
  accepted: { preparing: ['partner', 'admin'], cancelled: ['partner', 'admin'] },
  preparing: { out_for_delivery: ['partner', 'admin'], cancelled: ['partner', 'admin'] },
  out_for_delivery: { delivered: ['partner', 'admin'], failed_delivery: ['partner', 'admin'] },
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

/** Cash can be taken at the door: only once the order is on its way or delivered. */
export function canCollectPayment(fulfillment: string, collection: string): boolean {
  return collection === 'uncollected' && (fulfillment === 'out_for_delivery' || fulfillment === 'delivered');
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

export function canonicalVariantKey(selections: Record<string, string>): string {
  return Object.keys(selections)
    .sort()
    .map((k) => `${k}=${selections[k]}`)
    .join('|');
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
 * One delivery per order: the highest per-product fee applies.
 * A product with a null fee means "unknown" (never free), which makes the whole order fee unknown.
 */
export function computeDeliveryFee(fees: ReadonlyArray<number | null | undefined>): DeliveryFeeResult {
  if (fees.length === 0) return { feeHalalas: null, known: false };
  let max = 0;
  for (const fee of fees) {
    if (fee == null || !Number.isSafeInteger(fee) || fee < 0) return { feeHalalas: null, known: false };
    if (fee > max) max = fee;
  }
  return { feeHalalas: max, known: true };
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

export type ContactInput = { contactName: string; contactPhone: string };
export type DeliveryInput = ContactInput & { addressLine: string; city: string; notes: string | null };

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

export type AvailabilityWindow = { weekday: number; startMin: number; endMin: number; capacity: number };

export function parseAvailability(json: unknown): AvailabilityWindow[] {
  if (!Array.isArray(json)) return [];
  const windows: AvailabilityWindow[] = [];
  for (const raw of json) {
    if (!isRecord(raw)) continue;
    const { weekday, startMin, endMin, capacity } = raw;
    if (
      typeof weekday === 'number' && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 &&
      typeof startMin === 'number' && Number.isInteger(startMin) && startMin >= 0 && startMin < 1440 &&
      typeof endMin === 'number' && Number.isInteger(endMin) && endMin > startMin && endMin <= 1440 &&
      typeof capacity === 'number' && Number.isInteger(capacity) && capacity >= 1 && capacity <= 100
    ) {
      windows.push({ weekday, startMin, endMin, capacity });
    }
  }
  return windows;
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
  | { ok: true; window: AvailabilityWindow; endsAt: Date }
  | { ok: false; code: 'SLOT_IN_PAST' | 'SLOT_TOO_FAR' | 'SLOT_MISALIGNED' | 'SLOT_OUTSIDE_AVAILABILITY' | 'AVAILABILITY_NOT_CONFIGURED' };

/** Is `startsAt` a bookable instant for a service with this availability and duration? */
export function checkSlot(
  startsAt: Date,
  durationMin: number,
  windows: AvailabilityWindow[],
  now: Date = new Date(),
): SlotCheck {
  if (windows.length === 0) return { ok: false, code: 'AVAILABILITY_NOT_CONFIGURED' };
  if (startsAt.getTime() < now.getTime() + BOOKING_LEAD_MINUTES * 60_000) return { ok: false, code: 'SLOT_IN_PAST' };
  if (startsAt.getTime() > now.getTime() + BOOKING_HORIZON_DAYS * 86_400_000) return { ok: false, code: 'SLOT_TOO_FAR' };
  const { weekday, minuteOfDay } = localParts(startsAt);
  if (startsAt.getUTCSeconds() !== 0 || startsAt.getUTCMilliseconds() !== 0) return { ok: false, code: 'SLOT_MISALIGNED' };
  const window = windows.find(
    (w) => w.weekday === weekday && minuteOfDay >= w.startMin && minuteOfDay + durationMin <= w.endMin,
  );
  if (!window) return { ok: false, code: 'SLOT_OUTSIDE_AVAILABILITY' };
  // Slots sit on a grid that starts at the window start and steps by the service duration.
  if ((minuteOfDay - window.startMin) % durationMin !== 0) return { ok: false, code: 'SLOT_MISALIGNED' };
  return { ok: true, window, endsAt: new Date(startsAt.getTime() + durationMin * 60_000) };
}

export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export type SlotView = { startsAt: string; endsAt: string; capacity: number; remaining: number; available: boolean };

/** Slots of one local day, with remaining capacity given the already-held bookings. */
export function buildDaySlots(
  dateKey: string,
  durationMin: number,
  windows: AvailabilityWindow[],
  held: ReadonlyArray<{ startsAt: Date; endsAt: Date }>,
  now: Date = new Date(),
): SlotView[] {
  const dayStart = localInstant(dateKey, 0);
  if (!dayStart) return [];
  const weekday = localParts(new Date(dayStart.getTime() + 12 * 3_600_000)).weekday;
  const slots: SlotView[] = [];
  for (const w of windows.filter((x) => x.weekday === weekday)) {
    for (let m = w.startMin; m + durationMin <= w.endMin; m += durationMin) {
      const startsAt = localInstant(dateKey, m)!;
      const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
      const taken = held.filter((h) => intervalsOverlap(startsAt, endsAt, h.startsAt, h.endsAt)).length;
      const remaining = Math.max(w.capacity - taken, 0);
      const bookable = checkSlot(startsAt, durationMin, windows, now).ok;
      slots.push({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        capacity: w.capacity,
        remaining,
        available: bookable && remaining > 0,
      });
    }
  }
  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
