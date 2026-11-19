/**
 * After withdraw / read error: no stale price and no booking CTA.
 * Booking-closed keeps published description but refuses new booking.
 * RC5.1: alternatives / compare must not steal the open-offer price.
 */
import assert from 'node:assert/strict';
import {
  ALTERNATIVES_SEARCH_FAILED_AR,
  buildAlternativesConsultationTurn,
  isAlternativesOrCompareAsk,
  isAlternativesPriceOrCompareAsk,
  isOpenOfferLiveAsk,
  isOpenOfferPriceQuestion,
  marketplaceAlternativesOrCompareReply,
  marketplaceOfferFacts,
  marketplaceOfferLiveAskReply,
  marketplaceOfferPriceOrBookReply,
} from './services/consultation-scope';

const live = marketplaceOfferFacts({
  id: 'svc-1',
  kind: 'service',
  nameAr: 'تنظيف',
  descriptionAr: 'وصف منشور',
  priceHalalas: 15000,
  availability: true,
  durationMin: 45,
});

assert.match(String(marketplaceOfferPriceOrBookReply('كم سعرها؟', live)), /150/);
assert.match(String(marketplaceOfferPriceOrBookReply('بكم هذه؟', live)), /150/);
assert.match(String(marketplaceOfferPriceOrBookReply('أقدر أحجزها؟', live)), /طلب موعد/);
assert.match(String(marketplaceOfferLiveAskReply('احجزيها', live)), /طلب موعد/);
assert.match(String(marketplaceOfferLiveAskReply('هل الحجز متاح؟', live)), /طلب موعد/);
assert.match(String(marketplaceOfferLiveAskReply('هل فيه موعد؟', live)), /لا أجزم بتوفر ساعة/);
assert.doesNotMatch(String(marketplaceOfferLiveAskReply('هل فيه موعد؟', live)), /الساعة الخامسة|17:00/);

// RC5.1 / RC5.2 — open-offer price gate must not claim alternatives / compare.
assert.equal(isOpenOfferPriceQuestion('بكم خدمة ثانية؟'), false);
assert.equal(isOpenOfferPriceQuestion('كم سعر البدائل؟'), false);
assert.equal(isOpenOfferPriceQuestion('بكم هذه؟'), true);
assert.equal(isOpenOfferPriceQuestion('بكم البديل؟'), false);
assert.equal(isOpenOfferLiveAsk('بكم خدمة ثانية؟'), false);
assert.equal(isAlternativesPriceOrCompareAsk('بكم خدمة ثانية؟'), true);
assert.equal(isAlternativesOrCompareAsk('قارني سعرها بخدمة الترطيب'), true);
assert.equal(isAlternativesOrCompareAsk('بكم البديل؟'), true);
assert.equal(isAlternativesOrCompareAsk('طيب بكم غيرها؟'), true);
assert.equal(isAlternativesOrCompareAsk('بكم هذه؟'), false);

const altSecond = String(marketplaceAlternativesOrCompareReply('بكم خدمة ثانية؟', live));
assert.match(altSecond, /بديل|خدمة ثانية/);
assert.doesNotMatch(altSecond, /سعر «تنظيف» 150/);
assert.match(altSecond, /لن أستخدم سعر/);

const altList = String(marketplaceAlternativesOrCompareReply('كم سعر البدائل؟', live));
assert.match(altList, /بديل/);
assert.doesNotMatch(altList, /^سعر «تنظيف» 150/);

const compare = String(marketplaceAlternativesOrCompareReply('قارني سعرها بخدمة الترطيب', live));
assert.match(compare, /ترطيب/);
assert.match(compare, /150/);
assert.match(compare, /لن أنسب سعر/);
assert.doesNotMatch(compare, /سعر «ترطيب» 150|الترطيب» 150/);

assert.equal(marketplaceOfferLiveAskReply('بكم خدمة ثانية؟', live), null);
assert.equal(marketplaceOfferLiveAskReply('كم سعر البدائل؟', live), null);
assert.equal(marketplaceOfferLiveAskReply('بكم البديل؟', live), null);

const withdrawn = [
  {
    id: 'marketplace.offer.status.svc-1',
    labelAr: 'حالة العرض',
    valueAr: 'سُحب أو أوقف من النشر — لا أعتمد وصفًا أو سعرًا سابقًا',
  },
  ...live,
];
for (const q of ['كم سعرها؟', 'أقدر أحجزها؟', 'احجزيها', 'وش تشمل الجلسة؟']) {
  const reply = String(marketplaceOfferLiveAskReply(q, withdrawn));
  assert.match(reply, /لم يعد منشورًا/);
  assert.doesNotMatch(reply, /150/);
  assert.doesNotMatch(reply, /وصف منشور/);
}

