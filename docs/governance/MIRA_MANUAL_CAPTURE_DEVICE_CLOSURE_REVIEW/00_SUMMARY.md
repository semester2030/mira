# MIRA_MANUAL_CAPTURE_DEVICE_CLOSURE_REVIEW — 2026-09-17

تصحيح محدود على `MIRA_UX_CAPTURE_MAP_BG_IMPL` — إغلاق عيوب محددة.

## الإصلاحات

### 1) دقة الصورة
- `ResolutionPreset.high` → **`veryHigh`** (هدف short side ≥ 1080 لمسار Perfect HD).
- لا تكبير صورة منخفضة لتجاوز الفحص.
- لوجات: `savedDims` / `uploadDims` / `CAPTURE_DIMS_TRUTH` بعد الالتقاط.
- رسالة `resolution_below_hd`: أُزيل «قرّبي الوجه»؛ النص يوضح أن الاقتراب لا يزيد بكسلات الملف.

### 2) أهلية التصوير ورسائله
- مصدر واحد: `_manualGuidanceVm` ← `_canTakePhoto` (mesh).
- أُزيل اعتماد `CameraKit.isReady` لـ canManualCapture / جاهزية الإطار.
- أُزيلت لاحقة «أعيدي المحاولة» من سقف التشخيص.
- إضاءة/وضعية CameraKit = نصيحة اختيارية فقط.
- auto-capture ما زال معطّلاً؛ منع التكرار عبر `_capturing` / `_validatingFace` / `isAnalyzing`.

### 3) الوجه داخل الإطار
- بدل تقاطع 50% مع كامل المعاينة: **احتواء ≥ 82%** داخل `CaptureGuideGeometry.illustrativeOval` (+ تسامح pad 8%).
- نفس إحداثيات الـ viewport بعد map/mirror.
- بدون شرط ملء البيضاوي / ثبات / إضاءة.
- حداثة التتبع ≤ 500ms محفوظة.

### 4) الخريطة / الخلفية
- محاذاة / مقارنة / تكبير / «الأعلى أفضل» كما هي.
- `onBlack: false` للكاروسيل والدرجة — بطاقات فاتحة متوافقة مع `#FFF7FA`.
- التحليل على الأصل؛ الماتّة للعرض فقط.

## اختبارات
`test/skin_analysis/manual_capture_shutter_and_minimal_gate_test.dart` — يشمل كشف عيب الـ 50% — **PASS**.

## بناء
`flutter build ios --profile --no-codesign` — **نجح** (Runner.app). بناء ≠ إثبات تجربة.

## إثبات الجهاز (3 محاولات)

| # | الحالة |
|---|--------|
| 1–3 | **NOT PROVEN** |

**العائق:** عند الإغلاق، `Engineer FA` غير متصل فعلياً؛ يظهر فقط `fayez’s iPhone` لاسلكياً بدون جلسة تصوير→تحليل موثّقة في هذه الجولة. نجاح البناء ≠ إغلاق التجربة.

بروتوكول الإثبات لاحقاً (لوگات بلا صور/أسرار):
`preset=veryHigh` · `savedDims` · `uploadShort` · أزمنة T0/T1 منفصلة عن زمن التحليل · خريطة/مقارنة/تكبير بصرياً.
