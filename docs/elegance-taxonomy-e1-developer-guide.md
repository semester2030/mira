# دليل المطوّر — أساس تصنيفات «أناقتك» (E1 مغلق)

## مصدر التعريف

| ماذا | أين |
|------|-----|
| حقول/profiles | `mira-api/src/partners-portal/registry/field-registry.v2.json` |
| شجرة أناقتك | `mira-api/src/marketplace/taxonomy/elegance-taxonomy.v1.json` |
| دمج PATCH للخصائص | `marketplace/taxonomy/attributes-patch.merge.ts` |
| تحقق التصنيف | `marketplace/taxonomy/product-taxonomy.validate.ts` |
| تطبيق الحفظ | `marketplace/taxonomy/taxonomy-write.apply.ts` |

نسخة السجل للويب مشتقة: `partners-portal/web/js/field-registry.v2.json` (`npm run check:field-registry`).  
إسقاط التطبيق العام: `GET /api/v1/marketplace/taxonomy?lane=elegance` (يُحمَّل JSON من `dist` بعد البناء — مضمّن في `nest-cli.json` assets).

## عقد PATCH / null / المصفوفات

- الحقل **غير المرسل** يبقى كما هو.
- `attributes: {}` لا يمسح الخصائص.
- `attributes: null` ككيس كامل → مرفوض (`ATTRIBUTES_NULL_FORBIDDEN`).
- مفتاح علوي `null` → مسح ذلك المفتاح فقط.
- مصفوفة مرسلة → استبدال كوحدة (لا دمج عناصر).
- كائن متداخل (مثل `dimensionsCm`) → دمج عميق؛ `dimensionsCm.w=null` → 400 `DIMENSIONS_NULL`.
- التحقق يُطبَّق على **النتيجة بعد الدمج**، مع قفل `FOR UPDATE` في التحديث الفردي.

## منشور مقابل معلّق

للمنتج `contentStatus=published`:
- الاسم/الوصف → `draftName*`
- options/variants → `draftOptions*` / `draftVariants*`
- category/subcategory/profileId/attributes → `draftCategory` / `draftSubcategory` / `draftProfileId` / `draftAttributesJson` + `draftTaxonomySet`
- النسخة العامة لا تتغير حتى `approve` في `CatalogContentService.decide`
- حساب `developer` يبقى بنشر مباشر بعد submit مع بقاء التحقق والملكية

غير المنشور: الكتابة على الأعمدة الحية مباشرة.

## المسارات

1. فردي: `POST/PATCH /partners-portal/products`
2. مسودة: editor PUT → materialize (`attributesJsonFromDraftValues` يجمع حقول `attributes.*`)
3. مجموعات: bulk → نفس materialize
4. موافقة: admin `POST /admin/catalog-reviews/:kind/:id/decision`

## إضافة تصنيف فرعي مدعوم

1. عقدة في `elegance-taxonomy.v1.json` (معرّف ثابت، parent/children متوافقان، `writeEnabled` صادق).
2. `profileId` موجود في السجل.
3. `npm run check:elegance-taxonomy` و`npm run test:elegance-e1`.
4. لا تفعّل الشنط/الأحذية للكتابة قبل E4.

## اختبارات التوافق

```bash
npm run test:elegance-e1
npm run build   # يجب وجود dist/marketplace/taxonomy/elegance-taxonomy.v1.json
node scripts/e1-migration-rollback-proof.mjs
```

تراجع migration المفضّل: إعادة نشر بناء سابق مع إبقاء الأعمدة الإضافية.
