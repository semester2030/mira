# متتبع MC-FIX RC6 — بعد مراجعة MIRA_COMMERCE_MC_FIX_RC5

أساس المراجعة: حزمة RC5 / المصدر `a3fc689fdc403b412c313b0594cf7a5bcf594626` / sha `5860901d59b028c994ee34cb95b6447ad1d96fe85240fa4e851c27352297b217`.
حالة RC5 بعد المراجعة المستقلة: **تمت مراجعته — يحتاج تصحيحًا** (البندان المتبقيان: حماية الخيارات عند تغيير التصنيف؛ بروتوكول الأقفال عند اتساع الموارد + اختبارات إنتاجية).
لا اعتماد للمرحلة الخامسة. المشاهدات والتخزين الدائم مؤجلان بقرار المالك.

| البند | السبب الجذري | التصحيح | الاختبار الفعلي | البيئة | النتيجة | الدليل | commit | المتبقي |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RC6-01 | تغيير التصنيف يسقط مجموعات محفوظة؛ `readCommerce` يرسل `optionsJson=null` بلا مسح صريح عندما لا توجد تركيبات | `incompatibleGroupIds` + تعارض `category_incompatible`؛ الإبقاء على المجموعات؛ زر العودة للتصنيف السابق؛ لا null دون `clearingOptions` | catalog-options-rc6؛ CatalogJourney 390/480/1280 | محلي + Playwright | PASS | mc-fix-rc6/portal-options.log ؛ browser-ui-* | (يُثبَّت عند الختم) | حفظ بوابة مصدّق إن وُجدت حسابات |
| RC6-02 | `updateService` يكتسب أقفال موارد إضافية بعد الانتظار بترتيب يناقض المحمول → انتظار دائري | `lockPartnerScheduleScope`: قفل تنسيق جهة → إعادة قراءة → توسيع → مجموعة أقفال مرتبة مرة واحدة | control deadlock + concurrent updateService بعد نمو النطاق | PostgreSQL محلي | PASS | lock-protocol.log ؛ LOCK_PROTOCOL.md | (يُثبَّت) | — |
| RC6-03 | E5/E6 السابقان ليسا مسارَي إنتاج كاملين للاتجاهين | اختبارات تستدعي `deleteService`/`createBooking`/`catalog.decide` مع بوابة `MIRA_TEST_SCHEDULE_GATE` | E5b/E6b/ADMIN/CAP1 + atomic/lost-update | PostgreSQL محلي | PASS | test-commerce.log | (يُثبَّت) | — |
| RC6-04 | RC5 اختار الوجه ولم يثبت تعارض التصنيف/الملابس؛ الحفظ محجوب | مجس CatalogJourney: ملابس M/L/XL+ألوان؛ وجه→ملابس تعارض؛ revert؛ group_removed | Playwright 390/480/1280 | محلي | PASS للنموذج؛ AUTH/device قيد الاستكمال | browser-ui-journey.txt ؛ portal-form-*.png | (يُثبَّت) | رحلات مصدّقة / iPhone |
| RC6-05 | سجل analyze بـ exit مضلّل | analyze من جذر المشروع؛ تسجيل exit عملية Flutter؛ scoped marketplace منفصل | `flutter analyze` كامل + scoped | محلي | كامل: exit≠0 (أخطاء سابقة خارج التجارة)؛ scoped يُسجَّل | flutter-analyze.log ؛ flutter-analyze-scoped.log | (يُثبَّت) | إصلاح أخطاء ناتجة عن تغييرات RC6 فقط |
| RC6-06 | RC5 يحتاج تحديث حالة المراجعة + بطاقات RC6 | بطاقات RC6 + تحديث RC5 → تمت مراجعته؛ روابط الحزمة | validate_package / freshness | موقع مرجعي | قيد التحديث | MC_FIX_RC6_TRACKER ؛ discover-phases | (يُثبَّت) | ختم ZIP |
| RC6-07 | حزمة قابلة لإعادة التحقق | ZIP+sha+verification+unpack | فك نظيف + إعادة اختبارات | سطح المكتب | قيد التنفيذ | PACKAGE_VERIFY.txt | (يُثبَّت) | مراجعة مستقلة |

## بروتوكول الأقفال (ملخص)

انظر `mc-fix-rc6/LOCK_PROTOCOL.md`.
