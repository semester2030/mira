# P1 RC6 — إغلاق عيوب مراجعة RC5

| # | العيب | الإصلاح | الاختبار | الدليل | الحالة |
|---|---|---|---|---|---|
| 1 | putServiceProfile بعد get-latest يتجاوز التعارض | ربط `boundServiceReviewRevision` عند الفتح؛ put أولاً ثم updateService | RC6-01 | logs/rc6-browser-e2e.txt | PASS_LOCAL |
| 2 | preserveCtx يعيد priceMode/answers قديمة | تحديث values.serviceProfile من نتيجة الحفظ بنسخ عميق | RC6-02 | logs/rc6-browser-e2e.txt | PASS_LOCAL |
| 3 | reopen يوجّه الخدمة لـ serviceForm بينما الصالون على catalogForm | `resolveFormTarget` موحّد + preferredFormId | RC6-03 | logs/rc6-browser-e2e.txt | PASS_LOCAL |
| 4 | فحص الجلسة قبل اكتمال json | التحقق بعد `res.json()` في api.js | RC6-04 | logs/rc6-browser-e2e.txt | PASS_LOCAL |
| 5 | استجابة قديمة بعد تبديل/نموذج | AUTH_CHANGED + seq supersede + فحوصات conflict reload | RC6-05 | editor-v2 + api | PASS_LOCAL |
| 6 | «محفوظ» أثناء مدخل باطل | clearFormPendingQueue يرفع seq؛ تجاهل نجاح seq قديم | RC6-06 | logs/rc6-browser-e2e.txt | PASS_LOCAL |
