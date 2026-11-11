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

import { isValidDateKey, parseOptionGroups, parseVariants, type ProductVariant } from './commerce.types';
import { resolveSaudiCity } from '../geo/saudi-cities';

/** Match city filter against stored id or Arabic/English name. */
export function citiesEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const ra = resolveSaudiCity(left);
  const rb = resolveSaudiCity(right);
  if (ra && rb) return ra.id === rb.id;
  if (ra && (ra.id === right || ra.nameAr === right || ra.nameEn.toLowerCase() === right.toLowerCase())) {
    return true;
  }
  if (rb && (rb.id === left || rb.nameAr === left || rb.nameEn.toLowerCase() === left.toLowerCase())) {
    return true;
  }
  return false;
}

/** True when coverage list includes the filter city (id or display name). */
export function coverageIncludesCity(
  coverageCityIds: string[] | null | undefined,
  filterCity: string,
): boolean {
  const ids = Array.isArray(coverageCityIds) ? coverageCityIds : [];
  if (!ids.length) return false;
  return ids.some((id) => citiesEquivalent(id, filterCity));
}

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

export type CatalogSort = 'key' | 'price_asc' | 'price_desc' | 'distance';

export type CatalogFilterInput = {
  q?: string;
  tags?: string[];
  category?: string;
  /** Exact saved subcategory node id (never browseOnly *.all as a product value). */
  subcategory?: string;
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
  /** Partner branch ids from serviceProfileJson.answers.branchId when present. */
  branchIds?: string[];
  /**
   * Attribute filters (OR within one key, AND across keys).
   * Example: { shoeUsage: ['formal','daily'] }.
   */
  attributeSelections?: Record<string, string[]>;
  /**
   * Children age filter in months (inclusive bounds on ageMinMonths/ageMaxMonths).
   * Products missing both bounds are excluded when this filter is set.
   */
  ageMonths?: number;
  /** When true, only products with attributes.giftEligible === true (cross-list). */
  giftEligible?: boolean;
  /** Discover lane — gifts lane expands match to giftEligible without duplicating rows. */
  lane?: string;
  /**
   * Resolved from central taxonomy when `subcategory` is set (browse enrichment).
   * Drives service vs product matching — never infer lane from partner type or title.
   */
  taxonomyNode?: {
    id: string;
    lane: string;
    category: string;
    profileId: string | null;
    offerKind: 'product' | 'service' | null;
  };
  /** Local Asia/Riyadh date YYYY-MM-DD — calendar day must not be closed/unconfigured. */
  availableOn?: string;
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
  subcategory?: string | null;
  /** Registry / taxonomy profile id when persisted (services + products). */
  profileId?: string | null;
  concernTags: string[];
  priceHalalas: number | null;
  durationMin?: number | null;
  placeMode?: string | null;
  branchId?: string | null;
  /** Branch coordinates for distance sort (services only). */
  lat?: number | null;
  lng?: number | null;
  /** Populated when sorting by distance; approximate km. */
  distanceKm?: number | null;
  /** Home coverage city ids when placeMode=home. */
  coverageCityIds?: string[] | null;
  /** Raw availability document for calendar-day eligibility (services). */
  availabilityJson?: unknown;
  /**
   * Precomputed: true when ≥1 bookable slot exists on availableOn (same rules as booking listing).
   * False when booking disabled, full, duration unfit, capacity conflict, or no open slot.
   */
  availableOnDay?: boolean | null;
  bookingEnabled?: boolean;
  optionsJson?: unknown;
  variantsJson?: unknown;
  /** Product-level sellable qty; null = untracked. */
  stockQty?: number | null;
  stockAvailable?: boolean;
  inventoryMode?: string;
  /** variantId → sellable qty (null = untracked). Absent ids treated as unavailable when mode=variant. */
  variantSellable?: Record<string, number | null>;
  /** Product attributesJson projection for attribute facets/filters (e.g. shoeUsage). */
  attributesJson?: Record<string, unknown> | null;
};

