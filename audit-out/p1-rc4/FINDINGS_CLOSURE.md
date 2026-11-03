# P1 RC4 — إغلاق العيوب الخمسة

| # | العيب | الإصلاح | اختبار إعادة الإنتاج | الدليل | الحالة |
|---|---|---|---|---|---|
| 1 | optionsJson مجهول + M→m + أسود≠black | سجل optionsJson/variantsJson + canonical ids في catalog-options-core + presets ألوان | options-registry-contract + HTTP UI-shaped + متصفح chips | logs/rc4-http-integration.txt, logs/rc4-browser-e2e.txt | PASS_LOCAL |
| 2 | استئناف materialize يعيد PUT | حالة submit_failed + resume storage + زر استئناف بلا PUT | متصفح: فشل submit ثم وسائط ثم نجاح | logs/rc4-browser-e2e.txt | PASS_LOCAL |
| 3 | persistListing موازي لـ v2 | عند v2 الحفظ عبر المسودة؛ لا pushServiceProfile فوق latest revision | كود + رحلة أزرار | catalog-journey.js | PASS_LOCAL |
| 4 | تجاهل خطأ readCommerce | buildEditorValues يعيد ok/fieldErrors ويمنع الحفظ | منطق + حفظ خيارات صالح | PASS_LOCAL |
| 5 | cancelAllPending عند فتح نموذج | cancelFormPending لكل نموذج | عزل منتج/خدمة في المتصفح | PASS_LOCAL |
