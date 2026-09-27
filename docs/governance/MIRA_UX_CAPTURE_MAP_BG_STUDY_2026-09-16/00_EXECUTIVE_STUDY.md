# MIRA — دراسة تنفيذ قابلة للمراجعة (Capture · Map · Interaction · Background)

**التاريخ:** 2026-09-16 · **تصحيحات:** 2026-09-17 (`06_CORRECTIONS_2026-09-17.md`)  
**النوع:** دراسة فقط — **لا تنفيذ كود** حتى موافقة المراجعة.  
**الأساس:** الكود الحالي في المستودع + هوية `AppColors` + عقود Perfect HD.  
**ملاحظة مرجعية:** `IMG_5025.jpeg` لم يتوفر كملف في الجلسة؛ قُدّم تصور تصميمي على `#FFF7FA` (DESIGN MOCK). التفاصيل: `REFERENCE_IMAGE_NOTE.md`.

---

## الحكم التنفيذي (سطر واحد)

المكوّنات موجودة؛ التنفيذ جراحي. التصحيح 09-17 يحسم: زر = `FaceMeshQualityGate.canTakePhoto` (لا CameraKit ready)، بعد الالتقاط = رفض حدّ أدنى فقط (لا حزمة IQ كاملة)، Face Explorer = `uiScore` أعلى أفضل (الشدة فقط عبر `100−ui` الصريح).

---

## 1) تبسيط التصوير

### الموجود
| قدرة | أين | حالة |
|------|-----|------|
| زر يدوي + وميض + رفع للتحليل | `face_capture_panel.dart` → `_takePicture` / `_canTakePhoto` | يعمل لكن مقفول بـ CameraKit |
| بوابة CameraKit MODERATE | `perfect_camera_kit_gate.dart` (`isReady` ← `q.ready` = area∧pose∧lighting) | **قفل تصميم حالي** |
| استقرار تلقائي | `isStableReady` + طابور تلقائي في اللوحة | مسار ثانوي يُلغى من الاعتماد التصميمي |
| وجه واحد / مساحة / وضعية (بعد الملف) | `FaceGateValidator` + `FaceGateRules` | جاهز؛ **يُتخطى حالياً عند CameraKit** (`FaceGateResult.accepted()`) |
| ضبابية / سطوع بكسل | `ImageQualityEvaluator` | جاهز؛ **يُتخطى حالياً عند CameraKit** |
| إرشاد إضاءة/مسافة عربي | `guidanceArForBlock` + HUD اللوحة | يُبقى **مساعداً فقط** |

### الفجوة المثبتة
- `_canTakePhoto` عند `_cameraKitActive` يعيد `PerfectCameraKitGate.isReady` فقط → الإضاءة `under_exposed` تمنع الزر حتى مع وجه ظاهر.
- بعد الالتقاط بمسار CameraKit: لا FaceGate ولا ImageQuality → رفض/إعادة محاولة غير صادقة على الملف الفعلي.
- الاعتماد التصميمي على `ready` / `isStableReady` يتعارض مع المطلوب: **يدوي أساسي = وجه واحد في الإطار**.

### اتجاه التنفيذ المصحَّح (بدون كود الآن)
1. **تمكين الزر (محسوم):** `FaceMeshQualityGate.canTakePhoto(frame)` فقط — انظر `evidence/shutter_enable_decision.md`. لا بدائل معلّقة.
2. **CameraKit:** إرشاد نصي فقط؛ ممنوع `isReady`/`isStableReady`/قبول إضاءة لتمكين الزر؛ عطّل auto-queue.
3. **بعد الضغطة:** حد أدنى للرفض فقط (وجوه، مساحة وجه، decode، blur<28، brightness متطرف، دقة) — **ليس** FaceGate+IQ كاملين. التفاصيل: `evidence/post_capture_threshold_matrix.md`.
4. **رفض صادق:** رسالة واحدة + معاينة فورية؛ بلا انتظار READY.
5. وضعية/مركز/ظل = إرشادي أو رفض مزود لاحق — لا تكرار رفض محلي.

---

## 2) خريطة البشرة وفق المرجع / العقود

