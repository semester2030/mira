# 01 — الوضع الحالي وأدلته

## 1. نطاق الفحص

| بند | قيمة |
|---|---|
| فرع العمل المفحوص | `mira/p5-strict-frontend-recovery-2026-09-14` |
| SHA العمل | `09ef97aaf2640e7cb1bf46c38add8b6ab7fd533c` |
| `origin/main` للمطابقة | `fb56c83701d17ea64d9e13529a16d6a637b8df89` |
| مشاريع داخل المستودع | تطبيق Flutter (`lib/`)، `mira-api` (NestJS + Prisma)، `partners-portal`، `admin-portal`، `website`/`web` |
| بحث عربي/إنجليزي | مشهور، مشاهير، إعلان، CatalogAd، creator، influencer، affiliate، attribution، adId، referral |
| وثائق سابقة (بداية تحقق فقط) | `docs/mira-commerce-reference/` — **قديمة جزئيًا** (تقول GAP-0006 لا كيان إعلان بينما `CatalogAd` موجود الآن) |

**محفوظات الفريق:** لم تُمس ملفات التطبيق أو البيانات؛ لم تُنفَّذ migrations ولا نشر ولا شراء/حجز حقيقي.

## 2. المشاريع والتقنيات

| سطح | المسار | التقنية |
|---|---|---|
| تطبيق العميلة | `lib/` | Flutter |
| API | `mira-api/` | NestJS، Prisma، Postgres، تخزين وسائط S3-compatible |
| بوابة الشريك | `partners-portal/web/` | HTML/JS ثابتة تتحدث مع API |
| لوحة الإدارة | `admin-portal/web/` | HTML/JS + مفتاح إدارة |
| موقع تعريفي | `website/` / `web/` | ثابت |

أنواع الشريك في المخطط: `brand | clinic | salon` (`mira-api/prisma/schema.prisma` حوالي L149–152). يظهر أيضًا `developer` في منطق النشر السريع. **لا يوجد نوع حساب `celebrity` منفصل**؛ المعلن اليوم هو `Partner` ينشئ `CatalogAd`.

## 3. ما شُغّل محليًا

| الأمر | النتيجة | الدليل |
|---|---|---|
| `flutter test test/features/marketplace/discover_ad_feed_test.dart test/features/marketplace/discover_ad_rc7_test.dart` | **8/8 نجحت** | `evidence/flutter-discover-ad-tests.txt` |
| `npx tsx src/marketplace/catalog-video-duration.schema-tests.ts` | **ok** | `evidence/video-duration-schema-tests.txt` |
| اختبارات HTTP لـ `catalog-ad.ph4*.ts` | **لم تُشغَّل** | تحتاج Postgres + خادم API محلي — موثّق كتعذّر بيئة |

## 4. مصفوفة القدرات

حالات: **E2E** = مثبت طرفًا لطرف بالاختبار/الكود التشغيلي · **كود** = موجود بالكود ولم يُثبت تشغيل إنتاج · **جزئي** · **غائب** (بعد البحث في النطاق) · **غير متحقق**.

