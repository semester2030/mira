# P1 RC2 — إغلاق ملاحظات مراجعة RC1

| # | الملاحظة | الإصلاح | الاختبار | الدليل |
|---|---|---|---|---|
| 1 | عزل الحسابات: مؤقت A يرسل بجلسة B | `editor-v2.js` يلتقط partnerId+sessionEpoch عند الجدولة ويتحقق قبل الإرسال/الاستجابة؛ إلغاء عند الخروج/التبديل | `editor-v2-isolation.tests.mjs` | `logs/rc2-account-isolation.txt` |
| 2 | `values.serviceProfile` → REGISTRY_UNKNOWN_FIELD | إضافة `serviceProfile` للسجل + أنشطة الخدمة؛ تحقق متداخل للقالب | validation + HTTP | `logs/rc2-registry-validation.txt`, `logs/rc2-http-integration.txt` |
| 3 | رحلة المسودات ناقصة (منتجات / list / materialize UI) | autosave للمنتجات والخدمات؛ لوحة مسودات؛ زر materialize؛ مسار قالب موحّد داخل المسودة | HTTP + كود بوابة | `dashboard.html`, `catalog-journey.js` |
| 4 | تحقق ضعيف (array / قالب / قيم) | دعم `array`، رفض أنواع غير مدعومة، كتالوج قوالب، صلاحية الشريك | 9 قوالب + سلبيات | `logs/rc2-registry-validation.txt` |
| 5 | colors/sizes لا تُحوَّل؛ aliases Flutter | `optionsJsonFromDraftValues`؛ canonical → snake_case Flutter + adapter | HTTP + Flutter | `logs/rc2-http-integration.txt`, `logs/rc2-flutter-tests.txt` |
| 6 | materialize ثم فشل submit بلا استئناف | `submitReviewStatus` + 503 صادق + إعادة بنفس المفتاح | HTTP resume | `logs/rc2-http-integration.txt` |

## فصل الحالات

| جزء | إصلاح الكود | اختبار معزول | رحلة بوابة متصفح | Staging | جهاز |
|---|---|---|---|---|---|
| P1.1 | IMPLEMENTED | PASS_LOCAL | NOT_RUN (لا متصفح آلي هنا) | NOT_RUN | — |
| P1.2 | IMPLEMENTED | PASS_LOCAL | PARTIAL (لوحة+autosave في الكود؛ لا Playwright) | NOT_RUN | — |
| P1.3 | IMPLEMENTED | PASS_LOCAL | PARTIAL | NOT_RUN | NOT_RUN |
