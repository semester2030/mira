# متتبع MC-FIX — بعد مراجعة 8ebbf54

تاريخ البدء: 2026-10-01  
أساس المراجعة: `8ebbf54` (كود مطابق `b16c2ed`) → تصحيح MC-FIX على `338c26d`  
نتيجة المراجعة المستقلة لـ 8ebbf54: **تمت المراجعة — يحتاج تصحيحًا واستكمال أدلة**

| معرف | التصحيح | الاختبار الفعلي | النتيجة | دليل | الحالة | المتبقي |
| --- | --- | --- | --- | --- | --- | --- |
| MC-FIX-01 | confirmationFingerprint + QUOTE_STALE | npm run test:commerce EXIT 0 | PASS محلي | mc-fix/test-commerce.log | مختبر محليًا — بانتظار المراجعة المستقلة | رحلة جهاز |
| MC-FIX-02 | requestFingerprint + IDEMPOTENCY_CONFLICT | نفس السجل | PASS محلي | mc-fix/test-commerce.log | مختبر محليًا — بانتظار المراجعة المستقلة | إثبات منشور تفاعلي |
| MC-FIX-03 | resourceId سعة/حجز | نفس السجل room-A/B + shared | PASS محلي | mc-fix/test-commerce.log | مختبر محليًا — بانتظار المراجعة المستقلة | رحلة بوابة→تطبيق منشورة |
| MC-FIX-04 | easy UI فوق JSON | كود بوابة؛ متصفح NOT_RUN | منفّذ مصدرًا | partners-portal/.../catalog-journey.js | قيد التنفيذ | لقطة متصفح |
| MC-FIX-05 | draftOptionsSet + معاينة | كود؛ حي NOT_RUN | منفّذ مصدرًا | admin + catalog-content | قيد التنفيذ | إثبات إدارة حية |
| MC-FIX-06 | متابعة تاجر/إدارة | NOT_RUN على الحي | مفتوح | deploy-338c26d.txt (admin ABSENT) | مفتوح | إنشاء/عنوان لوحة الإدارة |
| MC-FIX-07 | مشاركة/مفضلة/مشاهدات | flutter 164 PASS وحدة؛ مشاهدات مؤجلة | جزئي | flutter-marketplace.log | مفتوح / مؤجل (مشاهدات) | جهاز + قرار مشاهدات |
| MC-FIX-08 | نشر ورحلة | API LIVE؛ جهاز NOT_RUN | جزئي | deploy-338c26d.txt | قيد التنفيذ | رحلات جهاز |
| MC-FIX-09 | حزمة مراجعة | unpack OK 328 ملف | جاهزة للمراجعة | PACKAGE_VERIFY.txt + Desktop ZIP | بانتظار المراجعة المستقلة | قرار المراجع |

## نشر

- commit المختبر: `338c26d`
- mira-api: https://mira-api-n4p3.onrender.com — deploy `dep-dav20o5g1s2s73d7fqd0` LIVE
- partners: https://mira-partners-portal.onrender.com
- admin Render service: **غير موجود** في الحساب

## قرارات مفتوحة

- عدّ المشاهدات: مؤجل بقرار المالك (غير مفعّل).
- تخزين الوسائط الدائم: مؤجل سابقًا.