| القدرة | ما تراه المستخدمة/الشريك | المسار UI → API → منطق → بيانات/حدث → تقرير | الدليل | الحالة | الناقص | إعادة الاستخدام |
|---|---|---|---|---|---|---|
| ربط إعلان بهدف أصلي (منتج/خدمة) دون نسخ سعر | بوابة شريك: إنشاء مسودة `targetKind`+`targetId`+نص | `ads.js` → `POST /partners-portal/ads` → `CatalogAdService.create` → جدول `catalog_ads` → لا تقرير مبيعات | `catalog-ad.service.ts` L25–42؛ `schema.prisma` `CatalogAd`؛ رفض `priceHalalas` L393–395 | **كود** (+ اختبارات HTTP معزولة موجودة) | لا دور «مشهور» صريح؛ تفويض ناشر آخر مرفوض (`publisherFor` L397–403) | عالٍ — أساس الربط |
| مراجعة/اعتماد/رفض/سحب | إدارة: «مراجعة الإعلانات»؛ شريك: إرسال/سحب | admin `POST /admin/catalog-ads/:id/decision`؛ شريك submit/withdraw | `catalog-ad.controller.ts`؛ `admin-portal` `adReviews` | **كود** | لا إثبات تشغيل إنتاج في هذه الدراسة | عالٍ |
| نشر في Discover كشريحة إعلان | العميلة ترى إعلانًا مع إفصاح | `publishedAds()` → `GET /marketplace/ads` → دمج في `DiscoverFeedController` | `marketplace_repository_impl.dart`؛ `discover_published_ad.dart`؛ اختبارات `discover_ad_*` | **جزئي/كود** (مثبت في اختبارات الوحدة؛ غير متحقق إنتاج) | وسائط الإعلان = وسائط الأصل | عالٍ لمشغّل Discover |
| فتح رابط خارجي من الإعلان | زر يصبح «افتحي الرابط» | Discover `_buy` إن وُجد `advertisement` → `_openAdLink` → `POST .../link-open` | `discover_presentation_screen.dart` L1147–1162، L1101–1144؛ `CatalogAdAction` | **جزئي** | ليس شراءً؛ لا COD | متوسط — outbox الروابط |
| شراء COD منسوب للإعلان | — | — | لا `adId` في `CommerceCartItem`/`CommerceOrderItem`؛ `_buy` يتجاهل السلة عند وجود إعلان | **غائب** | إسناد بند + مسار شراء داخلي من الإعلان | سلة COD القائمة للمنتجات المباشرة قابلة لإعادة الاستخدام **بعد** ربط `adId` |
| حجز خدمة منسوب للإعلان | — | `appointmentOperational: false` دائمًا في `publicBody` | `catalog-ad.service.ts` L262–268 | **غائب** | تفعيل حجز تشغيلي + `adId` على الحجز | حجز COD/venue القائم قابل لإعادة الاستخدام |
| وسائط خاصة بالإعلان (٣ فيديو / فيديو+صور) | — | `publishedMedia(targetKind, targetId)` فقط | `catalog-ad.service.ts` L385–391؛ لا مسارات `/ads/:id/media` | **غائب** | `ownerKind=ad` + محرر + سياسة | محرر منتج/خدمة + `CatalogMedia` + S3 |
| صفحة مشهور عامة بكل إعلاناته قابلة للمشاركة | — | بحث `creator`/`مشهور` profile في `lib/` بلا صفحة | بحث مسارات 2026-11-24 | **غائب** | صفحة عامة + روابط | Partner detail / Discover chrome |
| مساحة مشهور لإدارة النتائج | بوابة: قائمة إعلانات + `linkOpens` فقط | `GET .../ads/:id/stats` → عدّ `link_open`؛ المشاهدات معطّلة | `stats` L130–133؛ `ads.js` L24 | **جزئي** | تقارير مشترين/قطع/قيمة/حجوزات | نمط تقارير الشريك للطلبات إن وُجد |
| موافقة التاجر على إعلان الغير | — | أي معلن يربط بهدف منشور مؤهل | `assertTargetLinkable` | **غائب** كسياسة منتج | قرار مالك (DEC) + نموذج إذن | مراجعة الإدارة الحالية جزئيًا |
| عدّ مشاهدات مؤهلة | — | `recordView` يرمي 503 | L298–305 | **غائب** تشغيليًا | اعتماد قواعد العد | سياسة `catalog-view.policy` |
| عزل بيانات الشركاء | شريك يرى إعلاناته؛ إدارة ترى المراجعة | حراس PartnerToken / AdminApiKey | controllers | **كود** | اختبار اختراق شريك↔شريك غير مشغّل هنا | قائم |
| متجر vs مقدّم خدمة | عميلة: أزرار من نوع الإعلان | `PartnerCatalogSurface` على `main` (PR #25) | `origin/main` / عمل سابق | **مثبت على main** (خارج SHA فرع الفحص جزئيًا) | — | إلزامي لرحلات المنتج/الخدمة |

### أين بُحث قبل الحكم بالغياب

- `mira-api/prisma/schema.prisma`، `mira-api/src/marketplace/catalog-ad*`، `commerce*`
- `lib/features/marketplace/**` (Discover، ads، cart)
- `partners-portal/web/js/ads.js`، `catalog-journey.js`
- `admin-portal/web/js/api.js`، `app.js`
- `docs/mira-commerce-reference/**` (مرجعية تاريخية فقط)
- لا مستودع خارجي إضافي مطلوب؛ كل الأسطح داخل هذا المستودع.

## 5. فصل النتائج عن التوصيات

**مثبت في الكود/الاختبار:** كيان الإعلان، ربط بالهدف، مراجعة، رفض نسخ السعر، بث عام، فتح رابط + outbox، دمج Discover، اختبارات وحدة الإعلان.

**توصية (ليست واقعًا اليوم):** وسائط إعلان مستقلة، إسناد بنود البيع/الحجز، صفحة مشهور، تقارير مشتركة المصدر، موافقة مالك العرض، شراء/حجز داخلي من شريحة الإعلان.
