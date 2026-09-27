# 01 — خطة تبسيط التصوير (مصحَّحة 2026-09-17)

## تمكين الزر — قرار محسوم

```
_canTakePhoto :=
  preview جاهز
  && FaceMeshQualityGate.canTakePhoto(_faceOverlayController.frame)
  && ¬busy
```

التفاصيل والأحداثيات والحداثة: `evidence/shutter_enable_decision.md`.

**لا** `PerfectCameraKitGate.isReady` / `isStableReady` / قبول إضاءة.

إرشاد CameraKit (مسافة/إضاءة) = نص HUD فقط.  
عطّل طابور الالتقاط التلقائي المعتمد على `isStableReady`.

---

## بعد الضغطة — لا تكرار رفض

**لا** تشغيل FaceGate + ImageQuality الحاجبين «كما هما».

الحد الأدنى للرفض المحلي (ضروري):

1. لا وجه / أكثر من وجه  
2. مساحة وجه خارج **[0.05, 0.92]**  
3. فشل decode  
4. blur Laplacian **< 28**  
5. brightness خارج **[0.18, 0.92]**  
6. short edge **< 480 px**

كل ما عدا ذلك (yaw/pitch/roll، مركز، over/under exposure، shadow، مثالي السطوع، warn blur) = **إرشادي** أو رفض مزود لاحق برسالة واضحة.

المصفوفة الكاملة: `evidence/post_capture_threshold_matrix.md`.

سلوك الرفض: رسالة عربية واحدة + عودة فورية للمعاينة — بلا انتظار READY.

---

## ملفات للمسّ عند التنفيذ (بعد الموافقة)

| ملف | تغيير متوقع |
|-----|-------------|
| `face_capture_panel.dart` | `_canTakePhoto` → mesh `canTakePhoto`؛ إزالة قفل ready؛ تعطيل auto-queue؛ `_validateFile` ببوابة الحد الأدنى لا الحزمة الكاملة |
| `perfect_camera_kit_gate.dart` | إرشاد فقط — لا تغيير عتبات lighting لهذا البند |
| طبقة صغيرة اختيارية | `PostCaptureMinimalGate` تلف FaceGate/IQ بالتصنيف الضروري فقط |

## اختبارات قبول مرتبطة

انظر `05_FILES_AND_ACCEPTANCE.md` بنود A1–A5 المصحَّحة.