### الموجود
- `PerfectMaskSession` يميّز `scoreOnly` vs بايتات قناع حقيقية.
- `PerfectMaskOverlay` + `SharedImageMaskFit` + بروفايلات `PerfectMaskPresentationProfile` (شفافية/لuminanceGate).
- `SkinFaceMapVisualTokens.accentForConcern` من `AppColors.analysis*`.
- الكاروسيل يعرض فقط مؤشرات لها نتيجة شرعية (`providersWithLegitimateResult`).
- scoreOnly يُعرض بدرجة بدون قناع (`results_skin_map_panel.dart`).

### الفجوة
- جو الاستكشاف أسود (`faceOnlyBlack` / `explorerBlack`) — ليس هوية ميرا الوردية/الذهبية.
- بعض البروفايلات قد تبدو «طلاء» على بشرة داكنة/فاتحة؛ يحتاج معايرة شفافية على الجهاز لا اختراع هندسة.
- لا تُنشأ نقاط/خطوط تخمينية — القناع RGBA من Perfect هو المصدر المكاني الوحيد.

### قاعدة العرض (ملزمة)
| نوع بيانات المحرك | العرض |
|-------------------|--------|
| قناع RGBA + `uiScore` | طبقة شفافة + الرقم wellness (**الأعلى أفضل**) + شرح عربي |
| درجة فقط (`scoreOnly`) | بطاقة درجة wellness — **بدون** خريطة مكانية |
| غياب الاثنين | لا أيقونة ميتة في الكاروسيل |

**قطبية:** لا تُفسَّر درجة Perfect كشدة. الشدة = `wellnessUiToSeverity = 100 − ui` في مسار النتائج فقط.  
جدول مصحَّح: `02_METRIC_MAP_TABLE.md` · تتبّع: `evidence/score_polarity_trace.md`.

---

## 3) التفاعل

### الموجود ويُحافظ عليه
- اختيار مؤشر → قناع + درجة + `MetricPresentationPolicy` (شرح عربي).
- انتقالات: `selectionTransition` 180ms / `metricCrossfade` 220ms.
- ضغط مطوّل = مقارنة بالأصل (`_holdingOriginal` → `_sourceBytes`).
- مكبّر من بكسلات القناع الحقيقية (`PerfectMaskMagnifierFocus`).
- محاذاة: `SharedImageMaskFit` + `PerfectMaskOverlay` (contain/cover مشترك للصورة والقناع).

### الفجوة / الضبط
- ضمان أن تبديل خلفية العرض (بند 4) لا يكسر المحاذاة: الخلفية الملوّنة تُركّب **تحت** نفس شبكة البكسل؛ القناع فوق نفس `destRect`.
- لا مسار هندسي موازٍ؛ لا ClipOval كقص حقيقة.

---

## 4) خلفية ميرا بدل الأسود

### الموجود
- `ApplePersonMattingChannel.renderBlackComposite` يدمج الشخص فوق **#000** صلباً.
- اللوحة تستخدم `matte.blackCompositePng` كـ `_faceOnlyBlackBytes` للعرض فقط؛ `_sourceBytes` يبقى للصورة الأصلية (مقارنة + تحليل).

### المطلوب
- استبدال لون الخلفية المدمجة للعرض بهوية ميرا أنيقة نسائية.
- **بكسلات البشرة من المصدر دون إعادة تلوين.**
- الصورة الأصلية تبقى مدخل التحليل؛ الخلفية للعرض فقط.

### خياران مقترحان (من `AppColors` الفعلية)
انظر `04_BACKGROUND_OPTIONS.md`:
1. **Mist Blush `#FFF7FA`** — مثبَّت للتصور التصميمي في `visuals/` (DESIGN MOCK).
2. **Rose Champagne** — بديل دافئ إن رُفض A لاحقاً.

التنفيذ المفضل: تعميم `renderBlackComposite` → `renderMatteComposite(bgRGB)` أو تركيب Flutter بـ `alphaPng` فوق لون/تدرج — مع الإبقاء على `alphaPng` كما هو.

---

## معايير قبول الجهاز (ملخص)

المعايير المصحَّحة (A1–A5، B1–B3، …): `05_FILES_AND_ACCEPTANCE.md`.  
ملخص التصحيحات: `06_CORRECTIONS_2026-09-17.md`.

---

## خارج النطاق صراحةً
- إعادة بناء CameraKit / تخفيف عتبات Perfect lighting كـ «إصلاح جاهزية».
- اختراع أقنعة لمؤشرات scoreOnly.
- تغيير مدخل التحليل إلى الصورة المعزولة.
- تحقيقات الإضاءة السابقة كشرط لهذه الدراسة.
