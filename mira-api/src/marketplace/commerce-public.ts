import { BadRequestException } from '@nestjs/common';
import {
  PURCHASE_MODE_EXTERNAL,
  PURCHASE_MODE_INTERNAL_COD,
  parseAvailability,
  parseOptionGroups,
  parseVariants,
} from './commerce.types';

function assertVariantIdsUnique(variantsJson: unknown[]): void {
  const parsed = parseVariants(variantsJson);
  const ids = new Set<string>();
  const selectionKeys = new Set<string>();
  for (const variant of parsed) {
    if (ids.has(variant.id)) throw new BadRequestException(`معرّف التركيبة مكرر: ${variant.id}`);
    ids.add(variant.id);
    const key = Object.keys(variant.selections)
      .sort()
      .map((g) => `${g}=${variant.selections[g]}`)
      .join('|');
    if (selectionKeys.has(key)) throw new BadRequestException('تركيبتان بنفس الاختيارات');
    selectionKeys.add(key);
  }
}

/** Variant selections must point at known group/value ids; ids and selection maps must be unique. */
export function assertVariantsMatchOptions(optionsJson: unknown[] | null, variantsJson: unknown[]): void {
  assertVariantIdsUnique(variantsJson);
  if (optionsJson == null || optionsJson.length === 0) {
    if (variantsJson.length > 0) throw new BadRequestException('لا يمكن الإبقاء على تركيبات بعد مسح الخيارات');
    return;
  }
  const groups = parseOptionGroups(optionsJson);
  if (groups.length === 0 && variantsJson.length > 0) {
    throw new BadRequestException('التركيبات تشير إلى خيارات غير صالحة');
  }
  const valueIds = new Map(groups.map((g) => [g.id, new Set(g.values.map((v) => v.id))] as const));
  for (const variant of parseVariants(variantsJson)) {
    for (const [groupId, valueId] of Object.entries(variant.selections)) {
      const allowed = valueIds.get(groupId);
      if (!allowed || !allowed.has(valueId)) {
        throw new BadRequestException(`التركيبة ${variant.id} تشير إلى خيار غير موجود`);
      }
    }
    for (const group of groups) {
      if (!(group.id in variant.selections)) {
        throw new BadRequestException(`التركيبة ${variant.id} ناقصة اختيار «${group.labelAr}»`);
      }
    }
  }
}

/**
 * Public (customer-visible) commerce fields for catalog rows, and merchant input checks.
 * Pure helpers: no database access. `reservedQty` is never exposed.
 */

type ProductCommerceRow = {
  purchaseMode: string;
  stockQty: number | null;
  reservedQty: number;
  deliveryFeeHalalas: number | null;
  optionsJson: unknown;
  variantsJson: unknown;
};

type ServiceCommerceRow = {
  bookingEnabled: boolean;
  payMode: string;
  availabilityJson: unknown;
};

/** Units a customer can still order. `null` means stock is not tracked. */
export function sellableQty(row: Pick<ProductCommerceRow, 'stockQty' | 'reservedQty'>): number | null {
  if (row.stockQty == null) return null;
  return Math.max(row.stockQty - row.reservedQty, 0);
}

export function publicProductCommerce(row: ProductCommerceRow) {
  const available = sellableQty(row);
  const inApp = row.purchaseMode === PURCHASE_MODE_INTERNAL_COD;
  return {
    purchaseMode: inApp ? PURCHASE_MODE_INTERNAL_COD : PURCHASE_MODE_EXTERNAL,
    // Sellable units (stock minus reservations). null = not tracked.
    stockQty: available,
    stockAvailable: available === null || available > 0,
    // null = fee unknown (never "free").
    deliveryFeeHalalas: row.deliveryFeeHalalas ?? null,
    optionsJson: Array.isArray(row.optionsJson) && parseOptionGroups(row.optionsJson).length > 0 ? row.optionsJson : null,
    variantsJson: Array.isArray(row.variantsJson) && parseVariants(row.variantsJson).length > 0 ? row.variantsJson : null,
  };
}

