# تصنيف إخفاقات discover_* — 1717

سجل: `raw/flutter_test_discover_suite_1717.txt` → **158 / 8**

| # | الاختبار | التصنيف |
|---|---|---|
| 1–2 | activation routes / store handoff | توقع قديم / إعداد define |
| 3–4 | ad_rc5 retry / stale | إعلانات — خارج المسار |
| 5–6 | phase2 server / appointment | كتالوج/موعد |
| 7–8 | presentation buy / preview buy | شراء |

`neighbor proxy open does not steal priority`: نجح تحت المجموعة في 1717 بعد رفع مهلة النمو/الاكتمال وإثبات البادئة صراحةً — فشل 1716 تحت الحمل كان توقيتًا لا تراجعًا وظيفيًا لـ `_kickFill`.
