# تدقيق قوالب التفاصيل — إعلانات قديمة

## معرّفات الإنتاج (قبل أي إعادة نشر)

| مثال | id | إشارات التصنيف على browse | على detail قبل الإصلاح |
|---|---|---|---|
| فستان زواج | `14260bc3-7960-493f-86ad-2422d96bfa47` | category=clothes · profileId=null | category فقط — **بدون** subcategory/profileId |
| خاتم | `a06ff375-cbf8-4a5e-bef3-66bbebd98d31` | category=jewelry · subcategory=jewelry.rings · profileId=product.jewelry | category فقط — taxonomy ساقطة |
| خدمة مركز | `37d28c28-be68-40da-9bac-6ab1fb27e103` | صالون روز · bookingEnabled=false | وصف/وسائط فارغة · لا حجز |

## سبب الفرق قبل الإصلاح
1. **قالب غير مطبّق للمنتجات:** شاشة واحدة عامة؛ لا عائلة أزياء/مجوهرات.
2. **فجوة API:** `getPublishedItem` للمنتجات أسقط `subcategory` / `profileId` / `attributesJson` رغم وجودها في browse.
3. **بيانات لم يدخلها المقدّم:** الخاتم بلا وزن ذهب/شهادة في attributes — يجب إظهار «غير مرفقة» / «لم يُدخل المواصفات» لا اختراع قيم.

## الإصلاح
- API يعيد حقول التصنيف والسمات كما هي.
- `CatalogDetailFamilyResolver` يختار fashion/jewelry/generic من category/profileId/subcategory (الإعلان القديم يكفي).
- `ProductDetailScreen` يعرض عائلة القالب + اسألي ميرا + شريط سعر؛ للمجوهرات شهادة صادقة.
- خدمة: أقسام المعرض / عن المركز؛ الحجز فقط إن `bookingEnabled`.

بناء الآيفون المستهدف: `1.0.0+202611191930`
