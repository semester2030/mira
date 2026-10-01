# متتبع MC-FIX RC2 — بعد مراجعة 338c26d

نتيجة مراجعة 338c26d: **يحتاج تصحيحًا واستكمال أدلة**

الحالة النهائية للبنود المثبتة أدناه: **منفّذ ومختبر — بانتظار المراجعة المستقلة** (لا اعتماد ذاتي للمرحلة).

| البند | الخطأ المعالج | التصحيح | الاختبار الفعلي | النتيجة | رابط الدليل | المتبقي |
| --- | --- | --- | --- | --- | --- | --- |
| MC-FIX-04 | فقد id/سعر/توافر التركيبة | حالة تركيبات منظمة + تحقق خادم + حفظ بدون إعادة توليد | test:commerce + portal-options + رحلة حية sku-M/sku-L | منفّذ ومختبر — بانتظار المراجعة المستقلة | mc-fix-rc2/ + LIVE_JOURNEY.txt | — |
| MC-FIX-05 | إحياء المنشور عند المسح | draftOptionsSet+null = مسح في UI/خادم | portal-options + migration | منفّذ ومختبر — بانتظار المراجعة المستقلة | mc-fix-rc2/portal-options.log | — |
| MC-FIX-05 | ترحيل أعلام false | ترحيل 20261001153000 يهيئ المسودات غير الفارغة | migrate deploy + service tests | منفّذ ومختبر — بانتظار المراجعة المستقلة | migration + test-commerce.log | — |
| MC-FIX-03 | سعة متعارضة + عربي | min سعة شريك + normalize عربي + رفض حفظ متعارض | types+service + حجز حي غرفة-أ remaining=0 | منفّذ ومختبر — بانتظار المراجعة المستقلة | LIVE_JOURNEY.txt + test-commerce.log | — |
| MC-FIX-01 | تزامن شراء خارجي | FOR UPDATE قبل التسعير/الطلب | EXTERNAL بعد flip في Postgres | منفّذ ومختبر — بانتظار المراجعة المستقلة | test-commerce.log | — |
| MC-FIX-02 | بصمة فارغة = مطابقة | إعادة بناء من السجل أو IDEMPOTENCY_* | legacy fingerprint tests | منفّذ ومختبر — بانتظار المراجعة المستقلة | test-commerce.log | — |
| MC-FIX-09 | حزمة غير قابلة للتشغيل | شجرة كاملة + فك نظيف + test:commerce | unpack EXIT 0 (إعادة بعد الختم) | منفّذ ومختبر — بانتظار المراجعة المستقلة | PACKAGE_VERIFY.txt | — |
| متابعة حية | نشر/إدارة/رحلات | Render + admin rootDir + HTTP journeys | API/partners/admin LIVE؛ طلب COD+حجز+تحصيل | منفّذ ومختبر جزئيًا على HTTP/بوابة | LIVE_JOURNEY.txt | مشاركة deep-link على جهاز؛ عزل مفضلة بحسابين بشريين |
| مشاهدات | — | مؤجلة بقرار المالك | — | مؤجل | — | اعتماد قواعد المشاهدات |
| تخزين وسائط دائم | رفع حي 503 | مؤجل بقرار المالك | upload 503 مثبت | مؤجل | LIVE_JOURNEY.txt | بدون اشتراك جديد في هذه الجولة |

## نشر

- code: `bbbfa84`
- docs tip previously: `9bfd3a6` على `main`
- mira-api: `srv-d85ngcfavr4c73d3rk6g` / `https://mira-api-n4p3.onrender.com`
- partners: `https://mira-partners-portal.onrender.com`
- admin: `srv-dav2ih0jo6nc73f7d9rg` / `https://mira-admin-portal.onrender.com` (`rootDir=admin-portal/web`)

## أدلة حية مختصرة

- منتج `5cea12ba-…`؛ طلب `MO-261001-E8AYP5` delivered+collected؛ حجز `MB-261001-VWBG2A` confirmed على `غرفة-أ`.
- بديل وسائط: صف `catalog_media` مسودة لأن التخزين الدائم غير مهيأ (503).
