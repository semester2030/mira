# دليل المطوّر — كتالوج ميرا (تعريف ≠ عرض ≠ حجز)

## الطبقات الثلاث

| الطبقة | ماذا تحفظ | أين |
|---|---|---|
| **تعريف الدليل** | نوع المقدّم، اسم الخدمة، الحقول، العبارات، أيقونة/ورقة التصنيف | `mira-api/src/marketplace/taxonomy/catalog-guide.v1.json` عبر `GET /marketplace/catalog-guide` |
| **عرض المقدّم** | السعر، الوصف (بعد العبارة)، الوسائط، التوفر، `bookingEnabled` | جداول `Service` / `Product` + `CatalogMedia` |
| **لقطة الحجز** | ما أكدته العميلة وقت الطلب (اسم/سعر/مدة) | `CommerceBooking` — لا تعتمد على تعديل لاحق للعرض |

لا تنشئ شاشة أو جدولًا لكل خدمة من الـ٧٤. أضف صفًا في الدليل + قالب بوابة + ورقة taxonomy عند الحاجة.

## إضافة خدمة جديدة

1. أضف الخدمة في `catalog-guide.v1.json` (`id` مثل `S0xx`، `suggestedPhrasesAr`، `taxonomyLeafId` إن وُجد، `providerTypeIds`).
2. إن لزم اكتشاف جديد: أضف ورقة في `beauty-taxonomy.v1.json` (أو lane مناسب) مع `catalogGuideServiceId`.
3. إن لزم حقول خاصة: أضف قالبًا في `partners-portal/web/js/service-templates.js` مع `catalogGuideServiceId` و`suggestedPhrasesAr`.
4. شغّل `catalog-guide.schema-tests.ts`.
5. **إصدار تطبيق؟** تحديث بيانات الدليل/العبارات فقط → لا. حقول UI جديدة أو أيقونات أصلية في Flutter → نعم.

## «اسألي ميرا» على عرض منشور

- العميل يفتح التفاصيل → `AdvisorRouteArgs.marketplaceOfferId`.
- الجلسة تمرّر `marketplaceOfferId`؛ الخادم يحقن حقائق من العرض المنشور (الوصف/السعر/المدة).
- سؤال «وش تشمل الجلسة؟» يُجاب من وصف المقدّم فقط — بلا اختلاق.

## الرحلة الأولى (BC / S042 / S043)

- أنواع: `Partner.type` = `salon` أو `clinic`.
- أوراق: `beauty.face_care.cleanse` / `hydrate`.
- قوالب: `face_care_cleanse` / `face_care_hydrate`.
- محظور للتسجيل الجديد: `clinic_teeth`، `clinic_laser`.
