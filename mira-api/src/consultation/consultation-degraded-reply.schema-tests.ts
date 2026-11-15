/**
 * Offline advisor replies when LLM_API_KEY is absent — no invented scores / no English mild.
 */
import assert from 'node:assert/strict';
import {
  buildDegradedAdvisorReply,
  isProductOrCatalogAsk,
  resolveMoistureDisplay,
  severityLabelAr,
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

{
  const same = buildDegradedAdvisorReply('ابي نفس هذا المنتج', [
    { id: 'skin.concern.moisture', labelAr: 'الترطيب', valueAr: 'خفيف' },
  ]);
  assert.match(same, /بحث الكتالوج غير متاح|لم أنفّذ بحثاً/);
  assert.doesNotMatch(same, /مؤشر الترطيب|درجة ترطيب/);
  console.log('pass same_product_not_hydration');
}

{
  const product = buildDegradedAdvisorReply('رشّحي لي واقي شمس من ميرا بأقل من ١٠٠ ريال', []);
  assert.match(product, /بحث الكتالوج غير متاح|لم أنفّذ بحثاً/);
  console.log('pass product_discovery_off');
}

console.log('OK consultation degraded reply schema tests');
