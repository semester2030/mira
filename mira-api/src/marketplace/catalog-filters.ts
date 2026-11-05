/**
 * P5 public catalog filters — pure helpers (no Prisma).
 *
 * Contract:
 * - Multi-select within one field = OR (unless a later contract says otherwise).
 * - Different fields = AND.
 * - Color/size/option filters match the **same** publicly available variant.
 * - Draft / unavailable / unpublished variants never match.
 * - Facet counts for a field exclude that field's own selection and apply the rest.
 */

import { parseOptionGroups, parseVariants, type ProductVariant } from './commerce.types';

/** Registry filter key → option group id used in optionsJson / variantsJson.selections. */
export const VARIANT_FILTER_GROUP_IDS: Readonly<Record<string, string>> = {
  'variant.color': 'color',
  color: 'color',
  'variant.size': 'size',
  size: 'size',
  'variant.volume': 'volume',
  volume: 'volume',
  'variant.shade': 'shade',
  shade: 'shade',
  'variant.ringSize': 'ringSize',
  ringSize: 'ringSize',
  finish: 'finish',
};

export type CatalogSort = 'key' | 'price_asc' | 'price_desc';

export type CatalogFilterInput = {
  q?: string;
  tags?: string[];
  category?: string;
  city?: string;
  partnerId?: string;
  /** kind filter: product | service (optional; lane may already constrain). */
  kind?: 'product' | 'service';
  /** option group id → selected value ids (OR within, AND across). */
  variantSelections?: Record<string, string[]>;
  /** When true, matching variant (or product-level stock) must be sellable. */
  inStock?: boolean;
  priceMinHalalas?: number | null;
  priceMaxHalalas?: number | null;
  durationMin?: number | null;
  durationMax?: number | null;
  placeModes?: string[];
  sort?: CatalogSort;
};

export type CatalogFilterItem = {
  kind: 'product' | 'service';
  id: string;
  partnerId: string;
  partnerType: string;
  partnerNameAr: string;
  city: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  category?: string | null;
  concernTags: string[];
  priceHalalas: number | null;
  durationMin?: number | null;
  placeMode?: string | null;
  optionsJson?: unknown;
  variantsJson?: unknown;
  /** Product-level sellable qty; null = untracked. */
  stockQty?: number | null;
  stockAvailable?: boolean;
  inventoryMode?: string;
  /** variantId → sellable qty (null = untracked). Absent ids treated as unavailable when mode=variant. */
  variantSellable?: Record<string, number | null>;
};

export type MatchedVariant = {
  variantId: string;
  priceHalalas: number | null;
  selections: Record<string, string>;
};

export type CatalogFilterMatch = {
  item: CatalogFilterItem;
  matchedVariants: MatchedVariant[];
  /** Price used for sort/display for this match (variant override or item). */
  effectivePriceHalalas: number | null;
};

function splitCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0))];
}

function parseNonNegInt(raw: string | undefined, field: string): number | null | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    return null; // signal invalid
  }
  return n;
}

