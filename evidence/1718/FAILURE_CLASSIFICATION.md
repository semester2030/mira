# تصنيف إخفاقات 1718 (قبل الإصلاح)

| اختبار | السبب الجذري | الإصلاح |
|---|---|---|
| left_dark + release | `_dropIfStale` يتخلّص من controller متوقّف (parked) ثم `release` يستدعي dispose ثانية | تخطّي parked/warm/prepared؛ dispose هادئ في release؛ dispose اختباري idempotent |
| A→صورة→A unmute | بعد `setVolume(1)` البالي، مسار stale يكتم حتى لو الـcontroller ما زال حيّاً لمحاولة أحدث | بعد await: لا تكتم إن `identical(_controller, controller)` |
| stale A resolve | مصنع الاختبار يعيد `a` لأول إنشاء وهو B | مصنع حسب المسار؛ توقع لا يلعب A |
| delayed audio cut | بوابة volume على cut تُعلّق attach B (deadlock) | اختبار cut بتوليد قديم بعد ملكية B |
| proxy abort waits≠0 | dart:io لا يُكمل `response.done` أثناء انتظار بلا كتابة للجسم | خطاف `debugForceProxyClientGone` + مهلة flush أثناء البث |
