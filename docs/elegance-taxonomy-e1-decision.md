# قرار المرحلة E1 — أساس تصنيفات أناقتك

**القرار:** `E1_IMPLEMENTED_VERIFIED`

لا يعني إغلاق E2–E5 ولا جاهزية الإطلاق العام ولا ترحيل قاعدة الإنتاج.

## حالات القبول

| ID | الحالة | دليل |
|----|--------|------|
| E1-01 | IMPLEMENTED_VERIFIED | `taxonomy.load.schema-tests.ts` |
| E1-02 | IMPLEMENTED_VERIFIED | HTTP `GET /marketplace/taxonomy` في `elegance-e1.http.integration-tests.ts` |
| E1-03 | IMPLEMENTED_VERIFIED | حفظ subcategory + قراءة DB/API |
| E1-04 | IMPLEMENTED_VERIFIED | رفض browseOnly / تعارض / writeDisabled |
| E1-05 | IMPLEMENTED_VERIFIED | attributes مصفوفة، dimensionsCm null/سالب |
| E1-06 | IMPLEMENTED_VERIFIED | مسودة تحتفظ بالسعر الحقيقي |
| E1-07 | IMPLEMENTED_VERIFIED | تعديل الاسم لا يمسح options/variants/stock |
| E1-08 | IMPLEMENTED_VERIFIED | legacy subcategory=null + omit يحافظ |
| E1-09 | IMPLEMENTED_VERIFIED | عزل الشريك 404 |
| E1-10 | IMPLEMENTED_VERIFIED | أعمدة migration موجودة؛ تراجع موثّق في العقد |
| E1-11 | IMPLEMENTED_VERIFIED | فلتر subcategory قبل pagination |
| E1-12 | IMPLEMENTED_VERIFIED | انحدار catalog-filters + smoke E1 |

## ما انتقل إلى E2

انظر `docs/elegance-taxonomy-e2-acceptance.md` — material[] / carryStyle round-trip في البوابة.

## المرجع

- دراسة التصميم: RC2-CLOSE-FIX2  
- أصل الفرع: `60d9134294f6db96bc0c55685066dc49301833ae` (`origin/main` عند بدء E1)
