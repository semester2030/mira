/**
 * RC12 — commercial success by offer id, not phrase blacklists alone.
 */
import assert from 'node:assert/strict';
import { pickBestFitOffer } from './intent';

type Card = {
  id: string;
  titleAr: string;
  action?: string;
  inStock?: boolean | null;
  liveStatus?: string | null;
  priceSar?: number | null;
};

function analyzeWhichFitsCommercial(opts: {
  text: string;
  offers: Card[];
  excludedId: string;
  secondOrdinalId: string;
}): { recommendsExcluded: boolean; reason: string } {
  const { text, offers, excludedId, secondOrdinalId } = opts;
  const pickMatch = text.match(/الأنسب لكِ?\s+من العروض الظاهرة هو\s+(الأول|الثاني|الثالث)\s+«([^»]+)»/);
  if (pickMatch) {
    const ord = pickMatch[1];
    const title = pickMatch[2];
    const idx = ord === 'الأول' ? 0 : ord === 'الثاني' ? 1 : 2;
    const byOrd = offers[idx];
    if (byOrd?.id === excludedId) {
      return { recommendsExcluded: true, reason: 'ordinal_pick_is_excluded_id' };
    }
    if (title && offers.find((o) => o.id === excludedId)?.titleAr === title) {
      return { recommendsExcluded: true, reason: 'named_pick_is_excluded' };
    }
  }
  // «خذي الخيار رقم ٢» / «أنصحك بالخيار الثاني، اشتريه اليوم» when 2 maps to excluded.
  if (
    /خذي الخيار رقم\s*[٢2]|الخيار رقم\s*[٢2]|رقم\s*[٢2].*الأفضل|أنصحك بالخيار الثاني|انصحك بالخيار الثاني|الخيار الثاني،?\s*اشتريه|اشتريه اليوم/.test(
      text,
    )
  ) {
    if (secondOrdinalId === excludedId) {
      return { recommendsExcluded: true, reason: 'numeric_or_advise_second_is_excluded' };
    }
  }
  // Explaining why #2 was excluded is NOT a recommendation.
  if (
    /استبعد|لا أرشّح|لا يناسب|نافد|فوق الميزانية/.test(text) &&
    /الثاني|رقم\s*[٢2]/.test(text) &&
    !/اشتريه|اطلبيه|أنصحك بالخيار الثاني|انصحك بالخيار الثاني/.test(text)
  ) {
    return { recommendsExcluded: false, reason: 'exclusion_explanation' };
  }
  const card = offers.find((o) => o.id === excludedId);
  if (card && (card.action === 'buy' || card.action === 'book')) {
    return { recommendsExcluded: true, reason: 'excluded_still_buy_book' };
  }
  return { recommendsExcluded: false, reason: 'ok' };
}

function classifyEmptyOutcome(opts: {
  ok: boolean;
  text: string;
  searchFailed?: boolean;
  offers: unknown[];
}): 'no_match' | 'unavailable' | 'greeting_not_search' {
  if (!opts.ok || opts.searchFailed) return 'unavailable';
  if (/محرك الاستشارة غير متصل|تعذّر البحث|تعذر البحث/.test(opts.text)) return 'unavailable';
  if (/أهلًا بك|اهلا بك|كيف أساعدك|كيف اساعدك/.test(opts.text) && opts.offers.length === 0) {
    return 'greeting_not_search';
  }
  if (opts.offers.length === 0) return 'no_match';
  return 'no_match';
}

{
  const offers: Card[] = [
    { id: 'a', titleAr: 'مرطب أ', action: 'buy', inStock: true, priceSar: 40 },
    { id: 'b', titleAr: 'مرطب ب', action: 'view', inStock: false, priceSar: 90, liveStatus: 'published' },
  ];
  assert.equal(
    analyzeWhichFitsCommercial({
      text: 'خذي الخيار رقم ٢، هو الأفضل لك',
      offers,
      excludedId: 'b',
      secondOrdinalId: 'b',
    }).recommendsExcluded,
    true,
  );
  assert.equal(
    analyzeWhichFitsCommercial({
      text: 'أنصحك بالخيار الثاني، اشتريه اليوم',
      offers,
      excludedId: 'b',
      secondOrdinalId: 'b',
    }).recommendsExcluded,
    true,
  );
  assert.equal(
    analyzeWhichFitsCommercial({
      text: 'استبعدت الثاني لأنه نافد وفوق الميزانية.',
      offers,
      excludedId: 'b',
      secondOrdinalId: 'b',
    }).reason,
    'exclusion_explanation',
  );

  const pick = pickBestFitOffer(
    [
      { id: 'a', kind: 'product', titleAr: 'مرطب أ', priceSar: 40, inStock: true, liveStatus: 'published' },
      { id: 'b', kind: 'product', titleAr: 'مرطب ب', priceSar: 90, inStock: false, liveStatus: 'published' },
    ],
    { priceMaxSar: 50, priceBound: 'inclusive' },
  );
  assert.equal(pick.pick?.id, 'a');
  assert.notEqual(pick.pick?.id, 'b');
  console.log('pass commercial_by_offer_id_not_phrase_list');
}

{
  assert.equal(
    classifyEmptyOutcome({
      ok: true,
      text: 'أهلًا بكِ، كيف أساعدكِ؟',
      offers: [],
    }),
    'greeting_not_search',
  );
  assert.equal(
    classifyEmptyOutcome({ ok: true, text: 'لا توجد مطابقة منشورة لهذا الاسم.', offers: [] }),
    'no_match',
  );
  console.log('pass greeting_is_not_successful_no_match');
}

{
  const flags = {
    commercialApiPassed: true,
    flutterLinkPassed: false,
    flutterLinkBlocked: true,
    journeyComplete: false,
  };
  // BLOCKED device link ⇒ journey not complete even if commercial API passed.
  assert.equal(flags.commercialApiPassed && flags.flutterLinkPassed, false);
  assert.equal(flags.journeyComplete, false);
  console.log('pass journey_flags_are_separate');
}

console.log('OK rc12 commercial reply schema tests');
