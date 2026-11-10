# E2ج + E3 — مسار المطور (محلي)

نطاق: الإضافة الفردية للمنتجات/الخدمات. المجموعات `DEFERRED_BY_OWNER`. كتابة الشنط/الأحذية = E4. لا إنتاج/R2/جهاز.

## فصل المسؤوليات

| طبقة | ماذا تفعل | ملفات |
|---|---|---|
| عرض البوابة | تركيب المحرر، دوائر، تقويم، بطاقة معاينة أعلى الإتاحة | `partners-portal/web/js/e2b-service-shell.js`, `catalog-journey.js`, `e2b-product-editor.css` |
| قواعد عمل الإتاحة | تطبيع + رفض التداخل + سعات المورد | `mira-api/src/marketplace/commerce.types.ts` (`assertAvailabilityConsistent`) |
| مسودة→تحويل | نفس عقد الإتاحة عند materialize | `editor-drafts.service.ts` (`availabilityFromBulkSchedule`) |
| تعديل خدمة منشور/مسودة | `availabilityWrite` عبر البوابة | `partners-portal.service.ts` |
| تصنيفات عامة | إسقاط `definitionsVersion` + عقد الفلاتر | `taxonomy.service.ts`, `catalog-filters.ts` |
| شاشة التطبيق | دوائر Discover + كاش التعريفات عبر HTTP | `elegance_taxonomy_source.dart`, `discover_presentation_screen.dart` |

العرض لا يخترع موارد/أصفار. التحقق مشترك بين المسودة والتحويل وPATCH.

## مسار طلب خدمة (فردي)

1. واجهة الصالون تملأ basics + معاينة وسائط في العمود الجانبي أولًا (`sideOrder = main-media → availability`).
2. إتاحة مختصرة ظاهرة (تقويم شهري + ملخص فترات)؛ الأسبوعي ومعاينة 14 يومًا داخل `<details>` مطوي افتراضيًا مع الاستثناءات.
3. حفظ مسودة editor-v2 → `PUT editor-drafts` → **إعادة فتح المسودة والتحقق** → ثم `materialize` (عقد إتاحة صارم؛ بلا `room-fix-*`).
4. تعديل لاحق: زر الحفظ → `PATCH /partners-portal/services/:id` (نفس العقد؛ لا تعويض API من الاختبار).
5. وسائط → استئناف مراجعة / نشر مطوّر حسب الحساب.

قبول الهندسة: بطاقة معاينة حقيقية (`e2b-video-card` / `media-card-*`) مع `|previewTop − basicsTop|` ضمن حد صارم وفصل أفقي ≥120px.

## مسار طلب E3 (منتج أناقتك)

1. `POST /partners-portal/products` → `PATCH` → `POST …/media` → `submit-review`.
2. `POST /admin/catalog-reviews/product/:id/decision` approve.
3. ظهور في `GET /marketplace/catalog` ثم شاشة Discover عبر **browse HTTP الحي** (`MarketplaceRepositoryImpl` + `EleganceTaxonomySource.ensureLoaded`) — بلا `replaceForTest` وبلا JSON محقون في اختبار القبول.
4. bump `definitionsVersion` (اختبار: `TaxonomyService.bumpDefinitionsForTest`) → العميل يحدّث الكاش عبر `reloadIfStale`.
5. سكة التصنيفات تبقى ظاهرة حتى مع فراغ بصري مؤقت؛ الفلاتر غير المتوافقة تُستبعد.

## أوامر القبول المحلي

```bash
# E2ج
NODE_ENV=test MIRA_PARTNER_UPLOAD_SESSION=true MIRA_UPLOAD_PART_SIZE_BYTES=262144 \
  DATABASE_URL=postgresql://…@localhost:5432/mira_open_items_test \
  npx tsx src/marketplace/taxonomy/elegance-e2c-acceptance.browser.integration-tests.ts

# E3 (+ شاشة التطبيق عبر flutter test داخلي على HTTP الحي)
NODE_ENV=test DATABASE_URL=postgresql://…@localhost:5432/mira_open_items_test \
  npx tsx src/marketplace/taxonomy/elegance-e3-acceptance.http.integration-tests.ts
```

أدلة: `.e2c-acceptance-evidence/` · `.e3-acceptance-evidence/` (يشمل `media-store` لوسائط القبول المحلية).
