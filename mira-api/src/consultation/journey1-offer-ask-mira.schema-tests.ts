/**
 * Journey-1 chain (code-level): provider edits description → Ask Mira cites the new text.
 * Live portal/device recording remains for acceptance ZIP.
 */
import assert from 'node:assert/strict';
import {
  marketplaceOfferFacts,
  marketplaceOfferIncludesReply,
} from './services/consultation-scope';

// 1) Provider publishes cleanse with phrase-based draft description.
let descriptionAr = 'تعرّفي على خطوات التنظيف قبل اختيار موعدك.';
let facts = marketplaceOfferFacts({
  id: 'svc-cleanse',
  kind: 'service',
  nameAr: 'تنظيف تجميلي سطحي',
  descriptionAr,
  priceHalalas: 15000,
  availability: true,
  durationMin: 45,
  partnerNameAr: 'مركز عناية BC',
});
assert.match(
  String(marketplaceOfferIncludesReply('وش تشمل الجلسة؟', facts)),
  /خطوات التنظيف/,
);

// 2) Provider edits description from portal (same offer id).
descriptionAr = 'جلسة تنظيف تجميلي سطحي: تنظيف لطيف + ترطيب خفيف، بدون أجهزة طبية.';
facts = marketplaceOfferFacts({
  id: 'svc-cleanse',
  kind: 'service',
  nameAr: 'تنظيف تجميلي سطحي',
  descriptionAr,
  priceHalalas: 15000,
  availability: true,
  durationMin: 45,
  partnerNameAr: 'مركز عناية BC',
});
const afterEdit = marketplaceOfferIncludesReply('وش تشمل الجلسة؟', facts);
assert.match(String(afterEdit), /تنظيف لطيف \+ ترطيب خفيف/);
assert.doesNotMatch(String(afterEdit), /خطوات التنظيف قبل اختيار/);

// 3) Pause blocks new booking signal in facts (availability false).
const paused = marketplaceOfferFacts({
  id: 'svc-cleanse',
  kind: 'service',
  nameAr: 'تنظيف تجميلي سطحي',
  descriptionAr,
  priceHalalas: 15000,
  availability: false,
  durationMin: 45,
  partnerNameAr: 'مركز عناية BC',
});
const title = paused.find((f) => f.id.startsWith('marketplace.offer.title.'));
assert.equal(title?.commercial?.availability, false);

console.log('OK journey1-offer-ask-mira schema');
