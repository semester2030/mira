# دليل مطور مختصر — E2 محرر البوابة والخصائص

## إضافة حقل مدعوم لاحقًا

1. عرّف الحقل في `mira-api/src/partners-portal/registry/field-registry.v2.json` مع `storage: "attributes.<key>"`.
2. انسخ نفس الملف إلى `partners-portal/web/js/field-registry.v2.json` (يجب تطابق البصمة).
3. أضفه إلى `profiles[].fields` للملف المناسب (`product.clothes` …).
4. إن كان قابلًا للكتابة في E2، أدرج معرّفه في `E2_WRITE_FIELD_IDS` داخل `registry-attribute-fields.js` أو اضبط `currentStatus: "ATTRIBUTES_JSON"`.
5. لا تضف قوائم قيم مستقلة في الفردي/المجموعات — المكوّن المشترك يقرأ السجل فقط.
6. شغّل: `npx tsx src/partners-portal/registry/registry-attribute-fields.schema-tests.ts`

## إضافة تصنيف مدعوم للكتابة

1. عقد taxonomy (`elegance-taxonomy.v1.json`): `writeEnabled: true` + `profileId`.
2. ملف Registry مطابق.
3. خيار subcategory في محرر البوابة (لا تستخدم جذر الفئة بلا `parentId` كـ subcategory — `resolveFromSubcategory` يرفضه).
4. E4 فقط لتفعيل الشنط/الأحذية.

## المسارات

| دور | ملف |
|-----|-----|
| مكوّن مشترك | `partners-portal/web/js/registry-attribute-fields.js` |
| فردي | `catalog-journey.js` → payload `attributes` / `subcategory` |
| مجموعات | `bulk-group-journey.js` → قيم مسطّحة `material`/`cut`… |
| خادم | `applyTaxonomyPatch` + `attributesJsonFromDraftValues` |
