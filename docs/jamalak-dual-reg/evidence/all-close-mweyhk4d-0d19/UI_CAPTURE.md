# UI capture (Flutter widget + connected HTTP)

**runId:** `all-close-mweyhk4d-0d19`  
**النطاق:** محلي — محاكي/widget كافٍ — لا نشر إنتاج

## تسجيل الواجهة (خطوات مضغوطة من الاختبار الآلي)

1. **أطفال ← الكل**  
   - دائرة مضيئة: `all`  
   - طلب: `lane=children&category=children`  
   - نتائج: ملابس + أحذية  
   - مشغّل: `debugPlayingOfferId` ∈ {ملابس، أحذية} — ليس طقم مكياج  

2. **أحذية أطفال**  
   - دائرة مضيئة بعد التحميل: `children.shoes`  
   - مشغّل: `p-kids-shoes` / معرف الحذاء المزروع  

3. **الكل** مجددًا  
   - دائرة: `all`  
   - تعود الملابس والأحذية  

4. **جمالك → في موقعك → صالونات → مكياج → الكل**  
   - `placeModes` يبقى يتضمن `home` في الطلب  

مصدر التشغيل:  
`flutter test test/features/marketplace/children_all_scope_widget_test.dart`  
`npx tsx …/discover-all-scope-closure.http.integration-tests.ts`

لا يُستخدم `5992659` لإثبات هذه الجولة.