export type MatchedVariant = {
  variantId: string;
  /** Effective unit price after product inheritance (null only when both variant and product unknown). */
  priceHalalas: number | null;
  /** True when price came from the product base (variant had no own price). */
  priceInherited: boolean;
  selections: Record<string, string>;
};

export type CatalogFilterMatch = {
  item: CatalogFilterItem;
  matchedVariants: MatchedVariant[];
  /** Price used for sort/display for this match (variant override or item). */
  effectivePriceHalalas: number | null;
};

/** Coerce Nest/query values that may arrive as string | string[] into one CSV string (OR-merge). */
export function coerceQueryParam(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    const parts = raw
      .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts.join(',') : undefined;
  }
  return undefined;
}

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
  if (sortRaw !== 'key' && sortRaw !== 'price_asc' && sortRaw !== 'price_desc' && sortRaw !== 'distance') {
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

  const availableOn = (params.availableOn ?? '').trim();
  if (availableOn && !isValidDateKey(availableOn)) {
    return { ok: false, reason: 'invalid_available_on', messageAr: 'تاريخ الإتاحة غير صالح (YYYY-MM-DD)' };
  }

  const attributeSelections: Record<string, string[]> = {};
  for (const key of [
    'shoeUsage',
    'carryStyle',
    'occasion',
    'material',
    'metal',
    'purityKarat',
    'purity',
    'occasionType',
    'occasionTypeIds',
    'occasionServiceOffer',
    'eventType',
  ] as const) {
    const values = splitCsv(params[key] ?? params[`attributes.${key}`]);
    if (values.length) {
      // Accept purity as alias for purityKarat; occasionType/eventType → occasionTypeIds.
      let storeKey: string = key;
      if (key === 'purity') storeKey = 'purityKarat';
      else if (key === 'occasionType' || key === 'eventType') storeKey = 'occasionTypeIds';
      attributeSelections[storeKey] = [...new Set([...(attributeSelections[storeKey] ?? []), ...values])];
    }
  }

  const ageRaw = (params.ageMonths ?? '').trim();
  let ageMonths: number | undefined;
  if (ageRaw) {
    const n = Number(ageRaw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { ok: false, reason: 'invalid_age_months', messageAr: 'عمر غير صالح' };
    }
    ageMonths = n;
  }

  const giftRaw = (params.giftEligible ?? '').trim().toLowerCase();
  let giftEligible: boolean | undefined;
  if (giftRaw === '1' || giftRaw === 'true') giftEligible = true;
  else if (giftRaw === '0' || giftRaw === 'false') giftEligible = false;
  else if (giftRaw) {
    return { ok: false, reason: 'invalid_gift_eligible', messageAr: 'قيمة أهلية الإهداء غير صالحة' };
  }

  // ringSize as variant option (same-combo as color/size).
  const ringSizes = splitCsv(params['variant.ringSize'] ?? params.ringSize);
  if (ringSizes.length) {
    variantSelections.ringSize = [...new Set([...(variantSelections.ringSize ?? []), ...ringSizes])];
  }

  return {
    ok: true,
    filter: {
      q: (params.q ?? '').trim() || undefined,
      tags: splitCsv(params.tag),
      category: (params.category ?? '').trim() || undefined,
      subcategory: (params.subcategory ?? '').trim() || undefined,
      city: (params.city ?? '').trim() || undefined,
      partnerId: (params.partnerId ?? '').trim() || undefined,
      kind: kindRaw ? (kindRaw as 'product' | 'service') : undefined,
      variantSelections: Object.keys(variantSelections).length ? variantSelections : undefined,
      attributeSelections: Object.keys(attributeSelections).length ? attributeSelections : undefined,
      ageMonths,
      giftEligible,
      lane: (params.lane ?? '').trim() || undefined,
      inStock,
      priceMinHalalas: priceMin,
      priceMaxHalalas: priceMax,
      durationMin,
      durationMax,
      placeModes: splitCsv(params.placeMode),
      branchIds: splitCsv(params.branch ?? params.branchId),
      availableOn: availableOn || undefined,
      sort: sortRaw as CatalogSort,
    },
  };
}

/**
 * Effective attribute values for matching/facets.
 * Dual-read: legacy scalar `eventType` participates as occasionTypeIds when the new array is absent.
 */
