/**
 * After withdraw / read error: no stale price and no booking CTA.
 * Booking-closed keeps published description but refuses new booking.
 * RC5.1: alternatives / compare must not steal the open-offer price.
 */
import assert from 'node:assert/strict';
import {
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

// RC5.1 — open-offer price gate must not claim alternatives / compare.
assert.equal(isOpenOfferPriceQuestion('بكم خدمة ثانية؟'), false);
assert.equal(isOpenOfferPriceQuestion('كم سعر البدائل؟'), false);
assert.equal(isOpenOfferLiveAsk('بكم خدمة ثانية؟'), false);
assert.equal(isAlternativesPriceOrCompareAsk('بكم خدمة ثانية؟'), true);
assert.equal(isAlternativesOrCompareAsk('قارني سعرها بخدمة الترطيب'), true);

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
