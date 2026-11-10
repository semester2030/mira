# دليل المطوّر — المرحلة ١ (أقسام ميرا الأربعة)

## كيف أضيف فرعًا يستخدم حقولًا موجودة؟

1. افتح ملف التصنيف للمسار تحت `mira-api/src/marketplace/taxonomy/`  
   (مثل `jewelry-taxonomy.v1.json`).
2. أضف عقدة ابن: `id`, `parentId`, `labelAr`, `sort`, `active: true`,  
   `writeEnabled: true`, `profileId` لملف موجود (مثل `product.jewelry`)،  
   `imageKey` فريد، وأضِف `id` إلى `children` للأب.
3. ارفع `definitionsVersion` في نفس الملف.
4. اختياري: عبارات وصف في `description-phrases.v1.json` تحت نفس `id`.
5. أعد تشغيل الـAPI. لا تعدّل Flutter ولا بوابة العارض —  
   القراءة من `GET /api/v1/marketplace/taxonomy?lane=…`  
   (معاينة غير عامة: أضِف `audience=partner`).

**لا** تلمس `field-registry.v2.json` إذا كانت الحقول موجودة أصلًا.

## كيف أضيف حقلًا جديدًا؟

1. **المصدر الأصلي الوحيد:**  
   `mira-api/src/partners-portal/registry/field-registry.v2.json`
2. عرّف الحقل تحت `fields` (مع `filter` إن لزم) وأضِفه إلى `profiles[].fields` المناسب.
3. إن لزم سلوك فلتر كتالوج: حدّث `mira-api/src/marketplace/catalog-filters.ts`.
4. ولّد نسخة البوابة الثابتة (احتياطي offline فقط):
   ```bash
   cd mira-api && npm run sync:field-registry
   ```
5. افحص التزامن (يفشل عند الاختلاف):
   ```bash
   cd mira-api && npm run check:field-registry
   # إثبات أن الفحص يكتشف انحرافًا متعمدًا:
   npm run prove:field-registry-drift
   ```
6. محرّر البوابة يفضّل `PartnersApi.registry()` → `GET /partners-portal/registry`  
   على الملف الثابت. لا تعدّل يدويًا  
   `partners-portal/web/js/field-registry.v2.json`.

## صلاحية بيع المنتجات لمنسّق المناسبات

- العلم الصريح في قاعدة البيانات: `Partner.canSellProducts`  
  (عمود `can_sell_products`، افتراضي `false`).
- **لا** تُمنح الصلاحية عبر `storeUrl` أو أي قيمة نصية داخله  
  (بما فيها `mira:canSellProducts=1`).
- `event_planner`: خدمات المناسبات مسموحة دائمًا؛ المنتجات فقط بعد المنح.
- منح/سحب: تحديث `canSellProducts` على سجل الشريك.
- التوافق: الحسابات القديمة تبقى `false` حتى المنح الصريح؛  
  التراجع = إعادة `canSellProducts=false`.
- الهجرة: `prisma/migrations/20261110223000_partner_can_sell_products/`.
- حساب `developer` يستثنى دون تعميم لباقي الأنواع.

## ملفات المسؤوليات

| مسؤولية | ملف |
|---|---|
| فهرس المسارات | `taxonomy/lanes.manifest.v1.json` |
| أشجار الأقسام | `*-taxonomy.v1.json` |
| سجل الحقول (أصلي) | `partners-portal/registry/field-registry.v2.json` |
| نسخة بوابة مولَّدة | `partners-portal/web/js/field-registry.v2.json` (via sync) |
| فلاتر الكتالوج | `catalog-filters.ts` |
| صلاحيات الشريك | `partner-capabilities.ts` |
| قراءة التطبيق | `lib/.../elegance_taxonomy_source.dart` |
| قراءة البوابة | `partners-portal/web/js/api.js` → `taxonomy` / `registry` |

## اختبارات المرحلة ١

```bash
cd mira-api
npm run check:field-registry
npm run prove:field-registry-drift
npx tsx src/partners-portal/phase1-event-planner-sell.schema-tests.ts
npm run test:phase1-four-lanes
```

## قواعد مهمة

- `*.all` للتنقّل فقط — الخادم يرفضه كتصنيف نشر.
- الأقسام ذات `publicBrowse: false` لا تظهر للعامة.
- المجموعات خارج نطاق هذه المرحلة.
