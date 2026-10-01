# متتبع MC-FIX RC2 — بعد مراجعة 338c26d

نتيجة مراجعة 338c26d: **يحتاج تصحيحًا واستكمال أدلة**

| البند | الخطأ المعالج | التصحيح | الاختبار الفعلي | النتيجة | دليل | المتبقي |
| --- | --- | --- | --- | --- | --- | --- |
| MC-FIX-04 | فقد id/سعر/توافر التركيبة | حالة تركيبات منظمة + تحقق خادم | test:commerce + catalog-options-rc2-tests + public schema | PASS محلي | mc-fix-rc2/ | لقطة متصفح حية اختيارية |
| MC-FIX-05 | إحياء المنشور عند المسح | draftOptionsSet+null = مسح في UI | portal-options + migration | PASS محلي | mc-fix-rc2/portal-options.log | إثبات إدارة حية |
| MC-FIX-05 | ترحيل أعلام false | ترحيل 20261001153000 يهيئ المسودات غير الفارغة | migrate deploy + service test | PASS محلي | migration + test-commerce.log | — |
| MC-FIX-03 | سعة متعارضة + عربي | min سعة شريك + normalize عربي + رفض حفظ متعارض | types+service tests | PASS محلي | test-commerce.log | — |
| MC-FIX-01 | تزامن شراء خارجي | FOR UPDATE على المنتجات قبل التسعير | EXTERNAL بعد flip | PASS محلي | test-commerce.log | سباق حاجز إضافي اختياري |
| MC-FIX-02 | بصمة فارغة = مطابقة | إعادة بناء من السجل أو IDEMPOTENCY_* | legacy fingerprint tests | PASS محلي | test-commerce.log | — |
| MC-FIX-09 | حزمة غير قابلة للتشغيل | شجرة كاملة + اختبار من فك نظيف | unpack npm run test:commerce EXIT 0 | PASS من الفك | /tmp/rc2-unpack-run.log | — |
| MC-FIX-06/08 | متابعة/جهاز | نشر + إنشاء إدارة | قيد | جزئي | deploy | رحلات جهاز |
| MC-FIX-07 | مشاركة/مفضلة/مشاهدات | — | NOT_RUN جهاز | مفتوح/مؤجل مشاهدات | — | جهاز + قرار |
