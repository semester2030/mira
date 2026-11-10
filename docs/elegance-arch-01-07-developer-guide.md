# ARCH 01–07 — دليل المطوّر (مسارات فعلية)

نطاق هذا الدليل: الملفات المتأثرة بإغلاق بوابة أناقتك ↔ التطبيق. ليس إعادة هيكلة شاملة.

## فصل المجالات (ARCH-01 / ARCH-02)

| مجال | مسارات فعلية | لا يُخلط مع |
| --- | --- | --- |
| منتجات / مخزون / تركيبات | `partners-portal/web/js/catalog-journey.js` (brand)، `product-commerce-fields.js`، `catalog-options-core.js`، `mira-api/.../variant-inventory.service.ts`، `partners-portal.service.ts` (commerce PATCH) | خدمات / إتاحة |
| خدمات / إتاحة / مكان | `catalog-journey.js` (salon/clinic)، `e2b-service-shell.js`، `editor-drafts.service.ts` (weeklyHours/dateExceptions)، availability validators في البوابة | منتجات / variants |
| وسائط | `CatalogMediaStorage` / upload-sessions / `catalog-media.controller.ts`؛ رحلة الفردي في `catalog-journey.js`؛ المجموعة في `bulk-group-journey.js` | منطق التصنيف |
| صلاحيات | `PartnerTokenGuard`، قرارات المراجعة في `catalog-review.admin.controller.ts`، فرض الملكية على bulk في `bulk-batches.service.ts` | واجهة فقط |

إثبات الفصل: `ACC-E2C-ISOLATION` و`ACC-E2C-NO-REGRESS-PRODUCT-SHELL` و`ACC-GRP-PERMS-OWNERSHIP`.

## مصدر مركزي للتصنيفات والحقول (ARCH-03)

| المصدر | المستهلكون |
| --- | --- |
| `mira-api/src/marketplace/taxonomy/elegance-taxonomy.v1.json` | API `TaxonomyService`، بوابة `PartnersApi.taxonomy`، تطبيق `EleganceTaxonomySource` / Discover |
| `mira-api/src/partners-portal/registry/field-registry.v2.json` (+ نسخة الويب المتزامنة `partners-portal/web/js/field-registry.v2.json`) | محرر الفردي، المجموعات، فلاتر التطبيق عبر حقول `filter` |

إضافة حقل جديد (مثال):

1. أضف تعريف الحقل في `field-registry.v2.json` مع `storage` (`attributes.*` أو عمود).
2. أضفه إلى `profiles[].fields` للفئة المعنية (`product.bags` / `product.shoes` / …).
3. إن كان مرشح فلتر: عيّن `filter` وحدّث مسارات browse في `MarketplaceService` عند الحاجة.
4. للبوابة: تأكد أن `registry-attribute-fields.js` أو options-core يعرض الويدجت.
5. للتطبيق: لا تُحقن قوائم يدوية — اعتمد `ensureLoaded` / projections من API.
6. أضف اختبار قبول (schema أو رحلة) يفشل إذا غاب الحقل من المصدر المركزي.

## قواعد مشتركة فردي ↔ مجموعات (ARCH-04)

- الحقول/التحقق للمنتجات والخدمات تُبنى من نفس السجل والقوالب.
- `bulk-group-journey.js` منسّق تنقّل وبطاقات ورفع فيديو لكل عرض؛ **لا** يعيد تنفيذ قواعد المجالات — يستدعي `PartnersApi.putBulkCard` / materialize ويلتقط أخطاء الحقول من الخادم.
- إثبات: `ACC-GRP-PRODUCT-RETRY-FAILED-ONLY` (عزل العروض) + مشاركة `registry-attribute-fields` / options في الفردي والمجموعة.

## طبقات الطلب (ARCH-05)

```
HTTP (PartnersPortalController / MarketplaceController)
  → DTO + ValidationPipe
  → Service قواعد العمل (PartnersPortalService / BulkBatchesService / EditorDraftsService)
  → Prisma / تخزين الوسائط
```

لا تُوضع قواعد الإتاحة أو التصنيف داخل طبقة الـ controller فقط؛ الرفض النهائي للإتاحة غير الصالحة مثبت في الخدمة/المسودة (`AVAILABILITY_*`) وفي الواجهة عبر `availabilityJson.build()`.

## أوامر التشغيل المحلية (ARCH-06)

```bash
cd mira-api
export DATABASE_URL='postgresql://mira:mira_secret@localhost:5432/mira_open_items_test'
export NODE_ENV=test
export MIRA_PARTNER_UPLOAD_SESSION=true
export MIRA_UPLOAD_PART_SIZE_BYTES=262144

npx tsx src/marketplace/taxonomy/elegance-e2c-acceptance.browser.integration-tests.ts
npx tsx src/marketplace/taxonomy/elegance-e3-acceptance.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/elegance-e4-bags-shoes-write.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/elegance-groups-acceptance.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/elegance-e4-groups-ui.browser.integration-tests.ts
```

أدلة: `../.e2c-acceptance-evidence/` · `../.e3-acceptance-evidence/` · `../.e4-acceptance-evidence/` · `../.groups-acceptance-evidence/` · `../.e4-groups-ui-evidence/`.

التحقق من الحزمة:

```bash
python3 verification/verify_package.py /path/to/package-or-zip
```

## رحلة طلب مختصرة (ARCH-07)

**منتج فردي:** بوابة إنشاء/حفظ → وسائط → submit-review (عادي) أو نشر مطوّر → اعتماد إداري → `GET /marketplace/catalog` → Discover (Flutter) مع `definitionsVersion` / lifecycle refresh.

**خدمة فردية:** محرر الخدمة (دوائر + مكان + إتاحة) → مسودة خادمية → materialize → مراجعة/نشر → ظهور كتالوج الخدمات.

**مجموعة:** مقطع واحد → بياناته ووسيطه → «حفظ وإضافة مقطع آخر» → مراجعة المجموعة → materialize/publish؛ عند فشل جزء: `failedOnly` دون تكرار الناجح.

## قابلية التوسع — دليل إعادة الاستخدام (ليس أسماء مجلدات فقط)

| آلية | أين تُعاد |
| --- | --- |
| `validateProductTaxonomyWrite` | إنشاء/PATCH منتج، بوابة ومجموعات |
| `RegistryService` + attribute mount | فردي منتج، شنط/أحذية، بطاقات المجموعة |
| `compareAvailabilitySnapshot` / availability build | قبول E2ج وحفظ الخدمة |
| `EleganceTaxonomySource.ensureLoaded` | شاشة Discover واختبارات E3 |
| `LocalCatalogMediaStorage` في القبول | E3/E4 دون الاعتماد على تخزين إنتاج |

خارج النطاق هنا: try-on، لوجستيات، أطفال، مجوهرات.
