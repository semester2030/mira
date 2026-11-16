/**
 * RC9 — live getPublishedItem fields must overwrite stale session price/stock.
 */
import assert from 'node:assert/strict';
import { decideIntent, extractSignals, pickBestFitOffer, type GroundedOfferRow } from './intent';

function applyPublishedItem(
  o: GroundedOfferRow,
  item: {
    nameAr?: string;
    priceHalalas?: number;
    stockAvailable?: boolean;
    partnerId?: string;
    bookingEnabled?: boolean;
    purchaseMode?: string;
  } | null,
  err?: 'not_found' | 'network',
): GroundedOfferRow {
  if (err === 'not_found') {
    return { ...o, liveStatus: 'withdrawn', inStock: false, action: 'view', bookingEnabled: false };
  }
  if (err === 'network' || !item) {
    return {
      ...o,
      liveStatus: 'unverifiable',
      priceSar: null,
      inStock: null,
      action: 'view',
      bookingEnabled: false,
    };
  }
  const priceSar =
    typeof item.priceHalalas === 'number' ? Math.round(item.priceHalalas) / 100 : null;
  const inStock = item.stockAvailable ?? null;
  // Mirror refreshSessionOffers: OOS → view even when purchaseMode would allow buy.
  const action =
    o.kind === 'service'
      ? item.bookingEnabled
        ? 'book'
        : 'view'
      : inStock === false
        ? 'view'
        : item.purchaseMode === 'internal_cod' || item.purchaseMode === 'external'
          ? 'buy'
          : 'view';
  return {
    ...o,
    titleAr: item.nameAr ?? o.titleAr,
    priceSar,
    inStock,
    partnerId: item.partnerId ?? o.partnerId,
    bookingEnabled: item.bookingEnabled ?? false,
    action,
    liveStatus: 'published',
  };
}

{
  const stale: GroundedOfferRow = {
    id: 'p1',
    kind: 'product',
    titleAr: 'مرطب',
    priceSar: 40,
    inStock: true,
    liveStatus: 'published',
  };
  const live = applyPublishedItem(stale, {
    nameAr: 'مرطب',
    priceHalalas: 9000,
    stockAvailable: false,
    partnerId: 'brand-1',
    purchaseMode: 'external',
  });
  assert.equal(live.priceSar, 90);
  assert.equal(live.inStock, false);
  assert.equal(live.liveStatus, 'published');
  assert.equal(live.action, 'view'); // never «اطلبي» when OOS

  const sess = {
    priceMaxSar: 50,
    priceBound: 'inclusive' as const,
    lastOffers: [live],
  };
  const pick = pickBestFitOffer(sess.lastOffers, sess);
  assert.equal(pick.pick, null);
  const which = decideIntent(extractSignals('أيهم أنسب لي؟'), sess);
  assert.doesNotMatch(which.replyAr, /ضمن ميزانيتكِ/);
  console.log('pass live_price_stock_override_blocks_which_fits');
}

{
  const o: GroundedOfferRow = {
    id: 'p2',
    kind: 'product',
    titleAr: 'مرطب',
    priceSar: 40,
    inStock: true,
    liveStatus: 'published',
  };
  const net = applyPublishedItem(o, null, 'network');
  assert.equal(net.liveStatus, 'unverifiable');
  assert.equal(net.priceSar, null);
  const cmp = decideIntent(extractSignals('قارني الأول بالثاني'), {
    lastOffers: [net],
  });
  assert.match(cmp.replyAr, /تعذّر التحقق/);
  console.log('pass unverifiable_does_not_assert_stale_price');
}

{
  const wd = applyPublishedItem(
    {
      id: 'p3',
      kind: 'product',
      titleAr: 'مرطب',
      priceSar: 40,
      inStock: true,
    },
    null,
    'not_found',
  );
  assert.equal(wd.liveStatus, 'withdrawn');
  console.log('pass not_found_is_withdrawn_not_network');
}

{
  // Status wins over Arabic error text containing «غير متاح».
  function classifyByStatus(status: number, messageAr: string): 'withdrawn' | 'unverifiable' {
    if (status === 404) return 'withdrawn';
    // 503 «الكتالوج غير متاح مؤقتًا» must NOT become withdrawn via message regex.
    if (/غير متاح/.test(messageAr) && status !== 404) return 'unverifiable';
    if (status >= 500) return 'unverifiable';
    return 'unverifiable';
  }
  assert.equal(
    classifyByStatus(503, 'الكتالوج غير متاح مؤقتًا'),
    'unverifiable',
  );
  assert.equal(classifyByStatus(404, 'غير متاح'), 'withdrawn');
  console.log('pass 503_message_not_withdrawn');
}

console.log('OK live-offer-refresh schema tests');
