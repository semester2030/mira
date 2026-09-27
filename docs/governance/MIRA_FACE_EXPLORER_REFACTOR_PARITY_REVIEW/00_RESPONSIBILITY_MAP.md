# MIRA Face Explorer — Refactor + Parity Review

التاريخ: 2026-09-17  
البناء: `1.0.0+2026091707`

## مرحلتان

### 1) تقسيم المسؤوليات

| قبل | بعد |
|---|---|
| `results_skin_map_panel.dart` (~2000 سطر، كل شيء) | منسّق رفيع + وحدات |

| ملف | مسؤولية |
|---|---|
| `results_skin_map_panel.dart` | تجميع الشاشة، API العام `selectConcern`، callbacks |
| `face_explorer_controller.dart` | اختيار/منطقة/عدسة/مقارنة/تصدير + ربط التركيز |
| `face_explorer_image_loader.dart` | تحميل الصورة + عزل الوجه + حارس الجيل |
| `face_explorer_metrics.dart` | شبكة 3×2 مرتّبة + شريط الدرجة |
| `face_explorer_stage.dart` | صورة/قناع/لمس محلي للصورة |
| `face_explorer_lens_panel.dart` | لوحة مستطيلة ×2/×3 + منزلقات + اختصارات |
| `face_explorer_details.dart` | مفتاح لون + مناطق قياس + شرح النتيجة |

### 2) إصلاحات التصور/الربط

- الشرائح والاختصارات تستخدم `boundMask` مع `requireExactRegion` للمنطقة المختارة.
- لمس الوجه يفتح لوحة التكبير على الموضع؛ حلقة الفحص تظهر مع اللوحة فقط.
- ترتيب الشاشة وفق `VISUAL_PARITY_ACCEPTANCE.md`.
- شبكة أساسية مرتّبة صراحة: مسام ← تجاعيد ← حبوب ← تصبغات ← ترطيب ← دهون.
- تصدير: `sharePositionOrigin` صالح؛ حالة enum بدل `startsWith`.
- تحميل الصورة: معرّف جيل يمنع استبدال نتيجة قديمة بصورة أحدث؛ `codec.dispose`.

## ما اختُبر

- `face_explorer_controller_test` (7) + magnifier/fit/overlay المرتبطة.
- `dart analyze` على الوحدات الجديدة: نظيف.
- بناء iOS profile `+2026091707`.

## ما لم يُختبر / متبقٍ

- مقارنة مرئية جهاز↔تصور حالةً بحالة (لقطات مالك).
- إثبات وصول ZIP فعلي إلى الماك في هذه الجولة.
- اكتمال وضوح الخرائط على أقنعة محاولة حقيقية — **غير معلن**.

## مراجع

`docs/governance/MIRA_MAP_APPROVED_INPUTS_AND_REVIEW/VISUAL_PARITY_ACCEPTANCE.md`
