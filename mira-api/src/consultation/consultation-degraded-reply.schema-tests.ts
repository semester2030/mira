/**
 * Offline advisor replies when LLM_API_KEY is absent — no invented scores.
 */
import assert from 'node:assert/strict';
import { buildDegradedAdvisorReply } from './services/consultation-scope';

{
  const withFact = buildDegradedAdvisorReply('لماذا درجة ترطيبي كذا؟', [
    { id: 'skin.moisture', labelAr: 'الترطيب', valueAr: '٤٢٪' },
  ]);
  assert.match(withFact, /٤٢٪/);
  assert.match(withFact, /الترطيب/);
  assert.doesNotMatch(withFact, /محرك الاستشارة الذكي غير متصل/);
  console.log('pass moisture_from_fact');
}

{
  const missing = buildDegradedAdvisorReply('لماذا درجة ترطيبي كذا؟', []);
  assert.match(missing, /لن أخمن|لا أجد درجة ترطيب/);
  console.log('pass moisture_missing_no_guess');
}

{
  const sunscreen = buildDegradedAdvisorReply('ما أهمية واقي الشمس في روتيني؟', []);
  assert.match(sunscreen, /واقي الشمس/);
  assert.doesNotMatch(sunscreen, /محرك الاستشارة الذكي غير متصل/);
  console.log('pass sunscreen_advice');
}

{
  const generic = buildDegradedAdvisorReply('مرحبا', []);
  assert.match(generic, /غير متصل|إرشاد عناية/);
  console.log('pass generic_degraded');
}

{
  const product = buildDegradedAdvisorReply('رشّحي لي واقي شمس من ميرا بأقل من ١٠٠ ريال', []);
  assert.match(product, /بحث الكتالوج غير مفعّل|لن أخترع بطاقة/);
  console.log('pass product_discovery_off');
}

console.log('OK consultation degraded reply schema tests');