/** Parse public query params into a typed filter. Returns `{ ok:false, reason }` on bad input. */
export function parseCatalogFilterQuery(params: Record<string, string | undefined>):
  | { ok: true; filter: CatalogFilterInput }
  | { ok: false; reason: string; messageAr: string } {
  const sortRaw = (params.sort ?? 'key').trim();
  if (sortRaw !== 'key' && sortRaw !== 'price_asc' && sortRaw !== 'price_desc') {
    return { ok: false, reason: 'invalid_sort', messageAr: 'ترتيب النتائج غير صالح' };
  }

  const priceMin = parseNonNegInt(params.priceMin, 'priceMin');
  if (priceMin === null) return { ok: false, reason: 'invalid_price_min', messageAr: 'الحد الأدنى للسعر غير صالح' };
  const priceMax = parseNonNegInt(params.priceMax, 'priceMax');
  if (priceMax === null) return { ok: false, reason: 'invalid_price_max', messageAr: 'الحد الأعلى للسعر غير صالح' };
  if (priceMin != null && priceMax != null && priceMin > priceMax) {
    return { ok: false, reason: 'invalid_price_range', messageAr: 'نطاق السعر غير صالح' };
  }

  const durationMin = parseNonNegInt(params.durationMin, 'durationMin');
  if (durationMin === null) return { ok: false, reason: 'invalid_duration_min', messageAr: 'الحد الأدنى للمدة غير صالح' };
  const durationMax = parseNonNegInt(params.durationMax, 'durationMax');
  if (durationMax === null) return { ok: false, reason: 'invalid_duration_max', messageAr: 'الحد الأعلى للمدة غير صالح' };
  if (durationMin != null && durationMax != null && durationMin > durationMax) {
    return { ok: false, reason: 'invalid_duration_range', messageAr: 'نطاق المدة غير صالح' };
  }

  const kindRaw = (params.kind ?? '').trim();
  if (kindRaw && kindRaw !== 'product' && kindRaw !== 'service') {
    return { ok: false, reason: 'invalid_kind', messageAr: 'نوع العنصر غير صالح' };
  }

  const variantSelections: Record<string, string[]> = {};
  for (const [paramKey, groupId] of Object.entries(VARIANT_FILTER_GROUP_IDS)) {
    const values = splitCsv(params[paramKey] ?? params[groupId]);
    if (values.length === 0) continue;
    const existing = variantSelections[groupId] ?? [];
    variantSelections[groupId] = [...new Set([...existing, ...values])];
  }
  // Generic `option=color:black,size:m` (AND across pairs; OR if same group repeats).
  for (const pair of splitCsv(params.option)) {
    const colon = pair.indexOf(':');
    if (colon <= 0 || colon === pair.length - 1) {
      return { ok: false, reason: 'invalid_option', messageAr: 'خيار التركيبة غير صالح (group:value)' };
    }
    const groupId = pair.slice(0, colon).trim();
    const valueId = pair.slice(colon + 1).trim();
    if (!groupId || !valueId) {
      return { ok: false, reason: 'invalid_option', messageAr: 'خيار التركيبة غير صالح (group:value)' };
    }
    variantSelections[groupId] = [...new Set([...(variantSelections[groupId] ?? []), valueId])];
  }

  const inStockRaw = (params.inStock ?? '').trim();
  let inStock: boolean | undefined;
  if (inStockRaw === '1' || inStockRaw === 'true') inStock = true;
  else if (inStockRaw === '0' || inStockRaw === 'false') inStock = false;
  else if (inStockRaw !== '') {
    return { ok: false, reason: 'invalid_in_stock', messageAr: 'قيمة التوفر غير صالحة' };
  }

  return {
    ok: true,
    filter: {
      q: (params.q ?? '').trim() || undefined,
      tags: splitCsv(params.tag),
      category: (params.category ?? '').trim() || undefined,
      city: (params.city ?? '').trim() || undefined,
      partnerId: (params.partnerId ?? '').trim() || undefined,
      kind: kindRaw ? (kindRaw as 'product' | 'service') : undefined,
      variantSelections: Object.keys(variantSelections).length ? variantSelections : undefined,
      inStock,
      priceMinHalalas: priceMin,
      priceMaxHalalas: priceMax,
      durationMin,
      durationMax,
      placeModes: splitCsv(params.placeMode),
      sort: sortRaw as CatalogSort,
    },
  };
}

/** True when a public variant satisfies every variant filter field (AND) with OR within each field. */
export function variantMatchesSelections(
  variant: ProductVariant,
  selections: Record<string, string[]> | undefined,
): boolean {
  if (!variant.available) return false;
  if (!selections || Object.keys(selections).length === 0) return true;
  for (const [groupId, values] of Object.entries(selections)) {
    if (values.length === 0) continue;
    const picked = variant.selections[groupId];
    if (!picked || !values.includes(picked)) return false;
  }
  return true;
}

