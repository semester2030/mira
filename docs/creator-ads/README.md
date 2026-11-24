# دراسة منظومة المشاهير والإعلانات القابلة للشراء والحجز

**تاريخ الدراسة:** 2026-11-24  
**نطاق الفحص الأصلي:** `origin/main` @ `fb56c83`.  
**تنفيذ v1:** فرع `mira/creator-ads-v1` — انظر [07-path-map.md](./07-path-map.md).

## الفهرس

| الملف | المحتوى |
|---|---|
| [01-current-state.md](./01-current-state.md) | الوضع الحالي، مصفوفة القدرات، الأدلة، ما شُغّل وما تعذّر |
| [02-journeys-break-points.md](./02-journeys-break-points.md) | مسارا شراء الكريم وحجز الخدمة ونقاط انقطاع الدليل |
| [03-media-matrix.md](./03-media-matrix.md) | مسار الوسائط وحدودها وحكم حالتي ٣ فيديوهات / فيديو+١٠ صور |
| [04-attribution-rules.md](./04-attribution-rules.md) | **مرجع واحد** لقواعد إسناد البيع والحجز والمؤشرات (مقترح vs موجود) |
| [05-architecture-contracts.md](./05-architecture-contracts.md) | حدود الباك/الفرونت، العقود، خريطة الأسطح، «أين أغيّر ماذا؟» |
| [06-implementation-plan.md](./06-implementation-plan.md) | مراحل التنفيذ والاختبار والقبول التدريجي |
| [07-path-map.md](./07-path-map.md) | **خريطة المسارات الفعلية بعد v1** (باك/بوابة/Flutter) |
| [evidence/](./evidence/) | سجلات تشغيل الاختبارات المعزولة ونطاق SHA |

## حكم سريع

### قبل v1 (الدراسة)

- `CatalogAd` يربط هدفًا بلا نسخ سعر؛ مراجعة؛ `link_open`؛ وسائط الإعلان كانت وسائط الهدف.

### ما أضافته v1 (فرع `mira/creator-ads-v1`)

- ملف مشهور `CreatorProfile` + دليل عام صفحي + بوابة «حساب المشهور».
- **وسائط يملكها الإعلان** (`ownerKind=ad`) مع سقوف ٣ فيديو / ١٠ صور؛ الإعلانات القديمة تسقط لوسائط الهدف إن لم توجد وسائط إعلان.
- دائرة «المشاهير» فوق «اكتشفي عالم ميرا» + شاشات دليل/ملف/مشغّل في Flutter.
- اختبار HTTP معزول: ٣ فيديوهات + فيديو/١٠ صور + ٧ ملفات في الدليل + عزل ملكية — **PASS**.
- **ما زال للمرحلة التالية:** إسناد بند الطلب/الحجز لـ `adId` وتقارير الطرفين.

التفاصيل: [07-path-map.md](./07-path-map.md) · [evidence/DELIVERY.txt](./evidence/DELIVERY.txt) · [evidence/FAYEZ_REPEAT.md](./evidence/FAYEZ_REPEAT.md).  
لا تُنسخ قواعد الإسناد خارج [04-attribution-rules.md](./04-attribution-rules.md).
