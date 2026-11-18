# تصنيف إخفاقات discover_* (بعد نقل discover_fonts)

تشغيل: `flutter test test/features/marketplace/discover_*.dart`  
بعد النقل: لم يعد `discover_fonts.dart` يُحمَّل كاختبار. الإخفاقات المتبقية من واجهة/نصوص — **ليست مسار كاش الفيديو**.

| # | الاختبار | السبب من السجل | التصنيف | دليل أنه سابق لـ1714؟ |
|---|---|---|---|---|
| 1 | `discover_fonts.dart` loading | ملف مساعد بلا `main` طابقه `discover_*.dart` | **إعداد تشغيل خاطئ** | أُصلح بنقله إلى `test/helpers/load_discover_fonts.dart` |
| 2 | activation: routes stay closed… | المتوقع `DiscoverHubScreen` والفعلي `DiscoverPresentationScreen` | اختبار/تعريف مسار قديم أو تغيّر توجيه | نفس الملف فشل على commit السابق (stash compare: 2 failures) |
| 3 | activation: store link handoff | نص `الشراء من متجر` غير موجود | اختبار UI متقادم أو نسخة نصوص | فشل على النسخة السابقة أيضًا |
| 4–5 | ad_rc5: retry / stale page | نص خطأ التحميل أو إدراج صفحة غير ظاهر | اختبار إعلانات — لا يُضعَّف | يحتاج مقارنة أدق؛ خارج نطاق 1714 |
| 6–7 | phase2: server entry / appointment | نصوص `سيروم…` / `طلب موعد` غير موجودة | اختبار ودجت phase2 | خارج نطاق 1714 |
| 8–9 | presentation: buy / preview buy | نص `أضيفي للسلة` غير موجود | اختبار شراء — **لا يُحذف** | خارج نطاق 1714 |

**الخلاصة:** لا تُعامل التسعة كأعطال منتج في مسار الفيديو. إصلاح مثبت فقط لملف الخطوط. بقية الإخفاقات تبقى مفتوحة كدين اختبارات UI دون إضعافها.
