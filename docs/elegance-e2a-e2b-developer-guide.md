# دليل المطوّر — E2أ + E2ب + E2ج + E3 (منتجات · خدمات · أناقتك)

> **نطاق المالك الحالي:** الفردي مُغلق محليًا؛ **E2ج محرر الخدمات** مُغلق محليًا؛ **E3 ربط أناقتك/الفلاتر** مُغلق محليًا. المجموعات `DEFERRED_BY_OWNER`. الشنط/الأحذية browse-only حتى E4.

## الملفات المسؤولة

| المسار | المسؤولية |
|--------|-----------|
| `partners-portal/web/js/catalog-journey.js` | محرر الفردي: صف اسم+سعر، لوحة ألوان، مقاسات، بطاقة فيديو، شريط أفعال موحّد |
| `partners-portal/web/js/catalog-options-core.js` | قاموس الألوان/المقاسات المركزي + `optionPresets` + `colorSwatchStyle` |
| `partners-portal/web/js/field-registry.v2.json` و `mira-api/.../field-registry.v2.json` | مصدر الألوان/الخامات المعتمد (يُحدَّثان معًا) |
| `partners-portal/web/js/bulk-group-journey.js` | رحلة المجموعة (مؤجّلة كشرط قبول؛ المسار يبقى حيًا) |
| `partners-portal/web/js/bulk-group-journey.harness.js` | Harness قبول فقط (`__MIRA_E2A_HARNESS__`) |
| `partners-portal/web/js/e2b-product-shell.js` | صدفة E2ب: دوائر التصنيف، فصل قائمة/محرر، compose |
| `partners-portal/web/js/e2b-service-shell.js` | صدفة E2ج: دوائر الخدمة، compose منفصل عن المنتجات |
| `partners-portal/web/js/service-templates.js` | قوالب عقود الخدمة (حقول حسب النوع) |
| `partners-portal/web/css/e2b-product-editor.css` | هوية الفردي + لوحة ألوان + بطاقة فيديو + وضع الخدمة |
| `partners-portal/web/assets/e2b-ref/` | أصول المرجع البصري المعتمدة |
| `partners-portal/web/js/registry-attribute-fields.js` | حقول السجل المركزي (خامة/قصة/طول…) |
| `partners-portal/web/js/product-commerce-fields.js` | خيارات وتركيبات مشتركة فردي↔مجموعة |
| `mira-api/.../elegance-fin-evaluators.ts` | مقيّمات FIN المشتركة (إيجابي + سلبي) |
| `mira-api/.../elegance-e2a-acceptance.browser.integration-tests.ts` | بوابة قبول E2أ ACC-* |
| `mira-api/.../elegance-e2b-acceptance.browser.integration-tests.ts` | بوابة قبول E2ب UX shell |
| `mira-api/.../elegance-e2c-acceptance.browser.integration-tests.ts` | بوابة قبول E2ج محرر الخدمة |
| `mira-api/.../elegance-e3-acceptance.http.integration-tests.ts` | بوابة قبول E3 taxonomy + فلاتر AND |
| `lib/features/marketplace/data/elegance_taxonomy_source.dart` | إسقاط دوائر أناقتك من `GET /marketplace/taxonomy?lane=elegance` |
| `lib/features/marketplace/data/discover_catalog_query.dart` | `forFamily('elegance')` ← مصدر موحّد؛ فلاتر discover |
| `lib/features/marketplace/presentation/screens/discover_presentation_screen.dart` | تحميل taxonomy؛ تنظيف فلاتر غير متوافقة عند تغيير التصنيف |

## رحلة الطلب (فردي)

واجهة → `PartnersApi` → `/api/v1/partners-portal/editor-drafts` / materialize → تحقق السجل والتصنيف → خدمة المجال → Prisma → إعادة قراءة المحرر.

### ترتيب الحقول والأفعال (I-01 / I-02)

