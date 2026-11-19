# تصنيف إخفاقات discover_* — 1715

سجل كامل: `raw/flutter_test_discover_suite_1715.txt` → **153 نجاحًا / 8 إخفاقات**  
(بعد نقل الخطوط؛ لم يعد `discover_fonts` يُحسب).

| # | الاختبار | الرسالة | التصنيف | إثبات سابق؟ |
|---|---|---|---|---|
| 1 | activation: routes stay closed | Expected DiscoverHubScreen, got DiscoverPresentationScreen | اختبار توجيه/define — ليس كاش فيديو | فشل على commit قبل تعديلات 1714 (stash compare) |
| 2 | activation: store link handoff | نص «الشراء من متجر» غير موجود | اختبار UI نصوص | كذلك سابق |
| 3–4 | ad_rc5 retry / stale page | نص خطأ التحميل أو إدراج غير ظاهر | اختبار إعلانات | خارج مسار 1715؛ **لم يُضعَّف** |
| 5–6 | phase2 server / appointment | نصوص كتالوج/موعد غير موجودة | اختبار phase2 | خارج المسار |
| 7–8 | presentation buy / preview buy | «أضيفي للسلة» غير موجود | اختبار شراء | خارج المسار؛ **لم يُحذف** |

اختبارات المشغّل ذات الصلة:  
`asset_video_port_test` + `discover_sync_video_a_image_a_test` → **نجحت** (`raw/flutter_test_asset_video_port_1715.txt`).
