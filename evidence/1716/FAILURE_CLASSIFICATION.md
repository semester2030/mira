# تصنيف إخفاقات discover_* — 1716

سجل كامل: `raw/flutter_test_discover_suite_1716.txt` → **153 نجاح / 9 إخفاقات**

| # | الاختبار | التصنيف | دليل |
|---|---|---|---|
| 1 | activation: routes stay closed | توقع قديم / إعداد define | فشل سابق 1715؛ ليس مسار كاش/مشغّل |
| 2 | activation: store link handoff | توقع UI نصوص | سابق |
| 3–4 | ad_rc5 retry / stale page | إعلانات — خارج المسار | سابق؛ لم يُضعَّف |
| 5–6 | phase2 server / appointment | كتالوج/موعد | سابق |
| 7–8 | presentation buy / preview buy | شراء | سابق |
| 9 | neighbor proxy open does not steal priority | **تذبذب تحت الحمل المتوازي** | ينجح منفردًا (`--name neighbor proxy`); فشل عند تشغيل المجموعة كاملة مع ملفات أخرى — إعداد/توقيت وليس تراجع وظيفي لـ `_kickFill` |

اختبارات المشغّل+كاش الموجهة: **65/65** (`raw/flutter_test_focus_1716.txt`).
