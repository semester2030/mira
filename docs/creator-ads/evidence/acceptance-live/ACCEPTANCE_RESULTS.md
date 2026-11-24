# قبول مشاهدير v1 — نتائج التشغيل الحي

**SHA التنفيذ:** `5dc38be` (فرع `mira/creator-ads-v1`، طرف الوثائق `6802b5e`)  
**تشغيل:** `acc-1795550082532`  
**API/بوابة:** `http://127.0.0.1:3000` (خادم قبول معزول + بوابة static نفس الأصل)  
**قاعدة:** `mira_creator_ads_v1_test`

## نتيجة كل خطوة

| # | المطلب | النتيجة | الدليل |
|---|---|---|---|
| 1a | دخول مطوّر | **PASS** — login 201، type=developer | `STEPS_API.json` · بوابة `login.html` |
| 1b | تسجيل مشهور باسم/صورة مميزين | **PASS** — `فايز قبول acc-…` + avatar برتقالي | `STEPS_API.json` · `shots/02-…` · `avatars/` |
| 1c | ظهور في الدليل قبل أي إعلان | **PASS** — `developerVisible: true` قبل نشر الإعلانات | `STEPS_API.json` → `directoryBeforeAds` |
| 1d | خروج/دخول → ملف واحد + منتجات/خدمات | **PASS (API+بوابة)** — نفس profile id؛ `/me` يعيد منتج المطوّر وخدمة المطوّر؛ القائمة الجانبية تعرض منتجاتي/خدماتي/حساب المشهور | `STEPS_API.json` · لقطة القائمة |
| 2a | دائرة فوق «اكتشفي عالم ميرا» | **PASS (اختبار Flutter سابق)** | `../flutter-celebrities-verify.txt` |
| 2b | ٦ في صفين ثم ٧ بالتمرير + أسماء/صور مختلفة | **PASS (API+صور)** — page1=6، nextCursor، صفحة٢ تبدأ بالسابع؛ ٧ صور RGB مختلفة محفوظة | `STEPS_API.json` · `shots/03-directory-distinct-avatars.png` · `avatars/` |
| 2c | فتح السابع + حفظ موضع التمرير في التطبيق | **متعذّر على الجهاز في هذه الجلسة** — انظر «Flutter» أدناه؛ Layout widget test يغطي التمرير إلى السابع | `../` layout tests |
| 3a | إعلان منتج ٣ فيديوهات عبر مسار النشر | **PASS** — published، media=3 video؛ ظاهر في بوابة إعلاناتي | `STEPS_API.json` · `shots/04-portal-published-ads.png` |
| 3b | إعلان خدمة فيديو+١٠ صور | **PASS** — نُشر بـ 11 ثم بعد حذف صورة تجريبية بقي بث الفيديو سليمًا؛ البطاقة تعرض وسائط=10 | `STEPS_API.json` · بوابة |
| 3c | تشغيل الوسائط (بث) | **PASS (HTTP stream)** — `video/mp4` 200 لأول وسيط في الإعلانين | سجلات هذا الملف |
| 3d | فتح تفاصيل العرض الأصلي من التطبيق | **متعذّر (تطبيق)** — الهدف مربوط (`targetId` منتج/خدمة) في الـ API العام | `IDS.json` |
| 3e | حذف وسيط إعلان لا يمس وسائط التاجر | **PASS** — `merchantStill: true` | `STEPS_API.json` |
| 4 | تسجيل شاشة / لقطات | **جزئي** — لقطات بوابة + montage دليل + reel MP4 من اللقطات؛ لا تسجيل محاكي لتطبيق Flutter | `shots/` · `portal-acceptance-reel.mp4` |

## Flutter / المحاكي — سبب التعذّر

1. امتلاء القرص (`No space left on device`) أثناء تجميع dill.  
2. بعد تفريغ ~6GiB: `pod install` فشل على MiraRC2 (CocoaPods).  
لذلك **لم يُشغَّل التطبيق على المحاكي** لمشاهدة الوسائط داخل UI Flutter في هذه الجلسة.

ما يغطي الفجوة جزئيًا: اختبارات orbit/directory layout السابقة + دليل عام API بصور مختلفة + بث الوسائط HTTP 200.

## بيئة القبول المحلية

- خادم: `mira-api/src/marketplace/creator-ads.v1.acceptance-server.ts`  
- بيانات الدخول: انظر `CREDS.txt` (حساب اختبار محلي فقط)  
- إصلاح جانبي أثناء التشغيل: `orderBy: createdAt` لعروض الإعلان (Product/Service بلا `updatedAt`)

## إسناد البيع/الحجز

غير مشمول في v1 — `link_open` فقط.
