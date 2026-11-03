# P1_DECISIONS — قرارات محسومة (تنفيذ RC1)

أساس البناء المراجع: `origin/main` @ `10b48c5de746a1fafe212ab0b3e66d50dd3a00a8`  
فرع التنفيذ: `mira/p1-partner-editor-v2` (worktree معزول؛ لا reset/clean لمستودع المستخدم).

Feature flag: **`MIRA_PARTNER_EDITOR_V2=false`** افتراضيًا. الخادم مصدر التفعيل؛ لا يفعّل query param ميزة معطّلة.

---

## تصحيحات العقود الأربعة (مغلقة)

### أ) الحقول الاختيارية
- مفاتيح السجل: **`draftRequired`**, **`publishRequiredWhen`** (camelCase كما في `field-registry.v2.json`).
- **`nameAr` ليس شرطًا لحفظ المسودة**.
- مسودة صالحة بـ `values: {}` مع `kind` + `profileId` + `schemaVersion`.
- متطلبات النشر تُطبَّق عند **materialize** (و/أو submitReview) لا عند الحفظ التلقائي.
- ممنوع توليد اسم/سعر/مدة وهمية.

### ب) تحويل المسودة (materialize)
- الجسم يتطلب **`expectedRevision`**.
- بعد النجاح: `status=materialized`, `materializedAt`, `targetOwnerId`/`targetKind` مربوطة.
- معاملة + `SELECT … FOR UPDATE` على صف المسودة؛ لا اعتماد على Idempotency-Key وحده بين مفتاحين مختلفين.
- نفس المفتاح + نفس البصمة → إعادة نتيجة؛ نفس المفتاح + بصمة مختلفة → 409.

### ج) تعديل القالب / الاستيراد
- كل كتابة تستخدم **`expectedRevision`** (= `Service.reviewRevision`) ذريًا.
- **`force=true` لا يتجاوز** إصدارًا تغيّر بعد المعاينة؛ إن تغيّر → 409؛ إعادة التأكيد على نسخة حديثة.

### د) التراجع
- تعطيل العلم مع **الإبقاء على البيانات**.
- لا `DROP TABLE` / `DROP COLUMN` في خطة التراجع المعتادة.

---

## أ) سجل الحقول (P1.1)

| قرار | قيمة |
|---|---|
| مصدر الحقيقة | `mira-api/src/partners-portal/registry/field-registry.v2.json` |
| نسخة الويب | `partners-portal/web/js/field-registry.v2.json` — يجب تطابق SHA؛ فحص `scripts/check-field-registry-sync.mjs` |
| schemaVersion | `2` |
| profileId | من `profiles[].id`؛ الأنشطة `enabledByDefault=false` / FUTURE تبقى مرفوضة |
| صلاحية profile | لا يكفي وجود id؛ يجب partnerType ∈ profile.partnerTypes والملف مفعّل |
| مجهول | 400 `REGISTRY_UNKNOWN_FIELD` / `REGISTRY_UNKNOWN_VALUE` على كتابات v2 |
| عميل قديم | مسارات CRUD الحالية تعمل والعلم on أو off |

## ب) PartnerEditorDraft (P1.2)

- جدول `partner_editor_drafts` + قيد `UNIQUE(partner_id, client_draft_id)`.
- `partnerId` من الجلسة فقط.
- `revision` يبدأ 1؛ PUT يستبدل `values` كاملة؛ تعارض → 409.
- المسودات لا تظهر في الكتالوج العام.
- الحفظ التلقائي في البوابة يعتمد الخادم؛ localStorage ليس مصدر الحقيقة النهائي.

## ج) قوالب الخدمات (P1.3)

- أعمدة: `service_profile_json`, `draft_service_profile_json`, `draft_service_profile_set`.
- البنية: `{ templateId, templateVersion, priceMode, answers }`.
- منشور: يكتب draft_* حتى الاعتماد؛ العام لا يسرّب draft.
- Flutter P1.3: قراءة `serviceProfileJson` وعرض حقول معتمدة؛ P5 للفلاتر المتقدمة.

## Flutter

- P1.3: parser + عرض تفاصيل.
- P5: فلاتر/تقويم موسّع.

## Migrations

1. `PartnerEditorDraft` (+ idempotency columns on draft).
2. `profile_id` / `schema_version` على products/services.
3. أعمدة `service_profile_*`.

تراجع تشغيلي: العلم off أولًا.
