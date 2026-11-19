/**
 * TEST-ONLY fixture helpers. Runtime Ask Mira must browse MarketplaceService —
 * these tests never authorize fixture use in the orchestrator.
 */
import assert from 'node:assert/strict';
import {
  discoveryCardFromOffer,
  outcomeMessageAr,
  RC5_FIXTURE_OFFERS,
  searchPublishedCatalog,
} from './services/consultant-discovery-catalog';
import {
  answerGroundedInPublishedCatalog,
  stripInventedMiraCatalogClaims,
} from './services/consultation-scope';

{
  assert.equal(RC5_FIXTURE_OFFERS.length, 3);
  assert.equal(RC5_FIXTURE_OFFERS.filter((o) => o.kind === 'product').length, 2);
  assert.equal(RC5_FIXTURE_OFFERS.filter((o) => o.kind === 'service').length, 1);
  console.log('pass fixture_two_products_one_service');
}

{
  const moist = searchPublishedCatalog('أبي مرطب من ميرا');
  assert.equal(moist.outcome, 'matched');
  assert.ok(moist.offers.some((o) => o.id === 'rc5-prod-dew'));
  const card = discoveryCardFromOffer(moist.offers[0]!);
  assert.equal(card?.id, moist.offers[0]!.id);
  assert.equal(card?.priceLabelAr, '49 ريال');
  assert.equal(card?.action, 'buy');
  const oos = discoveryCardFromOffer(RC5_FIXTURE_OFFERS.find((o) => o.id === 'rc5-prod-sun')!);
  assert.equal(oos?.inStock, false);
  assert.equal(oos?.action, 'view');
  console.log('pass search_returns_offer_ids');
}

{
  const none = searchPublishedCatalog('أبغى صاروخ فضائي من ميرا');
  assert.equal(none.outcome, 'no_match');
  assert.match(outcomeMessageAr(none), /لم نجد مطابقًا/);
  const fail = searchPublishedCatalog('مرطب', { forceFail: true });
  assert.equal(fail.outcome, 'search_failed');
  assert.match(outcomeMessageAr(fail), /تعذّر البحث/);
  console.log('pass no_match_vs_search_failed');
}

{
  const hair = searchPublishedCatalog('صورة تسريحة وأبغى أحجز');
  assert.equal(hair.outcome, 'matched');
  assert.ok(hair.offers.some((o) => o.id === 'rc5-svc-pearl'));
  const book = discoveryCardFromOffer(hair.offers.find((o) => o.kind === 'service')!);
  assert.equal(book?.action, 'book');
  console.log('pass hairstyle_maps_to_published_service');
}

{
  // Conversation path must ground LLM prose against the SAME offers search returned.
  const search = searchPublishedCatalog('مرطب وواقي شمس');
  const inventedPrice = 'مرطب الندى من ميرا بـ 49.99 ريال';
  assert.equal(answerGroundedInPublishedCatalog(inventedPrice, search.offers), false);
  assert.match(stripInventedMiraCatalogClaims(inventedPrice, search.offers), /ما أقدر أتحقق/);
  const oos = 'واقي شمس النهار من ميرا متوفر بـ 79 ريال';
  assert.equal(answerGroundedInPublishedCatalog(oos, search.offers), false);
  console.log('pass conversation_path_uses_search_offers_not_flag_alone');
}

console.log('OK consultant discovery catalog schema tests');
