/**
 * Offline advisor replies when LLM_API_KEY is absent — no invented scores / no English mild.
 */
import assert from 'node:assert/strict';
import {
  buildDegradedAdvisorReply,
  claimsMiraCatalogProduct,
  isProductOrCatalogAsk,
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
  assert.match(product, /ما أقدر أتحقق من منتجات ميرا|بحث الكتالوج غير متاح|لم أنفّذ بحثاً/);
  console.log('pass product_discovery_off');
}

{
  const moistAsk = buildDegradedAdvisorReply('أعطني مرطب للبشرة من ميرا', []);
  assert.match(moistAsk, /ما أقدر أتحقق من منتجات ميرا/);
  assert.doesNotMatch(moistAsk, /Hydra|Moisturizer|هيالورونيك/);
  console.log('pass moisturizer_mira_unavailable');
}

{
  const invented =
    'يمكنك استخدام مرطب "Hydra Boost Moisturizer" من ميرا، فهو يحتوي على حمض الهيالورونيك';
  assert.equal(claimsMiraCatalogProduct(invented), true);
  assert.match(stripInventedMiraCatalogClaims(invented), /ما أقدر أتحقق من منتجات ميرا/);
  console.log('pass strip_invented_mira_sku');
}

{
  const arInvented = 'جرّبي مرطب الندى من ميرا بسعر ٤٩ ريال مع حمض الهيالورونيك';
  assert.equal(claimsMiraCatalogProduct(arInvented), true);
  assert.match(stripInventedMiraCatalogClaims(arInvented), /ما أقدر أتحقق من منتجات ميرا/);
  console.log('pass strip_invented_arabic_sku_price');
}

console.log('OK consultation degraded reply schema tests');