const altAfterWithdraw = String(marketplaceAlternativesOrCompareReply('كم سعر البدائل؟', withdrawn));
assert.match(altAfterWithdraw, /سُحب|لم يعد/);
assert.doesNotMatch(altAfterWithdraw, /سعر «تنظيف» 150|150 ريال كسعر لبديل/);
assert.match(altAfterWithdraw, /لن أعتمد سعرًا قديمًا|لن أخترع/);

// Final consultation turn (reply + cards) — not function text alone.
const hydrateAlt = {
  id: 'svc-hydrate',
  titleAr: 'ترطيب',
  kind: 'service',
  priceSar: 120,
  inStock: true,
};

// Discovery ON + published alternatives → cards with each offer's own price.
const turnOn = buildAlternativesConsultationTurn('كم سعر البدائل؟', live, [hydrateAlt], {
  discoveryEnabled: true,
});
assert.ok(turnOn);
assert.match(turnOn!.answerAr, /ترطيب/);
assert.match(turnOn!.answerAr, /120/);
assert.doesNotMatch(turnOn!.answerAr, /سعر «تنظيف» 150 ريال/);
assert.equal(turnOn!.discoveryOffers.length, 1);
assert.equal(turnOn!.discoveryOffers[0].priceSar, 120);
assert.equal(turnOn!.discoveryOffers[0].titleAr, 'ترطيب');
assert.equal(turnOn!.discoveryOffers[0].action, 'book');
assert.equal(turnOn!.replySource, 'discovery');
assert.equal(turnOn!.discoveryEnabled, true);

// RC5.2 — «بكم البديل؟» / «بكم غيرها؟» use published alt price, never open 150.
const turnBadil = buildAlternativesConsultationTurn('بكم البديل؟', live, [hydrateAlt], {
  discoveryEnabled: true,
});
assert.ok(turnBadil);
assert.match(turnBadil!.answerAr, /ترطيب/);
assert.match(turnBadil!.answerAr, /120/);
// May contrast open 150, but must not claim cleaning *is* the alternative price.
assert.doesNotMatch(turnBadil!.answerAr, /سعر البديل المنشور «تنظيف»/);
assert.doesNotMatch(turnBadil!.answerAr, /«ترطيب»:\s*150|البديل المنشور «ترطيب»:\s*150/);
assert.match(turnBadil!.answerAr, /وليس سعر «تنظيف»/);
assert.equal(turnBadil!.discoveryOffers[0].id, 'svc-hydrate');
assert.equal(turnBadil!.discoveryOffers[0].priceSar, 120);

const turnGhairaha = buildAlternativesConsultationTurn('طيب بكم غيرها؟', live, [hydrateAlt], {
  discoveryEnabled: true,
});
assert.ok(turnGhairaha);
assert.match(turnGhairaha!.answerAr, /120/);
assert.doesNotMatch(turnGhairaha!.answerAr, /سعر «تنظيف» 150 ريال كسعر لبديل/);

// Unknown alternative → ask to identify; never open-offer price as alt.
const turnUnknownAlt = buildAlternativesConsultationTurn('بكم البديل؟', live, [], {
  discoveryEnabled: false,
});
assert.ok(turnUnknownAlt);
assert.match(turnUnknownAlt!.answerAr, /أي بديل|حددي/);
assert.doesNotMatch(turnUnknownAlt!.answerAr, /^سعر «تنظيف» 150|البديل المنشور «تنظيف»/);
assert.equal(turnUnknownAlt!.discoveryOffers.length, 0);

// Published but booking closed → details only (action view).
const closedHydrate = { ...hydrateAlt, inStock: false, bookingEnabled: false };
const turnClosedAlt = buildAlternativesConsultationTurn('بكم البديل؟', live, [closedHydrate], {
  discoveryEnabled: true,
});
assert.ok(turnClosedAlt);
assert.match(turnClosedAlt!.answerAr, /120/);
assert.match(turnClosedAlt!.answerAr, /الحجز غير متاح|عرض التفاصيل/);
assert.equal(turnClosedAlt!.discoveryOffers[0].action, 'view');
assert.equal(turnClosedAlt!.discoveryOffers[0].inStock, false);
assert.equal(turnClosedAlt!.discoveryOffers[0].priceSar, 120);

