# P1 RC5 — إغلاق عيوب مراجعة RC4

| # | العيب | السبب | الإصلاح | اختبار إعادة الإنتاج | الدليل | الحالة |
|---|---|---|---|---|---|---|
| 1 | إنشاء مكرر بعد materialize | قيمة editing لقطة عند بناء النموذج | resolveOwnerId حي + الحفاظ على clientDraftId بعد الحفظ | T01/T02/T03 | logs/rc5-browser-e2e.txt | PASS_LOCAL |
| 2 | إعادة تحميل تعارض ناقصة | نسخ حقول بالاسم فقط | CatalogJourney.reopenServerDraft كاملة + suppressAutosave | T04/T05/T06 | screenshots/rc5-conflict-*.png | PASS_LOCAL |
| 3 | قيم غير صالحة تُسقط | null من riyalsToHalalas يحذف الحقل | تفريق فارغ/صالح/باطل في buildEditorValues | T07 | logs/rc5-browser-e2e.txt | PASS_LOCAL |
| 4 | PASS غير مشروط في RC4 | فرعا شرط يمرّان؛ تجاوز زر التعارض | تأكيد نص/حقول/معرّف؛ تسمية كاتب API بدقة | e2e صارم | logs/rc5-browser-e2e.txt | PASS_LOCAL |
