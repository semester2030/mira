# تحليل الحالتين من سجل 1713 (session=sho9voukj3q)

`firstFrameMs` = زمن إشارة تقدم المشغّل بعد settle — **ليس** إثبات ظهور مستقل على الشاشة.

## تصحيح التقرير

| فئة | العدد | firstFrameMs |
|---|---:|---|
| مشغّل مجهّز (source>0) | 24 | 106–175ms |
| ملف مكتمل + مشغّل جديد (cacheSource=3) | 4 | 501–1113ms |
| كاش جزئي / proxy (cacheSource=4) | 1 | **4009ms** |
| متوسط الكل | 29 | 332ms — **يخفي** حالة 4 ثوانٍ |

## transition=41 — partial 4009ms

`mediaId=b7989c2f-8f14-4d70-a106-5e0ee2062fcd` · `playerId=1048007353`

| مرحلة | زمن تقريبي من settle |
|---|---|
| audio_cut → بداية | 11:10:18.515 |
| initStart | 93ms |
| LOCK wait على نفس الوسيط | waitedMs=**2568** (ينتهي 21.166) |
| CACHE network_to_disk 1MiB | elapsedMs كان **0** (قياس خاطئ) |
| initDone / playStart | **3107ms** |
| firstFrame | **4009ms** (≈902ms بعد play) |
| waitedMs=7240 | **بعد** التشغيل (إكمال تنزيل) — ليس سبب البداية |

**السبب المثبت:** `resolvePlaySource` أعاد proxy فورًا بينما `have` صغير، ثم `initialize()` تسابق ملء البادئة تحت قفل الكتابة؛ الـproxy ينتظر البايتات أثناء امتلاك القفل ≈3s داخل التهيئة.

**ليس تجميعًا:** 2568 و3014 و902 متداخلة جزئيًا؛ المهيمن هو انتظار التهيئة أثناء ملء البادئة.

**إصلاح 1714:** بذر ≥1MiB (أو حجم الملف إن أصغر) قبل إرجاع proxy عند `claimPriority`، مع `prefix_seed_start/end` و`hold_start/end`، وتصحيح `elapsedMs` الحقيقي لملء البادئة.

**الصوت:** لا يوجد `unmute_req`/`audio_armed` لـ1048007353 قبل الانتقال 42 رغم firstFrame. السجل لا يثبت أن الفيديو كان مسموعًا. 1714 يسجّل `unmute_skipped` إن خرج المسار قبل التسليح.

## transition=35 — complete reopen 607ms

`mediaId=71062d9e-…` · cacheSource=3 · source=0 (مشغّل جديد)  
resolveMs=53 · init 66→144 · playStart=145 · firstFrame=607

**الفجوة play→FF ≈462ms** بعد جاهزية الملف محليًا. ليست انتظار شبكة/قفل (LOCK بعد FF بـ7ms فقط).

التفسير الأرجح من المصدر: رصد التقدم ينتظر `position > floor`؛ مسار cold لا كان يستخدم seek-nudge (مقصور على reused). sticky محدود بـ12 — بعد >20 وسيطًا يُطرد أول مقطع من الـprepared فيُفتح باردًا من الملف.

**إصلاح 1714:** seek-nudge لمسار `cacheSource=3` حتى مع source=0 — دون زيادة عدد المشغّلات في الذاكرة.