// Search failed → distinct retry copy, empty cards (not «أي بديل تقصدين؟»).
const turnSearchFail = buildAlternativesConsultationTurn('بكم البديل؟', live, [hydrateAlt], {
  discoveryEnabled: true,
  searchFailed: true,
});
assert.ok(turnSearchFail);
assert.equal(turnSearchFail!.answerAr, ALTERNATIVES_SEARCH_FAILED_AR);
assert.equal(turnSearchFail!.discoveryOffers.length, 0);
assert.equal(turnSearchFail!.searchFailed, true);
assert.ok(turnSearchFail!.suggestedQuestionsAr.includes('أعيدي البحث'));

// Withdrawn alternative → omit from text and cards (unlike booking-closed).
const withdrawnHydrate = {
  ...hydrateAlt,
  liveStatus: 'withdrawn' as const,
  inStock: false,
  bookingEnabled: false,
};
const turnWithdrawnAlt = buildAlternativesConsultationTurn('بكم البديل؟', live, [withdrawnHydrate], {
  discoveryEnabled: true,
});
assert.ok(turnWithdrawnAlt);
assert.equal(turnWithdrawnAlt!.discoveryOffers.length, 0);
assert.doesNotMatch(turnWithdrawnAlt!.answerAr, /120|ترطيب/);
assert.doesNotMatch(turnWithdrawnAlt!.answerAr, /تعذّر عليّ البحث الآن/);

// Discovery OFF after withdraw → clarify, empty cards, no stale 150 as alternative price.
const turnOffWithdrawn = buildAlternativesConsultationTurn('بكم خدمة ثانية؟', withdrawn, [], {
  discoveryEnabled: false,
});
assert.ok(turnOffWithdrawn);
assert.match(turnOffWithdrawn!.answerAr, /سُحب|بديل/);
assert.doesNotMatch(turnOffWithdrawn!.answerAr, /سعر «تنظيف» 150/);
assert.equal(turnOffWithdrawn!.discoveryOffers.length, 0);
assert.equal(turnOffWithdrawn!.discoveryEnabled, false);

// Compare with a published second source → both prices, no attribution swap.
const turnCompare = buildAlternativesConsultationTurn('قارني سعرها بخدمة الترطيب', live, [hydrateAlt], {
  discoveryEnabled: true,
});
assert.ok(turnCompare);
assert.match(turnCompare!.answerAr, /150/);
assert.match(turnCompare!.answerAr, /120/);
assert.match(turnCompare!.answerAr, /ترطيب/);
assert.equal(turnCompare!.discoveryOffers[0].priceSar, 120);

const errored = [
  {
    id: 'marketplace.offer.status.svc-1',
    labelAr: 'حالة العرض',
    valueAr: 'تعذّر التحقق من العرض المنشور الآن — لن أجزم بالسحب ولن أعيد وصفًا قديمًا',
  },
];
assert.match(String(marketplaceOfferLiveAskReply('كم سعرها؟', errored)), /تعذّر التحقق/);
assert.doesNotMatch(String(marketplaceOfferLiveAskReply('كم سعرها؟', errored)), /سُحب/);

const closed = marketplaceOfferFacts({
  id: 'svc-1',
  kind: 'service',
  nameAr: 'تنظيف',
  descriptionAr: 'وصف ما زال منشورًا',
  priceHalalas: 15000,
  availability: false,
  durationMin: 45,
});
assert.match(String(marketplaceOfferLiveAskReply('وش تشمل الجلسة؟', closed)), /وصف ما زال منشورًا/);
assert.match(String(marketplaceOfferLiveAskReply('أقدر أحجزها؟', closed)), /غير متاح/);
assert.match(String(marketplaceOfferLiveAskReply('كم سعرها؟', closed)), /150/);

const product = marketplaceOfferFacts({
  id: 'prod-1',
  kind: 'product',
  nameAr: 'مرطب',
  descriptionAr: 'مرطب يومي لطيف',
  priceHalalas: 8900,
  availability: true,
});
assert.match(String(marketplaceOfferLiveAskReply('وش يحتوي المنتج؟', product)), /مرطب يومي/);

// General routine ask stays out of offer path.
assert.equal(marketplaceOfferLiveAskReply('وش يشمل روتيني؟', live), null);

console.log('OK marketplace-offer-price-book');
