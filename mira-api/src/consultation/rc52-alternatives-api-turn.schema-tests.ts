/**
 * RC5.2 — acceptance on the *final consultation turn* (answerAr + discoveryOffers actions),
 * matching the orchestrator alternatives payload shape — not card-builder helpers alone.
 */
import assert from 'node:assert/strict';
import {
  buildAlternativesConsultationTurn,
  isOpenOfferPriceQuestion,
  marketplaceOfferFacts,
  marketplaceOfferLiveAskReply,
} from './services/consultation-scope';

const openClean = marketplaceOfferFacts({
  id: 'svc-clean',
  kind: 'service',
  nameAr: 'تنظيف',
  descriptionAr: 'تنظيف منشور',
  priceHalalas: 15000,
  availability: true,
  durationMin: 45,
});

const hydrate = {
  id: 'svc-hydrate',
  titleAr: 'ترطيب',
  kind: 'service' as const,
  priceSar: 120,
  inStock: true,
  bookingEnabled: true,
};

type ApiTurn = {
  answerAr: string;
  replySource: string;
  discoveryOffers: Array<Record<string, unknown>>;
  discoveryEnabled: boolean;
};

function asApiPayload(turn: NonNullable<ReturnType<typeof buildAlternativesConsultationTurn>>): ApiTurn {
  // Same fields the orchestrator writes into discoveryPayload for altPriceAsk.
  return {
    answerAr: turn.answerAr,
    replySource: turn.replySource,
    discoveryOffers: turn.discoveryOffers,
    discoveryEnabled: turn.discoveryEnabled,
  };
}

function assertNoOpenPriceAsAlt(answerAr: string) {
  assert.doesNotMatch(answerAr, /سعر البديل المنشور «تنظيف»/);
  assert.doesNotMatch(answerAr, /البديل.*:\s*150\s*ريال/);
  assert.doesNotMatch(answerAr, /^سعر «تنظيف» 150/);
}

// «بكم هذه؟» stays open-offer path (150), not alternatives.
assert.equal(isOpenOfferPriceQuestion('بكم هذه؟'), true);
assert.match(String(marketplaceOfferLiveAskReply('بكم هذه؟', openClean)), /150/);

const cases: Array<{ q: string; expectPrice: number; expectId: string }> = [
  { q: 'بكم البديل؟', expectPrice: 120, expectId: 'svc-hydrate' },
  { q: 'طيب بكم غيرها؟', expectPrice: 120, expectId: 'svc-hydrate' },
  { q: 'قارني سعرها بخدمة الترطيب', expectPrice: 120, expectId: 'svc-hydrate' },
];

for (const c of cases) {
  const turn = buildAlternativesConsultationTurn(c.q, openClean, [hydrate], { discoveryEnabled: true });
  assert.ok(turn, `turn for ${c.q}`);
  const api = asApiPayload(turn!);
  assert.match(api.answerAr, new RegExp(String(c.expectPrice)));
  assertNoOpenPriceAsAlt(api.answerAr);
  assert.equal(api.discoveryOffers.length, 1);
  assert.equal(api.discoveryOffers[0]!.id, c.expectId);
  assert.equal(api.discoveryOffers[0]!.priceSar, c.expectPrice);
  assert.equal(api.discoveryOffers[0]!.action, 'book');
  // Never attach open offer id/action to the alt card.
  assert.notEqual(api.discoveryOffers[0]!.id, 'svc-clean');
  console.log('pass api_turn', c.q, api.discoveryOffers[0]!.action, api.discoveryOffers[0]!.priceSar);
}

// Unknown alt — clarify, empty cards.
{
  const turn = buildAlternativesConsultationTurn('بكم البديل؟', openClean, [], { discoveryEnabled: false });
  const api = asApiPayload(turn!);
  assert.match(api.answerAr, /أي بديل|حددي/);
  assertNoOpenPriceAsAlt(api.answerAr);
  assert.equal(api.discoveryOffers.length, 0);
  console.log('pass api_turn unknown_alt');
}

// Closed booking → view only + status.
{
  const closed = { ...hydrate, inStock: false, bookingEnabled: false };
  const turn = buildAlternativesConsultationTurn('بكم البديل؟', openClean, [closed], {
    discoveryEnabled: true,
  });
  const api = asApiPayload(turn!);
  assert.equal(api.discoveryOffers[0]!.action, 'view');
  assert.equal(api.discoveryOffers[0]!.inStock, false);
  assert.equal(api.discoveryOffers[0]!.priceSar, 120);
  assert.match(String(api.discoveryOffers[0]!.statusLabelAr ?? api.answerAr), /الحجز غير متاح|عرض التفاصيل/);
  console.log('pass api_turn closed_booking_view');
}

// After withdraw of open offer — still use published alt price, never stale open 150 as alt.
{
  const withdrawn = [
    {
      id: 'marketplace.offer.status.svc-clean',
      labelAr: 'حالة العرض',
      valueAr: 'سُحب أو أوقف من النشر — لا أعتمد وصفًا أو سعرًا سابقًا',
    },
    ...openClean,
  ];
  const turn = buildAlternativesConsultationTurn('بكم البديل؟', withdrawn, [hydrate], {
    discoveryEnabled: true,
  });
  const api = asApiPayload(turn!);
  assert.match(api.answerAr, /120/);
  assert.doesNotMatch(api.answerAr, /سعر «تنظيف» 150 ريال كسعر لبديل/);
  assert.equal(api.discoveryOffers[0]!.priceSar, 120);
  console.log('pass api_turn after_withdraw');
}

// Discovery off — clarify path, no invented cards.
{
  const turn = buildAlternativesConsultationTurn('بكم خدمة ثانية؟', openClean, [], {
    discoveryEnabled: false,
  });
  const api = asApiPayload(turn!);
  assert.equal(api.discoveryEnabled, false);
  assert.equal(api.discoveryOffers.length, 0);
  assertNoOpenPriceAsAlt(api.answerAr);
  console.log('pass api_turn discovery_off');
}

console.log('OK rc52-alternatives-api-turn');
