# متتبع MC-FIX RC4 — بعد مراجعة MIRA_COMMERCE_MC_FIX_RC3

أساس المراجعة: حزمة RC3 / المصدر `2e438fd` / sha `d33a94…` / نشر `ebc2869`.
الحزمة الحالية: `MIRA_COMMERCE_MC_FIX_RC4.zip` — sha `b87f4915748ffbdb42e9ad51b1ebf3bb4979b247cbd1606017a22f143fef88d4` — 43033408 بايت — 2277 ملفًا (manifest) — مطابقة missing=0 mismatches=0 extra=0.
مصدر التشغيل المختبر والمنشور: `012feb17c367f7d2ded8651cc1edb173707bc579` (توثيق لاحق للختم `5329d85` دون تغيير كود التشغيل داخل ZIP المختوم).
لا اعتماد للمرحلة الخامسة. المشاهدات والتخزين الدائم مؤجلان بقرار المالك.

| البند | سبب المشكلة | التصحيح | الاختبار الفعلي | النتيجة | مسار الدليل | commit المختبر | المتبقي |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC4-01 | قوائم التركيبة لا تُحدَّث بعد اختيار القيم | `refreshVariantPickers` + `MiraCatalogOptions` مسار الحفظ | catalog-options-rc4؛ harness متصفح؛ من الفك | منفّذ ومختبر — بانتظار المراجعة المستقلة | mc-fix-rc4/portal-options.log ؛ browser-ui-journey.txt | 012feb1 | حفظ بوابة مصدّق بحساب شريك |
| RC4-02 | أقفال حجز/تعديل غير موحّدة؛ اختبار RC3 لا يمر بـ updateService | `commerce-schedule-locks` partner-scoped + حاجز pg_locks | commerce.concurrency من المستودع والفك | منفّذ ومختبر — بانتظار المراجعة المستقلة | mc-fix-rc4/test-commerce.log ؛ concurrency-events.txt | 012feb1 | — |
| RC4-03 | unify قبل create خارج معاملة | createService ذري + تحقق أولًا + تراجع محقون | commerce.create-service-atomic | منفّذ ومختبر — بانتظار المراجعة المستقلة | mc-fix-rc4/test-commerce.log | 012feb1 | توحيد حي من بوابة مصدّقة |
| RC4-04 | استيرادات Dart؛ AGP/NDK vs camera | مسارات ثيم؛ Kotlin 2.1.0؛ AGP 8.9.1؛ NDK 28.2 | analyze؛ APK من المستودع والفك؛ iOS build | منفّذ ومختبر — بانتظار المراجعة المستقلة | flutter-apk.log ؛ unpack-flutter.log ؛ device-run.txt | 012feb1 | رحلة جهاز مكتملة (PARTIAL الآن) |
| RC4-05 | أدلة تجميع ناقصة | فك→اختبار→manifest→ZIP→sha خارجي | PACKAGE_VERIFY + VERIFICATION | منفّذ ومختبر — بانتظار المراجعة المستقلة | PACKAGE_VERIFY.txt ؛ zip.sha256 | 012feb1 | رحلات COD/حجز حية |
| RC4-06 | موقع غير مضمّن في RC3 | بطاقة RC4 + تحديث RC3 في PH-5 + موقع داخل الحزمة | generate_data_js؛ site-check من الفك | منفّذ ومختبر — بانتظار المراجعة المستقلة | discover-phases.json ؛ site-check.txt | 012feb1 | — |

نشر: api `dep-db1aik5ckfvc73di3110` · partners `dep-db1aik5ckfvc73di31mg` · admin `dep-db1aj3hsrm7s73aqvbf0` — كلها LIVE على `012feb1`.
