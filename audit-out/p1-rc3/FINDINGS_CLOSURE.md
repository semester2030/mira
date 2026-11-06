# P1 RC3 — إغلاق عيوب مراجعة RC2

| # | العيب | الإصلاح | الاختبار | الدليل | الحالة |
|---|---|---|---|---|---|
| 1 | حفظ A بجلسة B عبر `saveSession` قبل وصول partner metadata | `api.js` يرفع `authGeneration` ويمسح `mira_partner_id` قبل كتابة التوكن؛ `editor-v2` يربط الطلب بـ authGeneration+tokenFingerprint ويمرّر AbortSignal | عزل وحدة + متصفح | `logs/rc3-account-isolation.txt`, `logs/rc3-browser-e2e.txt` | PASS_LOCAL |
| 2 | فتح مسودة بلا الحفاظ على clientDraftId / قيم بلا targetOwnerId | `bindEditContext` + `draftCtx` في `renderForm`/`dashboard`؛ تحميل القيم والقالب قبل الرسم | متصفح جلسة ثانية | `logs/rc3-browser-e2e.txt` | PASS_LOCAL |
| 3 | `buildEditorValues` يسقط colors/sizes/stock/… وautosave ناقص | توسيع القيم + ربط nameEn/description/options/commerce | HTTP round-trip + متصفح | `logs/rc3-http-integration.txt` | PASS_LOCAL |
| 4 | flush يفشل ثم materialize يمضي | `flush`/`flushUntilSettled` يعيدان نتيجة صريحة؛ التحويل يتوقف إن لم `ok` | متصفح | `logs/rc3-browser-e2e.txt` | PASS_LOCAL |
| 5 | templateVersion=9999 / answers[] / package_sessions=-4 | رفض إصدار غير مدعوم، رفض مصفوفة answers، حدود الأعداد | validation + HTTP | `logs/rc3-registry-validation.txt`, `logs/rc3-http-integration.txt` | PASS_LOCAL |
| 6 | hash سجل الواجهة غير مهيأ | حساب SHA-256 من `field-registry.v2.json` قبل تمكين الكتابة | bootstrap + sync | `logs/rc3-registry-sync.txt` | PASS_LOCAL |
| 7 | materialize ثم فشل submit | الإبقاء على RC2 + مسار متصفح: فشل صادق ثم رفع وسائط ثم submit | متصفح | `logs/rc3-browser-e2e.txt` | PASS_LOCAL |
