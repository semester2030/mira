# 05 — الملفات ومعايير القبول (مصحَّحة 2026-09-17)

## ملفات للمسّ عند التنفيذ (بدون تغيير عن الجولة السابقة + دقة البوابات)

### تصوير
| ملف | موضع |
|-----|------|
| `face_capture_panel.dart` | `_canTakePhoto` → `FaceMeshQualityGate.canTakePhoto`؛ تعطيل auto `isStableReady`؛ `_validateFile` بحد أدنى لا الحزمة الكاملة |
| `perfect_camera_kit_gate.dart` | إرشاد فقط |
| `face_mesh_quality_gate.dart` / `face_mesh_models.dart` | قراءة فقط + حداثة `timestamp` اختيارية |
| بوابة ما بعد التقاط جديدة (مقترح) | تصفية ضروري/إرشادي حسب `evidence/post_capture_threshold_matrix.md` |

### درجات / خريطة
| ملف | موضع |
|-----|------|
| `results_skin_map_panel.dart` `_ActiveMetricHero` | الإبقاء على uiScore + «الأعلى أفضل» |
| `metric_presentation_policy.dart` | عدم خلط `faceExplorerStatusAr` مع `severityStatusPublicAr` على نفس الرقم |
| `score_semantics_contract.dart` | التحويل `wellnessUiToSeverity` لمسار النتائج فقط |
| tokens / overlay / session | كما في الدراسة — بلا أقنعة وهمية |

### خلفية
| ملف | موضع |
|-----|------|
| `ApplePersonMattingChannel.swift` | خلفية `#FFF7FA` بدل `#000` للعرض |
| bridge + `results_skin_map_panel` + tokens | استهلاك العرض |

---

## مصفوفة قبول الجهاز (مصحَّحة)

| ID | السيناريو | نجاح |
|----|-----------|------|
| A1 | وجه واحد متتبَّع (mesh `hasFace` و quality≠low) مع إضاءة غير READY لـ CameraKit → **الزر مفعّل** | ☐ |
| A2 | لا وجه / quality=low → الزر معطّل؛ **بدون** انتظار isStableReady | ☐ |
| A3 | ضغطة → التقاط → تحليل إن اجتاز الحد الأدنى فقط | ☐ |
| A4 | رفض ضروري فقط (لا وجه، وجوه متعددة، blur<28، brightness متطرف، مساحة وجه متطرفة، decode) برسالة واحدة وعودة فورية | ☐ |
| A5 | وضعية/مركز/ظل غير مثالي **لا** يرفض محلياً بعد الضغطة في المسار المبسّط | ☐ |
| B1 | Face Explorer يعرض `uiScore` مع تلميح **الأعلى أفضل** | ☐ |
| B2 | لا يُعرض رقم الشدة `100−ui` على الخريطة ما لم يُحوَّل صراحة في مسار نتائج منفصل | ☐ |
| B3 | scoreOnly → درجة بلا خريطة | ☐ |
| C1–C2 | محاذاة مكبّر + hold original (كما سبق) | ☐ |
| D1 | خلفية عرض `#FFF7FA`؛ البشرة محفوظة | ☐ |
| D2 | التحليل على الأصل لا الماتّة | ☐ |
| D3 | وضوح نقاط/خطوط/مناطق شفافة على بشرة مختلفة | ☐ |
| V1 | التصور `visuals/...FFF7FA.png` موسوم DESIGN MOCK ومفصول عن نتيجة جهاز حقيقية | ☐ |

## خارج نطاق هذه التصحيحات

تنفيذ كود الإنتاج · تخفيف عتبات CameraKit lighting · إعادة دراسة كاملة.
