# 00 — VERDICT

## حكم

**أين يتوقف الالتقاط (VERIFIED):** عند شرط `PerfectCameraKitGate.isReady` / `isStableReady` قبل استدعاء `_capture` / `takePicture`.

**السبب الجذري (ROOT CAUSE VERIFIED):** CameraKit يُرجع `light=under_exposed` في **كل** الحالات التي يصل فيها `area=good` و`pose=good` معًا (65/65 في جلسة الجهاز 80179). منطق ميرا يعتبر الإضاءة مقبولة فقط عند `good|normal`، لذا `ready` يبقى `false` دائمًا → زر التصوير معطّل → الالتقاط التلقائي لا يُستدعى → التحليل لا يبدأ.

```
ready_true = 0
area_good ∩ pose_good = 65
area_good ∩ pose_good ∩ under_exposed = 65
```

**ليس السبب (مرفوض بالدليل في هذه الجلسة):**
- فشل `CameraKit.create` — init نجح (OBSERVED).
- عدم وصول الإطارات — callbacks حية بقيم area/pose متغيرة (OBSERVED).
- MediaPipe كبوابة نهائية — `_cameraKitActive` يعطّل Mirror gate (VERIFIED في الكود).
- تعطّل `takePicture` نفسه — لم يُستدعَ أصلًا لأن READY=false (VERIFIED).

## ما عُدّل بعد الإثبات

- `lightingLower`: MODERATE `0.70` → `0.55` (أرضية RELAXED الموثّقة في SDK) عبر `setCameraKitOverwrite` بعد `setCameraKitLevel(.moderate)`.
- **لم تُغيَّر** حدود yaw/pitch ولا `faceSizeRatio`.
- تشخيص debug أوضح لبوابة READY ومحاولات الالتقاط.

## التحقق على الجهاز بعد هذا الإصلاح

**لم يُثبت بعد.** نشر لاحق عبر Wi‑Fi توقف عند التثبيت. الحالة: **AWAITING_DEVICE_VERIFICATION**.

لا PASS / لا «تم الحل نهائيًا» من البناء وحده.

## OBSERVED vs VERIFIED

| بند | التصنيف |
|---|---|
| ZIP السابق تقارير فقط بلا كود/سجلات | VERIFIED (unzip) |
| فيديو `ScreenRecording_09-15-2026 21-16-25` | **NOT FOUND** محليًا بهذا الاسم |
| وصف المستخدم: إضاءة ثم تثبيت وجه بلا التقاط | OBSERVED — يتوافق مع لوجات 80179 |
| `ready_true=0` مع 65× good/good/under_exposed | VERIFIED (80179) |
| VideoRange→FullRange سبب under_exposed | HYPOTHESIS — لم يُعزل؛ الـexpand لم يُلغِ under_exposed |
| deg=0.0 مع pose=bad | OBSERVED — لا يدخل قرار الالتقاط |
