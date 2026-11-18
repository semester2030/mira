# حزمة 1716 — قياس + صوت + kickFill

## مثبت بالاختبارات

| بند | نتيجة |
|---|---|
| سباق seek → FF | حراسة attempt+player + `_seekInFlight` قبل `await seekTo`؛ اختبار حتمي يمر |
| المقياس | `metric=position_not_pixels` — ليس إطارًا مرسومًا |
| unmute مزدوج | `_armAudioOnce` مشترك لكل محاولة؛ اختبار عدّ setVolume |
| unmute متأخر بعد المغادرة | يعيد الكتم؛ لا يُسمع المقطع السابق |
| proxy `_kickFill` | prefix محدود لا `ensureLocal` كامل؛ اختبار `debugHasInflight=false` |
| E2E أول بايت | 6–7ms وtailGate مغلق |
| Focus مشغّل+كاش+sync | **65 نجحت** |

commit الإصلاح يُسجَّل بعد البناء في `raw/git_head.txt`.

## تحقيق تأخير 1715 (مثبت بالسجل)

انظر `ANALYSIS_DELAY_1715.md`:
- مكتمل محلي: ~357ms peek/قفل + تهيئة؛ FF=1011 ملوّث بسباق seek
- جزئي: `_kickFill→ensureLocal` بدأ تحميلًا كاملًا قبل التقدم

## غير مثبت على الجهاز بعد

- هوية 2026111716 من سجل التشغيل بعد التثبيت
- ربط تسجيل شاشة المستخدم بحالات cold/partial/return-20
- **الأداء يبقى مفتوحًا** حتى ذلك الربط

## مفتوح مستقل

تنظيم الملفات · 3 فيديوهات + 10 صور من البوابة.
