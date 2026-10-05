# متتبع MC-FIX RC5 — بعد مراجعة MIRA_COMMERCE_MC_FIX_RC4

أساس المراجعة: حزمة RC4 / المصدر `012feb17c367f7d2ded8651cc1edb173707bc579` / sha `b87f4915748ffbdb42e9ad51b1ebf3bb4979b247cbd1606017a22f143fef88d4`.
كود التشغيل المختبر والمنشور: `a3fc689fdc403b412c313b0594cf7a5bcf594626`.
الحزمة: `MIRA_COMMERCE_MC_FIX_RC5.zip` — sha `5860901d59b028c994ee34cb95b6447ad1d96fe85240fa4e851c27352297b217` — 44254059 بايت — missing=0 mismatches=0 extra=0.
لا اعتماد للمرحلة الخامسة. المشاهدات والتخزين الدائم مؤجلان بقرار المالك.

| البند | سبب المشكلة | التصحيح | الاختبار الفعلي | النتيجة | مسار الدليل | commit المختبر | المتبقي |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC5-01 | حذف آخر قيمة لمجموعة مستخدمة يصغّر التركيبة بصمت | تحقق من مجموعات التركيبات المشار إليها؛ تعارض `group_removed` | catalog-options-rc5 (+rc2/rc4) | PASS محليًا | mc-fix-rc5/portal-options.log | a3fc689 | حفظ بوابة مصدّق NOT_RUN |
| RC5-02 | تعديلات متزامنة تمحو سعات موارد مشتركة | expandScheduleScope + أقفال + إعادة قراءة | commerce.lost-update + atomic | PASS PostgreSQL | mc-fix-rc5/test-commerce.log | a3fc689 | توحيد حي من بوابة مصدّقة |
| RC5-03 | deleteService/withdraw خارج بروتوكول الحجز | schedule locks + E5/E6 | concurrency | PASS PostgreSQL | test-commerce.log ؛ LOCK_PROTOCOL.md | a3fc689 | — |
| RC5-04 | harness بدل النموذج؛ analyze بمسار خاطئ | CatalogJourney الحقيقي 390/480/1280؛ analyze من جذر Flutter؛ APK/iOS | portal probe؛ analyze scoped؛ APK؛ iOS | PARTIAL (نموذج حقيقي+بناء PASS؛ مصادقة NOT_RUN) | browser-ui-* ؛ flutter-*.log | a3fc689 | حساب اختبار مصدّق |
| RC5-05 | رحلات جهاز/COD | نشر a3fc689 + محاولات | Render LIVE؛ device PARTIAL؛ journeys NOT_RUN | PARTIAL | LIVE_JOURNEY.txt ؛ device-run.txt | a3fc689 | رحلات مصدّقة |
| RC5-06 | validate/freshness/DEC-0007/WIP | تحديث المراحل وDEC-0007 وMANIFEST | validate_package PASS؛ freshness CURRENT_RECORDED | PARTIAL | site-validate.txt ؛ freshness.txt | a3fc689 | freshness ليس PASS |
| RC5-07 | حزمة قابلة لإعادة التحقق | ZIP+sha خارجي | unpack missing=0؛ validate PASS | حُتمت — بانتظار المراجعة المستقلة | PACKAGE_VERIFY.txt ؛ zip.sha256 | a3fc689 | مراجعة مستقلة |

نشر: api `dep-db1bbklg1s2s739g8vf0` · partners `dep-db1bbklg1s2s739g9080` · admin `dep-db1bc0142hec73eshc3g` — LIVE على `a3fc689`.
