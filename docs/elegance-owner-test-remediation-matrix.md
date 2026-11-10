# جدول معالجة ملاحظات الاختبار — أناقتك

التاريخ: 2026-11-10T18:05:00Z  
الأساس: حزمة `mira-elegance-taxonomy-orbs-20261110T172902Z-2f4e939` + إصلاحات لاحقة

| الملاحظة | السبب | الإصلاح | الاختبار والدليل | الحالة |
|---|---|---|---|---|
| `optionPresets('bags'/'shoes')` فارغة و`categoryFromProfileId`→clothes | مطابقة الملف كانت تستثني bags/shoes أو تُسقِطها إلى clothes | إصلاح المصدر في `catalog-options-core.js` + presets مركزية حسب الرئيسي/الفرعي | `catalog-options-bags-shoes-customs.tests.mjs` | منفّذ |
| دمج قيمتين يدويتين بسبب `،` vs `,` | الاستعادة تفصل عربيًا والحفظ إنجليزيًا فقط | `splitCustomLabels` / `joinCustomLabels` + `customsList` مع معرّفات مستقرة | نفس الاختبار: حفظ→استعادة→حفظ بلا تغيّر | منفّذ |
| ازدواج «قيم خاصة» / جاهز-يدوي | مسار الفردي قديم بجانب المكوّن المشترك | توحيد «اختيار جاهز / كتابة يدوية» في الفردي والمجموعات | `input-mode-*` + commerce fields | منفّذ |
| ازدواج التصميم (إخفاء legacy فقط) | CTA قديم ما زال يستقبل أحداثًا | تعطيل legacy كاملًا + خطوات جوال قصيرة تحفظ الحالة | `e2b-product-shell.js` / `e2b-service-shell.js` + CSS | منفّذ |
| `dependsOn` في JSON فقط | لا تحقق خادمي ولا تقليم عند تغيير التصنيف | واجهة + `pruneAttributesByDependsOn` في taxonomy-write | prune heelHeight على shoes.flat | منفّذ |
| `shoeUsage` غير مربوط بالفلاتر | الواجهة/الاستعلام لم يمرّرا السمة | facet + query + Discover chips + stale drop | كود Discover + catalog-filters | منفّذ — بانتظار جهاز |
| نشر + Release على الجوال | يحتاج دفع/نشر Render + تثبيت بعد فتح الجهاز | push `4721da1` → mira-api + partners-portal live؛ `flutter run --release` على iPhone | Render dep live + log تثبيت الجهاز | منفّذ |
| صور 56 فرع + الكل + رجوع | — | محفوظة من الحزمة السابقة دون إعادة توليد | ACC-ELEGANCE-ORB-ASSETS | محفوظ |
