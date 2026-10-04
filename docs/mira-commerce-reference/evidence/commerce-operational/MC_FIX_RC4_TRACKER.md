# متتبع MC-FIX RC4 — بعد مراجعة MIRA_COMMERCE_MC_FIX_RC3

أساس المراجعة: حزمة RC3 / المصدر `2e438fd` / sha `d33a94…` / نشر `ebc2869` (توثيق لاحق `8383b44`).
سلامة ZIP مثبتة؛ ست ملاحظات إغلاق تفتح هذه الجولة. لا اعتماد للمرحلة الخامسة.
المشاهدات والتخزين الدائم: مؤجلان بقرار المالك (ليس خطأ مفتوحًا في هذه الجولة).

| البند | سبب المشكلة | التصحيح | الاختبار الفعلي | النتيجة | مسار الدليل | commit المختبر | المتبقي |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC4-01 | قوائم التركيبة تُبنى قبل القيم ولا تُحدَّث عند اختيار المقاس | `refreshVariantPickers` + `MiraCatalogOptions.buildOptionGroups`/`structuredOptionsPayload` | catalog-options-rc4-tests + اختبارات RC2 | منفّذ ومختبر محليًا — بانتظار المراجعة المستقلة | mc-fix-rc4/portal-options.log | فوق 8383b44 (WIP) | متصفح مصدّق 390/480/1280 |
| RC4-02 | قفل حجز غير مقيّد بالجهة؛ تعطيل الاختبار لا يمر بـ updateService | `commerce-schedule-locks` مشترك؛ اختبارات حاجز + updateService | commerce.concurrency.schema-tests | منفّذ ومختبر محليًا — بانتظار المراجعة المستقلة | mc-fix-rc4/test-commerce.log | فوق 8383b44 (WIP) | — |
| RC4-03 | unify قبل create خارج معاملة | createService ذري + تحقق أولًا + تراجع محقون | commerce.create-service-atomic.schema-tests | منفّذ ومختبر محليًا — بانتظار المراجعة المستقلة | mc-fix-rc4/test-commerce.log | فوق 8383b44 (WIP) | بوابة حيّة |
| RC4-04 | استيرادات Dart مكسورة؛ AGP 8.7 vs camera 1.6؛ NDK قديم | مسارات ثيم؛ Kotlin 2.1.0؛ AGP 8.9.1؛ NDK 28.2 | flutter analyze؛ build apk (جاري/مسجّل) | قيد التحقق | mc-fix-rc4/flutter-*.log | فوق 8383b44 (WIP) | APK/iOS/جهاز |
| RC4-05 | أدلة تجميع ناقصة في RC3 | فك→اختبار→manifest→ZIP→sha | يُسجَّل عند الختم | قيد التنفيذ | mc-fix-rc4/PACKAGE_VERIFY.txt | — | نشر + LIVE |
| RC4-06 | موقع/بيانات غير مضمّنة في RC3 | بطاقة RC4 + تحديث RC3 في PH-5 | generate_data_js | منفّذ مصدرًا — بانتظار فحص الفك | MC_FIX_RC4_TRACKER.md + data/ | فوق 8383b44 (WIP) | freshness من الفك |

الحالة النهائية للبنود التي اجتازت تحققها: **منفّذ ومختبر — بانتظار المراجعة المستقلة**.