function variantSellableQty(
  item: CatalogFilterItem,
  variant: ProductVariant,
): { tracked: boolean; sellable: number | null } {
  if (item.inventoryMode === 'variant') {
    if (!item.variantSellable || !(variant.id in item.variantSellable)) {
      return { tracked: true, sellable: 0 };
    }
    const qty = item.variantSellable[variant.id]!;
    return { tracked: qty != null, sellable: qty };
  }
  // Product-level: variant.available already checked; stock is product-wide.
  if (item.stockQty == null) return { tracked: false, sellable: null };
  return { tracked: true, sellable: item.stockQty };
}

function variantInStock(item: CatalogFilterItem, variant: ProductVariant): boolean {
  const { tracked, sellable } = variantSellableQty(item, variant);
  if (!tracked) return true;
  return (sellable ?? 0) > 0;
}

function extractPlaceMode(profileJson: unknown): string | null {
  if (!profileJson || typeof profileJson !== 'object' || Array.isArray(profileJson)) return null;
  const answers = (profileJson as { answers?: unknown }).answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const raw = (answers as Record<string, unknown>).placeMode ?? (answers as Record<string, unknown>).place_mode;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function placeModeFromServiceProfile(profileJson: unknown): string | null {
  return extractPlaceMode(profileJson);
}

function priceInRange(price: number | null, min?: number | null, max?: number | null): boolean {
  if (min == null && max == null) return true;
  if (price == null) return false; // unknown price never satisfies a bounded range
  if (min != null && price < min) return false;
  if (max != null && price > max) return false;
  return true;
}

/**
 * Match one published catalog row against filters.
 * Variant filters require at least one same-variant hit; black+S and white+M must not satisfy black+M.
 */
export function matchCatalogItem(item: CatalogFilterItem, filter: CatalogFilterInput): CatalogFilterMatch | null {
  if (filter.kind && item.kind !== filter.kind) return null;
  if (filter.partnerId && item.partnerId !== filter.partnerId) return null;
  if (filter.city && item.city !== filter.city) return null;
  if (filter.category && item.category !== filter.category) return null;

  if (filter.tags && filter.tags.length > 0) {
    if (!item.concernTags.some((t) => filter.tags!.includes(t))) return null;
  }

  if (filter.q) {
    const q = filter.q.toLowerCase();
    const hay = `${item.nameAr} ${item.nameEn} ${item.partnerNameAr} ${item.descriptionAr ?? ''} ${item.city}`.toLowerCase();
    if (!hay.includes(q)) return null;
  }

  if (item.kind === 'service') {
    if (Object.keys(filter.variantSelections ?? {}).length > 0) return null; // product-only facets
    if (filter.placeModes && filter.placeModes.length > 0) {
      if (!item.placeMode || !filter.placeModes.includes(item.placeMode)) return null;
    }
    if (filter.durationMin != null || filter.durationMax != null) {
      if (item.durationMin == null) return null;
      if (filter.durationMin != null && item.durationMin < filter.durationMin) return null;
      if (filter.durationMax != null && item.durationMin > filter.durationMax) return null;
    }
    if (!priceInRange(item.priceHalalas, filter.priceMinHalalas, filter.priceMaxHalalas)) return null;
    if (filter.inStock === true) {
      // Services: inStock is not applicable; ignore rather than invent availability.
    }
    return { item, matchedVariants: [], effectivePriceHalalas: item.priceHalalas };
  }

  // Product path
  if (filter.placeModes && filter.placeModes.length > 0) return null;
  if (filter.durationMin != null || filter.durationMax != null) return null;

  const variants = parseVariants(item.variantsJson);
  const hasVariantFilters = Object.keys(filter.variantSelections ?? {}).length > 0;

  if (hasVariantFilters) {
    const matched: MatchedVariant[] = [];
    for (const variant of variants) {
      if (!variantMatchesSelections(variant, filter.variantSelections)) continue;
      if (filter.inStock === true && !variantInStock(item, variant)) continue;
      if (filter.inStock === false && variantInStock(item, variant)) continue;
      const unitPrice = variant.priceHalalas ?? item.priceHalalas;
      if (!priceInRange(unitPrice, filter.priceMinHalalas, filter.priceMaxHalalas)) continue;
      matched.push({
        variantId: variant.id,
        priceHalalas: variant.priceHalalas,
        selections: { ...variant.selections },
      });
    }
    if (matched.length === 0) return null;
    const prices = matched.map((m) => m.priceHalalas ?? item.priceHalalas).filter((p): p is number => p != null);
    const effective =
      filter.sort === 'price_desc'
        ? prices.length
          ? Math.max(...prices)
          : item.priceHalalas
        : prices.length
          ? Math.min(...prices)
          : item.priceHalalas;
    return { item, matchedVariants: matched, effectivePriceHalalas: effective };
  }

  // No variant filters — product-level price/stock.
  if (!priceInRange(item.priceHalalas, filter.priceMinHalalas, filter.priceMaxHalalas)) return null;
  if (filter.inStock === true) {
    if (item.inventoryMode === 'variant') {
      const any = variants.some((v) => v.available && variantInStock(item, v));
      if (!any) return null;
    } else if (item.stockAvailable === false) {
      return null;
    }
  }
  if (filter.inStock === false) {
    if (item.inventoryMode === 'variant') {
      const any = variants.some((v) => v.available && variantInStock(item, v));
      if (any) return null;
    } else if (item.stockAvailable !== false) {
      return null;
    }
  }

  return { item, matchedVariants: [], effectivePriceHalalas: item.priceHalalas };
}

export function filterCatalogItems(
  items: readonly CatalogFilterItem[],
  filter: CatalogFilterInput,
): CatalogFilterMatch[] {
  const out: CatalogFilterMatch[] = [];
  for (const item of items) {
    const hit = matchCatalogItem(item, filter);
    if (hit) out.push(hit);
  }
  return sortCatalogMatches(out, filter.sort ?? 'key');
}

export function sortCatalogMatches(matches: CatalogFilterMatch[], sort: CatalogSort): CatalogFilterMatch[] {
  const key = (m: CatalogFilterMatch) => `${m.item.kind}:${m.item.id}`;
  const copy = [...matches];
  copy.sort((a, b) => {
    if (sort === 'price_asc' || sort === 'price_desc') {
      const ap = a.effectivePriceHalalas;
      const bp = b.effectivePriceHalalas;
      // Unknown prices sort last for both directions (stable discovery).
      if (ap == null && bp != null) return 1;
      if (ap != null && bp == null) return -1;
      if (ap != null && bp != null && ap !== bp) {
        return sort === 'price_asc' ? ap - bp : bp - ap;
      }
    }
    const ak = key(a);
    const bk = key(b);
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  });
  return copy;
}

export type FacetBucket = { id: string; count: number };
export type CatalogFacets = {
  /** Facet counts exclude the field's own filter and apply the rest (standard faceted search). */
  concern: FacetBucket[];
  category: FacetBucket[];
  city: FacetBucket[];
  'variant.color': FacetBucket[];
  'variant.size': FacetBucket[];
  placeMode: FacetBucket[];
  staleSelections: Array<{ field: string; value: string }>;
};

function bump(map: Map<string, number>, id: string) {
  if (!id) return;
  map.set(id, (map.get(id) ?? 0) + 1);
}

function toBuckets(map: Map<string, number>): FacetBucket[] {
  return [...map.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/** Build facet counts: for each facet field, apply all filters except that field. */
export function buildCatalogFacets(
  items: readonly CatalogFilterItem[],
  filter: CatalogFilterInput,
): CatalogFacets {
  const without = (omit: keyof CatalogFilterInput | 'variant.color' | 'variant.size' | 'variant'): CatalogFilterInput => {
    if (omit === 'variant.color' || omit === 'variant.size' || omit === 'variant') {
      const selections: Record<string, string[]> = { ...(filter.variantSelections ?? {}) };
      if (omit === 'variant.color') delete selections.color;
      else if (omit === 'variant.size') delete selections.size;
      else {
        for (const key of Object.keys(selections)) delete selections[key];
      }
      const next: CatalogFilterInput = { ...filter };
      next.variantSelections = Object.keys(selections).length > 0 ? selections : undefined;
      return next;
    }
    const next: CatalogFilterInput = { ...filter };
    delete (next as Record<string, unknown>)[omit];
    return next;
  };

  const concern = new Map<string, number>();
  const category = new Map<string, number>();
  const city = new Map<string, number>();
  const colors = new Map<string, number>();
  const sizes = new Map<string, number>();
  const placeMode = new Map<string, number>();

  for (const hit of filterCatalogItems(items, without('tags'))) {
    for (const tag of hit.item.concernTags) bump(concern, tag);
  }
  for (const hit of filterCatalogItems(items, without('category'))) {
    if (hit.item.category) bump(category, hit.item.category);
  }
  for (const hit of filterCatalogItems(items, without('city'))) {
    bump(city, hit.item.city);
  }
  for (const hit of filterCatalogItems(items, without('variant.color'))) {
    if (hit.item.kind !== 'product') continue;
    // Count distinct color values among variants that satisfy other variant filters.
    const other: Record<string, string[]> = { ...(filter.variantSelections ?? {}) };
    delete other.color;
    const otherSel = Object.keys(other).length ? other : undefined;
    const seen = new Set<string>();
    for (const v of parseVariants(hit.item.variantsJson)) {
      if (!variantMatchesSelections(v, otherSel)) continue;
      if (filter.inStock === true && !variantInStock(hit.item, v)) continue;
      const c = v.selections.color;
      if (c && !seen.has(c)) {
        seen.add(c);
        bump(colors, c);
      }
    }
  }
  for (const hit of filterCatalogItems(items, without('variant.size'))) {
    if (hit.item.kind !== 'product') continue;
    const other: Record<string, string[]> = { ...(filter.variantSelections ?? {}) };
    delete other.size;
    const otherSel = Object.keys(other).length ? other : undefined;
    const seen = new Set<string>();
    for (const v of parseVariants(hit.item.variantsJson)) {
      if (!variantMatchesSelections(v, otherSel)) continue;
      if (filter.inStock === true && !variantInStock(hit.item, v)) continue;
      const s = v.selections.size;
      if (s && !seen.has(s)) {
        seen.add(s);
        bump(sizes, s);
      }
    }
  }
  for (const hit of filterCatalogItems(items, without('placeModes'))) {
    if (hit.item.placeMode) bump(placeMode, hit.item.placeMode);
  }

  const staleSelections: Array<{ field: string; value: string }> = [];
  const colorFacet = new Set(toBuckets(colors).map((b) => b.id));
  const sizeFacet = new Set(toBuckets(sizes).map((b) => b.id));
  for (const v of filter.variantSelections?.color ?? []) {
    if (!colorFacet.has(v)) staleSelections.push({ field: 'variant.color', value: v });
  }
  for (const v of filter.variantSelections?.size ?? []) {
    if (!sizeFacet.has(v)) staleSelections.push({ field: 'variant.size', value: v });
  }

  return {
    concern: toBuckets(concern),
    category: toBuckets(category),
    city: toBuckets(city),
    'variant.color': toBuckets(colors),
    'variant.size': toBuckets(sizes),
    placeMode: toBuckets(placeMode),
    staleSelections,
  };
}

/** Public option value ids present on a published product (for debugging / matrix docs). */
export function publicOptionValueIds(optionsJson: unknown, groupId: string): string[] {
  const group = parseOptionGroups(optionsJson).find((g) => g.id === groupId);
  return group ? group.values.map((v) => v.id) : [];
}
