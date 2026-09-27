# قرار تمكين زر التصوير (محسوم)

## القرار

```
_canTakePhoto (عند CameraKit أو غيره للمسار اليدوي المبسّط) :=
  !_busy
  && _previewBoxSize != Size.zero
  && FaceMeshQualityGate.canTakePhoto(_faceOverlayController.frame)
```

**ممنوع كشرط تمكين:**  
`PerfectCameraKitGate.isReady` · `isStableReady` · قبول إضاءة CameraKit (`lighting` good/normal) · `q.ready`.

CameraKit يبقى مصدر **إرشاد نصي فقط**.

---

## الدالة والحقول الفعلية

### `FaceMeshQualityGate.canTakePhoto(FaceMeshFrame frame)`

```dart
frame.hasFace && frame.quality != FaceTrackingQuality.low;
```

| حقل | تعريف فعلي | ملاحظات |
|-----|------------|---------|
| `hasFace` | `outline.length >= 8` | وجه واحد من مسار MediaPipe (لا حقل `faceCount` على الإطار الحي) |
| `quality` | من `MediaPipeRegionBuilder._evaluateQuality` | high إن score≥0.55؛ medium ≥0.30؛ وإلا low — يعتمد `mesh.score` + اكتمال outline/regions/landmarks |
| `outline` / `boundingBox` | إحداثيات **viewport** بعد `FaceMeshPointMapper` | المرآة والـ cover عبر `FaceMappingContext` (`rawImageSize`, `contentSize`, `viewportSize`, `mirrorPreview`) |
| `timestamp` | `DateTime` على كل `FaceMeshFrame` | **لا يُفحص اليوم داخل `canTakePhoto`** |

### ربط المعاينة (موجود)

`face_capture_panel` يمرّر عند كل إطار:

```dart
FaceMappingContext(
  rawImageSize: Size(image.width, image.height),
  contentSize: Size(contentW, contentH),
  viewportSize: _previewBoxSize,
  lensDirection: ...,
  mirrorPreview: _isFrontCamera,
)
```

إذن كشف الوجه داخل مساحة المعاينة **مراعى إحداثياً** عبر الـ mapper — ليس عبر CameraKit.

### حداثة الكشف (فجوة موثّقة → توصية تنفيذ)

`canTakePhoto` لا يتحقق من عمر الإطار.  
**توصية دراسية (ليست كوداً الآن):** ارفض التمكين إذا  
`DateTime.now().difference(frame.timestamp) > 500ms`  
أو إذا `frame == FaceMeshFrame.empty` بعد فقدان التتبع — حتى لا يبقى الزر مفعّلاً على آخر وجه قديم.

---

## لماذا لا نعيد استخدام `FaceMeshQualityGate.evaluate` / `isReadyForCapture`؟

`evaluate(frame, guideRect)` يفرض: مناطق تشريحية كاملة + مركز داخل الدليل + نسبة ارتفاع وجه ∈ **[0.74, 1.06]** مقابل الدليل.  
هذا أقرب لبوابة صارمة/مرآة و**يعيد احتكاك الرفض** قبل التصوير — يتعارض مع «يدوي بسيط».

`canTakePhoto` أخف: وجه متتبَّع بجودة ≠ low فقط.

## وجوه متعددة

المسار الحي لا يعدّ وجوهاً. الرفض `multiple_faces` يبقى في **الحد الأدنى بعد الالتقاط** عبر ML Kit (`FaceGateRules`) — انظر مصفوفة الرفض الضروري.

## خلاصة جملة واحدة

تمكين الزر = mesh حي في إحداثيات المعاينة يقول `hasFace` وجودة تتبع غير منخفضة — **لا** جاهزية CameraKit.
