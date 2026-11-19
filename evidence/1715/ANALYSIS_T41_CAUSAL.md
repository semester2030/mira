# سلسلة سببية T41 (جلسة 1713) — بعد تصحيح 1714

## لماذا رفضنا انتظار 1MiB كإصلاح

`resolveMs=82` في T41 يثبت أن `resolvePlaySource` **لم** ينتظر ملء 1MiB.
`cacheBytes=1048576` في سطر FF هو لقطة لاحقة/مضللة إن أُعيدت كتابتها؛ القيمة عند الفتح قد تكون أقل.
إجبار `await ensurePlayablePrefix(1MiB)` قبل الإرجاع أدخل `elapsedMs=20011` في الاختبارات — تراجع، لا إصلاح.

## التسلسل (جدار الساعة)

| وقت UTC | حدث | دلالة |
|---|---|---|
| 11:10:18.515 | audio_cut → b7989c2f | settle |
| 11:10:18.515+82ms | resolveMs=82 | إرجاع proxy سريع |
| 11:10:18.515+93ms | initStart | بداية initialize |
| 11:10:21.166 | network_to_disk dl=1MiB + LOCK wait 2568 | ملء بادئة تحت القفل أثناء التهيئة |
| 11:10:21.340 | جارٍ 96697802 prefix 1MiB | منافسة جار أثناء أولوية الحالي |
| 11:10:22.513 | FF firstFrameMs=4009 initDone=playStart=3107 | ~3s تهيئة + ~0.9s بعد play |

## السبب القابل لإعادة الاختبار

1. `attach` كان يستدعي `prefetchDisk()` **قبل** `prioritize` وبدون `lowPriority` → يُعامل المقطع كجارٍ أحيانًا، أو يشغّل `ensureLocal` كاملًا تحت القفل.
2. ` _openResolved` مع `fullFill:true` كان يستدعي `prefetch(lowPriority:false)` → `ensureLocal` كامل أثناء `initialize`.
3. AVPlayer على الـproxy ينتظر بايتات بينما الكاتب يملك القفل ويملأ البادئة (~2.5–3s داخل init).

`cacheBytes=1048576` عند FF لا يعني أن البادئة كانت جاهزة عند الفتح؛ قد تكون اكتملت أثناء التهيئة. 1715 يسجّل `cacheBytesAtOpen` منفصلًا و`attemptId`، ولا يعيد كتابة init/play لمحاولة لاحقة.

## إصلاح 1715

- أزل `await` على 1MiB من `resolvePlaySource` (kick غير حاجب فقط).
- `prioritize` ثم `prefetchDisk(lowPriority: true)` عند الفتح؛ التحميل الكامل بعد أول إطار.
- اختبار E2E: الساعة من قبل `resolvePlaySource` → أول بايت محلي قبل تحرير `tailGate` (نجح ~5–8ms، بلا 20s).
