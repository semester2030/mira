# P1 RC4 — إغلاق العيوب الخمسة

| # | العيب | الإصلاح | اختبار إعادة الإنتاج | الدليل | الحالة |
|---|---|---|---|---|---|
| 1 | optionsJson مجهول + M→m + أسود≠black | سجل optionsJson/variantsJson + canonical ids | options-contract + HTTP + متصفح chips | logs/rc4-http-integration.txt, logs/rc4-browser-e2e.txt | PASS_LOCAL |
| 2 | استئناف materialize يعيد PUT | حالة submit_failed + resume + زر بلا PUT | متصفح فشل ثم وسائط ثم نجاح | logs/rc4-browser-e2e.txt | PASS_LOCAL |
| 3 | persistListing موازي + overwrite revision | v2 عبر المسودة؛ لوحة تعارض صريحة reload/keep | browser-dual-session-conflict + HTTP A05 | logs/rc4-browser-e2e.txt | PASS_LOCAL |
| 4 | تجاهل خطأ readCommerce | buildEditorValues → ok/fieldErrors | منطق + حفظ صالح | PASS_LOCAL |
| 5 | cancelAllPending عند فتح نموذج | cancelFormPending لكل نموذج | عزل منتج/خدمة | PASS_LOCAL |
