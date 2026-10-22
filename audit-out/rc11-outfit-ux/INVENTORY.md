# RC11 Outfit UX — inventory (before edits)

API live: https://mira-api-n4p3.onrender.com · Redis AVAILABLE · tip 4bcf6e7
Failing save: POST /api/v1/outfit-analysis/snapshots → 400 (4 hits @ 01:27–01:28Z, Dart client)
Tracking shown: c-1792632474988668 (client microseconds form)

| مطلب | الحالة | مسار | دليل |
|---|---|---|---|
| شاشة 4 تبويبات | موجود ويعمل | `outfit_studio_screen.dart` | إطلالتك/ألوانك/جرّبي/دولابك + اسألي ميرا |
| حفظ التقرير قبل المحادثة | موجود ويحتاج إصلاحاً | `mira_advisor_screen.dart` · `save-outfit-snapshot.dto.ts` | `clientSaveId = μs-SHA256` يتجاوز MaxLength(64) → 400 |
| clientSaveId ذري | موجود ويعمل (خادم) | migration `20261022020000` · service | LIVE بعد 207871b؛ لا 400 بعد 01:28:20 إن لم يُعاد الإرسال |
| mapper بدون scoreSupported | موجود ويعمل | `outfit_consultation_mapper.dart` | يرسل الدرجات فقط إن scoreSupported |
| دائرة نبيتي وردية | موجود ويحتاج إصلاحاً | `FashionColorBinding` · `FashionColorLibrary.byName('نبيتي')` | بدون alias قد تُطابق «نبيتي فاتح جداً» #ECD5D5 |
| عدم أسود افتراضي | موجود ويعمل | VisionColorMapper · recolor panel | RC10 |
| فصل قناع التلوين عن التعرف | موجود جزئياً | segmentMap · recolor panel | يحتاج وضوح أهلية قبل الخيارات |
| غياب الدرجة ≠ 0 | موجود ويحتاج إصلاحاً | `_HistoryTile` يستخدم `score > 0` كدليل دعم | يجب scoreSupported / بدون درجة مدعومة صراحة |
| سجل دولابك | موجود ويحتاج تحسيناً | `_WardrobePage` | قائمة نصية؛ بلا شبكة مصغّرات/مقارنة |
| ألوان مرصودة كدوائر | غير موجود في الاستديو | `_ColorsPage` بطاقات نص فقط | إضافة دوائر من FashionColorBinding المشتركة |
| تصميم مطوي للصورة | موجود ويحتاج تحسيناً | `_Photo` ارتفاع ثابت 42% | تصغير عند التمرير |
| نطاق المحادثة | موجود ويعمل | consultation-scope RC10 | اختبارات 12 |
| كاميرا جسم متوقفة | موجود ويعمل | MIRA_OUTFIT_CAMERA_CAPTURE | قرار مالك |

Root cause save 400: clientSaveId length = len(μs)+1+64 ≈ 81 > 64.
Also imageFingerprint MaxLength(64) OK for sha256 hex.
