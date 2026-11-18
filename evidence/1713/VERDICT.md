# حزمة 1713 — تحقق جهاز Discover (بعد إصلاح 1711)

## الحكم

- **هوية النسخة المشغّلة:** مثبتة في سجل الجهاز — `MIRA_BUILD_IDENTITY build=2026111713` + `api=https://mira-api-n4p3.onrender.com/api/v1` + `useBackend=true` (ليست سجل تثبيت فقط).
- **تعارض prefix/full:** ما زال مُغلقًا في الاختبارات؛ مسار الإنتاج لا يحتوي `debugJoinInflightUnderLock` (محاكاة Completer في الاختبار فقط؛ `debugYieldBeforeInflightJoin` @visibleForTesting).
- **اختبار الشاشة:** fling و jumpToPage منفصلان — لا يُخفى فشل السحب بانتقال برمجي.
- **سرعة الفيديو على الآيفون:** **OPEN** — سُجّلت عيّنة تشغيل واحدة من الجهاز (`firstFrameMs=1113` من كاش قرص كامل)، لكن سيناريوهات التحقق الكاملة لم تُغلق بعد.
- **تنظيم الملفات الطويلة / رحلة 3 فيديوهات + 10 صور من البوابة:** **OPEN** (بنود مستقلة).

## ما تغيّر في 1713 (تجهيز القياس)

1. سجل جهاز قابل للسحب لاسلكيًا: `Library/Application Support/mira_discover_logs/mira_discover_device.log`
2. سطور مرتبطة: `MIRA_BUILD_IDENTITY`, `MIRA_DISCOVER_CACHE`, `MIRA_DISCOVER_LOCK`, `MIRA_DISCOVER_FF`, `MIRA_DISCOVER_SWIPE`, `MIRA_DISCOVER_AUDIO`
3. حماية سباق `PathNotFound` عند `part.length()` أثناء finalize
4. رقم البناء `1.0.0+2026111713`

## عيّنة جهاز (قبل اكتمال السيناريوهات)

من `mira_discover_device_pre_scenarios.log`:

| إشارة | قيمة |
|---|---|
| build | 2026111713 |
| session | sho9voukj3q |
| api | https://mira-api-n4p3.onrender.com/api/v1 |
| mediaId | 71062d9e-622f-4377-bf22-8df75fc63afb |
| cache | disk / complete (`cacheSource=3`, bytes=40375570) |
| lock wait | 360ms ثم 6ms |
| firstFrameMs | 1113 (إشارة مشغّل موثوقة في السجل — ليست تسجيل شاشة) |
| audible | 1 بعد unmute |

لا تُساوَى هذه العيّنة بإغلاق مشكلة التأخير العام.

## اختبارات

- Focus (disk cache + screen sync fling/jump): **31 نجحت**
- مجموعة `discover_*.dart` الأوسع: إخفاقات غير مرتبطة بمسار الكاش/الفيديو (activation/ads/fonts/chrome) — موثّقة في السجل الخام؛ ليست سبب إصدار 1713

## السيناريوهات المتبقية

انظر `SCENARIOS.md`. بعد التجربة: `raw/pull_device_discover_log.sh` ثم تحديث هذا الحكم.
