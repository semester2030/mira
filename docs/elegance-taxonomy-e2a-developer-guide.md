# دليل مطور — E2أ إغلاق ملاحظات البوابة (C01–C05 / ARCH)

تاريخ التحديث: 2026-11-08 · النطاق: بوابة الشركاء فقط (لا E2ب/ج بصري، لا E3–E5، لا نشر إنتاج).

## 1) خريطة الملفات ومسؤولياتها

| جزء | مسار فعلي | مسؤولية |
|-----|-----------|---------|
| مكوّن خصائص مشترك | `partners-portal/web/js/registry-attribute-fields.js` | عرض الحقول، حالة التحرير، parked غير المتوافق، استخراج القيم، لقطات الخادم الآمنة |
| رحلة الفردي | `partners-portal/web/js/catalog-journey.js` | تحميل taxonomy عبر `PartnersApi`، remount مع `preserveEdits`، حماية رد الحفظ القديم |
| رحلة المجموعات | `partners-portal/web/js/bulk-group-journey.js` | نفس المكوّن لكل بطاقة (`mountId` فريد)، استخراج من registry، إعادة محاولة taxonomy |
| عميل API | `partners-portal/web/js/api.js` | `PartnersApi.base` من meta/`api-base`، `taxonomy`، `productPreview`، منتجات/مجموعات |
| سجل الحقول | `partners-portal/web/js/field-registry.v2.json` + نسخة API | مصدر المعرفات/التخزين/الملفات الشخصية |
| taxonomy | `mira-api/src/marketplace/taxonomy/elegance-taxonomy.v1.json` | عقد التصنيفات و`profileId` / `writeEnabled` |
| تحقق خادم | `applyTaxonomyPatch` داخل خدمات الشركاء | ملكية، صلاحيات، قيم، مسودة taxonomy |
| اختبار مكوّن | `mira-api/src/partners-portal/registry/registry-attribute-fields.schema-tests.ts` | C01/C02/C04 محليًا |
| اختبار HTTP بوابة | `mira-api/src/marketplace/taxonomy/elegance-e2-portal.http.integration-tests.ts` | حفظ→DB→preview |
| اختبار رحلة E2أ | `mira-api/src/marketplace/taxonomy/elegance-e2a-portal-journey.integration-tests.ts` | قبول C01–C05 على Nest حقيقي |

حدود المجالات (ARCH): المنتجات/المخزون/التركيبات في مسارات `products` + commerce mounts؛ الخدمات/المواعيد في `services` + قوالب منفصلة؛ الوسائط عبر `/media`؛ الصلاحيات في `PartnerTokenGuard` + نوع الحساب.

## 2) مسار طلب نموذجي (واجهة → DB → عرض)

1. واجهة: المستخدم يعدّل حقلًا → `markDirty` / `bumpEditRevision` → `onChange` يرفع `formContentEpoch`.
2. حفظ: `catalog-journey` يبني `payload.attributes` من `getAttributesPatch()` (مفاتيح dirty فقط؛ القيم المتوقفة parked لا تُرسل).
3. API: `PartnersApi.updateProduct` / `createProduct` → `PATCH/POST /partners-portal/products`.
4. تحقق: حارس التوكن → خدمة الشركاء → `applyTaxonomyPatch` + ملكية الشريك.
5. DB: `attributesJson` / `draftAttributesJson` + subcategory.
6. قراءة: `PartnersApi.productPreview(id)` — مسار البوابة؛ لا يُستبدل بنجاح قراءة Prisma وحدها.
7. عرض: إن لم يتغيّر `editRevision` منذ الإرسال يُطبَّق الرد كاملًا؛ وإلا `applyServerSnapshot({ onlyClean: true })`.

المجموعات: نفس المكوّن؛ القيم المسطّحة تُحوَّل عبر `extractAttributesFromValues(vals, registry)`.

## 3) المنطق المشترك فردي ↔ مجموعات

