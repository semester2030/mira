# متتبع MC-FIX RC3 — بعد مراجعة MIRA_COMMERCE_MC_FIX_RC2

أساس المراجعة: حزمة RC2 / المصدر `bbbfa84` — تصحيحات جزئية مثبتة، يحتاج استكمالًا.
لا اعتماد للمرحلة الخامسة. الجولة فوق أحدث HEAD دون الرجوع لـ commit قديم.

| البند | المشكلة | أثرها | التصحيح | الاختبار الفعلي | النتيجة | الدليل | commit المصدر المختبر | المتبقي |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MC-FIX-04/05 | تحقق التركيبات عند إرسال الحقلين معًا فقط | مسودة/منشور غير متسق | `effectiveOptionsVariants` + تحقق الحالة النهائية؛ اعتماد يعيد التحقق | schema + test:commerce | منفّذ ومختبر — بانتظار المراجعة المستقلة | mc-fix-rc3/test-commerce.log | 2e438fd | مراجعة مستقلة |
| MC-FIX-04 UI | إدخال `|` للتركيبات | مسار تقني للتاجر | صفوف اختيار (select) لكل مجموعة | متصفح حي 390/480/1280 + وحدة مشتركة | منفّذ ومختبر — بانتظار المراجعة المستقلة | portal-variant-picker-*.png + portal-options.log | 2e438fd | رحلة حفظ مصدّقة |
| MC-FIX-03 | MIN صامت للسعة المتعارضة | حجوزات على تعريف ملتبس | `findResourceCapacityConflicts` + رفض حجز؛ `unifySharedResources` | test:commerce تعارض staff-shared | منفّذ ومختبر — بانتظار المراجعة المستقلة | mc-fix-rc3/test-commerce.log | 2e438fd | رحلة بوابة حية للتوحيد |
| MC-FIX-01/03 تزامن | نوم/سباق بلا حاجز | إثبات ضعيف | اتصالان + `pg_locks` + FOR UPDATE/advisory | commerce.concurrency.schema-tests | منفّذ ومختبر — بانتظار المراجعة المستقلة | سجل ترتيب الأحداث في test-commerce.log | 2e438fd | — |
| بوابة اختبارات | نسخ دوال في الاختبار | اختبار لا يمس التنفيذ | `catalog-options-core.js` مشترك | portal-options.log | منفّذ ومختبر — بانتظار المراجعة المستقلة | mc-fix-rc3/portal-options.log | 2e438fd | رحلة DOM متصفح |
| منع التكرار | انحدار | — | إعادة تحقق ضمن test:commerce | PASS | منفّذ ومختبر — بانتظار المراجعة المستقلة | test-commerce.log | 2e438fd | — |
| MC-FIX-09 | أصول/خطوط ناقصة بعد الفك | لا تشغيل نظيف | حزمة RC3 كاملة + PACKAGE_VERIFY | فك نظيف + test:commerce/portal/flutter من unpack | منفّذ ومختبر — بانتظار المراجعة المستقلة | mc-fix-rc3/PACKAGE_VERIFY.txt | 2e438fd | مراجعة مستقلة |
| نشر/رحلات | — | — | Render + رحلات HTTP/جهاز | API/بوابات LIVE ebc2869؛ متصفح picker؛ COD/جهاز NOT_RUN | منفّذ ومختبر جزئيًا — بانتظار المراجعة المستقلة | LIVE_JOURNEY.txt | ebc2869 | جهاز + رحلة مصدّقة |

ملاحظة: اختبارات المتصفح وحواجز التزامن **مطلوبة** لقبول الإغلاق — ليست اختيارية.
