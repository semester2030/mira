import { Prisma } from '@prisma/client';

/** Map P1 draft values (colors/sizes/…) into Product optionsJson groups. No variant matrix / stock. */
export function optionsJsonFromDraftValues(values: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  const groups: Array<{ id: string; labelAr: string; values: Array<{ id: string; labelAr: string }> }> = [];

  if (Array.isArray(values.colors)) {
    const colorValues = values.colors
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      .map((id) => ({ id, labelAr: colorLabelAr(id) }));
    if (colorValues.length) {
      groups.push({ id: 'color', labelAr: 'اللون', values: colorValues });
    }
  }

  if (Array.isArray(values.sizes)) {
    const sizeValues = values.sizes
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      .map((id) => ({ id, labelAr: id }));
    if (sizeValues.length) {
      groups.push({ id: 'size', labelAr: 'المقاس', values: sizeValues });
    }
  }

  // Explicit optionsJson from editor wins if already shaped; else build from colors/sizes.
  if (values.optionsJson !== undefined) {
    return values.optionsJson == null ? undefined : (values.optionsJson as Prisma.InputJsonValue);
  }
  if (!groups.length) return undefined;
  return groups as unknown as Prisma.InputJsonValue;
}

function colorLabelAr(id: string): string {
  const map: Record<string, string> = {
    black: 'أسود',
    ivory: 'عاجي',
    brown: 'بني',
    pink: 'وردي',
    blue: 'أزرق',
    green: 'أخضر',
    multi: 'متعدد',
  };
  return map[id] || id;
}

/** Fields that must not be silently dropped on materialize when present in values. */
export const P1_PRODUCT_MAPPED_FIELDS = ['colors', 'sizes', 'nameAr', 'nameEn', 'descriptionAr', 'priceHalalas', 'category', 'purchaseMode', 'stockQty', 'deliveryFeeHalalas', 'externalUrl', 'concernTags'] as const;
