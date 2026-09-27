# تصحيحات الدراسة — 2026-09-17

**النطاق:** تصحيح أربع نقاط فقط على `MIRA_UX_CAPTURE_MAP_BG_STUDY_2026-09-16`.  
**لا إعادة دراسة كاملة. لا تعديلات إنتاجية على التطبيق.**

## ملخص التصحيحات

| # | الخطأ في الدراسة السابقة | التصحيح |
|---|--------------------------|---------|
| 1 | «شغّل FaceGate + ImageQuality كما هي بعد الالتقاط» | مصفوفة شروط كاملة: **ضروري للرفض** vs **إرشادي فقط** — لا تشغيل الحزمة الحاجبة كاملة (تمنع التكرار المزعج) |
| 2 | جدول المؤشرات فسّر ارتفاع الدرجة كمشكلة أشد | Perfect `ui_score` = **أعلى أفضل**؛ الشدة = `100 − ui` فقط عبر `wellnessUiToSeverity` في مسار النتائج — Face Explorer يعرض wellness |
| 3 | تمكين الزر بصيغة «مصدر بديل إن وُجد» | قرار محسوم: `FaceMeshQualityGate.canTakePhoto(frame)` فقط + حداثة اختيارية؛ **ممنوع** `isReady`/`isStableReady`/قبول إضاءة CameraKit |
| 4 | مرجع بصري غير مربوط | `IMG_5025.jpeg` لم يُعثر عليه كملف على القرص في هذه الجلسة؛ قُدّم **تصور تصميمي** على `#FFF7FA` مع وسم DESIGN MOCK |

## الملفات المحدَّثة في هذه الجولة

- `00_EXECUTIVE_STUDY.md` — فقرات 1–2–3 + إشارة المرجع
- `01_CAPTURE_PLAN.md` — بوابات ما بعد الالتقاط + تمكين الزر المحسوم
- `02_METRIC_MAP_TABLE.md` — قطبية الدرجات + مثال رقمي
- `04_BACKGROUND_OPTIONS.md` — تثبيت الخيار A + ربط التصور
- `05_FILES_AND_ACCEPTANCE.md` — معايير قبول مصحَّحة
- `REFERENCE_IMAGE_NOTE.md` — حالة IMG_5025 + مسار التصور
- `evidence/post_capture_threshold_matrix.md` — جدول الحدود
- `evidence/score_polarity_trace.md` — تتبّع الدرجة
- `evidence/shutter_enable_decision.md` — قرار الزر
- `visuals/mira_face_explorer_design_mock_optionA_FFF7FA.png` — تصور تصميمي (ليس نتيجة تحليل)
