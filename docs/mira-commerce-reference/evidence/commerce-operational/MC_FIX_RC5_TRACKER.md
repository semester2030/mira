# متتبع MC-FIX RC5 — بعد مراجعة MIRA_COMMERCE_MC_FIX_RC4

أساس المراجعة: حزمة RC4 / المصدر `012feb17c367f7d2ded8651cc1edb173707bc579` / sha `b87f4915748ffbdb42e9ad51b1ebf3bb4979b247cbd1606017a22f143fef88d4`.
سلامة حزمة RC4 مثبتة؛ الإصلاحات الصحيحة فيها محفوظة. لا اعتماد للمرحلة الخامسة. المشاهدات والتخزين الدائم مؤجلان بقرار المالك.

| البند | سبب المشكلة | التصحيح | الاختبار الفعلي | النتيجة | مسار الدليل | commit المختبر | المتبقي |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC5-01 | حذف آخر قيمة لمجموعة مستخدمة يصغّر التركيبة بصمت | تحقق من المجموعات المشار إليها في التركيبات؛ تعارض `group_removed`؛ منع الحفظ | `catalog-options-rc5-tests.mjs` (+ rc2/rc4) | PASS محليًا | mc-fix-rc5/portal-options.log | يُحدَّث عند الالتزام | بوابة مصدّقة 390/480/1280 |
| RC5-02 | تعديلات متزامنة على موارد مشتركة تمحو سعات بعضها | `expandScheduleScope` + أقفال خدمات/موارد + إعادة قراءة قبل unify | `commerce.lost-update` + atomic + concurrency | PASS على PostgreSQL | mc-fix-rc5/test-commerce.log | يُحدَّث عند الالتزام | توحيد حي من البوابة |
| RC5-03 | `deleteService`/withdraw خارج بروتوكول الحجز | سحب/تعطيل/تعديل ضمن schedule locks؛ E5/E6 | concurrency E5/E6 | PASS على PostgreSQL | mc-fix-rc5/test-commerce.log ؛ LOCK_PROTOCOL.md | يُحدَّث عند الالتزام | — |
| RC5-04 | harness بدل النموذج الحقيقي؛ analyze بمسار خاطئ | analyze من جذر Flutter؛ بناء APK/iOS من `lib/main.dart` | analyze scoped؛ APK؛ iOS | قيد التنفيذ | flutter-*.log | يُحدَّث | بوابة مصدّقة |
| RC5-05 | رحلات جهاز/COD ناقصة في RC4 | نشر + رحلات حسابات اختبار | يُحدَّث | قيد التنفيذ / NOT_RUN إن تعذّر الوصول | LIVE_JOURNEY.txt ؛ device-run.txt | يُحدَّث | حسابات اختبار حية |
| RC5-06 | validate/freshness؛ WIP؛ DEC-0007؛ PACKAGE_VERIFY | تحديث المراحل وDEC-0007 وإصلاح الروابط | validate_package + freshness من الفك | قيد التنفيذ | site-validate.txt | يُحدَّث | فحص من الفك النهائي |
| RC5-07 | تسليم قابل لإعادة التحقق | ZIP + sha خارجي + PACKAGE_VERIFY | unpack + inspect | قيد التنفيذ | PACKAGE_VERIFY.txt | بعد الختم | الختم بعد اكتمال الأدلة |

## بروتوكول الأقفال (RC5-03)

انظر `mc-fix-rc5/LOCK_PROTOCOL.md`.
