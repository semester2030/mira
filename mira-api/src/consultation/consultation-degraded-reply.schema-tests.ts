/**
 * Offline advisor replies when LLM_API_KEY is absent — no invented scores / no English mild.
 */
import assert from 'node:assert/strict';
import {
  answerGroundedInPublishedCatalog,
  buildDegradedAdvisorReply,
  claimsMiraCatalogProduct,
  isProductOrCatalogAsk,
  marketplaceOfferFacts,
  marketplaceOfferIncludesReply,
  resolveMoistureDisplay,
  severityLabelAr,
  stripInventedMiraCatalogClaims,
} from './services/consultation-scope';

assert.equal(severityLabelAr('mild'), 'خفيف');
assert.equal(severityLabelAr('moderate'), 'متوسط');
assert.equal(severityLabelAr('priority'), 'أولوية عناية');
console.log('pass severity_ar');

{
  const display = resolveMoistureDisplay([
    { id: 'skin.concern.moisture', labelAr: 'الترطيب', valueAr: 'mild' },
    { id: 'skin.score.moisture', labelAr: 'الترطيب', valueAr: '62/100 — خفيف (مؤشر تقديري من الصورة)' },
  ]);
  assert.ok(display);
  assert.match(display!.valueAr, /62/);
  assert.doesNotMatch(display!.valueAr, /\bmild\b/i);
  console.log('pass moisture_prefers_score');
}

{
  const withConcernOnly = buildDegradedAdvisorReply('لماذا درجة ترطيبي كذا؟', [
    { id: 'skin.concern.moisture', labelAr: 'الترطيب', valueAr: 'mild' },
  ]);
  assert.match(withConcernOnly, /خفيف/);
  assert.doesNotMatch(withConcernOnly, /\bmild\b/i);
  console.log('pass moisture_arabic_severity');
}

{
  const sunscreen = buildDegradedAdvisorReply('ما أهمية واقي الشمس في روتيني؟', []);
  assert.match(sunscreen, /واقي الشمس/);
  console.log('pass sunscreen_advice');
}

{
  const facts = marketplaceOfferFacts({
    id: 'svc-1',
    kind: 'service',
    nameAr: 'تنظيف تجميلي سطحي',
    descriptionAr: 'تنظيف لطيف وترطيب خفيف لمدة ٤٥ دقيقة',
    priceHalalas: 15000,
    availability: true,
    durationMin: 45,
    partnerNameAr: 'مركز عناية تجريبي',
  });
  const reply = marketplaceOfferIncludesReply('وش تشمل الجلسة؟', facts);
  assert.match(String(reply), /تنظيف لطيف وترطيب خفيف/);
  assert.match(String(reply), /تنظيف تجميلي سطحي/);
  const degraded = buildDegradedAdvisorReply('وش تشمل الجلسة؟', facts);
  assert.equal(degraded, reply);
  // General «يشمل» without an open offer must not claim missing session description.
  assert.equal(marketplaceOfferIncludesReply('وش يشمل روتيني الصباحي؟', []), null);
  assert.equal(marketplaceOfferIncludesReply('وش يشمل روتيني الصباحي؟', facts), null);
  console.log('pass marketplace_offer_includes');
}

assert.equal(isProductOrCatalogAsk('ابي نفس هذا المنتج'), true);
assert.equal(isProductOrCatalogAsk('طيب رشّحي لي واحد من ميرا بأقل من ١٠٠ ريال'), true);
assert.equal(isProductOrCatalogAsk('أعطني مرطب للبشرة من ميرا'), true);
assert.equal(isProductOrCatalogAsk('أعطني الرابط'), true);
assert.equal(isProductOrCatalogAsk('عطيني الرابط'), true);
console.log('pass product_ask_detect');

{
  const same = buildDegradedAdvisorReply('ابي نفس هذا المنتج', [
    { id: 'skin.concern.moisture', labelAr: 'الترطيب', valueAr: 'خفيف' },
  ]);
  assert.match(same, /ما أقدر أتحقق من منتجات ميرا|بحث الكتالوج غير متاح|لم أنفّذ بحثاً/);
  assert.doesNotMatch(same, /مؤشر الترطيب|درجة ترطيب/);
  console.log('pass same_product_not_hydration');
}

{
  const product = buildDegradedAdvisorReply('رشّحي لي واقي شمس من ميرا بأقل من ١٠٠ ريال', []);
  assert.match(product, /ما أقدر أتحقق من منتجات أو خدمات ميرا|بحث الكتالوج غير متاح|لم أنفّذ بحثاً/);
  console.log('pass product_discovery_off');
}

{
  const moistAsk = buildDegradedAdvisorReply('أعطني مرطب للبشرة من ميرا', []);
  assert.match(moistAsk, /ما أقدر أتحقق من منتجات أو خدمات ميرا/);
  assert.doesNotMatch(moistAsk, /Hydra|Moisturizer|هيالورونيك/);
  console.log('pass moisturizer_mira_unavailable');
}

{
  const invented =
    'يمكنك استخدام مرطب "Hydra Boost Moisturizer" من ميرا، فهو يحتوي على حمض الهيالورونيك';
  assert.equal(claimsMiraCatalogProduct(invented), true);
  assert.match(stripInventedMiraCatalogClaims(invented), /ما أقدر أتحقق من منتجات أو خدمات ميرا/);
  console.log('pass strip_invented_mira_sku');
}

