# مسار الحقول المشتركة (فردي / مجموعات)

| طبقة | موضع المنطق |
|---|---|
| تعريفات الحقول | `partners-portal/web/js/field-registry.v2.json` (+ نسخة API) |
| خيارات اللون/المقاس/الحجم | `catalog-options-core.js` ← `optionPresets(category, subcategory)` |
| واجهة الخيارات | `product-commerce-fields.js` (مجموعات) و`catalog-journey.js` (فردي عبر نفس الـcore) |
| خصائص السجل | `registry-attribute-fields.js` (mount واحد للفردي والمجموعات) |
| تحقق الخادم | `product-taxonomy.validate.ts` + `taxonomy-write.apply.ts` |

## إضافة حقل جديد
1. عرّفه في السجل (`storage: attributes.*` أو مجموعة options).
2. أضفه لملف التعريف/الملف الشخصي المناسب.
3. إن احتاج واجهة: وسّع `registry-attribute-fields.js` أو `optionPresets` — لا تنسخ قواعد داخل bulk فقط.
4. حدّث التحقق الخادمي إن لزم (`dependsOn` / `inputModes` / نوع القيمة).
5. مرّر `category` + `subcategory` عند `mount` من الفردي والمجموعات.