export function effectiveAttributeValues(
  attributesJson: Record<string, unknown> | null | undefined,
  key: string,
): string[] {
  const attrs = attributesJson && typeof attributesJson === 'object' ? attributesJson : {};
  const raw = (attrs as Record<string, unknown>)[key];
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (raw != null && raw !== '') return [String(raw)];
  if (key === 'occasionTypeIds') {
    const legacy = (attrs as Record<string, unknown>).eventType;
    if (Array.isArray(legacy)) return legacy.map((x) => String(x)).filter(Boolean);
    if (legacy != null && legacy !== '') return [String(legacy)];
  }
  return [];
}

/** Attribute value match: scalar string or array contains any selected id (OR within field). */
export function attributesMatchSelections(
  attributesJson: Record<string, unknown> | null | undefined,
  selections: Record<string, string[]> | undefined,
): boolean {
  if (!selections || Object.keys(selections).length === 0) return true;
  for (const [key, wanted] of Object.entries(selections)) {
    if (!wanted.length) continue;
    const have = effectiveAttributeValues(attributesJson, key);
    if (!wanted.some((w) => have.includes(w))) return false;
  }
  return true;
}

/** Effective sell price for a variant: own price, else product base, else null (unknown). */
export function effectiveVariantPrice(
  variant: ProductVariant,
  item: Pick<CatalogFilterItem, 'priceHalalas'>,
): { priceHalalas: number | null; inherited: boolean } {
  if (variant.priceHalalas != null) return { priceHalalas: variant.priceHalalas, inherited: false };
  return { priceHalalas: item.priceHalalas, inherited: item.priceHalalas != null };
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

function profileAnswers(profileJson: unknown): Record<string, unknown> | null {
  if (!profileJson || typeof profileJson !== 'object' || Array.isArray(profileJson)) return null;
  const answers = (profileJson as { answers?: unknown }).answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  return answers as Record<string, unknown>;
}

function extractPlaceMode(profileJson: unknown): string | null {
  const answers = profileAnswers(profileJson);
  if (!answers) return null;
  const raw = answers.placeMode ?? answers.place_mode;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function extractBranchId(profileJson: unknown): string | null {
  const answers = profileAnswers(profileJson);
  if (!answers) return null;
  const raw = answers.branchId ?? answers.branch_id;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function placeModeFromServiceProfile(profileJson: unknown): string | null {
  return extractPlaceMode(profileJson);
}

export function branchIdFromServiceProfile(profileJson: unknown): string | null {
  return extractBranchId(profileJson);
}

/** Whether a public variant passes stock + price constraints for the active filter. */
export function variantPassesCommerceConstraints(
  item: CatalogFilterItem,
  variant: ProductVariant,
  filter: CatalogFilterInput,
): boolean {
  if (!variant.available) return false;
  if (filter.inStock === true && !variantInStock(item, variant)) return false;
  if (filter.inStock === false && variantInStock(item, variant)) return false;
  const { priceHalalas } = effectiveVariantPrice(variant, item);
  return priceInRange(priceHalalas, filter.priceMinHalalas, filter.priceMaxHalalas);
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
  if (filter.city) {
    // Home services: coverage only — never fall back to partner HQ / branch city.
    if (item.kind === 'service' && item.placeMode === 'home') {
      if (!coverageIncludesCity(item.coverageCityIds, filter.city)) return null;
    } else if (!citiesEquivalent(item.city, filter.city)) {
      return null;
    }
  }
  if (filter.category && item.category !== filter.category) {
    // Gifts lane may still match via giftEligible when category differs (cross-list).
    const giftsCross =
      filter.lane === 'gifts' &&
      item.kind === 'product' &&
      item.attributesJson?.giftEligible === true;
    if (!giftsCross) return null;
  }
  // Subcategory: products match persisted id; service leaves match taxonomy profile/category.
  if (filter.subcategory) {
    const node = filter.taxonomyNode;
    if (item.kind === 'product') {
      if (node?.offerKind === 'service') return null;
      if (item.subcategory !== filter.subcategory) return null;
    } else {
      if (!node || node.offerKind !== 'service') return null;
      const byProfile = !!node.profileId && item.profileId === node.profileId;
      const byCategory = !!node.category && item.category === node.category;
      const bySub = item.subcategory === filter.subcategory;
      if (!byProfile && !byCategory && !bySub) return null;
    }
  }
  if (filter.attributeSelections && Object.keys(filter.attributeSelections).length > 0) {
    // Products and services (occasions) both carry attributesJson for facet filters.
    if (!attributesMatchSelections(item.attributesJson, filter.attributeSelections)) return null;
  }
  if (filter.giftEligible === true) {
    if (item.kind !== 'product' || item.attributesJson?.giftEligible !== true) return null;
  }
  if (filter.giftEligible === false) {
    if (item.kind === 'product' && item.attributesJson?.giftEligible === true) return null;
  }
  // Lane membership by taxonomy ids — never by partner type or service title.
  if (filter.lane === 'occasions' && !filter.category && !filter.subcategory) {
    if (item.kind === 'product') {
      const cat = String(item.category || '');
      const sub = String(item.subcategory || '');
      const native =
        cat === 'occasions' || cat.startsWith('occasions') || sub.startsWith('occasions.');
      if (!native) return null;
    } else {
      const cat = String(item.category || '');
      const ok = cat === 'occasions' || item.profileId === 'service.occasions';
      if (!ok) return null;
    }
  }
  // Gifts lane without explicit category: native gifts.* OR giftEligible cross-list.
  if (filter.lane === 'gifts' && !filter.category && !filter.subcategory && item.kind === 'product') {
    const cat = String(item.category || '');
    const native = cat === 'gifts' || cat.startsWith('gifts');
    const eligible = item.attributesJson?.giftEligible === true;
    if (!native && !eligible) return null;
  }
  if (filter.ageMonths != null) {
    if (item.kind !== 'product') return null;
    const minRaw = item.attributesJson?.ageMinMonths;
    const maxRaw = item.attributesJson?.ageMaxMonths;
    const min = typeof minRaw === 'number' ? minRaw : Number(minRaw);
    const max = typeof maxRaw === 'number' ? maxRaw : Number(maxRaw);
    const hasMin = Number.isFinite(min);
    const hasMax = Number.isFinite(max);
    // Unknown age → exclude when age filter is active (spec: مجهول العمر يُستبعد من نتيجة هذا الفلتر فقط).
    if (!hasMin && !hasMax) return null;
    if (hasMin && filter.ageMonths < min) return null;
    if (hasMax && filter.ageMonths > max) return null;
  }

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
    if (filter.branchIds && filter.branchIds.length > 0) {
      if (!item.branchId || !filter.branchIds.includes(item.branchId)) return null;
    }
    if (filter.durationMin != null || filter.durationMax != null) {
      if (item.durationMin == null) return null;
      if (filter.durationMin != null && item.durationMin < filter.durationMin) return null;
      if (filter.durationMax != null && item.durationMin > filter.durationMax) return null;
    }
    if (!priceInRange(item.priceHalalas, filter.priceMinHalalas, filter.priceMaxHalalas)) return null;
    if (filter.availableOn) {
      // availableOnDay is precomputed from the same calendar document used by booking.
      if (item.availableOnDay !== true) return null;
    }
    if (filter.inStock === true) {
      // Services: inStock is not applicable; ignore rather than invent availability.
    }
    return { item, matchedVariants: [], effectivePriceHalalas: item.priceHalalas };
  }

  // Product path — service-only filters do not apply.
  if (filter.placeModes && filter.placeModes.length > 0) return null;
  if (filter.branchIds && filter.branchIds.length > 0) return null;
  if (filter.durationMin != null || filter.durationMax != null) return null;
  if (filter.availableOn) return null;

  const variants = parseVariants(item.variantsJson);
  const hasVariantFilters = Object.keys(filter.variantSelections ?? {}).length > 0;
  const needsVariantScope =
    hasVariantFilters ||
    filter.priceMinHalalas != null ||
    filter.priceMaxHalalas != null ||
    filter.inStock != null;

  if (variants.length > 0) {
    const matched: MatchedVariant[] = [];
    for (const variant of variants) {
      if (hasVariantFilters && !variantMatchesSelections(variant, filter.variantSelections)) continue;
      if (!variantPassesCommerceConstraints(item, variant, filter)) continue;
      const priced = effectiveVariantPrice(variant, item);
      matched.push({
        variantId: variant.id,
        priceHalalas: priced.priceHalalas,
        priceInherited: priced.inherited,
        selections: { ...variant.selections },
      });
    }
    if (needsVariantScope && matched.length === 0) return null;
    if (!needsVariantScope) {
      // Unconstrained browse: display/sort representative = lowest known eligible price («ابتداءً من»).
      const available = variants.filter((v) => v.available);
      const prices = available
        .map((v) => effectiveVariantPrice(v, item).priceHalalas)
        .filter((p): p is number => p != null);
      const effective = prices.length ? Math.min(...prices) : item.priceHalalas;
      return { item, matchedVariants: [], effectivePriceHalalas: effective };
    }
    // Matched set: representative price is always the minimum known matched price (sort direction
    // uses a separate key in sortCatalogMatches; it must not change the displayed amount).
    const prices = matched.map((m) => m.priceHalalas).filter((p): p is number => p != null);
    const effective = prices.length ? Math.min(...prices) : null;
    return { item, matchedVariants: matched, effectivePriceHalalas: effective };
  }

  // No variants — product-level price/stock only. Variant filters cannot match.
  if (hasVariantFilters) return null;
  if (!priceInRange(item.priceHalalas, filter.priceMinHalalas, filter.priceMaxHalalas)) return null;
  if (filter.inStock === true && item.stockAvailable === false) return null;
  if (filter.inStock === false && item.stockAvailable !== false) return null;

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

/** Internal sort key: for price_desc use max known eligible price without mutating display («ابتداءً من» min). */
function sortPriceKey(m: CatalogFilterMatch, sort: CatalogSort): number | null {
  if (sort !== 'price_desc') return m.effectivePriceHalalas;
  const fromMatched = m.matchedVariants
    .map((v) => v.priceHalalas)
    .filter((p): p is number => p != null);
  if (fromMatched.length) return Math.max(...fromMatched);
  if (m.item.kind === 'product') {
    const variants = parseVariants(m.item.variantsJson).filter((v) => v.available);
    const prices = variants
      .map((v) => effectiveVariantPrice(v, m.item).priceHalalas)
      .filter((p): p is number => p != null);
    if (prices.length) return Math.max(...prices);
  }
  return m.effectivePriceHalalas;
}

export function sortCatalogMatches(matches: CatalogFilterMatch[], sort: CatalogSort): CatalogFilterMatch[] {
  const key = (m: CatalogFilterMatch) => `${m.item.kind}:${m.item.id}`;
  const copy = [...matches];
  copy.sort((a, b) => {
    if (sort === 'distance') {
      const aDist = a.item.kind === 'service' ? a.item.distanceKm : null;
      const bDist = b.item.kind === 'service' ? b.item.distanceKm : null;
      if (aDist == null && bDist != null) return 1;
      if (aDist != null && bDist == null) return -1;
      if (aDist != null && bDist != null && aDist !== bDist) return aDist - bDist;
    }
    if (sort === 'price_asc' || sort === 'price_desc') {
      const ap = sortPriceKey(a, sort);
      const bp = sortPriceKey(b, sort);
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

export type FacetBucket = { id: string; labelAr?: string; count: number; swatchHex?: string | null };
export type CatalogFacets = {
  /** Facet counts exclude the field's own filter and apply the rest (standard faceted search). */
  concern: FacetBucket[];
  category: FacetBucket[];
  city: FacetBucket[];
  'variant.color': FacetBucket[];
  'variant.size': FacetBucket[];
  'variant.volume': FacetBucket[];
  shoeUsage: FacetBucket[];
  occasionType: FacetBucket[];
  occasionServiceOffer: FacetBucket[];
  placeMode: FacetBucket[];
  branch: FacetBucket[];
  staleSelections: Array<{ field: string; value: string }>;
};

function bump(map: Map<string, number>, id: string) {
  if (!id) return;
  map.set(id, (map.get(id) ?? 0) + 1);
}

function toBuckets(
  map: Map<string, number>,
  labels?: Map<string, { labelAr?: string; swatchHex?: string | null }>,
): FacetBucket[] {
  return [...map.entries()]
    .map(([id, count]) => ({
      id,
      count,
      ...(labels?.get(id)?.labelAr ? { labelAr: labels.get(id)!.labelAr } : {}),
      ...(labels?.get(id)?.swatchHex != null ? { swatchHex: labels.get(id)!.swatchHex } : {}),
    }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

function collectOptionMeta(items: readonly CatalogFilterItem[], groupId: string) {
  const meta = new Map<string, { labelAr?: string; swatchHex?: string | null }>();
  for (const item of items) {
    if (!Array.isArray(item.optionsJson)) continue;
    for (const raw of item.optionsJson) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const group = raw as { id?: unknown; values?: unknown };
      if (group.id !== groupId || !Array.isArray(group.values)) continue;
      for (const value of group.values) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const row = value as { id?: unknown; labelAr?: unknown; swatchHex?: unknown };
        if (typeof row.id !== 'string' || !row.id || meta.has(row.id)) continue;
        meta.set(row.id, {
          labelAr: typeof row.labelAr === 'string' ? row.labelAr : row.id,
          swatchHex: typeof row.swatchHex === 'string' ? row.swatchHex : null,
        });
      }
    }
  }
  return meta;
}

/**
 * Count offers (not variants) that would match if `valueId` were the sole selection for `groupId`,
 * with all other filters held constant. Used so facet count == result count for a single-value pick.
 */
function countOffersForVariantValue(
  items: readonly CatalogFilterItem[],
  filter: CatalogFilterInput,
  groupId: string,
  valueId: string,
): number {
  const selections: Record<string, string[]> = { ...(filter.variantSelections ?? {}) };
  selections[groupId] = [valueId];
  return filterCatalogItems(items, { ...filter, variantSelections: selections }).length;
}

/** Build facet counts: for each facet field, apply all filters except that field. Counts are offers. */
export function buildCatalogFacets(
  items: readonly CatalogFilterItem[],
  filter: CatalogFilterInput,
): CatalogFacets {
  const without = (
    omit:
      | keyof CatalogFilterInput
      | 'variant.color'
      | 'variant.size'
      | 'variant.volume'
      | 'variant'
      | 'shoeUsage'
      | 'occasionType'
      | 'occasionServiceOffer',
  ): CatalogFilterInput => {
    if (
      omit === 'variant.color' ||
      omit === 'variant.size' ||
      omit === 'variant.volume' ||
      omit === 'variant'
    ) {
      const selections: Record<string, string[]> = { ...(filter.variantSelections ?? {}) };
      if (omit === 'variant.color') delete selections.color;
      else if (omit === 'variant.size') delete selections.size;
      else if (omit === 'variant.volume') delete selections.volume;
      else {
        for (const key of Object.keys(selections)) delete selections[key];
      }
      const next: CatalogFilterInput = { ...filter };
      next.variantSelections = Object.keys(selections).length > 0 ? selections : undefined;
      return next;
    }
    if (omit === 'shoeUsage' || omit === 'occasionType' || omit === 'occasionServiceOffer') {
      const attrs: Record<string, string[]> = { ...(filter.attributeSelections ?? {}) };
      if (omit === 'shoeUsage') delete attrs.shoeUsage;
      if (omit === 'occasionType') delete attrs.occasionTypeIds;
      if (omit === 'occasionServiceOffer') delete attrs.occasionServiceOffer;
      const next: CatalogFilterInput = { ...filter };
      next.attributeSelections = Object.keys(attrs).length ? attrs : undefined;
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
  const volumes = new Map<string, number>();
  const shoeUsage = new Map<string, number>();
  const occasionType = new Map<string, number>();
  const occasionServiceOffer = new Map<string, number>();
  const placeMode = new Map<string, number>();
  const branch = new Map<string, number>();

  for (const hit of filterCatalogItems(items, without('tags'))) {
    const seen = new Set<string>();
    for (const tag of hit.item.concernTags) {
      if (seen.add(tag)) bump(concern, tag);
    }
  }
  for (const hit of filterCatalogItems(items, without('category'))) {
    if (hit.item.category) bump(category, hit.item.category);
  }
  for (const hit of filterCatalogItems(items, without('city'))) {
    bump(city, hit.item.city);
  }

  // Candidate value ids from options that survive the rest of the filter (color field omitted).
  const colorCandidates = new Set<string>();
  for (const hit of filterCatalogItems(items, without('variant.color'))) {
    if (hit.item.kind !== 'product') continue;
    const other: Record<string, string[]> = { ...(filter.variantSelections ?? {}) };
    delete other.color;
    const otherSel = Object.keys(other).length ? other : undefined;
    for (const v of parseVariants(hit.item.variantsJson)) {
      if (!variantMatchesSelections(v, otherSel)) continue;
      if (!variantPassesCommerceConstraints(hit.item, v, { ...filter, variantSelections: otherSel })) continue;
      if (v.selections.color) colorCandidates.add(v.selections.color);
    }
  }
  for (const valueId of colorCandidates) {
    const n = countOffersForVariantValue(items, without('variant.color'), 'color', valueId);
    if (n > 0) colors.set(valueId, n);
  }

  const sizeCandidates = new Set<string>();
  for (const hit of filterCatalogItems(items, without('variant.size'))) {
    if (hit.item.kind !== 'product') continue;
    const other: Record<string, string[]> = { ...(filter.variantSelections ?? {}) };
    delete other.size;
    const otherSel = Object.keys(other).length ? other : undefined;
    for (const v of parseVariants(hit.item.variantsJson)) {
      if (!variantMatchesSelections(v, otherSel)) continue;
      if (!variantPassesCommerceConstraints(hit.item, v, { ...filter, variantSelections: otherSel })) continue;
      if (v.selections.size) sizeCandidates.add(v.selections.size);
    }
  }
  for (const valueId of sizeCandidates) {
    const n = countOffersForVariantValue(items, without('variant.size'), 'size', valueId);
    if (n > 0) sizes.set(valueId, n);
  }

  const volumeCandidates = new Set<string>();
  for (const hit of filterCatalogItems(items, without('variant.volume'))) {
    if (hit.item.kind !== 'product') continue;
    const other: Record<string, string[]> = { ...(filter.variantSelections ?? {}) };
    delete other.volume;
    const otherSel = Object.keys(other).length ? other : undefined;
    for (const v of parseVariants(hit.item.variantsJson)) {
      if (!variantMatchesSelections(v, otherSel)) continue;
      if (!variantPassesCommerceConstraints(hit.item, v, { ...filter, variantSelections: otherSel })) continue;
      if (v.selections.volume) volumeCandidates.add(v.selections.volume);
    }
  }
  for (const valueId of volumeCandidates) {
    const n = countOffersForVariantValue(items, without('variant.volume'), 'volume', valueId);
    if (n > 0) volumes.set(valueId, n);
  }

  for (const hit of filterCatalogItems(items, without('shoeUsage'))) {
    if (hit.item.kind !== 'product') continue;
    const raw = hit.item.attributesJson?.shoeUsage;
    const vals = Array.isArray(raw) ? raw : raw == null || raw === '' ? [] : [raw];
    for (const v of vals) bump(shoeUsage, String(v));
  }

  for (const hit of filterCatalogItems(items, without('occasionType'))) {
    for (const v of effectiveAttributeValues(hit.item.attributesJson, 'occasionTypeIds')) {
      bump(occasionType, v);
    }
  }
  for (const hit of filterCatalogItems(items, without('occasionServiceOffer'))) {
    for (const v of effectiveAttributeValues(hit.item.attributesJson, 'occasionServiceOffer')) {
      bump(occasionServiceOffer, v);
    }
  }

  for (const hit of filterCatalogItems(items, without('placeModes'))) {
    if (hit.item.placeMode) bump(placeMode, hit.item.placeMode);
  }
  for (const hit of filterCatalogItems(items, without('branchIds'))) {
    if (hit.item.branchId) bump(branch, hit.item.branchId);
  }

  const colorMeta = collectOptionMeta(items, 'color');
  const sizeMeta = collectOptionMeta(items, 'size');
  const volumeMeta = collectOptionMeta(items, 'volume');
  const shoeUsageLabels = new Map<string, { labelAr?: string }>([
    ['formal', { labelAr: 'رسمي' }],
    ['daily', { labelAr: 'يومي' }],
    ['occasions', { labelAr: 'مناسبات' }],
  ]);
  const occasionTypeLabels = new Map<string, { labelAr?: string }>([
    ['wedding', { labelAr: 'زفاف' }],
    ['graduation', { labelAr: 'تخرج' }],
    ['birthday', { labelAr: 'ميلاد' }],
    ['baby_shower', { labelAr: 'احتفال بالمولود' }],
    ['private', { labelAr: 'مناسبة خاصة' }],
  ]);
  const occasionServiceOfferLabels = new Map<string, { labelAr?: string }>([
    ['full_planning', { labelAr: 'تنظيم كامل' }],
    ['styling_decor', { labelAr: 'تنسيق وديكور' }],
    ['hospitality', { labelAr: 'ضيافة' }],
  ]);

  const staleSelections: Array<{ field: string; value: string }> = [];
  const colorFacet = new Set(toBuckets(colors).map((b) => b.id));
  const sizeFacet = new Set(toBuckets(sizes).map((b) => b.id));
  const volumeFacet = new Set(toBuckets(volumes).map((b) => b.id));
  const shoeUsageFacet = new Set(toBuckets(shoeUsage).map((b) => b.id));
  const occasionTypeFacet = new Set(toBuckets(occasionType).map((b) => b.id));
  const occasionServiceOfferFacet = new Set(toBuckets(occasionServiceOffer).map((b) => b.id));
  for (const v of filter.variantSelections?.color ?? []) {
    if (!colorFacet.has(v)) staleSelections.push({ field: 'variant.color', value: v });
  }
  for (const v of filter.variantSelections?.size ?? []) {
    if (!sizeFacet.has(v)) staleSelections.push({ field: 'variant.size', value: v });
  }
  for (const v of filter.variantSelections?.volume ?? []) {
    if (!volumeFacet.has(v)) staleSelections.push({ field: 'variant.volume', value: v });
  }
  for (const v of filter.attributeSelections?.shoeUsage ?? []) {
    if (!shoeUsageFacet.has(v)) staleSelections.push({ field: 'shoeUsage', value: v });
  }
  for (const v of filter.attributeSelections?.occasionTypeIds ?? []) {
    if (!occasionTypeFacet.has(v)) staleSelections.push({ field: 'occasionType', value: v });
  }
  for (const v of filter.attributeSelections?.occasionServiceOffer ?? []) {
    if (!occasionServiceOfferFacet.has(v)) staleSelections.push({ field: 'occasionServiceOffer', value: v });
  }

  return {
    concern: toBuckets(concern),
    category: toBuckets(category),
    city: toBuckets(city),
    'variant.color': toBuckets(colors, colorMeta),
    'variant.size': toBuckets(sizes, sizeMeta),
    'variant.volume': toBuckets(volumes, volumeMeta),
    shoeUsage: toBuckets(shoeUsage, shoeUsageLabels),
    occasionType: toBuckets(occasionType, occasionTypeLabels),
    occasionServiceOffer: toBuckets(occasionServiceOffer, occasionServiceOfferLabels),
    placeMode: toBuckets(placeMode),
    branch: toBuckets(branch),
    staleSelections,
  };
}

/** Public option value ids present on a published product (for debugging / matrix docs). */
export function publicOptionValueIds(optionsJson: unknown, groupId: string): string[] {
  const group = parseOptionGroups(optionsJson).find((g) => g.id === groupId);
  return group ? group.values.map((v) => v.id) : [];
}
