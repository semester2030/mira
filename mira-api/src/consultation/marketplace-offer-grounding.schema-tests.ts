/**
 * Journey-1 Ask Mira: reply must come from provider description facts only.
 */
import assert from 'node:assert/strict';
import {
  marketplaceOfferFacts,
  marketplaceOfferIncludesReply,
} from './services/consultation-scope';

const facts = marketplaceOfferFacts({
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'service',
  nameAr: 'تنظيف تجميلي سطحي',
  descriptionAr: 'وصف معدّل من موقع المقدّم: تنظيف لطيف بدون أجهزة طبية',
  priceHalalas: 12000,
  availability: true,
  durationMin: 40,
  partnerNameAr: 'مركز عناية الرحلة الأولى',
});

assert.ok(facts.some((f) => f.id.startsWith('marketplace.offer.description.')));
const reply = marketplaceOfferIncludesReply('وش تشمل الجلسة؟', facts);
assert.match(String(reply), /وصف معدّل من موقع المقدّم/);
assert.doesNotMatch(String(reply), /أجهزة طبية تشخيص|ليزر طبي/);

const empty = marketplaceOfferIncludesReply('وش تشمل الجلسة؟', [
  { id: 'marketplace.offer.title.x', labelAr: 'اسم الجلسة', valueAr: 'جلسة' },
]);
assert.match(String(empty), /لا يوجد وصف منشور/);

console.log('OK marketplace-offer-grounding journey1');