export function publicServiceCommerce(row: ServiceCommerceRow) {
  const windows = parseAvailability(row.availabilityJson);
  return {
    bookingEnabled: row.bookingEnabled,
    payMode: row.payMode,
    // Whether the partner has published any weekly hours. Slots themselves come from the availability endpoint.
    availabilityPresent: windows.length > 0,
  };
}

export type ProductCommerceInput = {
  purchaseMode?: string;
  stockQty?: number | null;
  deliveryFeeHalalas?: number | null;
  optionsJson?: unknown[] | null;
  variantsJson?: unknown[] | null;
};

export type ProductCommerceData = {
  purchaseMode?: string;
  stockQty?: number | null;
  deliveryFeeHalalas?: number | null;
  optionsJson?: unknown[] | null;
  variantsJson?: unknown[] | null;
};

type CurrentProductCommerce = Pick<ProductCommerceRow, 'purchaseMode' | 'reservedQty'> & { priceHalalas: number };

/**
 * Validates merchant commerce fields and returns only what should be written.
 * `undefined` = leave unchanged, `null` = clear. Throws an Arabic 400 on bad data.
 */
export function normalizeProductCommerce(
  input: ProductCommerceInput,
  current: CurrentProductCommerce | null,
  nextPriceHalalas: number,
): ProductCommerceData {
  const out: ProductCommerceData = {};

  if (input.purchaseMode !== undefined) {
    if (input.purchaseMode !== PURCHASE_MODE_EXTERNAL && input.purchaseMode !== PURCHASE_MODE_INTERNAL_COD) {
      throw new BadRequestException('طريقة الشراء غير صالحة');
    }
    out.purchaseMode = input.purchaseMode;
  }
  if (input.stockQty !== undefined) {
    if (input.stockQty !== null) {
      if (!Number.isInteger(input.stockQty) || input.stockQty < 0) throw new BadRequestException('كمية المخزون غير صالحة');
      if (current && input.stockQty < current.reservedQty) {
        throw new BadRequestException('المخزون أقل من الكمية المحجوزة لطلبات قائمة');
      }
    }
    out.stockQty = input.stockQty;
  }
  if (input.deliveryFeeHalalas !== undefined) {
    if (input.deliveryFeeHalalas !== null && (!Number.isInteger(input.deliveryFeeHalalas) || input.deliveryFeeHalalas < 0)) {
      throw new BadRequestException('رسوم التوصيل غير صالحة');
    }
    out.deliveryFeeHalalas = input.deliveryFeeHalalas;
  }
  if (input.optionsJson !== undefined) {
    if (input.optionsJson !== null && input.optionsJson.length > 0 && parseOptionGroups(input.optionsJson).length !== input.optionsJson.length) {
      throw new BadRequestException('خيارات المنتج غير صالحة: لكل خيار معرّف واسم وقيمة واحدة على الأقل');
    }
    out.optionsJson = input.optionsJson && input.optionsJson.length > 0 ? input.optionsJson : null;
  }
  if (input.variantsJson !== undefined) {
    if (input.variantsJson !== null && input.variantsJson.length > 0 && parseVariants(input.variantsJson).length !== input.variantsJson.length) {
      throw new BadRequestException('نسخ المنتج غير صالحة: لكل نسخة معرّف واختيارات');
    }
    out.variantsJson = input.variantsJson && input.variantsJson.length > 0 ? input.variantsJson : null;
  }
  if (out.optionsJson !== undefined && out.variantsJson !== undefined) {
    assertVariantsMatchOptions(out.optionsJson, out.variantsJson ?? []);
  } else if (out.variantsJson !== undefined && out.variantsJson !== null) {
    assertVariantIdsUnique(out.variantsJson);
  } else if (out.optionsJson === null && out.variantsJson === undefined) {
    // Clearing options without an explicit variants field: force variants clear on the write path.
    out.variantsJson = null;
  }

  const mode = out.purchaseMode ?? current?.purchaseMode ?? PURCHASE_MODE_EXTERNAL;
  if (mode === PURCHASE_MODE_INTERNAL_COD && !(Number.isSafeInteger(nextPriceHalalas) && nextPriceHalalas > 0)) {
    throw new BadRequestException('الشراء داخل ميرا يتطلب سعرًا أكبر من صفر');
  }
  return out;
}