1. **الترتيب المعتمد:** basics (اسم+سعر ثم وصف) → `options` (ألوان/مقاسات) → `attributes` (خامات) + `e2b-qty-host` → `options-preview` → بطاقة فيديو في عمود الوسائط → تفاصيل التركيبات/الشراء داخل `<details>`. لا تضع معاينة طويلة بين المقاسات والخامات.
2. **مصدر الخيارات:** `catalog-options-core.js` + `field-registry.v2.json` (ويب وAPI معًا) — لا قائمة ألوان يدوية موازية.
3. **إجراء نهائي واحد:** `applyFinalCtaPolicy()` / `resumeFinalLabel()` في `catalog-journey.js`. المطوّر غير المستأنف = «نشر الآن»؛ استئناف المطوّر = «استئناف النشر» أو «استكمال النشر» (ليس مراجعة)؛ العادي = «إرسال للمراجعة» / استئناف المراجعة. استخدم `is-cta-suppressed` + `display:none!important`.
4. **حالة الفيديو:** `lastKnownSavedMainVideo` + `syncVideoCardChrome(serverMedia|{mainRemoved})`. `syncMedia` يحدّث كروم الفيديو فقط لمدخل الفيديو الرئيسي — وسيط التفاصيل لا يمرّر `null` فيفرّغ البطاقة. نسب التقدم من نسبة `0..1` عبر `progressPercentLabel` (0.5→50%).

## رحلة المجموعة

`MiraBulkAdd.open` (= `MiraGroupJourney.open`) → بطاقة تلو الأخرى → `uploadViaSession` بعد إنشاء الجلسة → `putBulkCard` / materialize → ملخص → نشر مطوّر أو إرسال مراجعة.

## تشغيل القبول محليًا

```bash
export DATABASE_URL='postgresql://mira:mira_secret@127.0.0.1:5432/mira_db'
export MIRA_PARTNER_EDITOR_V2=true
cd mira-api
npx tsx src/marketplace/taxonomy/elegance-e2a-acceptance.browser.integration-tests.ts
npx tsx src/marketplace/taxonomy/elegance-e2b-acceptance.browser.integration-tests.ts
npx tsx src/marketplace/taxonomy/elegance-e2c-acceptance.browser.integration-tests.ts
npx tsx src/marketplace/taxonomy/elegance-e3-acceptance.http.integration-tests.ts
# من جذر التطبيق:
flutter test test/features/marketplace/elegance_taxonomy_source_test.dart
```

الأدلة: `../.e2a-acceptance-evidence/` و `../.e2b-acceptance-evidence/` و `../.e2c-acceptance-evidence/` و `../.e3-acceptance-evidence/` (نسبةً إلى `mira-wt`).

**حكم الفردي منفصل:** `results.json` في E2أ يصدر `individualVerdict` / `individualGate` من `INDIVIDUAL_MANDATORY` فقط. المجموعات `DEFERRED_BY_OWNER` عبر `bulkVerdict` ولا تغيّر إغلاق الفردي. E2ب يربط عبر `individualVerdict` وليس اشتراط `E2A_ACCEPTANCE_PASS` الكلي.

## إضافة نوع خدمة