- المكوّن: `MiraRegistryAttributeFields.mount`
- التحويل: `extractAttributesFromValues` / `attrFieldIdsFromRegistry` / `projectStateOntoDefs`
- التصنيفات: `PartnersApi.taxonomy({ lane: 'elegance' })` + `subcategoriesFromTaxonomy`
- لا تُنقل حالة parked بين بطاقات مختلفة (`mountId` / عدم تمرير `preserveState` عند تبديل البطاقة)

## 4) إضافة تصنيف أو حقل / نوع خدمة لاحقًا

### تصنيف فرعي قابل للكتابة

1. عقد في `elegance-taxonomy.v1.json` (`parentId`, `writeEnabled`, `profileId`).
2. ملف profile في registry إن لزم.
3. لا تخمين subcategory في الواجهة؛ أبقِ القيمة المخزّنة ظاهرة إن لم تكن في القائمة.
4. اختبارات: schema + HTTP portal + عدم رجوع E1.

### حقل خصائص جديد (E2 كتابة)

1. تعريف في `field-registry.v2.json` مع `storage: "attributes.<key>"` و`currentStatus` مناسب.
2. انسخ إلى نسخة الويب؛ ثبّت التطابق باختبار النسخ.
3. أضفه إلى `profiles[].fields`.
4. **لا** تضف اسمه إلى قائمة ثانية — `attrFieldIdsFromRegistry` يشتقه.
5. الحقول `PROPOSED` تبقى مؤجّلة (`classifyField` → deferred) حتى تفعيل العقد.

### نوع خدمة مستقبلي

مسار منفصل عن المنتجات: قالب خدمة + `ServiceProfileService`؛ لا تخلط حقول الموعد مع `attributesJson` للمنتج. وثّق العقد قبل التنفيذ (E2ج/E3 حسب الخطة).

## 5) أوامر التشغيل والاختبار

```bash
cd mira-api
# مكوّن
npx tsx src/partners-portal/registry/registry-attribute-fields.schema-tests.ts
# بوابة HTTP E2
DATABASE_URL=… MIRA_PARTNER_EDITOR_V2=true npx tsx src/marketplace/taxonomy/elegance-e2-portal.http.integration-tests.ts
# رحلة E2أ
DATABASE_URL=… MIRA_PARTNER_EDITOR_V2=true npx tsx src/marketplace/taxonomy/elegance-e2a-portal-journey.integration-tests.ts
# عدم رجوع E1 (إن وُجد سكربت المشروع)
npx tsx src/marketplace/taxonomy/elegance-e1-*.ts
```

ملفات يجب تعديلها عند حقل جديد: نسختا registry، ربما taxonomy، اختبارات schema/HTTP — **ليس** قائمة `FLAT_ATTR_*` إلا كاحتياطي بلا registry.

## 6) المنفَّذ مقابل المؤجّل

| منفَّذ في E2أ | مؤجّل |
|---------------|--------|
| C01 parked عبر التصنيف | E2ب/ج تطبيق التصور البصري |
| C02 حماية رد الحفظ | E3 ربط التطبيق |
| C03 مصدر taxonomy موحّد | E4 كتابة شنط/أحذية |
| C04 اشتقاق الحقول من registry | E5 قبول iPhone حقيقي |
| ARCH دليل + حدود المجالات المتأثرة | نشر إنتاج |

## ARCH 01–07 (على الأجزاء المتأثرة)

1. فصل منتجات/مخزون عن خدمات؛ وسائط وصلاحيات عبر مساراتها.
2. المجموعات تنسّق وتعيد استخدام مكوّن الخصائص والتجارة.
3. الخادم يتحقق في كل مسارات المنتجات/المجموعات المختبرة.
4. التعريفات المركزية + اختبار تطابق نسختي registry.
5. استقبال HTTP → حارس → خدمة مجال → Prisma (نمط Nest القائم).
6. اتصال API وتحويل الحقول وحالة التحرير في المواضع المشتركة أعلاه.
7. توافق البيانات القديمة؛ لا إعادة هيكلة شاملة خارج النطاق.
