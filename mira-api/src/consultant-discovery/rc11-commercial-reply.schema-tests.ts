/**
 * RC11 — commercial reply must fail closed even without «ضمن ميزانيتكِ».
 */
import assert from 'node:assert/strict';

function commerciallyRecommendsExcluded(
  text: string,
  offers: Array<{ id: string; action?: string; actionLabelAr?: string }>,
  targetId: string,
  targetTitle: string,
  ordinalIndex: number,
): string | null {
  const hit = offers.find((o) => o.id === targetId);
  if (hit && (hit.action === 'buy' || hit.actionLabelAr === 'اطلبي')) {
    return 'buy_cta';
  }
  const recommendsOrdinal =
    ordinalIndex === 1 &&
    /أرشح لكِ?\s*الثاني|الأنسب لكِ?\s*.*الثاني|اطلبيه|اطلبي الثاني|الثاني، اطلبيه/.test(text);
  const namesTarget =
    targetTitle.length >= 6 &&
    text.includes(targetTitle.slice(0, Math.min(18, targetTitle.length))) &&
    /أرشح|الأنسب|اطلبي|اطلبيه|ضمن ميزانيتك/.test(text);
  if (recommendsOrdinal || namesTarget) return 'recommend_text';
  return null;
}

{
  const bad =
    'أرشح لكِ الثاني، اطلبيه الآن — يناسبكِ.';
  assert.equal(
    commerciallyRecommendsExcluded(bad, [{ id: 't2', action: 'view' }], 't2', 'مرطب RC11 ثاني', 1),
    'recommend_text',
  );
  assert.equal(
    commerciallyRecommendsExcluded(
      'لا أجد خيارًا يناسب قيودكِ.',
      [{ id: 't2', action: 'view', actionLabelAr: 'عرض التفاصيل' }],
      't2',
      'مرطب RC11 ثاني',
      1,
    ),
    null,
  );
  assert.equal(
    commerciallyRecommendsExcluded(
      'مقارنة عامة',
      [{ id: 't2', action: 'buy', actionLabelAr: 'اطلبي' }],
      't2',
      'مرطب',
      1,
    ),
    'buy_cta',
  );
  console.log('pass commercial_reply_fail_closed_without_budget_phrase');
}

function stockIsExplicitlyOut(item: Record<string, unknown>): boolean | null {
  if (typeof item.stockAvailable === 'boolean') return item.stockAvailable === false;
  if (typeof item.inStock === 'boolean') return item.inStock === false;
  if (item.stockQty != null && Number.isFinite(Number(item.stockQty))) {
    return Number(item.stockQty) <= 0;
  }
  return null;
}

{
  assert.equal(stockIsExplicitlyOut({ priceHalalas: 9000 }), null);
  assert.equal(stockIsExplicitlyOut({ stockAvailable: false }), true);
  assert.equal(stockIsExplicitlyOut({ stockQty: 0 }), true);
  assert.equal(stockIsExplicitlyOut({ stockAvailable: true }), false);
  console.log('pass stock_missing_is_not_proof');
}

function classifySearchOutcome(opts: {
  ok: boolean;
  kind?: string;
  text?: string;
  searchFailed?: boolean;
  offers: Array<{ id: string }>;
  withdrawnId: string;
}): 'no_match' | 'unavailable' | 'still_recommends' {
  if (!opts.ok || opts.kind === 'engine_down' || opts.kind === 'empty' || opts.searchFailed) {
    return 'unavailable';
  }
  if (/محرك الاستشارة غير متصل/.test(opts.text ?? '')) return 'unavailable';
  if (opts.offers.some((o) => o.id === opts.withdrawnId)) return 'still_recommends';
  return 'no_match';
}

{
  assert.equal(
    classifySearchOutcome({
      ok: true,
      text: 'محرك الاستشارة غير متصل',
      offers: [],
      withdrawnId: 'x',
    }),
    'unavailable',
  );
  assert.equal(
    classifySearchOutcome({ ok: true, text: 'لا توجد مطابقة منشورة', offers: [], withdrawnId: 'x' }),
    'no_match',
  );
  console.log('pass no_match_vs_search_unavailable');
}

console.log('OK rc11 commercial reply schema tests');
