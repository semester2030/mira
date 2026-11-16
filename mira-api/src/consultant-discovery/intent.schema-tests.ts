/**
 * Consultant Discovery — signal + journey tests (correction round).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  decideIntent,
  extractSignals,
  matchSaudiCityAr,
  parseBudget,
  arabicDigitsToWestern,
  pickBestFitOffer,
  priceFitsBudget,
} from './intent';

const rules = JSON.parse(readFileSync(join(__dirname, 'rules.v1.json'), 'utf8')) as {
  version: string;
  rules: Array<{ ruleId: string }>;
};
assert.equal(rules.rules.length, 81);

assert.equal(arabicDigitsToWestern('٣٠٠'), '300');
assert.deepEqual(parseBudget('اقل من 300'), { max: 300, bound: 'exclusive' });
assert.deepEqual(parseBudget('حتى 300'), { max: 300, bound: 'inclusive' });
assert.deepEqual(parseBudget('تحت 300'), { max: 300, bound: 'inclusive' });

assert.equal(matchSaudiCityAr('في جدة'), 'جدة');
assert.equal(matchSaudiCityAr('في مكة'), 'مكة المكرمة');
assert.equal(matchSaudiCityAr('بالرياض'), 'الرياض');

{
  const s = extractSignals('شنطة بأقل من ٣٠٠');
  assert.equal(s.budgetMaxSar, 300);
  assert.equal(s.priceBound, 'exclusive');
  console.log('pass arabic_budget_exclusive');
}

{
  const s = extractSignals('حجز ليزر في جدة');
  assert.equal(s.city, 'جدة');
  assert.equal(s.laserExplicit, true);
  const i = decideIntent(s);
  assert.equal(i.city, 'جدة');
  assert.equal(i.kind, 'direct_service_search');
  console.log('pass city_jeddah_laser');
}

{
  const s = extractSignals('حجز ليزر في مكة');
  assert.equal(s.city, 'مكة المكرمة');
  console.log('pass city_makkah');
}

{
  const first = decideIntent(extractSignals('أبي شنطة أقل من ٣٠٠'));
  assert.equal(first.q, 'شنطة');
  assert.equal(first.priceMax, 300);
  assert.equal(first.priceBound, 'exclusive');
  const second = decideIntent(extractSignals('بس مو ذهبي'), first.sessionPatch);
  assert.equal(second.q, 'شنطة');
  assert.equal(second.priceMax, 300);
  assert.ok(second.excludeColors.some((c) => c.includes('gold') || c.includes('ذهبي')));
  console.log('pass session_correction_not_gold');
}

{
  const buy = decideIntent(extractSignals('أبي مكياج للشراء'));
  assert.equal(buy.kindFilter, 'product');
  const book = decideIntent(extractSignals('أبي حجز مكياج'));
  assert.equal(book.kindFilter, 'service');
  console.log('pass makeup_purchase_vs_book');
}

{
  const i = decideIntent(extractSignals('أبي مرطب بدون عطر'));
  assert.equal(i.kind, 'direct_product_search');
  assert.equal(i.requireFragranceFree, true);
  console.log('pass moisturizer_fragrance_free');
}

{
  const i = decideIntent(extractSignals('شو رأيكم؟', { imageKind: 'face' }));
  assert.ok(i.blockers.includes('face_image_not_diagnosis'));
  const outfit = decideIntent(extractSignals('شو رأيكم؟', { imageKind: 'outfit' }));
  assert.equal(outfit.blockers.includes('face_image_not_diagnosis'), false);
  const unknown = decideIntent(extractSignals('شو رأيكم؟', { imageKind: 'unknown', hasFaceImage: true }));
  // unknown attachment must NOT force face clinic gate
  assert.equal(unknown.blockers.includes('face_image_not_diagnosis'), false);
  console.log('pass image_kind_gates');
}

{
  const guest = decideIntent(extractSignals('عندي زواج أنا ضيفة وأبي شنطة تحت 300'));
  assert.equal(guest.kind, 'direct_product_search');
  assert.equal(guest.priceBound, 'inclusive');
  const org = decideIntent(extractSignals('أنا أرتب زواج أختي بالرياض وأبي منسقة'));
  assert.equal(org.kind, 'direct_service_search');
  assert.equal(org.city, 'الرياض');
  const baby = decideIntent(extractSignals('أبي هدية لمولود'));
  assert.deepEqual(baby.lanes, ['children', 'gifts']);
  assert.equal(baby.saveAsPersonalPreference, false);
  console.log('pass core_journeys');
}

{
  const dress = decideIntent(extractSignals('أبي فستان زفاف تحت ٣٠٠٠، الفستان بس'));
  assert.ok(dress.blockers.includes('dress_only'));
  assert.equal(dress.sideSuggestionAr, null);
  assert.equal(dress.priceMax, 3000);
  console.log('pass dress_only_budget');
}

{
  const advice = decideIntent(extractSignals('ما أهمية واقي الشمس في روتيني؟'));
  assert.equal(advice.kind, 'advice_only');
  const explicit = decideIntent(
    extractSignals('رشّحي لي واقي شمس من ميرا بأقل من ١٠٠ ريال'),
  );
  assert.equal(explicit.kind, 'direct_product_search');
  assert.equal(explicit.sourceId, 'face.sunscreen');
  assert.equal(explicit.priceMax, 100);
  assert.equal(explicit.priceBound, 'exclusive');
  const anaphora = decideIntent(
    extractSignals('طيب رشّحي لي واحد من ميرا بأقل من ١٠٠ ريال'),
    {
      q: 'واقي شمس',
      kindFilter: 'product',
      sourceId: 'face.sunscreen',
      targetIds: ['face.sunscreen'],
      ruleIds: ['care.topic.sunscreen'],
    },
  );
  assert.equal(anaphora.kind, 'direct_product_search');
  assert.equal(anaphora.sourceId, 'face.sunscreen');
  assert.equal(anaphora.q, 'واقي شمس');
  assert.equal(anaphora.priceMax, 100);
  assert.ok(anaphora.blockers.includes('anaphora_sunscreen'));
  console.log('pass sunscreen_product_and_anaphora');
}

{
  const same = decideIntent(
    extractSignals('ابي نفس هذا المنتج', { attachmentCount: 1, imageKind: 'unknown' }),
  );
  assert.equal(same.kind, 'clarify');
  assert.ok(same.blockers.includes('need_product_identity'));
  assert.match(same.replyAr, /اسم المنتج|العلامة/);
  assert.doesNotMatch(same.replyAr, /ترطيب/);
  console.log('pass same_product_asks_identity');
}

{
  // Skin-report session must NOT force face when product photo + «أبي نفس هذا».
  const sig = extractSignals('ابي نفس هذا', {
    attachmentCount: 1,
    imageKind: 'unknown',
  });
  assert.equal(sig.hasProductAttachment, true);
  assert.equal(sig.imageKind, 'unknown');
  const withHint = decideIntent(
    extractSignals('ابي نفس هذا', {
      attachmentCount: 1,
      imageKind: 'unknown',
      attachmentHintAr: 'CeraVe PM',
    }),
  );
  assert.equal(withHint.kind, 'direct_product_search');
  assert.equal(withHint.q, 'CeraVe PM');
  console.log('pass product_photo_not_face_with_hint');
}

{
  const hair = decideIntent(
    extractSignals('مين تسوي لي مثلها؟', { attachmentCount: 1, imageKind: 'outfit' }),
  );
  assert.equal(hair.kind, 'direct_service_search');
  assert.ok(hair.blockers.includes('hairstyle_service_search'));
  console.log('pass hairstyle_service_from_image');
}

{
  const sess = {
    q: 'مرطب',
    kindFilter: 'product' as const,
    lastOffers: [
      { id: 'a1', kind: 'product' as const, titleAr: 'مرطب أ', priceSar: 49.99, inStock: true },
      { id: 'b2', kind: 'product' as const, titleAr: 'مرطب ب', priceSar: 59, inStock: true },
    ],
  };
  const cmp = decideIntent(extractSignals('قارني الأول بالثاني'), sess);
  assert.equal(cmp.kind, 'advice_only');
  assert.ok(cmp.blockers.includes('compare_grounded_only'));
  assert.match(cmp.replyAr, /مرطب أ/);
  assert.match(cmp.replyAr, /مرطب ب/);
  assert.match(cmp.replyAr, /49\.99/);
  console.log('pass compare_grounded_offers');
}

{
  assert.equal(priceFitsBudget(50, 50, 'exclusive'), 'over');
  assert.equal(priceFitsBudget(50, 50, 'inclusive'), 'fits');
  assert.equal(priceFitsBudget(49.99, 50, 'exclusive'), 'fits');
  assert.equal(priceFitsBudget(null, 50, 'inclusive'), 'unknown_price');
  console.log('pass price_fits_budget_bounds');
}

{
  // RC11 — dialogue routing before catalog: أبي ≠ buy.
  const unique = `مرطب RC11 ثاني ${Date.now()}`;
  const named = decideIntent(extractSignals(`أبي ${unique}`));
  assert.equal(named.kind, 'direct_product_search');
  assert.equal(named.q, unique);

  const buyNamed = decideIntent(extractSignals('أبي أشتري سيروم الندى'));
  assert.equal(buyNamed.kind, 'direct_product_search');
  assert.equal(buyNamed.q, 'سيروم الندى');
  assert.doesNotMatch(buyNamed.q ?? '', /أشتري|اشتري/);

  const waddi = decideIntent(extractSignals('ودي أشتري سيروم الندى'));
  assert.equal(waddi.kind, 'direct_product_search');
  assert.equal(waddi.q, 'سيروم الندى');

  const skin = decideIntent(extractSignals('أبي أعرف ليش بشرتي جافة'));
  assert.equal(skin.kind, 'advice_only');
  assert.ok(skin.blockers.includes('skin_explain_not_catalog'));
  assert.notEqual(skin.q, 'أعرف ليش بشرتي جافة');

  const skinSa = decideIntent(extractSignals('ابي اعرف ليش بشرتي جافه'));
  assert.equal(skinSa.kind, 'advice_only');

  const advice = decideIntent(extractSignals('أبي نصيحة'));
  assert.equal(advice.kind, 'clarify');
  assert.ok(advice.blockers.includes('bare_advice_clarify'));

  const homeHair = decideIntent(extractSignals('أبي كوافيرة تجي البيت'));
  assert.equal(homeHair.kind, 'direct_service_search');
  assert.ok(homeHair.blockers.includes('home_hair_service'));
  assert.ok(homeHair.blockers.includes('require_home_visit_capability'));
  assert.equal(homeHair.kindFilter, 'service');

  const homeHairSa = decideIntent(extractSignals('ابغى كوافيره تجيني للبيت'));
  assert.equal(homeHairSa.kind, 'direct_service_search');

  const missing = decideIntent(extractSignals('أبي منتج-غير-موجود-xyz-99999'));
  assert.equal(missing.kind, 'direct_product_search');

  const care = decideIntent(extractSignals('ما أهمية الترطيب في روتيني الصباحي؟'));
  assert.equal(care.kind, 'advice_only');

  const soft = decideIntent(extractSignals('أبي ترطيب لطيف'));
  assert.equal(soft.kind, 'advice_only');

  const coordinator = decideIntent(extractSignals('أبي منسقة'));
  assert.equal(coordinator.kind, 'advice_only');
  console.log('pass rc11_dialogue_routing_before_catalog');
}

{
  const budgetSess = {
    q: 'مرطب',
    kindFilter: 'product' as const,
    priceMaxSar: 50,
    priceBound: 'inclusive' as const,
    lastOffers: [
      {
        id: 'expensive-oos',
        kind: 'product' as const,
        titleAr: 'مرطب فاخر',
        priceSar: 120,
        inStock: false,
        liveStatus: 'published' as const,
      },
      {
        id: 'fit-in-budget',
        kind: 'product' as const,
        titleAr: 'مرطب عملي',
        priceSar: 40,
        inStock: true,
        liveStatus: 'published' as const,
      },
    ],
  };
  const which = decideIntent(extractSignals('أيهم أنسب لي؟'), budgetSess);
  assert.match(which.replyAr, /الثاني/);
  assert.match(which.replyAr, /مرطب عملي/);
  assert.doesNotMatch(which.replyAr, /مرطب فاخر.*لأنها العرض الأول|العرض الأول المطابق/);
  assert.match(which.replyAr, /ميزاني|متوفر/);

  const reversed = {
    ...budgetSess,
    lastOffers: [...budgetSess.lastOffers].reverse(),
  };
  const whichRev = decideIntent(extractSignals('أيهم أنسب لي؟'), reversed);
  assert.match(whichRev.replyAr, /مرطب عملي/);
  assert.match(whichRev.replyAr, /الأول/); // now first card after reverse
  const pickA = pickBestFitOffer(budgetSess.lastOffers!, budgetSess);
  const pickB = pickBestFitOffer(reversed.lastOffers!, reversed);
  assert.equal(pickA.pick?.id, 'fit-in-budget');
  assert.equal(pickB.pick?.id, 'fit-in-budget');

  // Partner updates same id: 40→90 OOS — must stop recommending.
  const afterPartnerEdit = {
    ...budgetSess,
    lastOffers: budgetSess.lastOffers.map((o) =>
      o.id === 'fit-in-budget'
        ? { ...o, priceSar: 90, inStock: false, liveStatus: 'published' as const }
        : o,
    ),
  };
  const afterEdit = decideIntent(extractSignals('أيهم أنسب لي؟'), afterPartnerEdit);
  assert.doesNotMatch(afterEdit.replyAr, /مرطب عملي» لأن/);
  assert.ok(
    afterEdit.blockers.includes('which_fits_need_signal') ||
      !/الأنسب لكِ.*مرطب عملي/.test(afterEdit.replyAr),
  );

  // Exclusive «أقل من 50» rejects exactly 50.
  const exclusiveExact = pickBestFitOffer(
    [
      {
        id: 'at-50',
        kind: 'product',
        titleAr: 'حد الميزانية',
        priceSar: 50,
        inStock: true,
        liveStatus: 'published',
      },
    ],
    { priceMaxSar: 50, priceBound: 'exclusive' },
  );
  assert.equal(exclusiveExact.pick, null);

  const inclusiveExact = pickBestFitOffer(
    [
      {
        id: 'at-50',
        kind: 'product',
        titleAr: 'حد الميزانية',
        priceSar: 50,
        inStock: true,
        liveStatus: 'published',
      },
    ],
    { priceMaxSar: 50, priceBound: 'inclusive' },
  );
  assert.equal(inclusiveExact.pick?.id, 'at-50');

  // Unknown price never treated as within budget.
  const unknownPrice = pickBestFitOffer(
    [
      {
        id: 'no-price',
        kind: 'product',
        titleAr: 'بلا سعر',
        priceSar: null,
        inStock: true,
        liveStatus: 'published',
      },
    ],
    { priceMaxSar: 50, priceBound: 'inclusive' },
  );
  assert.equal(unknownPrice.pick, null);

  const withdrawn = {
    ...budgetSess,
    lastOffers: budgetSess.lastOffers.map((o) =>
      o.id === 'fit-in-budget' ? { ...o, liveStatus: 'withdrawn' as const } : o,
    ),
  };
  const afterWithdraw = decideIntent(extractSignals('أيهم أنسب لي؟'), withdrawn);
  assert.doesNotMatch(afterWithdraw.replyAr, /مرطب عملي» لأن/);
  const cmpW = decideIntent(extractSignals('قارني الأول بالثاني'), withdrawn);
  assert.match(cmpW.replyAr, /مسحوب/);

  const unverifiable = {
    ...budgetSess,
    lastOffers: budgetSess.lastOffers.map((o) =>
      o.id === 'fit-in-budget'
        ? { ...o, liveStatus: 'unverifiable' as const, priceSar: null, inStock: null }
        : o,
    ),
  };
  const afterNet = decideIntent(extractSignals('أيهم أنسب لي؟'), unverifiable);
  assert.match(afterNet.replyAr, /تعذّر التحقق|لا أجد/);
  assert.doesNotMatch(afterNet.replyAr, /ضمن ميزانيتكِ/);
  console.log('pass which_fits_budget_live_price_and_withdrawn');
}

console.log('OK consultant-discovery intent schema tests (correction)');
