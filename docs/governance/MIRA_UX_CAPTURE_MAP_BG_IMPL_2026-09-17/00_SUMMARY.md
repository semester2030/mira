# MIRA — تنفيذ تصوير يدوي + خريطة + خلفية Mist Blush

**التاريخ:** 2026-09-17  
**الأساس:** الدراسة المصحَّحة `MIRA_UX_CAPTURE_MAP_BG_STUDY_2026-09-16` + ملاحظات التنفيذ  
**IMG_5025.jpeg:** لم يُعثر على الملف على القرص — التصور التصميمي السابق يبقى مرجعاً بصرياً فقط (ليس اعتماد استبدال للشعار).

---

## ما نُفّذ

### 1) تصوير يدوي
- `_canTakePhoto` ← كاميرا جاهزة + `FaceMeshQualityGate.canTakePhoto(frame, previewSize:)`  
  (وجه متتبَّع، جودة ≠ low، تقاطع مع المعاينة ≥50%، حداثة ≤500ms).
- **ممنوع:** `PerfectCameraKitGate.isReady` / `isStableReady` / قبول إضاءة كشرط زر.
- تعطيل الالتقاط التلقائي (`_autoCaptureEnabled = false`) لمساري CameraKit والمرآة.
- مؤقت 200ms يُسقط تمكين الزر عند فقدان/تقادم التتبع.
- ضغطة واحدة → `takePicture` → `PostCaptureMinimalGate` → مسار التحليل؛ منع التكرار عبر `_capturing` / `_validatingFace` / `isAnalyzing`.
- فشل تهيئة CameraKit لم يعد يمنع فتح الكاميرا (إرشاد فقط).

### 2) صلاحية الصورة (بعد الالتقاط)
`PostCaptureMinimalGate` — رفض ضروري فقط:

| شرط | قيمة | ضرورة |
|-----|------|--------|
| decode | فشل | نعم |
| وجوه | 0 أو >1 | نعم |
| مساحة وجه | خارج [0.05, 0.92] | نعم |
| short edge | **< 1080** (Perfect HD) | نعم — **ليس** 480 SD |
| blur < 28 | قياس Laplacian يُسجَّل فقط | **لا** رفض — عتبة غير مثبتة مقابل نجاح HD |
| وضعية/مركز/تعريض/ظل | — | **لا** رفض محلي |

رسائل الرفض عربية من البوابة.

### 3) الخريطة والتفاعل
- الإبقاء على `PerfectMaskOverlay` + `SharedImageMaskFit` + hold-original + magnifier.
- `uiScore` على الخريطة = **الأعلى أفضل** (موجود في `_ActiveMetricHero`).
- scoreOnly بلا علامات مكانية مصطنعة (سلوك سابق محفوظ).

### 4) الخلفية
- `ApplePersonMattingChannel.renderBlackComposite` يركّب على **#FFF7FA** مع حفظ RGB البشرة.
- كروم المستكشف: `explorerStage = #FFF7FA` بدل الأسود.
- التحليل يبقى على `_sourceBytes` الأصل.

---

## اختبارات وحدة

`test/skin_analysis/manual_capture_shutter_and_minimal_gate_test.dart` — **12 passed**  
(تمكين زر / حداثة / تقاطع معاينة / presence+area / HD 1080).

## بناء iOS Profile

`flutter build ios --profile --no-codesign` → **نجح** (`Runner.app` 164.8MB).  
**بناء ناجح ≠ إثبات تجربة تصوير/تحليل على الجهاز.**

---

## إثبات الجهاز (3 محاولات تصوير → تحليل)

| محاولة | التقاط | زمن التقاط | زمن تحليل | استجابة تحليل | خريطة/خلفية/مقارنة/تكبير |
|--------|--------|------------|-----------|----------------|---------------------------|
| 1 | **NOT PROVEN** | — | — | — | — |
| 2 | **NOT PROVEN** | — | — | — | — |
| 3 | **NOT PROVEN** | — | — | — | — |

**السبب:** الجهاز `Engineer FA` يظهر في `flutter devices` لكن إثبات التقاط وجه حقيقي + استجابة Perfect يتطلب تفاعلاً بشرياً على الجهاز (كاميرا + شبكة API). نجاح البناء/الاختبارات وحده **لا** يُعد إثبات تجربة.

عند التشغيل لاحقاً: راقبي لوجات  
`Mira CAPTURE_ATTEMPT` و `MiraMeasureTrace` (`T0_CAPTURE_REQUEST` / `T1_TAKE_PICTURE_OK`) منفصلة عن زمن استجابة التحليل في الشاشة/الـ API.

---

## ملفات لمسها التنفيذ

- `lib/.../face_capture_panel.dart`
- `lib/.../face_mesh_quality_gate.dart`
- `lib/.../post_capture_minimal_gate.dart` (جديد)
- `lib/core/face_gate/face_gate_rules.dart`
- `lib/core/face_gate/face_gate_validator.dart`
- `ios/Runner/ApplePersonMattingChannel.swift`
- `lib/.../skin_face_map_visual_tokens.dart`
- `lib/.../results_skin_map_panel.dart`
- `test/skin_analysis/manual_capture_shutter_and_minimal_gate_test.dart`

---

## ما بقي غير متحقق على الجهاز

1. ثلاث محاولات تصوير مستقلة تصل لاستجابة تحليل حقيقية مع أزمنة منفصلة.  
2. وضوح الخريطة على درجات بشرة مختلفة تحت خلفية #FFF7FA.  
3. مطابقة بصرية بكسل-بكسل مع `IMG_5025.jpeg` (الملف غير متاح).
