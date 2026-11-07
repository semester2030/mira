# دليل المطوّر — أساس تصنيفات «أناقتك» (E1)

## أين يعدّل التصنيفات والحقول؟

| ماذا | أين (مصدر الحقيقة) |
|------|---------------------|
| حقول المنتج والـprofiles | `mira-api/src/partners-portal/registry/field-registry.v2.json` |
| شجرة أقسام/فروع أناقتك | `mira-api/src/marketplace/taxonomy/elegance-taxonomy.v1.json` |
| نسخة البوابة من السجل | `partners-portal/web/js/field-registry.v2.json` (مشتقة — يجب تطابق SHA) |

لا تُنشئ سجل حقول ثانيًا. الإسقاط العام للتطبيق يُشتق من ملف التصنيفات أعلاه عبر `TaxonomyService.publicProjection()`.

## كيف يضيف فرعًا مدعومًا؟

1. أضف عقدة في `elegance-taxonomy.v1.json` بمعرّف ثابت (`parent.child`)، و`parentId` صحيح، و`children` متبادلة.
2. اربط `profileId` موجودًا في `field-registry.v2.json` (أو أضف الـprofile أولًا).
3. اضبط `writeEnabled: true` فقط عندما يكون القسم في allowlist المنتجات وجاهزًا للحفظ.
4. لا تستخدم `*.all` إلا كـ`browseOnly` للتنقّل — لا يُحفظ على المنتج.
5. شغّل: `npm run check:elegance-taxonomy` و`npm run test:elegance-e1`.

## ما الذي يحتاج كودًا / migration / إصدار تطبيق؟

| التغيير | مطلوب |
|---------|--------|
| فرع جديد ضمن قسم write-enabled قائم + profile موجود | تحديث JSON + اختبارات (غالبًا بدون migration) |
| عمود تخزين جديد على Product | migration إضافية متوافقة |
| قسم جديد للكتابة غير موجود في `PRODUCT_CATEGORIES` | كود allowlist + profile + taxonomy |
| شاشات البوابة/التطبيق | مراحل E2–E5 (خارج E1) |

## كيف تُولد النسخ المشتقة؟

- السجل للويب: انسخ من مصدر الـAPI ثم `npm run check:field-registry`.
- التصنيفات العامة: لا تُنسخ يدويًا — `GET /api/v1/marketplace/taxonomy?lane=elegance`.
- كشف الانحراف: `npm run check:elegance-taxonomy`.

## كيف يشغّل الاختبارات؟

```bash
cd mira-api
export DATABASE_URL='postgresql://mira:mira_secret@localhost:5432/mira_db?schema=public'
npx prisma migrate deploy
npm run test:elegance-e1
```

اختبارات نقية بدون HTTP:  
`npx tsx src/marketplace/taxonomy/taxonomy.load.schema-tests.ts`  
`npx tsx src/marketplace/taxonomy/product-taxonomy.validate.schema-tests.ts`

## تتبّع حقل من التعريف إلى الحفظ والقراءة

1. تعريف الحقل في `field-registry.v2.json` → `RegistryService.validateValues`.
2. التصنيف الفرعي في `elegance-taxonomy.v1.json` → `validateProductTaxonomyWrite` / `TaxonomyService.validateWrite`.
3. الحفظ الفردي: `PartnersPortalService.createProduct|updateProduct` → أعمدة `category` / `subcategory` / `profile_id` / `attributes_json`.
4. المسودات: `EditorDraftsService` materialize بنفس الأعمدة.
5. القراءة العامة: كتالوج marketplace يعيد `subcategory`؛ الفلتر `?subcategory=` قبل pagination.
6. التصفح العام للشجرة: `GET .../marketplace/taxonomy?lane=elegance`.

## حدود E1 مقابل E2+

- **مغلق في E1:** مصدر موحّد، تحقق خادم ملزم، taxonomy API، حفظ/قراءة subcategory، فلتر كتالوج، اختبارات E1-01..12.
- **E2 إلزامي:** استدارة حفظ attributes في البوابة (مثل `material[]` و`carryStyle`) بعد تعديل الاسم — انظر `docs/elegance-taxonomy-e2-acceptance.md`.
- **E4:** تفعيل كتابة الشنط/الأحذية (`writeEnabled`).
- خارج النطاق: مجوهرات، أطفال، خدمات، حجوزات، ترحيل إنتاج، نشر عام للميزة.
