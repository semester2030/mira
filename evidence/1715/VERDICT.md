# حزمة 1715 — تصحيح تراجع 1714

## مثبت بالاختبارات

| بند | نتيجة |
|---|---|
| إلغاء انتظار prefix_seed الحاجب | لا `prefix_seed_end … 20011`؛ السجل يظهر `prefix_kick … blocking=0` |
| E2E_START_TO_FIRST_BYTE_MS | **5–8ms** والـtailGate ما زال مغلقًا |
| FIRST_BYTE / AFTER20 (ساعة كاملة من قبل resolve) | **7ms / 11ms** وشرط `<2000` |
| claimPriority مع origin متوقف | resolve <500ms مع بادئة محلية |
| Focus disk+sync | **33 نجحت** |
| asset_video_port + sync A→image→A | **نجحت** |
| مجموعة discover_* | **153 نجاح / 8 إخفاقات** — مصنّفة في `FAILURE_CLASSIFICATION.md` (ليست مسار كاش 1715) |

commit: `d3aed5ab45768155eb84ff5edb4006dc6735ad17`  
diff: `raw/source_diff_1715.patch`

## مثبت على الجهاز (هوية وتشغيل جزئي)

| بند | نتيجة |
|---|---|
| Bundle Version | **2026111715** (`raw/install_1715.txt` + `devicectl … apps`) |
| MIRA_BUILD_IDENTITY | **build=2026111715** في `raw/device_1715_from_first.txt` |
| prefix_seed حاجب على الجهاز | **0** في شريحة 1715؛ `prefix_kick blocking=0` فقط |
| FF أولية (14 محاولة) | min=105 max=1011 avg≈199ms — جلسة قصيرة دافئة |

## غير مثبت بعد على الجهاز (أبقِ الأداء مفتوحًا)

- إعادة حالة T41 (`b7989c2f…` جزئي ≈1MiB) بمقارنة شاشة+سجل تحت 1715
- إعادة حالة T35 (مكتمل/إعادة فتح) مع فصل seek عن الإطار المرئي
- حكم أداء شامل يشمل left_dark / مهلات الشبكة (من خط أساس 1713 فقط حتى الآن)

`post_install` لـ1714 = خط أساس **1713** فقط — لا يُستخدم كدليل 1714/1715.

## تفسير T41

انظر `ANALYSIS_T41_CAUSAL.md`. السبب: تنزيل تحت القفل أثناء initialize، لا شرط 1MiB قبل resolve. `cacheBytes=1048576` عند FF لا يثبت جاهزية عند الفتح — 1715 يسجّل `cacheBytesAtOpen` + `attemptId`.

## محاولات فاشلة (سجل 1713 الموسّع)

FF=33، left_dark=1 (`620cae53` dwellMs=15088، bytesAtLeave=12288)، OSStatus -1001، connection closed بعد ~9 دقائق (خلفية/شبكة). التفاصيل في `raw/attempt_accounting_1713.txt`.

## مفتوح مستقل

تنظيم الملفات · رحلة 3 فيديوهات + 10 صور من البوابة.
