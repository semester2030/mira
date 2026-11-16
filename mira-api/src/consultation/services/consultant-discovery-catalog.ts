import {
  PRICE_UNSPECIFIED_AR,
  publishedPriceLabelAr,
  type PublishedCatalogOffer,
} from './consultation-scope';

/**
 * TEST-ONLY fixture catalog (RC5). Production / Ask Mira runtime must use
 * `ConsultantDiscoveryService` → `MarketplaceService.browse` — never this list.
 */
export const RC5_FIXTURE_OFFERS: PublishedCatalogOffer[] = [
  {
    id: 'rc5-prod-dew',
    titleAr: 'مرطب الندى',
    kind: 'product',
    priceSar: 49,
    inStock: true,
  },
  {
    id: 'rc5-prod-sun',
    titleAr: 'واقي شمس النهار',
    kind: 'product',
    priceSar: 79,
    inStock: false,
  },
  {
    id: 'rc5-svc-pearl',
    titleAr: 'جلسة تسريحة اللؤلؤ',
    kind: 'service',
    priceSar: 180,
    inStock: true,
  },
];

export type DiscoverySearchResult = {
  searchFailed: boolean;
  searchErrorAr?: string;
  offers: PublishedCatalogOffer[];
  outcome: 'matched' | 'no_match' | 'search_failed';
};

export type DiscoveryCardJson = {
  id: string;
  kind: string;
  titleAr: string;
  action: string;
  actionLabelAr: string;
  openPath: string;
  priceSar: number | null;
  priceLabelAr: string;
  inStock: boolean | null;
};

/** Build UI/API cards strictly from a published offer id — never invent fields. */
export function discoveryCardFromOffer(offer: PublishedCatalogOffer): DiscoveryCardJson | null {
  const id = String(offer.id ?? '').trim();
  const titleAr = String(offer.titleAr ?? '').trim();
  if (!id || !titleAr) return null;
  const kind = String(offer.kind ?? 'product');
  const isService = kind === 'service';
  return {
    id,
    kind,
    titleAr,
    action: isService ? 'book' : 'buy',
    actionLabelAr: isService ? 'احجزي' : 'اطلبي',
    openPath: `/${kind}/${id}`,
    priceSar: offer.priceSar ?? null,
    priceLabelAr: publishedPriceLabelAr(offer),
    inStock: offer.inStock ?? null,
  };
}

/**
 * Search the fixture catalog by Arabic keywords.
 * `forceFail` / empty catalog simulate «تعذّر البحث» vs «لم نجد مطابقًا».
 */
export function searchPublishedCatalog(
  queryAr: string,
  opts?: {
    catalog?: PublishedCatalogOffer[];
    forceFail?: boolean;
  },
): DiscoverySearchResult {
  if (opts?.forceFail) {
    return {
      searchFailed: true,
      searchErrorAr: 'تعذّر البحث في الكتالوج الآن — ليست نتيجة «لا مطابق».',
      offers: [],
      outcome: 'search_failed',
    };
  }
  const catalog = opts?.catalog ?? RC5_FIXTURE_OFFERS;
  const q = String(queryAr ?? '').trim();
  if (!q) {
    return { searchFailed: false, offers: [], outcome: 'no_match' };
  }

  const wantsService = /جلسة|تسريحة|خدمة|حجز|صبغة|مكياج/.test(q);
  const wantsProduct = /مرطب|كريم|سيروم|واقي|منتج|sunscreen|moisturizer/i.test(q);
  const wantsSun = /واقي|شمس|sunscreen|spf/i.test(q);
  const wantsMoist = /مرطب|ترطيب|moisturizer/i.test(q);
  const wantsPearl = /لؤلؤ|تسريحة|شعر/.test(q);

  const matched = catalog.filter((offer) => {
    const title = String(offer.titleAr ?? '');
    if (q.includes(title) || title.split(/\s+/).some((t) => t.length > 2 && q.includes(t))) {
      return true;
    }
    if (wantsPearl && offer.kind === 'service') return true;
    if (wantsSun && /واقي|شمس/.test(title)) return true;
    if (wantsMoist && /مرطب/.test(title)) return true;
    if (wantsService && offer.kind === 'service') return true;
    if (wantsProduct && offer.kind === 'product' && !wantsSun && !wantsMoist) return true;
    return false;
  });

  // Dedupe by id, cap 3.
  const seen = new Set<string>();
  const offers: PublishedCatalogOffer[] = [];
  for (const offer of matched) {
    const id = String(offer.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    offers.push(offer);
    if (offers.length >= 3) break;
  }

  if (!offers.length) {
    return {
      searchFailed: false,
      offers: [],
      outcome: 'no_match',
      searchErrorAr: 'لم نجد مطابقًا في الكتالوج المنشور.',
    };
  }
  return { searchFailed: false, offers, outcome: 'matched' };
}

export function outcomeMessageAr(result: DiscoverySearchResult): string {
  if (result.outcome === 'search_failed') {
    return result.searchErrorAr ?? 'تعذّر البحث في الكتالوج الآن.';
  }
  if (result.outcome === 'no_match') {
    return result.searchErrorAr ?? 'لم نجد مطابقًا في الكتالوج المنشور.';
  }
  const lines = result.offers.map((o) => {
    const card = discoveryCardFromOffer(o);
    const stock =
      o.inStock === false ? 'غير متوفر' : o.inStock === true ? 'متوفر' : 'التوفر غير مذكور';
    const price = card?.priceLabelAr ?? PRICE_UNSPECIFIED_AR;
    return `• ${o.titleAr} — ${price} — ${stock}`;
  });
  return ['من كتالوج ميرا المنشور:', ...lines].join('\n');
}