{
  const arInvented = 'جرّبي مرطب الندى من ميرا بسعر ٤٩ ريال مع حمض الهيالورونيك';
  assert.equal(claimsMiraCatalogProduct(arInvented), true);
  assert.match(stripInventedMiraCatalogClaims(arInvented), /ما أقدر أتحقق من منتجات أو خدمات ميرا/);
  console.log('pass strip_invented_arabic_sku_price');
}

{
  const serviceInvented = 'جلسة تسريحة اللؤلؤ في ميرا بـ ١٨٠ ريال';
  assert.equal(claimsMiraCatalogProduct(serviceInvented), true);
  assert.match(stripInventedMiraCatalogClaims(serviceInvented), /ما أقدر أتحقق من منتجات أو خدمات ميرا/);
  const grounded = stripInventedMiraCatalogClaims(serviceInvented, [
    { id: 'svc-pearl', titleAr: 'جلسة تسريحة اللؤلؤ', kind: 'service', priceSar: 180 },
  ]);
  assert.equal(grounded, normalizeExpectedDigits(serviceInvented));
  console.log('pass service_claim_requires_published_catalog');
}

{
  const searchIntent = 'أقدر أبحث لك عن مرطب مناسب في ميرا';
  assert.equal(claimsMiraCatalogProduct(searchIntent), false);
  assert.equal(stripInventedMiraCatalogClaims(searchIntent), searchIntent);
  console.log('pass search_intent_not_catalog_claim');
}

{
  const missingPrice = 'مرطب الندى من ميرا بـ ٧٩ ريال';
  const published = [{ id: 'p-dew', titleAr: 'مرطب الندى', kind: 'product', priceSar: null }];
  assert.equal(claimsMiraCatalogProduct(missingPrice), true);
  assert.equal(answerGroundedInPublishedCatalog(missingPrice, published), false);
  const rewritten = stripInventedMiraCatalogClaims(missingPrice, published);
  assert.match(rewritten, /غير مذكور/);
  assert.doesNotMatch(rewritten, /79|٧٩/);
  console.log('pass missing_catalog_price_shows_unspecified');
}

{
  const mixed =
    'جرّبي مرطب الندى من ميرا بـ ٤٩ ريال وجلسة تسريحة اللؤلؤ بـ ١٨٠ ريال';
  const published = [{ id: 'p-dew', titleAr: 'مرطب الندى', kind: 'product', priceSar: 49 }];
  assert.equal(claimsMiraCatalogProduct(mixed), true);
  assert.equal(answerGroundedInPublishedCatalog(mixed, published), false);
  assert.match(stripInventedMiraCatalogClaims(mixed, published), /ما أقدر أتحقق من منتجات أو خدمات ميرا/);
  console.log('pass mixed_grounded_product_plus_invented_service_stripped');
}

{
  const wrongHallalas = 'مرطب الندى من ميرا بـ 49.99 ريال';
  const published = [{ id: 'p-dew', titleAr: 'مرطب الندى', kind: 'product', priceSar: 49, inStock: true }];
  assert.equal(answerGroundedInPublishedCatalog(wrongHallalas, published), false);
  assert.match(stripInventedMiraCatalogClaims(wrongHallalas, published), /ما أقدر أتحقق من منتجات أو خدمات ميرا/);
  const arabicDecimal = 'مرطب الندى من ميرا بـ ٤٩٫٩٩ ريال';
  assert.equal(answerGroundedInPublishedCatalog(arabicDecimal, published), false);
  assert.match(stripInventedMiraCatalogClaims(arabicDecimal, published), /ما أقدر أتحقق/);
  const exact = 'مرطب الندى من ميرا بـ 49 ريال';
  assert.equal(answerGroundedInPublishedCatalog(exact, published), true);
  console.log('pass hallalas_49_vs_4999_and_arabic_decimal');
}

{
  const claimsAvailable = 'واقي شمس النهار من ميرا متوفر بسعر 79 ريال';
  const published = [
    { id: 'p-sun', titleAr: 'واقي شمس النهار', kind: 'product', priceSar: 79, inStock: false },
  ];
  assert.equal(answerGroundedInPublishedCatalog(claimsAvailable, published), false);
  assert.match(stripInventedMiraCatalogClaims(claimsAvailable, published), /ما أقدر أتحقق من منتجات أو خدمات ميرا/);
  console.log('pass out_of_stock_rejects_available_claim');
}

{
  const withGhost =
    'مرطب الندى من ميرا بـ 49 ريال وواقي شمس النهار بـ 79 ريال وكريم سحري بـ 10 ريال';
  const published = [
    { id: 'p-dew', titleAr: 'مرطب الندى', kind: 'product', priceSar: 49, inStock: true },
    { id: 'p-sun', titleAr: 'واقي شمس النهار', kind: 'product', priceSar: 79, inStock: false },
  ];
  assert.equal(answerGroundedInPublishedCatalog(withGhost, published), false);
  assert.match(stripInventedMiraCatalogClaims(withGhost, published), /ما أقدر أتحقق/);
  console.log('pass unpublished_among_two_published_stripped');
}

console.log('OK consultation degraded reply schema tests');

function normalizeExpectedDigits(text: string): string {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  };
  return text.replace(/[٠-٩]/g, (d) => map[d] ?? d);
}
