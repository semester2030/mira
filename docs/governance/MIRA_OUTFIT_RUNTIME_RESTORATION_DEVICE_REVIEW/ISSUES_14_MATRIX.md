# مصفوفة 14 — بعد إصلاحات Runtime Restoration

أسطورة: **CODE_FIXED** / **DEVICE_PASS** / **DEVICE_NOT_PROVEN** / **OPEN_BLOCKER** / **N/A**

قاعدة: نجاح الوحدة ≠ قبول الجهاز. التثبيت `1.0.0+2026092201` مثبت؛ فيديو E2E غير متاح.

مرجع التسجيل التاريخي: `ScreenRecording_09-21-2026 23-58-09_1.mp4` — **ما زال غائباً**. محاولة التثبيت الحالية = `NEW_ATTEMPT` منفصلة.

| # | المشكلة | الحكم | الدليل |
|---|---------|-------|--------|
| 1 | انحراف حدود الملابس | **CODE_FIXED** partial / **DEVICE_NOT_PROVEN** | `supportsFabricRecolor` يرفض `pose_anatomy`؛ رسالة قدرة واضحة؛ لا تلوين قماش على bands. إثبات جهاز تفاعلي ناقص. FASHN: health يظهر `providerExecution=false` / `fashnChanges=false` → **OPEN_BLOCKER** محتمل للتحديد الدقيق. |
| 2 | فستان → قطعتين | **CODE_FIXED** / **DEVICE_NOT_PROVEN** | `OutfitTopologyInfer`: dressLike يبقى `one_piece` رغم upper/lower تشريحي؛ اختبارات وحدة PASS. |
| 3 | تضارب اللون الحالي/المستخرج | **CODE_FIXED** / **DEVICE_NOT_PROVEN** | كل مسارات العرض عبر `FashionColorBinding` HEX-first؛ `toDisplayColor` → null للمجهول. |
| 4 | عينات رمادية كاذبة | **CODE_FIXED** / **DEVICE_NOT_PROVEN** | `#9E9E9E` بدون اسم رمادي → null؛ الرمادي الحقيقي يبقى. |
| 5 | مقارنة حالي vs مقترح | **CODE_FIXED** / **DEVICE_NOT_PROVEN** | فصل current/alternative في `OutfitColorPreviewService`؛ عناوين «الحالي/المقترح». |
| 6 | فشل التلوين | **CODE_FIXED** gate / **OPEN_BLOCKER** مزود | بوابة قناع موثوق؛ HEX موثوق للهدف. Health: `fashnChanges=false` + `providerExecution=false` → إكمال التلوين السحابي قد يبقى معطلاً من الخادم. لا HTTP session مربوط. |
| 7 | غياب صور التوصيات | **CODE_FIXED** honesty / **DEVICE_NOT_PROVEN** | فلترة بطاقات بلا `imageAsset`؛ نص «لا تتوفر صورة للكتالوج» بدل إعلان اكتمال. |
| 8 | تعطّل المستشار | **CODE_FIXED** honesty / **OPEN_BLOCKER** entitlement | بناء الجهاز بـ `MIRA_FASHION_ADVISOR_V1=true`؛ UI يصرّح إن ModeB OFF. `fashionAdvisorModeB` صلاحية جلسة — غير مؤكدة من /health العام. |
| 9 | غموض النسب 0.82/98 | **CODE_FIXED** / **DEVICE_NOT_PROVEN** | إزالة floors/boosts وclamp 55–98؛ فصل درجة الإطلالة عن ثقة التحليل في البطل. `minPieceConfidence=0.82` يبقى عتبة تحقق قطع لا رقم عرض. |
| 10 | ربط البشرة | **DEVICE_NOT_PROVEN** | لم يُكسر مسار `OutfitSkinHarmonyLink`؛ لا إثبات جلسة جديدة. |
| 11 | تداخل بطاقة الدرجة | **CODE_FIXED** / **DEVICE_NOT_PROVEN** | إزالة `BeautyScoreRing` من البطل → رقم نصي مضغوط. |
| 12 | تفاصيل التنفيذ في الواجهة | **CODE_FIXED** partial / **DEVICE_NOT_PROVEN** | رسائل القدرة للعامة؛ تفاصيل المزود تبقى في التشخيص/سجلات. |
| 13 | بدء الاستشارة بسياق إطلالة | **CODE_FIXED** wiring / **DEVICE_NOT_PROVEN** | `AskOutfitMiraSection` يمرّر `outfitAnalysis`؛ قرار المسار يحترم السياق. تفعيل كامل يحتاج ModeB. |
| 14 | ضعف القراءة/التباين | **CODE_FIXED** partial / **DEVICE_NOT_PROVEN** | محاذاة Wave2 (إزالة الحلقة المتداخلة، صدق التوصيات). لا لقطة تباين جهاز. |

## عوائق مفتوحة صريحة
1. ملف التسجيل المرفق غير موجود على القرص → لا ربط session/request للتسجيل القديم.
2. لا فيديو NEW_ATTEMPT تفاعلي (analyze→recolor→advisor) — التثبيت فقط مثبت.
3. خادم: `intelligence.fashionIntelligence.providerExecution=false` و `fashnChanges=false`.
4. صلاحية runtime `fashionAdvisorModeB` غير ظاهرة في health العام (تتطلب جلسة مصادقة).
5. تحذير integrity: `OUTFIT_PROVIDER_LEGACY_MOCK`.
