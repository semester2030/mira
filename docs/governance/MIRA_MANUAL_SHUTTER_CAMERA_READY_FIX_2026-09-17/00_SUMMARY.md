# MIRA_MANUAL_SHUTTER_CAMERA_READY_FIX — 2026-09-17

## الحكم

تم فصل **تمكين زر التصوير** عن **صلاحية الصورة للتحليل**.  
الزر يعتمد جاهزية الكاميرا فقط؛ الفحص على الملف بعد `takePicture`.

## التغييرات

1. `_canTakePhoto` / `shutterEnabled` = كاميرا مهيأة + أذونات + ¬busy — **بلا** FaceMesh / حداثة / احتواء / CameraKit ready.
2. `_capture` لا يحجب بـ mesh؛ ضغطة → `takePicture` مرة واحدة → `PostCaptureMinimalGate` على الملف.
3. النص: «ضعي وجهك داخل الإطار واضغطي للتصوير» — أُزيل وعد الالتقاط التلقائي من `new_analysis_screen` و`SkinCaptureInstruction.readyManual`.
4. لوجات `attemptId=MAN-…` للمراحل: press / takePicture_ok / validate_accept|reject / analysis_handoff.
5. بناء مثبّت: **1.0.0+2026091701** (`CFBundleVersion=2026091701`).

## ما ثبت

| بند | حالة |
|-----|------|
| اختبارات وحدة | PASS |
| بناء Profile + install على fayez’s iPhone | تم (build 2026091701) |
| إطلاق التطبيق على الجهاز | تم |
| ضغط زر → `takePicture` مع CK غير جاهز / mesh قديم | **يحتاج ضغطك على الجهاز** — راقبي `phase=press` ثم `takePicture_ok` |

## ما لم يُختبر / لا يُعلن نجاح تجربة

- ثلاث محاولات تصوير→تحليل كاملة مع أزمنة منفصلة بعد هذا الإصلاح.
- إثبات صحفي من الكونسول أن الضغط استدعى الكاميرا (يتطلب تفاعل المستخدم بعد التثبيت).

لا تعتبر نجاح البناء إغلاقاً للتجربة.
