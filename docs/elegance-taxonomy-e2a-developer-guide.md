# دليل مطور — E2أ (R01–R04 / B01–B03 / ARCH 01–07)

تاريخ التحديث: 2026-11-08 · النطاق: بوابة الشركاء. خارج النطاق: E2ب/ج البصري، E3–E5، نشر إنتاج، تطبيق الجوال.

## معاني ARCH (ملزمة — لا تُعاد ترقيمها)

| الرمز | المتطلب |
|-------|---------|
| ARCH 01 | فصل المجالات ومسؤولياتها (منتجات/مخزون ≠ خدمات/مواعيد؛ وسائط وصلاحيات بحدودها) |
| ARCH 02 | منطق موحد للفردي والمجموعات |
| ARCH 03 | تعريفات مركزية للحقول والتصنيفات والقيم |
| ARCH 04 | ملفات محددة المسؤولية ومسار طلب واضح |
| ARCH 05 | مسار توسعة منظم يحافظ على التوافق |
| ARCH 06 | دليل المطور الجديد (هذا الملف) |
| ARCH 07 | إثبات التغييرات والحدود في التسليم |

## 1) خريطة الملفات (ARCH 04)

| جزء | مسار | مسؤولية |
|-----|------|---------|
| مكوّن خصائص | `partners-portal/web/js/registry-attribute-fields.js` | عرض، dirty، parked، invalid، مصدر إشعار `source` |
| فردي | `partners-portal/web/js/catalog-journey.js` | remount، `withProgrammaticPaint`، حفظ/نشر، materialize |
| مجموعات | `partners-portal/web/js/bulk-group-journey.js` | بطاقات مستقلة + استعادة وسيط/مخزون + حفظ بعد materialized |
| دفعات مجموعات (API) | `mira-api/.../bulk-batches.service.ts` | `get()` يدمج قيم المالك + ملخص `media` بعد materialize |
| API | `partners-portal/web/js/api.js` | `PartnersApi.base` / taxonomy / preview / updateProduct |
| Registry | `field-registry.v2.json` (ويب + API) | مصدر الحقول (`stockQty`, `inventoryMode`) |
| Taxonomy | `elegance-taxonomy.v1.json` | تصنيفات و`profileId` |
| اختبار مكوّن | `registry-attribute-fields.schema-tests.ts` | R01/R02/C* |
| اختبار API | `elegance-e2-portal.http.integration-tests.ts` | HTTP+preview |
| اختبار متصفح | `elegance-e2a-portal-browser.integration-tests.ts` | Chromium + dashboard |
| بوابة قبول E2أ | `elegance-e2a-acceptance.browser.integration-tests.ts` | معايير ACC-* الإلزامية على البوابة الفعلية |

## 2) مسار الطلب (واجهة → DB → عرض)

1. إدخال مستخدم → `notify({source:'user'})` → `bumpFormContentEpoch` / autosave.
2. حفظ مسودة الفردي → قيم مسطّحة من `getFlatValues()` (معرفات الحقول في الملف). **لا** تُرسل حقيبة `attributes` المتداخلة في `putEditorDraft` — تُرفض كـ `REGISTRY_UNKNOWN_FIELD`.
3. حفظ منتج منشور/مطور → `attributes` من `getAttributesPatch()` على مسار `createProduct`/`updateProduct` فقط.
4. API → حارس توكن → خدمة → `applyTaxonomyPatch` → DB.
5. رد مطابق → `setFromAttributes` / `applyServerSnapshot` داخل `withProgrammaticPaint` مع `source:'server'` — **لا** يرفع عداد المستخدم (R02).
6. قراءة البوابة: `productPreview` / `dashboard` — لا DB وحدها كإثبات استعادة.
7. مجموعات: `inventoryMode=untracked` ما لم يُدخل مخزون (وإلا `product` + `stockQty`) حتى لا يفشل materialize بـ `PUBLISH_REQUIRED` على `stockQty`.

## 2ب) مجموعات بعد `materialized` (B01–B03)

| بند | السلوك المعتمد |
|-----|----------------|
| B01 وسيط | `getBulkBatch` يعيد `card.media` + `partnerMediaPath`. المعاينة عبر `GET /partners-portal/media/:id` + Bearer → blob (أصلان مختلفان). ملف الاستبدال/`replaceIntent` لا يُمسحان عند حفظ الحقول. بعد نجاح البديل يُزال السابق. |
| B02 حفظ | بعد `materialized` → `updateProduct`/`updateService`. الحفظ منفصل عن الرفع. |
| B02.1 حقول | لا تُرسل `purchaseMode` إن لم تتغير؛ مسح الوصف يُرسل `''` صراحة. |
| B03 مخزون | `stockQty` موحّد؛ `0` ≠ فراغ ≠ `untracked`. |