1. أضف القالب في `partners-portal/web/js/service-templates.js` (`id`, `category`, `partnerTypes`, `fields`).
2. إن لزم تصنيف خدمة جديد: أضفه في `SALON_CATEGORIES` / `CLINIC_CATEGORIES` / `SERVICE_CATEGORIES` داخل `catalog-journey.js`، واربط الدائرة في `e2b-service-shell.js` عبر `ORB_BY_SERVICE_CAT` بأصل تحت `assets/e2b-ref/orbs/` — **لا تستخدم `accessories.png` للأظافر**.
3. الحقول الاختيارية في القالب تبقى اختيارية؛ لا تملأ صفرًا أو قيمة افتراضية عند الفراغ. **`durationMin` مطلوب عند التحويل** (عمود Prisma غير فارغ) — لا تخترع صفرًا؛ ارفض التحويل حتى يُدخل العارض مدة.
4. **مكان التقديم:** `placeMode` + `branchId` عبر الواجهة (شرائح) → قيم المسودة/`UpsertServiceDto` → `Service.placeMode`/`branchId`. الفروع من `dashboard.branches` (`PartnerBranch`). غياب الفروع يُوثَّق ولا يُعلن نجاح موقع شكلي.
5. **الإتاحة:** `buildEditorValues` يكتب `weeklyHours` + `dateExceptions` (سلاسل إغلاق **و** كائنات استثناء `special`/`closed`). `availabilityFromBulkSchedule` يعيد بناء `windows` + `closedDates` + `exceptions` — لا تُسقَط الاستثناءات. عند فتح المسودة/الخدمة: أولوية `availabilityJson` للخدمة المحفوظة ثم `seed.weeklyHours/dateExceptions` للمسودة قبل التحويل. يوم مغلق لا يعرض أوقاتًا أسبوعية. أخطاء التطبيع لا تُبتلع في `catch` عند التحويل.
6. **الموقع:** `placeMode` + `branchId` من عناصر النموذج مباشرة (`branchEl.value` — لا `hasOwnProperty(branchEl,'value')`). على الخادم: `placeFieldsFromBulkValues` يحترم `branchId: null` كمسح صريح ولا يستعيد فرعًا من `serviceProfile`. واجهة الموقع = سكة + اختيار فرع + لوحة خريطة (ليس نص إحداثيات وحده).
7. عزل الأوضاع: وضع محرر واحد نشط؛ `disableServiceMode` يخفي دوائر/compose الخدمة فعليًا (`hidden` + عدم الظهور). ظهور دوائر المحرر غير النشط يسقط `ACC-E2C-ISOLATION`.
8. لا تنسخ قواعد حفظ المنتجات/المخزون؛ أعد استخدام التحقق والمكوّنات المشتركة فقط.
9. أضف/حدّث ACC-E2C-* (EXCEPTIONS / CLOSED-NO-WEEKLY-SLOTS / ISOLATION / DESIGN-MATCH / PLACE). رفع الوسائط ونشر المطوّر عبر أزرار/حقول الواجهة فقط — بلا `addMedia`/`submitReview` تعويضي في الاختبار.

## مسار بيانات أناقتك (E3)

```
بوابة العارض (حفظ/نشر منتج) → Partners Portal / editor-drafts → Prisma Product
  → GET /api/v1/marketplace/taxonomy?lane=elegance  (تعريفات الدوائر + definitionsVersion)
  → GET /api/v1/marketplace/catalog?category=&subcategory=&variant.color=&variant.size=&facets=1
  → Flutter: EleganceTaxonomySource.ensureLoaded → DiscoverCatalogQueryEngine.forFamily('elegance')
  → discover_presentation_screen (سكة جذور → drill childrenOf → فلاتر)
```

- **مصدر موحّد:** عقد التصنيف في taxonomy doc/API؛ لا قوائم جذور متعارضة بين البوابة والتطبيق.
- **Drill:** الضغط على جذر له أبناء (مثل `clothes`) يستبدل السكة بـ `EleganceTaxonomySource.childrenOf` + زر «رجوع»؛ الاختيار الفرعي يرسل `category` + `subcategory`.
- **صور الدوائر:** `DiscoverCategoryAssets.thumbFor(id:)` — الشنط/الأحذية `product_bags.png` / `product_shoes.png` (تصفح فقط حتى E4).
- **فلاتر AND على نفس التركيبة:** `variant.color` + `variant.size` (+ إتاحة) تُقيَّم داخل التركيبة نفسها عبر `catalog-filters` / `matchedVariantIds` — لا جمع عبر تركيبات مختلفة.
- **تبديل التصنيف:** الواجهة تنظّف الألوان/المقاسات/الأحجام غير المتوافقة؛ عند `staleSelections` تُزال القيم تلقائيًا ويُعاد التحميل.
- **الكاش:** TTL 10 دقائق؛ `ensureLoaded(force: true)` / `reloadIfStale` عند تغيّر `definitionsVersion`.
- **المسودات/المسحوبة:** لا تظهر في browse العام (`contentStatus=published` + مراجعة معتمدة).
- **E4:** `bags` / `shoes` موجودة للتصفح (`writeEnabled=false`) — لا تفعّل مسار إنشاء لمجرد ظهور الأيقونة.

