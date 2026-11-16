/**
 * RC13 — service session continuity + placeMode/venue from real sessionPatch chain.
 */
import assert from 'node:assert/strict';
import { placeModeMatchesFilter } from '../marketplace/catalog-filters';
import {
  hasPublishedVenueCapability,
  resolvePublishedPlaceMode,
} from './consultant-discovery.service';
import { decideIntent, extractSignals } from './intent';

function passesHomeVisit(it: Record<string, unknown>): boolean {
  const rawMode = resolvePublishedPlaceMode(it);
  return placeModeMatchesFilter(rawMode, ['home']);
}

{
  const branchOnly = {
    id: 'salon-branch',
    placeMode: 'branch',
    descriptionAr: 'لا نقدم خدمة منزلية',
  };
  const mobile = {
    id: 'indie-home',
    placeMode: 'home',
    providerKind: 'independent',
    descriptionAr: 'أجيء لموقع العميلة',
  };
  const either = {
    id: 'salon-either',
    placeMode: 'either',
    providerKind: 'facility',
    descriptionAr: 'الفرع أو المنزل',
  };

  assert.equal(passesHomeVisit(branchOnly), false);
  assert.equal(passesHomeVisit(mobile), true);
  assert.equal(passesHomeVisit(either), true);
  assert.equal(hasPublishedVenueCapability({ placeMode: 'home' }), false);
  assert.equal(hasPublishedVenueCapability({ placeMode: 'either' }), false);
  assert.equal(hasPublishedVenueCapability({ locations: ['event_venue'] }), true);
  assert.equal(hasPublishedVenueCapability({ venueService: true }), true);
  console.log('pass place_mode_and_venue_capability');
}

{
  // Real sessionPatch chain — do NOT re-inject pendingHomeService.
  const t1 = decideIntent(extractSignals('أبي كوافيرة تجي البيت'));
  assert.equal(t1.kind, 'direct_service_search');
  assert.equal(t1.sessionPatch?.pendingServiceAsk, true);
  assert.equal(t1.sessionPatch?.awaitingCity, true);
  assert.equal(t1.sessionPatch?.servicePlace, 'home');

  const t2 = decideIntent(extractSignals('في الرياض'), t1.sessionPatch);
  assert.equal(t2.kind, 'direct_service_search');
  assert.equal(t2.city, 'الرياض');
  assert.equal(t2.sessionPatch?.pendingServiceAsk, true);
  assert.equal(t2.sessionPatch?.awaitingCity, false);
  assert.equal(t2.sessionPatch?.servicePlace, 'home');

  const t3 = decideIntent(extractSignals('مختصة فردية'), t2.sessionPatch);
  assert.equal(t3.kind, 'direct_service_search', 'must not fall to advice');
  assert.ok(t3.blockers.includes('prefer_independent_provider'));
  assert.ok(t3.blockers.includes('require_home_visit_capability'));
  assert.equal(t3.city, 'الرياض');
  assert.equal(t3.sessionPatch?.servicePlace, 'home');
  console.log('pass dialogue_city_then_independent_real_patch');
}

{
  // Provider kind before city.
  const t1 = decideIntent(extractSignals('أبي كوافيرة تجي البيت'));
  const t2 = decideIntent(extractSignals('مختصة فردية'), t1.sessionPatch);
  assert.equal(t2.kind, 'direct_service_search');
  assert.ok(t2.blockers.includes('prefer_independent_provider'));
  assert.equal(t2.sessionPatch?.awaitingCity, true);
  const t3 = decideIntent(extractSignals('في الرياض'), t2.sessionPatch);
  assert.equal(t3.kind, 'direct_service_search');
  assert.equal(t3.city, 'الرياض');
  assert.ok(t3.blockers.includes('prefer_independent_provider'));
  console.log('pass dialogue_independent_then_city_real_patch');
}

{
  const v1 = decideIntent(extractSignals('أبي ميك أب أرتست تجي القاعة'));
  assert.equal(v1.kind, 'direct_service_search');
  assert.equal(v1.sessionPatch?.servicePlace, 'venue');
  assert.ok(v1.blockers.includes('require_event_venue_capability'));
  assert.match(v1.q ?? '', /مكياج/);

  const v2 = decideIntent(extractSignals('في الرياض'), v1.sessionPatch);
  assert.equal(v2.kind, 'direct_service_search');
  assert.equal(v2.sessionPatch?.servicePlace, 'venue', 'city must not flip venue→home');
  assert.ok(v2.blockers.includes('require_event_venue_capability'));
  assert.ok(!v2.blockers.includes('require_home_visit_capability'));
  assert.equal(v2.city, 'الرياض');
  assert.match(v2.q ?? '', /مكياج/);

  const hairVenue = decideIntent(extractSignals('أبي كوافيرة للقاعة'));
  assert.equal(hairVenue.kind, 'direct_service_search');
  assert.match(hairVenue.q ?? '', /كوافيرة|تصفيف/);
  assert.doesNotMatch(hairVenue.q ?? '', /مكياج/);
  console.log('pass venue_stays_venue_and_hair_not_makeup');
}

{
  const shampoo = decideIntent(extractSignals('أبي شامبو للشعر يوصل للبيت'));
  assert.equal(shampoo.kind, 'direct_product_search');

  const hairAdvice = decideIntent(extractSignals('أبي نصيحة لشعري'));
  assert.equal(hairAdvice.kind, 'advice_only');

  const oily = decideIntent(extractSignals('أبي أعرف ليش بشرتي دهنية؟'));
  assert.equal(oily.kind, 'advice_only');
  assert.match(oily.replyAr, /دهن/);
  assert.doesNotMatch(oily.replyAr, /جفاف البشرة/);

  const dry = decideIntent(extractSignals('ليش أحس بشرتي جافة؟'));
  assert.equal(dry.kind, 'advice_only');
  assert.match(dry.replyAr, /جفاف|جافة/);
  assert.doesNotMatch(dry.replyAr, /دهنية البشرة/);
  console.log('pass delivery_advice_and_skin_topic_match');
}

{
  // Explicit topic change must replace prior home-hair ask.
  const a = decideIntent(extractSignals('أبي كوافيرة تجي البيت'));
  const b = decideIntent(extractSignals('في الرياض'), a.sessionPatch);
  assert.equal(b.city, 'الرياض');
  const c = decideIntent(
    extractSignals('غيرت رأيي، أبي ميك أب أرتست تجي القاعة في الرياض'),
    b.sessionPatch,
  );
  assert.equal(c.kind, 'direct_service_search');
  assert.equal(c.sessionPatch?.servicePlace, 'venue');
  assert.match(c.q ?? '', /مكياج/);
  assert.ok(c.blockers.includes('require_event_venue_capability'));
  assert.ok(!c.blockers.includes('require_home_visit_capability'));
  assert.equal(c.city, 'الرياض');
  console.log('pass explicit_topic_change_home_to_venue_makeup');
}

console.log('OK place-mode-home / RC13 dialogue schema tests');
