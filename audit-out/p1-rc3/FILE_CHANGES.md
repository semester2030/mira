# FILE_CHANGES RC3

## بوابة
- `partners-portal/web/js/api.js` — authGeneration، AbortSignal، أخطاء منظمة، saveSession يعزل قبل التوكن
- `partners-portal/web/js/editor-v2.js` — عزل auth+epoch، flush صريح، hash السجل، editContext، signal
- `partners-portal/web/js/catalog-journey.js` — draftCtx، buildEditorValues كامل، gate التحويل، scoped keys
- `partners-portal/web/dashboard.html` — فتح مسودة بالسياق الكامل
- `partners-portal/web/js/editor-v2-isolation.tests.mjs` — saveSession الحقيقي

## API
- `registry.service.ts` — إصدار قالب مدعوم، answers object، حدود الأعداد
- `registry.validation.schema-tests.ts` — سلبيات RC3
- `editor-v2-rc3.http.integration-tests.ts` — round-trip + عزل الشركاء
- `scripts/p1-rc3-browser-*.ts/mjs` — رحلة متصفح

## Flutter
- بدون تغيير سلوكي إضافي عن RC2 (اختبارات PASS_LOCAL)