## ملاحظات E2ج بعد e750305a / 5d6a0e07

- لا تستدعِ `materialize(..., submitReview=true)` بلا وسائط قابلة للمراجعة؛ الرسالة عند الإنشاء فقط: «أضيفي وسائط ثم استئناف الإرسال».
- بعد رفع الوسائط: زر استئناف → `submitReview` / rematerialize → `reviewStatus=in_review` (ACC-E2C-PARTNER-RESUME-SUBMIT).
- `body.e2b-service-mode .e2c-inactive-editor` يخفي قسم المنتج؛ بعد تغيير التصنيف أعد `composeServiceLayout` (حارس `alreadyOrdered`).
- تقويم اليوم: `closed` لمورد يلغي `special` لنفس المورد — طابق `resolveDay` في الخادم.
- قبول المطوّر يشترط `mediaRestored` بعد إعادة الفتح دون إعادة اختيار الملف.
- رحلة فيديو المنتج fail→retry مثبتة في E2أ (FIN-02). رحلة فيديو **الخدمة** الكاملة في بوابة E2ج تُسجَّل `NOT_RUN` حتى يُعاد إثباتها بنفس نمط الجلسة.

## E3 — drill ومسح الفلاتر

- `_eleganceDrillParentId` حالة UI؛ صفّرها عبر `_clearEleganceDrill` عند «مسح كل الفلاتر» / «مسح البحث والفلاتر»، ووفّقها في `_reconcileEleganceDrill` من الاستعلام.
- عند تبديل التصنيف: لا تمسح كل الألوان/المقاسات مسبقًا؛ اعتمد `facets.staleSelections` + إعادة تحميل.
- `reloadIfStale()` بعد التحميل الأول؛ harness الاختبار يقفل الشبكة عبر `replaceForTest`.
- إثبات الشاشة: `test/features/marketplace/elegance_discover_drill_widget_test.dart`.

### إضافة تصنيف أو حقل أناقة

1. أضف العقدة في مصدر التصنيف المعتمد (taxonomy) بنفس `id` العام؛ حدّث البوابة إن لزم عبر السجل/`profileId`.
2. التطبيق يقرأ من `EleganceTaxonomySource` — لا تُضِف قائمة جذور يدوية موازية في الشاشة.
3. إن كان الحقل فلترًا (لون/مقاس/حجم): خزّنه في `variantsJson.selections` واعتمد مفاتيح الاستعلام `variant.*`.
4. أضف/حدّث ACC-E3-* (جذور، browse-only، AND إيجابي/سلبي، مسودة، تبديل تصنيف) واختبار Dart للإسقاط.
5. أقسام الشنط/الأحذية تبقى مؤجلة E4 للكتابة.

## إضافة حقل أو تصنيف (منتجات — عام)

1. عرّف الحقل/العقدة في سجل التصنيف المعتمد (مصدر مركزي واحد).
2. اربط `profileId` بالعقدة؛ لا تنشئ قائمة حقول موازية في الفردي والمجموعة.
3. أضف قبولًا ACC يغطي الحفظ وإعادة الفتح والمسح الصريح إن لزم.
4. أقسام الشنط/الأحذية تبقى مؤجلة E4 — لا تُفعَّل كمسار إنشاء مكتمل هنا.

## إضافة لون أو خامة (فردي)

1. أضف المعرّف والعنوان وhex في `field-registry.v2.json` (نسختا الويب والـ API معًا) ضمن `fields.colors` / `colors[]` أو `fields.material`.
2. حدّث `COLOR_CANONICAL` و`COLOR_SWATCH_HEX` و`APPROVED_COLOR_PRESETS` في `catalog-options-core.js` إن كان لونًا.
3. لا تُظهر في الواجهة لونًا يرفضه الخادم؛ لا تُغيّر قيم المنتجات القديمة بصمت.
4. الخامات تُعرض عبر `MiraRegistryAttributeFields` من السجل — لا تنسخ قائمة خامات داخل `paintOptions`.

## الصلاحيات

