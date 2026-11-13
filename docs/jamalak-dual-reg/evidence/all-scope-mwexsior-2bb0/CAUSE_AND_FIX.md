# Discover «الكل» — السبب والإصلاح

## السبب المثبت

1. **Flutter:** عند مسار بشريط مُروَّج (مثل الأطفال)، شريحة «الكل» كانت `matchesAll` مع `storedKey: ''` و`parentId: null`. الضغط عليها يمسح `category` ويُرسل `lane=children` فقط.
2. **الخادم:** عضوية المسار موجودة لـ occasions/gifts فقط. `lane=children` بلا فئة كان يعيد **كل المنتجات المنشورة** (بما فيها طقم مكياج تحت `face`).
3. **الفيديو:** `DiscoverFeedController.load` كان يبقي العروض السابقة حتى تصل الاستجابة الجديدة، فيستمر تشغيل فيديو القسم السابق أثناء الانتقال.

تصنيف «طقم مكياج» في البوابة ليس أطفالًا (`category=face`)؛ التسريب كان من طلب بلا نطاق قسم + عدم عضوية المسار، وليس من اسم المنتج.

## الإصلاح

| الطبقة | التغيير |
|--------|---------|
| `elegance_taxonomy_source.dart` | شريحة «الكل» تحفظ `storedKey/parentId = section`؛ فروع الشريط تحتفظ بـ `parentId` |
| `discover_presentation_screen.dart` | «الكل» تبقي معرّف القسم وتمسح الفرع الأدق فقط؛ إيقاف الفيديو عند استبدال التغذية |
| `marketplace_repository_impl.dart` | لا يُسقط `categoryId` الحقيقي بسبب `matchesAll` |
| `discover_feed_controller.dart` | تفريغ العروض فور بدء `load` (منع استجابة متأخرة/فيديو قديم) |
| `catalog-filters.ts` | عضوية `children` / `jewelry` / `elegance`؛ مطابقة قسم↔ورقة عبر subcategory |

## جدول القبول (HTTP `all-scope-mwexsior-2bb0`)

| المسار المختار | طلب الخادم | معرّفات النتائج | معرّف الفيديو | الحالة |
|---|---|---|---|---|
| الأطفال (lane فقط) | `lane=children` | ملابس+أحذية فقط | أول عرض أطفال | PASS |
| الأطفال ← الكل | `lane=children&category=children` | ملابس+أحذية | ملابس | PASS |
| أحذية أطفال | `…&category=children&subcategory=children.shoes` | حذاء فقط | حذاء | PASS |
| ملابس (category=leaf) | `…&category=children.clothes` | ملابس فقط | ملابس | PASS |

طقم المكياج **لم يظهر** في أي صف.

## Flutter

`test/features/marketplace/children_all_scope_widget_test.dart` — PASS: الكل → `categoryId=children`؛ أحذية → `subcategory=children.shoes`؛ الكل مجددًا بلا مكياج.

## لا نشر إنتاج في هذه الجولة
