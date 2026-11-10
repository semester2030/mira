# جدول معالجة ملاحظات الاختبار — أناقتك

التاريخ: 2026-11-10T18:30:00Z  
الأساس: `mira-elegance-taxonomy-orbs-20261110T180219Z-4721da1` + إصلاحات لاحقة

| المشكلة | الإصلاح | الاختبار | الدليل | الحالة |
|---|---|---|---|---|
| اختفاء الحفظ/النشر في خطوات الجوال | فصل `editor-actions` عن tail + فرض الإظهار + كشف الخطوة عند خطأ | `e2b-mobile-actions-always.tests.mjs` | CSS/JS مصدر | منفّذ |
| عودة القيم اليدوية بعد المسح | تفريغ `customsList`/`inputModes`؛ clone كامل؛ معاينة مشتركة | `catalog-options-clear-restore.tests.mjs` | مشمشي/زيتوني→مسح→أسود فقط | منفّذ |
| itemDimensions غير معروض | ويدجت أبعاد + مزامنة dimensionsCm | `registry-attribute-dimensions.tests.mjs` | widget dimensions | منفّذ |
| جاهز/يدوي للخامة/الحمل | أوضاع إدخال + `custom:` مع تحقق خادمي | validate custom accept / random reject | API validate | منفّذ |
| مجموعات بلا subcategory | تمرير السياق وإعادة mount | مراجعة `bulk-group-journey.js` | mount args | منفّذ |
| نشر + Release جهاز | بعد اجتياز الاختبارات | Render + flutter | بعد push | منفّذ |
