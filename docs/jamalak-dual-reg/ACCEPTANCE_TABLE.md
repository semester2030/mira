# جمالك — بوابة إغلاق محلي

**قرار الإغلاق:** `NOT_CLOSED` — إصلاحات الاعتماد/الحجز مُثبَّتة ومُختبَرة على API؛ رحلات الواجهة الثلاث (بوابة→Flutter) ما زالت مطلوبة للإغلاق.  
**لا نشر إنتاج.**  
**رمز الجوال مؤجّل — ليس مانع إغلاق.**

**worktree:** `/Users/fayez/Desktop/mira-wt/elegance-e1` → `/Users/fayez/Desktop/مراجع تطبيق ميرا /mira-wt/elegance-e1`  
**فرع:** `mira/elegance-e1-taxonomy-foundation`  
**test API:** `http://127.0.0.1:3011/api/v1`  
**تشغيل API لهذه الجولة:** بعد `npx nest build` + `node dist/main.js` مع `.env.jamalak-test` (PORT=3011)

| المانع | الإصلاح | الاختبار الفعلي | الدليل / runId | الحالة |
|--------|---------|-----------------|----------------|--------|
| OTP عند التسجيل | أُزيلت UI والرموز؛ رسالة قيد مراجعة الإدارة | `jamalak-dual-reg-journey` | `jamalak-2026-11-12T11-35-56-155Z-eb04d4` | **PASS** |
| اعتماد خاطئ من أول صف | decide بـ `requestId` الناتج عن التسجيل | dual-reg + admin-review + partial | `admin-review-2026-11-12T11-35-55-657Z-4a48` / `partial-mwdh23mh-f565` | **PASS** |
| تفعيل تلقائي / إعادة رمز تتبّع بالبريد | `PARTNER_AUTO_APPROVE` يُتجاهل؛ كل apply ينشئ طلبًا و`statusToken` جديدين | `jamalak-admin-review` (duplicate email) | `admin-review-2026-11-12T11-35-55-657Z-4a48` | **PASS** |
| موافقة جزئية / توسيع | اعتماد سطر واحد؛ expand معلّق؛ ACTIVITY_NOT_APPROVED | `jamalak-partial-expand` | `partial-mwdh23mh-f565` | **PASS** |
| تسريب جوال التسجيل | `publicContactPhone` على كتالوج/شريك/خدمة | partial + place | privacyPhone=null | **PASS** |
| فلتر مقر vs موقعك | تغطية جدة بلا فرع جدة؛ فرع الرياض | `jamalak-place-booking` | `place-2026-11-12T11-35-57-111Z-1e27` | **PASS** |
| حجز يحفظ فرع/زيارة + ناقص/فرع خاطئ/تداخل مقر→زيارة | أعمدة place*؛ PLACE_REQUIRED؛ BRANCH_NOT_FOR_SERVICE؛ overlap home بعد branch؛ ACTIVITY_NOT_APPROVED عند المنح | `jamalak-place-booking-create` | `pbk-mwdh1r2e-3d1e` | **PASS** |
| Flutter يرسل مكان الحجز | createBooking + شاشة الموعد | `booking_request_screen_test` | widget | **PASS (unit)** / E2E محاكي **NOT_VERIFIED** |
| إزالة alias lists من Flutter | `beauty_id_compat.dart` مرآة لـ API | `beauty_id_compat_test` | unit | **PASS (unit)** |
| فيديو عيادة → خدمات عربية | linkedServices؛ مسودة/أجنبي missing | `jamalak-clinic-video` | `clinic-vid-mwdh24cv-6ed7` | **PASS (API)** / Discover+احجزي **NOT_VERIFIED** |
| أيقونة صبغة/استشوار → offerId | عروض منشورة + subcategory leaf | `jamalak-color-blowdry-publish` | `cb-2026-11-12T11-35-57-945Z-28c3` | **PASS (API catalog)** / نشر محرّر+ضغط أيقونة **NOT_VERIFIED** |
| بوابة apply مستقلة/صالون/عيادة بلا OTP | Playwright على apply.html + decide + نشر صبغة/استشوار | `jamalak-ui-portal-journeys` | `ui-portal-mwdh9vyg-8a03` | **PASS (portal UI)** |
| 3 رحلات Flutter (حجز+أيقونات+فيديو) | محاكي على نفس API | — | — | **NOT_VERIFIED** |
| رمز الجوال | مؤجّل عمدًا | — | — | **ليس مانع** |

## أوامر إعادة الاختبار

```bash
cd "/Users/fayez/Desktop/mira-wt/elegance-e1/mira-api"
set -a && source .env.jamalak-test && set +a
npx nest build && PORT=3011 node dist/main.js &
export MIRA_API_BASE=http://127.0.0.1:3011/api/v1
npx tsx src/marketplace/taxonomy/jamalak-admin-review.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-dual-reg-journey.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-partial-expand.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-place-booking.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-place-booking-create.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-clinic-video.http.integration-tests.ts
npx tsx src/marketplace/taxonomy/jamalak-color-blowdry-publish.http.integration-tests.ts
```

## ما يلزم لإعلان CLOSED_VERIFIED_LOCAL

1. تشغيل بوابة الشركاء في المتصفح على نفس الخادم: تسجيل مستقلة + صالون + عيادة فيديو، مع لقطات.
2. Flutter (محاكي كافٍ) على نفس API: حجز المستقلة، حجز صالون مقر/زيارة، احجزي من فيديو عام/خاص.
3. نشر الصبغة/الاستشوار من محرّر الشريك ثم ضغط الأيقونات مع `subcategory` و`offerId` في الطلب/الحجز.
