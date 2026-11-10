# جدول معالجة ملاحظات الاختبار — أناقتك

التاريخ: 2026-11-10T21:45:00Z  
الأساس: `mira-elegance-taxonomy-orbs-20261110T182252Z-b7ce901` + إغلاق المتبقي

| المشكلة | الإصلاح | الاختبار | الدليل | الحالة |
|---|---|---|---|---|
| أبعاد: خطأ ظاهر لكن validate=ok ويُرسل 12 القديمة بعد -5 | تحقق محاور `itemDimensions.w/h/d` عبر `invalidInputs` + منع patch أثناء المسودة غير الصالحة + تحقق خادمي موحّد مع `dimensionsCm` | `registry-attribute-dimensions-manual.tests.mjs` + schema API | 12→-5 يمنع الحفظ؛ 15 يُحفظ ويُستعاد | منفّذ |
| يدوي: «جلد طبيعي 100%» → slug وتصادم مع «جلد طبيعي 100» | `customAttrLabels` + معرّف مستقر غير متصادم؛ عرض النص الأصلي عند إعادة الفتح | نفس ملف الاختبار + `CUSTOM_LABELS_*` API | النص الأصلي بعد reopen؛ معرّفان مختلفان | منفّذ |
| اختفاء الحفظ/النشر في الجوال | فصل `editor-actions` عن خطوات الإخفاء | `e2b-mobile-actions-always.tests.mjs` | انحدار | محفوظ |
| مسح يدوي يعيد القيم | تفريغ `customsList` كاملًا | `catalog-options-clear-restore.tests.mjs` | انحدار | محفوظ |
| مجموعات بلا subcategory | تمرير السياق إلى mount | `bulk-group-journey.js` | انحدار | محفوظ |
| نشر + Release جهاز | بعد اجتياز الاختبارات | Render + flutter | يُسجَّل عند التنفيذ الفعلي | قيد التنفيذ |