اختبارات: `ACC-BULK-MEDIA-RESTORE` · `ACC-BULK-VIDEO-PREVIEW` · `ACC-BULK-VIDEO-REPLACE` · `ACC-BULK-PRESERVE-FIELDS` · `ACC-CREATE-LOSS-RECOVER` (زر واجهة فقط) · سلبيات `ACC-NEG-*`.

## 3) فرق تغيير المستخدم عن تطبيق الخادم (R02)

| الحدث | `source` | هل يرفع `formContentEpoch`؟ | autosave؟ |
|-------|----------|------------------------------|-----------|
| اختيار/رقم/مسح في المكوّن | `user` | نعم | نعم |
| `setFromAttributes` بعد حفظ مطابق | `server` | لا | لا |
| `applyServerSnapshot(onlyClean)` | `server` | لا | لا |
| تعبئة أولية / programmatic paint | عبر `withProgrammaticPaint` | لا | لا |

لا تُصفَّر dirty/revisions عامة لإخفاء المشكلة. تعديلات المستخدم أثناء الطلب تبقى محمية بـ `onlyClean` + مقارنة `editRevision`/`formContentEpoch`.

## 4) القيم المتوقفة والمدخلات غير الصالحة (R01 / C01)

- `parked` / `parkedCleared` / `parkedDirty` / `parkedInvalid` في `captureEditorState`.
- استعادة `parkedInvalid` **مستقلة** عن وجود قيمة صحيحة سابقة.
- المفاتيح تُحلّ عبر registry (معرف الحقل ↔ مفتاح التخزين).
- أثناء تصنيف لا يدعم الحقل: لا إرسال؛ عند الرجوع يظهر الخام + الخطأ و`hasBlockingErrors()` يمنع الحفظ.
- المسح الصريح يبقى مسحًا عبر `parkedCleared`.
- لا تسرّب بين البطاقات (`mountId` / عدم مشاركة preserveState).

## 5) المنطق المشترك فردي ↔ مجموعات (ARCH 02)

نفس `MiraRegistryAttributeFields.mount`، نفس `extractAttributesFromValues(vals, registry)`، نفس `PartnersApi.taxonomy`.

## 6) إضافة حقل دون قوائم موازية (ARCH 03 / C04)

1. عرّف في registry مع `storage: attributes.<key>`.
2. انسخ لنسخة الويب؛ اختبر التطابق.
3. أضفه للـ profile.
4. **لا** تضف اسمه لقائمة مسطّحة ثانية — `attrFieldIdsFromRegistry`.
5. `PROPOSED` يبقى مؤجلاً.

## 7) مسار توسعة متوافق (ARCH 05)

تصنيف جديد: taxonomy + profile + اختبارات. نوع خدمة: مسار خدمات منفصل — لا تخلط مع `attributesJson` للمنتج.

## 8) أوامر الاختبار (ARCH 07)

```bash
cd mira-api
npx tsx src/partners-portal/registry/registry-attribute-fields.schema-tests.ts   # مكوّن
DATABASE_URL=… MIRA_PARTNER_EDITOR_V2=true npx tsx src/marketplace/taxonomy/elegance-e2-portal.http.integration-tests.ts  # API
DATABASE_URL=… MIRA_PARTNER_EDITOR_V2=true npx tsx src/marketplace/taxonomy/elegance-e2a-portal-browser.integration-tests.ts  # متصفح استكشافي
DATABASE_URL=… MIRA_PARTNER_EDITOR_V2=true MIRA_PARTNER_UPLOAD_SESSION=true \
  MIRA_UPLOAD_ALLOW_DIRECT_PARTS=true \
  npx tsx src/marketplace/taxonomy/elegance-e2a-acceptance.browser.integration-tests.ts  # بوابة قبول ACC-*
DATABASE_URL=… npx tsx src/marketplace/taxonomy/elegance-e1-final-closure.http.integration-tests.ts  # عدم رجوع E1
```

Fixtures: فيديو `mira-api/src/partners-portal/upload-sessions/fixtures/valid-short.mp4`. نجاح البوابة = كل ACC-* = PASS مع أدلة في `.e2a-acceptance-evidence/`.

عند تعديل المكوّن/الرحلات: شغّل بوابة القبول على نفس code SHA. iPhone = E5.

## حدود منفَّذ / مؤجّل

منفَّذ في E2أ: R01–R04 + معايير ACC-* الإلزامية على البوابة. مؤجّل: E2ب/ج، E3، E4 كتابة شنط/أحذية، E5 جهاز.
