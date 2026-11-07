# دليل المطوّر — أساس تصنيفات «أناقتك» (E1 مغلق نهائيًا)

## مصدر التعريف

| ماذا | أين |
|------|-----|
| حقول/profiles | `mira-api/src/partners-portal/registry/field-registry.v2.json` |
| شجرة أناقتك | `mira-api/src/marketplace/taxonomy/elegance-taxonomy.v1.json` |
| دمج PATCH للخصائص | `marketplace/taxonomy/attributes-patch.merge.ts` |
| تحقق التصنيف | `marketplace/taxonomy/product-taxonomy.validate.ts` |
| تطبيق الحفظ | `marketplace/taxonomy/taxonomy-write.apply.ts` (`applyTaxonomyPatch`, `readTaxonomyBaseline`) |

نسخة السجل للويب مشتقة: `partners-portal/web/js/field-registry.v2.json` (`npm run check:field-registry`).  
إسقاط التطبيق العام: `GET /api/v1/marketplace/taxonomy?lane=elegance` (يُحمَّل JSON من `dist` بعد البناء — مضمّن في `nest-cli.json` assets).

## ترتيب التحقق (إلزامي)

1. احسب الحالة النهائية للتصنيف من الأساس + التعديل.
2. حدّد `profileId` الفعلي من التصنيف (عند غياب تعارض صريح).
3. ارفض تعارض `category` / `subcategory` / `profileId`.
4. حمّل تعريفات الحقول للملف **النهائي** فقط (`resolveAttributeFieldDefs`).
5. ادمج تعديل الخصائص.
6. تحقق من القيم قبل الحفظ.

لا تُحمَّل تعريفات الملف القديم بعد تغيير التصنيف. لا يُستخدم `allowUnknownAttributeKeys=true` كسماح شامل؛ المفاتيح الجديدة/المعدَّلة غير المعرّفة تُرفض، بينما الخصائص القديمة غير المعروفة تُحفظ عند عدم لمسها (توافق).

## عقد PATCH / null / المصفوفات

- الحقل **غير المرسل** يبقى كما هو.
- `attributes: {}` لا يمسح الخصائص.
- `attributes: null` ككيس كامل → مرفوض (`ATTRIBUTES_NULL_FORBIDDEN`).
- مفتاح علوي `null` → مسح ذلك المفتاح فقط.
- مصفوفة مرسلة → استبدال كوحدة (لا دمج عناصر).
- كائن متداخل (مثل `dimensionsCm`) → دمج عميق؛ `dimensionsCm.w=null` → 400 `DIMENSIONS_NULL`.
- `subcategory: null` / `profileId: null` مسموحان للمسح الصريح (legacy). إن رُفض المسح لاحقًا لعقد جديد فيجب أن يكون الرفض 400 من العملية الأولى لا تراجعًا صامتًا.
- المسودة تسمح بنقص الحقول المطلوبة للنشر، وترفض القيم ذات النوع الخاطئ.

## أساس التعديل المعلّق (`draftTaxonomySet`)

- `draftTaxonomySet=false` → الأساس = الأعمدة المنشورة.
- `draftTaxonomySet=true` → الأساس = `draftCategory` / `draftSubcategory` / `draftProfileId` / `draftAttributesJson` **بما فيها null للمسح**.
- ممنوع: `draftSubcategory ?? publishedSubcategory` لإلغاء مسح صريح.
- نفس القاعدة في الفردي، materialize، المعاينة، والموافقة.
- التعديل اللاحق يحافظ على المسح ما لم يُرسل المستخدم قيمة جديدة.
- عند الموافقة تُطبَّق الحالة المعلّقة كاملة ثم تُصفَّر الأعلام داخل المعاملة.
- الرفض لا يغيّر النسخة المنشورة.
- مسودة المحتوى لا تُغيّر السعر/المخزون/الحجوزات التشغيلية على المنشور.

## المسارات

1. فردي: `POST/PATCH /partners-portal/products`
2. مسودة: editor PUT → materialize (`attributesJsonFromDraftValues` يجمع حقول `attributes.*`؛ `subcategory` حقل سجل `existing.subcategory`)
3. مجموعات: bulk → نفس materialize
4. موافقة: admin `POST /admin/catalog-reviews/:kind/:id/decision`
5. مطوّر مخوّل: submit → نشر مباشر بعد التحقق والعزل (صلاحية من `partner.type` في الخادم فقط)

## إضافة تصنيف فرعي مدعوم

1. عقدة في `elegance-taxonomy.v1.json` (معرّف ثابت، parent/children متوافقان، `writeEnabled` صادق).
2. `profileId` موجود في السجل ومفعّل للكتابة عند الحاجة.
3. `npm run check:elegance-taxonomy` و`npm run test:elegance-e1`.
4. لا تفعّل الشنط/الأحذية للكتابة قبل E4.

## اختبارات وإثبات

```bash
export DATABASE_URL='postgresql://mira:mira_secret@localhost:5432/mira_db'
npm run test:elegance-e1
npm run test:elegance-e1-migration-proof
# بعد بناء الإصدار السابق على PREV_APP_DIST:
npm run test:elegance-e1-previous-app-rollback
npm run build   # يجب وجود dist/marketplace/taxonomy/elegance-taxonomy.v1.json
```

### غياب / مسح profile والتحقق

- `profileId` المخزَّن قد يكون `null` بعد مسح صريح.
- سياق التحقق يُستنتج من `subcategory` عند الحاجة دون إعادة كتابة الملف الممسوح.
- تعديل `attributes` فقط **لا يعيد** `profileId` الممسوح؛ الاستنتاج المخزَّن يحدث فقط عند **تغيير subcategory صراحةً** أو إنشاء جديد بإغفال الملف.
- إعادة إرسال نفس `subcategory` لا تلغي مسحًا سابقًا.
- إضافة/تعديل attributes بلا سياق موثوق → `ATTRIBUTE_CONTEXT_REQUIRED` (أو أخطاء النوع/المجهول عند توفر السياق).
- المسح بمفتاح `null` مسموح؛ الخصائص القديمة غير المعدَّلة تُحفظ.

تراجع migration المفضّل: إعادة نشر بناء سابق (`60d9134…`) مع إبقاء الأعمدة الإضافية — مثبَّت عبر `e1-previous-app-rollback-proof.mjs`. لا تَعُدّ DROP COLUMN رجوعًا آمنًا بعد اعتماد بيانات عليها.
