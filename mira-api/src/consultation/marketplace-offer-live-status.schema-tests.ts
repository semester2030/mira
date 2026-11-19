/**
 * Withdrawn / missing offer must not keep answering from stale description facts.
 */
import assert from 'node:assert/strict';
import { marketplaceOfferFacts, marketplaceOfferIncludesReply } from './services/consultation-scope';

const live = marketplaceOfferFacts({
  id: 'svc-1',
  kind: 'service',
  nameAr: 'تنظيف',
  descriptionAr: 'وصف قديم قبل السحب',
  availability: true,
  durationMin: 45,
});
assert.match(String(marketplaceOfferIncludesReply('وش تشمل الجلسة؟', live)), /وصف قديم/);

const withdrawn = [
  {
    id: 'marketplace.offer.status.svc-1',
    labelAr: 'حالة العرض',
    valueAr: 'سُحب أو أوقف من النشر — لا أعتمد وصفًا أو سعرًا سابقًا',
  },
  // Stale description must be ignored once status is withdrawn.
  ...live,
];
assert.match(
  String(marketplaceOfferIncludesReply('وش تشمل الجلسة؟', withdrawn)),
  /لم يعد منشورًا/,
);

const closed = marketplaceOfferFacts({
  id: 'svc-1',
  kind: 'service',
  nameAr: 'تنظيف',
  descriptionAr: 'وصف ما زال منشورًا',
  availability: false,
  durationMin: 45,
});
assert.match(String(marketplaceOfferIncludesReply('وش تشمل الجلسة؟', closed)), /وصف ما زال منشورًا/);
assert.match(String(marketplaceOfferIncludesReply('وش تشمل الجلسة؟', closed)), /الحجز غير متاح/);

console.log('OK marketplace-offer-live-status');
