/**
 * After withdraw / read error: no stale price and no booking CTA.
 * Booking-closed keeps published description but refuses new booking.
 */
import assert from 'node:assert/strict';
import {
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
assert.match(String(marketplaceOfferPriceOrBookReply('أقدر أحجزها؟', live)), /طلب موعد/);
assert.match(String(marketplaceOfferLiveAskReply('احجزيها', live)), /طلب موعد/);
assert.match(String(marketplaceOfferLiveAskReply('هل الحجز متاح؟', live)), /طلب موعد/);
assert.match(String(marketplaceOfferLiveAskReply('هل فيه موعد؟', live)), /لا أجزم بتوفر ساعة/);
assert.doesNotMatch(String(marketplaceOfferLiveAskReply('هل فيه موعد؟', live)), /الساعة الخامسة|17:00/);

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
