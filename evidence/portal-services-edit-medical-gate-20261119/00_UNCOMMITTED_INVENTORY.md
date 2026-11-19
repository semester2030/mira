# جرد التغييرات غير الملتزم بها عند إنشاء PR السابق + حالة هذا التصحيح

المصدر: تحذير «27 uncommitted changes» عند إنشاء طلب الدمج لـ production-services-events، ثم حالة العمل الحالية على فرع `mira/portal-services-edit-medical-gate`.

## ما دخل الإصدار المنشور `80f1766` (PR #16)
- تعديلات Flutter للتفاصيل / زيارة / مناسبات (مسارات التطبيق في ذلك الـ PR).
- تصنيف الجمال defs=3 ودوائر العرض الأربع في مسار الاكتشاف المنشور.
- ترحيلات/مسارات المناسبات إن وُجدت في ذلك الـ commit.

## ما بقي خارج `80f1766` وكان خطر نسيان (من جولة التفاصيل/القبول السابقة)
- `evidence/detail-template-audit-20261119/**` وملفات raw للبناء 1930/2000 — أدلة قبول، ليست كود تشغيل.
- `evidence/details-visual-acceptance-202611192000/` — حزمة قبول سابقة.
- `evidence/unified-prod-release-20261119/**` و `mira-production-services-events/baseline/*` — سجلات نشر/جهاز.
- `test/features/marketplace/product_detail_visual_capture_test.dart` — اختبار التقاط قد يعلّق؛ لم يُدمج كجزء من بوابة الإنتاج.
- `ios/Podfile.lock` — فرق قفل كوكوا بودز محلي؛ يُراجع مع بناء الآيفون التالي فقط إذا لزم.

## ما يشمله هذا التصحيح (يجب نشره الآن)
- بوابة: `e2b-service-shell.js` مسار `#/services/edit` (مقدّم→مجموعة→خدمة→تفاصيل)، حذف الليزر/الأسنان من الدوائر.
- بوابة: `catalog-journey.js`, `portal-shell.js`, `registry-attribute-fields.js`, `editor-v2.js`.
- خادم: بوابة إنشاء/تحديث خدمة + رفض نشر طبي في `catalog-content.service.ts`.
- اسألي ميرا: رفض ليزر/أسنان صريح.
- تصنيف: `beauty.experts` مربوط بتخصصات المكياج/الرموش/الحناء؛ الطبي `writeEnabled=false`.

## ما يبقى بلا اختبار جهاز حتى تُلتقط لقطات من البناء الجديد
- مطابقة التصميم الأربع شاشات على الآيفون.
- رحلتا الحجز الطرفين كاملتين ببيانات معزولة على الجهاز.