- المطوّر: نشر مباشر بعد التحقق والوسائط؛ بلا موافقة بشرية إضافية.
- الحساب العادي (علامة): إرسال للمراجعة؛ لا أدوات مطوّر خام في صدفة E2ب.
- ملكية الوسائط وACL تبقى ملزمة لكلا الحسابين.


## إغلاق ملاحظات المراجعة المستقلة (J-*)

| ملاحظة | الإصلاح | دليل القبول |
|--------|---------|-------------|
| J-A01 | رحلتا رفع بلا/مع وسيط جاهز؛ استئناف نفس sessionId؛ عزل معاينة+ملف محلي؛ مسح تركيبات مع إعادة فتح | ACC-BULK-UPLOAD-SESSION-SWITCH / PREVIEW-ISOLATION / VARIANTS-CLEAR |
| J-A02 | تخريب فقد الملف داخل ensureVideoReady؛ hooks خلف `__MIRA_E2A_HARNESS__` فقط | ACC-NEG-REPLACE-PENDING + ACC-E2B-HOOKS-ISOLATED |
| J-B01 | صدفة E2ب: قائمة مخفية، شعار/دوائر بأصول منفصلة، لؤلؤي/ليليكي/وردي | ACC-E2B-EDITOR-ENTRY / VISUAL / LAYOUTS |
| J-B02 | دوائر من taxonomy المركزي + selectSeq؛ لا MAIN موازية | ACC-E2B-TAXONOMY-SOURCE / CATEGORY-RACE |
| J-B03 | بوابة E2ب ترفض الأدلة الناقصة وتربط رحلات E2أ | ACC-E2B-GATE-REJECTS-BAD / JOURNEY-LINK-E2A |

### مثال إضافة تصنيف/أصل
1. أضف العقدة في مصدر التصنيف المعتمد.
2. ضع صورة الدائرة في `partners-portal/web/assets/e2b-ref/orbs/<id>.png` وربطها عبر `ORB_BY_ID`.
3. لا تنسخ قائمة MAIN ثابتة.
4. أضف ACC يغطي الظهور والترتيب والاستعادة.


## أصول الدوائر

اربط كل نوع فرعي عبر `SUB_ORB_BY_ID[id]` في `e2b-product-shell.js` — لا تستخدم `idx % N`. ضع الملف في `assets/e2b-ref/orbs/<id>.png` وافحص المحتوى بصريًا.



## تخطيط المحرر المعتمد (محدّث)

- `composeCatalogLayout()` يرتّب بالأدوار `data-section-role` لا بالنص العربي: الحقول (basics/options/attributes/commerce) بجانب `main-media`، ثم details → detail-media → variant-media → preview-publish → CTAs.
- التركيب Idempotent: يعيد استخدام مضيف compose؛ يفصل MutationObserver أثناء النقل لمنع الحلقة.
- `syncFromForm` + `reloadTaxonomy({force})` بعد طلاء التصنيفات؛ اختبار السباق يحجز طلب `/taxonomy` الحقيقي.
- ملخص المعاينة والنشر منفصل عن مسرح الفيديو.
- إعادة نقر الرئيسي نفسه تحافظ على الفرعي (`sameMain` / `preserveSub`).
- الإعدادات → `#partnerSettingsSection`؛ منتجاتي → `showList`؛ إعلانات منفصلة.
- Harness فقد الملف في `bulk-group-journey.harness.js` فقط — لا يُحمَّل من `dashboard.html`.


## حفظ طبيعي واختبار التركيبات

- اختبارات القبول الإيجابية لا تفرض `disabled=false` / إزالة `aria-busy`؛ تنتظر جاهزية الزر ثم تنقر.
- مسح التركيبات عبر `data-testid="commerce-clear-variants"` في المكوّن المشترك `product-commerce-fields.js` (فردي ومجموعات).
- بحث القائمة نطاقه صريح: العناصر المحمّلة من لوحة التحكم (`data-search-scope=loaded-dom`)، مع `data-id` على كل صف.
- بصمة المحتوى المشتركة تشمل `product-commerce-fields.js` و`dashboard.html` والأصول؛ غياب البصمة يفشل الربط E2أ↔E2ب.
